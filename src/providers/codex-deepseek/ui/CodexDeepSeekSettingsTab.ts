import * as fs from 'fs';
import { Setting } from 'obsidian';

import type { ProviderSettingsTabRenderer } from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import {
  getCodexDeepSeekProviderSettings,
  updateCodexDeepSeekProviderSettings,
} from '../settings';
import { CODEX_DEEPSEEK_PROVIDER_ID } from '../types/models';

function validateCliPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const expandedPath = expandHomePath(trimmed);
  if (!fs.existsSync(expandedPath)) return 'Path does not exist';
  if (!fs.statSync(expandedPath).isFile()) return 'Path must point to a file';
  return null;
}

export const codexDeepSeekSettingsTabRenderer: ProviderSettingsTabRenderer = {
  render(container, context): void {
    const settingsBag = context.plugin.settings;
    const providerSettings = getCodexDeepSeekProviderSettings(settingsBag);
    const hostnameKey = getHostnameKey();

    new Setting(container)
      .setName('Codex DeepSeek')
      .setHeading();

    new Setting(container)
      .setName('Enable')
      .setDesc('Unavailable for direct use: current Codex custom providers require Responses API, while DeepSeek exposes Chat Completions. Use OpenCode DeepSeek instead.')
      .addToggle(toggle => toggle
        .setValue(false)
        .setDisabled(true)
        .onChange(async (_value) => {
          updateCodexDeepSeekProviderSettings(settingsBag, { enabled: false });
          await context.plugin.saveSettings();
          context.refreshModelSelectors();
        }));

    const cliPathsByHost = { ...providerSettings.cliPathsByHost };
    const currentCliPath = providerSettings.cliPathsByHost[hostnameKey] || '';
    const validationEl = container.createDiv({
      cls: 'claudian-cli-path-validation claudian-setting-validation claudian-setting-validation-error claudian-hidden',
    });
    let cliPathInputEl: HTMLInputElement | null = null;

    const persistCliPath = async (value: string): Promise<void> => {
      const error = validateCliPath(value);
      if (error) {
        validationEl.setText(error);
        validationEl.toggleClass('claudian-hidden', false);
        cliPathInputEl?.toggleClass('claudian-input-error', true);
        return;
      }

      validationEl.toggleClass('claudian-hidden', true);
      cliPathInputEl?.toggleClass('claudian-input-error', false);

      const trimmed = value.trim();
      if (trimmed) {
        cliPathsByHost[hostnameKey] = trimmed;
      } else {
        delete cliPathsByHost[hostnameKey];
      }

      updateCodexDeepSeekProviderSettings(settingsBag, { cliPathsByHost: { ...cliPathsByHost } });
      await context.plugin.saveSettings();
    };

    new Setting(container)
      .setName('CLI path')
      .setDesc('Optional Codex CLI path for this provider. Leave empty to use normal Codex CLI discovery.')
      .addText(text => {
        text
          .setPlaceholder(process.platform === 'win32'
            ? 'C:\\Users\\you\\AppData\\Local\\OpenAI\\Codex\\bin\\codex.exe'
            : '/usr/local/bin/codex')
          .setValue(currentCliPath)
          .onChange(value => {
            void persistCliPath(value);
          });
        cliPathInputEl = text.inputEl;
      });

    new Setting(container)
      .setName('Safe mode')
      .setDesc('Sandbox mode used when the toolbar is in Safe mode.')
      .addDropdown(dropdown => dropdown
        .addOption('workspace-write', 'Workspace write')
        .addOption('read-only', 'Read only')
        .setValue(providerSettings.safeMode)
        .onChange(async (value) => {
          updateCodexDeepSeekProviderSettings(settingsBag, {
            safeMode: value === 'read-only' ? 'read-only' : 'workspace-write',
          });
          await context.plugin.saveSettings();
        }));

    new Setting(container)
      .setName('DeepSeek Provider')
      .setHeading();

    new Setting(container)
      .setName('Model')
      .setDesc('Model passed to Codex through the isolated DeepSeek provider.')
      .addText(text => text
        .setPlaceholder('deepseek/deepseek-chat')
        .setValue(providerSettings.model)
        .onChange(async (value) => {
          updateCodexDeepSeekProviderSettings(settingsBag, { model: value });
          await context.plugin.saveSettings();
          context.refreshModelSelectors();
        }));

    new Setting(container)
      .setName('Base URL')
      .setDesc('DeepSeek API base URL written to the private Codex config.')
      .addText(text => text
        .setPlaceholder('https://api.deepseek.com')
        .setValue(providerSettings.baseUrl)
        .onChange(async (value) => {
          updateCodexDeepSeekProviderSettings(settingsBag, { baseUrl: value });
          await context.plugin.saveSettings();
        }));

    new Setting(container)
      .setName('API key env')
      .setDesc('Environment variable name Codex uses for the DeepSeek API key.')
      .addText(text => text
        .setPlaceholder('DEEPSEEK_API_KEY')
        .setValue(providerSettings.envKey)
        .onChange(async (value) => {
          updateCodexDeepSeekProviderSettings(settingsBag, { envKey: value });
          await context.plugin.saveSettings();
        }));

    new Setting(container)
      .setName('Wire API')
      .setDesc('Codex currently accepts responses here. DeepSeek direct mode is disabled because the DeepSeek endpoint does not expose Responses API.')
      .addText(text => text
        .setPlaceholder('responses')
        .setValue(providerSettings.wireApi)
        .onChange(async (value) => {
          updateCodexDeepSeekProviderSettings(settingsBag, { wireApi: value });
          await context.plugin.saveSettings();
        }));

    renderEnvironmentSettingsSection({
      container,
      plugin: context.plugin,
      scope: `provider:${CODEX_DEEPSEEK_PROVIDER_ID}`,
      heading: 'Environment',
      name: 'Environment Variables',
      desc: 'Extra variables passed only to Codex DeepSeek. Add DEEPSEEK_API_KEY here or in your system environment.',
      placeholder: 'DEEPSEEK_API_KEY=sk-...',
      renderCustomContextLimits: target => context.renderCustomContextLimits(target, CODEX_DEEPSEEK_PROVIDER_ID),
    });
  },
};
