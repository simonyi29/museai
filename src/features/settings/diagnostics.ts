import * as fs from 'fs';
import { Notice, Setting } from 'obsidian';
import * as os from 'os';
import * as path from 'path';

import { ProviderRegistry } from '../../core/providers/ProviderRegistry';
import { ProviderWorkspaceRegistry } from '../../core/providers/ProviderWorkspaceRegistry';
import type { ClaudianSettings } from '../../core/types/settings';
import type ClaudianPlugin from '../../main';
import {
  getCodexProviderSettings,
  updateCodexProviderSettings,
} from '../../providers/codex/settings';
import {
  getCodexDeepSeekProviderSettings,
  updateCodexDeepSeekProviderSettings,
} from '../../providers/codex-deepseek/settings';
import {
  CODEX_DEEPSEEK_PROVIDER_ID,
  DEFAULT_CODEX_DEEPSEEK_MODEL,
} from '../../providers/codex-deepseek/types/models';
import {
  getOpencodeProviderSettings,
  updateOpencodeProviderSettings,
} from '../../providers/opencode/settings';

type DiagnosticSeverity = 'ok' | 'warning' | 'error';

export interface DiagnosticItem {
  message: string;
  severity: DiagnosticSeverity;
}

export interface DiagnosticsResult {
  items: DiagnosticItem[];
  repairableCount: number;
}

const OPENCODE_DEEPSEEK_FALLBACK_MODEL = 'opencode:deepseek/deepseek-v4-flash';

function addItem(items: DiagnosticItem[], severity: DiagnosticSeverity, message: string): void {
  items.push({ message, severity });
}

function getCodexConfigPath(): string {
  const codexHome = process.env.CODEX_HOME?.trim() || path.join(os.homedir(), '.codex');
  return path.join(codexHome, 'config.toml');
}

function getCodexDeepSeekConfigPath(plugin: ClaudianPlugin): string {
  const adapter = plugin.app.vault.adapter as { basePath?: string };
  const vaultPath = typeof adapter.basePath === 'string' && adapter.basePath
    ? adapter.basePath
    : process.cwd();
  return path.join(vaultPath, '.museai', 'codex-deepseek', 'config.toml');
}

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  } catch {
    return null;
  }
}

function hasBadCodexServiceTier(configText: string | null): boolean {
  if (!configText) {
    return false;
  }
  return /^\s*service_tier\s*=\s*"(default|flex)"\s*$/m.test(configText);
}

function removeCodexServiceTier(configText: string): string {
  return configText
    .split(/\r?\n/)
    .filter(line => !/^\s*service_tier\s*=\s*"(default|flex)"\s*$/.test(line))
    .join('\n');
}

function patchWireApiToResponses(configText: string): string {
  if (/^\s*wire_api\s*=/m.test(configText)) {
    return configText.replace(/^\s*wire_api\s*=\s*"[^"]*"\s*$/m, 'wire_api = "responses"');
  }
  return `${configText.trimEnd()}\nwire_api = "responses"\n`;
}

function shouldMoveToOpencodeDeepSeek(settings: ClaudianSettings): boolean {
  return settings.settingsProvider === CODEX_DEEPSEEK_PROVIDER_ID
    || settings.model === DEFAULT_CODEX_DEEPSEEK_MODEL
    || settings.savedProviderModel?.[CODEX_DEEPSEEK_PROVIDER_ID] === DEFAULT_CODEX_DEEPSEEK_MODEL;
}

export function runMuseAIDiagnostics(plugin: ClaudianPlugin): DiagnosticsResult {
  const items: DiagnosticItem[] = [];
  const settings = plugin.settings;
  let repairableCount = 0;

  const activeProvider = settings.settingsProvider || 'claude';
  const activeModel = settings.model || '(unset)';
  addItem(items, 'ok', `Current route: ${activeProvider} / ${activeModel}`);

  for (const providerId of ProviderRegistry.getRegisteredProviderIds()) {
    const enabled = ProviderRegistry.isEnabled(providerId, settings);
    const services = ProviderWorkspaceRegistry.getServices(providerId);
    const status = enabled ? 'enabled' : 'disabled';
    addItem(
      items,
      services || !enabled ? 'ok' : 'warning',
      `${ProviderRegistry.getProviderDisplayName(providerId)} is ${status}${services ? '' : '; workspace services are not initialized'}.`,
    );
  }

  const codexDeepSeek = getCodexDeepSeekProviderSettings(settings);
  if (codexDeepSeek.enabled || codexDeepSeek.wireApi !== 'responses' || shouldMoveToOpencodeDeepSeek(settings)) {
    addItem(
      items,
      'error',
      'Codex DeepSeek direct mode is unsafe here: Codex custom providers require Responses API, but DeepSeek direct API does not expose /responses.',
    );
    repairableCount += 1;
  }

  const opencode = getOpencodeProviderSettings(settings);
  if (!opencode.enabled && shouldMoveToOpencodeDeepSeek(settings)) {
    addItem(items, 'warning', 'OpenCode is disabled while the current model needs OpenCode DeepSeek.');
    repairableCount += 1;
  }

  const codexConfig = readFileIfExists(getCodexConfigPath());
  if (hasBadCodexServiceTier(codexConfig)) {
    addItem(items, 'error', 'Codex config contains service_tier = "default" or "flex"; this can break Codex app-server startup.');
    repairableCount += 1;
  } else {
    addItem(items, 'ok', 'Codex global config has no known bad service_tier line.');
  }

  const codexDeepSeekConfig = readFileIfExists(getCodexDeepSeekConfigPath(plugin));
  if (codexDeepSeekConfig && /wire_api\s*=\s*"chat"/.test(codexDeepSeekConfig)) {
    addItem(items, 'error', 'Private Codex DeepSeek config still uses wire_api = "chat", which current Codex rejects.');
    repairableCount += 1;
  }

  for (const providerId of ProviderRegistry.getRegisteredProviderIds()) {
    const resolver = ProviderWorkspaceRegistry.getCliResolver(providerId);
    if (!resolver || !ProviderRegistry.isEnabled(providerId, settings)) {
      continue;
    }
    const resolvedPath = resolver.resolveFromSettings(settings);
    addItem(
      items,
      resolvedPath ? 'ok' : 'warning',
      `${ProviderRegistry.getProviderDisplayName(providerId)} CLI ${resolvedPath ? `resolved: ${resolvedPath}` : 'was not found from current settings/PATH'}.`,
    );
  }

  return { items, repairableCount };
}

export async function repairMuseAIDiagnostics(plugin: ClaudianPlugin): Promise<number> {
  const settings = plugin.settings;
  let repairs = 0;

  const codexDeepSeek = getCodexDeepSeekProviderSettings(settings);
  if (codexDeepSeek.enabled || codexDeepSeek.wireApi !== 'responses') {
    updateCodexDeepSeekProviderSettings(settings, {
      enabled: false,
      wireApi: 'responses',
    });
    repairs += 1;
  }

  if (shouldMoveToOpencodeDeepSeek(settings)) {
    const opencode = getOpencodeProviderSettings(settings);
    const opencodeModel = settings.savedProviderModel?.opencode || OPENCODE_DEEPSEEK_FALLBACK_MODEL;
    updateOpencodeProviderSettings(settings, {
      ...opencode,
      enabled: true,
    });
    settings.settingsProvider = 'opencode';
    settings.model = opencodeModel;
    settings.savedProviderModel = {
      ...settings.savedProviderModel,
      opencode: opencodeModel,
    };
    repairs += 1;
  }

  const codexSettings = getCodexProviderSettings(settings);
  if (codexSettings.enabled) {
    updateCodexProviderSettings(settings, codexSettings);
  }

  const codexConfigPath = getCodexConfigPath();
  const codexConfig = readFileIfExists(codexConfigPath);
  if (codexConfig && hasBadCodexServiceTier(codexConfig)) {
    fs.writeFileSync(codexConfigPath, removeCodexServiceTier(codexConfig), 'utf8');
    repairs += 1;
  }

  const codexDeepSeekConfigPath = getCodexDeepSeekConfigPath(plugin);
  const codexDeepSeekConfig = readFileIfExists(codexDeepSeekConfigPath);
  if (codexDeepSeekConfig && /wire_api\s*=\s*"chat"/.test(codexDeepSeekConfig)) {
    fs.writeFileSync(codexDeepSeekConfigPath, patchWireApiToResponses(codexDeepSeekConfig), 'utf8');
    repairs += 1;
  }

  if (repairs > 0) {
    await plugin.saveSettings();
    for (const view of plugin.getAllViews()) {
      view.refreshModelSelector();
    }
  }

  return repairs;
}

function renderDiagnosticItem(container: HTMLElement, item: DiagnosticItem): void {
  const row = container.createDiv({ cls: `museai-diagnostic-item museai-diagnostic-item--${item.severity}` });
  row.createSpan({ cls: 'museai-diagnostic-status', text: item.severity.toUpperCase() });
  row.createSpan({ cls: 'museai-diagnostic-message', text: item.message });
}

export function renderDiagnosticsSettingsTab(container: HTMLElement, plugin: ClaudianPlugin): void {
  container.empty();

  new Setting(container)
    .setName('MuseAI diagnostics')
    .setDesc('Check local provider routing, CLI discovery, and common Codex/OpenCode configuration problems.')
    .setHeading();

  const resultsEl = container.createDiv({ cls: 'museai-diagnostics-results' });

  const renderResults = (): DiagnosticsResult => {
    resultsEl.empty();
    const result = runMuseAIDiagnostics(plugin);
    for (const item of result.items) {
      renderDiagnosticItem(resultsEl, item);
    }
    return result;
  };

  renderResults();

  new Setting(container)
    .setName('Run checks')
    .setDesc('Refresh diagnostics without changing settings.')
    .addButton(button => button
      .setButtonText('Check now')
      .onClick(() => {
        const result = renderResults();
        new Notice(`MuseAI diagnostics: ${result.items.length} checks complete.`);
      }));

  new Setting(container)
    .setName('Repair known issues')
    .setDesc('Disable unsupported Codex DeepSeek direct mode, move DeepSeek back to OpenCode, and remove known bad Codex service_tier lines.')
    .addButton(button => button
      .setButtonText('Repair')
      .setCta()
      .onClick(async () => {
        const repairs = await repairMuseAIDiagnostics(plugin);
        renderResults();
        new Notice(repairs > 0
          ? `MuseAI repaired ${repairs} issue${repairs === 1 ? '' : 's'}.`
          : 'MuseAI diagnostics found nothing to repair.');
      }));
}
