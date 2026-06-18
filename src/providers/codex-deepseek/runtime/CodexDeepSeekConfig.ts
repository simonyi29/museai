import * as fs from 'fs';
import * as path from 'path';

import type ClaudianPlugin from '../../../main';
import { getVaultPath } from '../../../utils/path';
import { getCodexDeepSeekProviderSettings } from '../settings';

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function getCodexDeepSeekHome(plugin: ClaudianPlugin): string {
  const vaultPath = getVaultPath(plugin.app) ?? process.cwd();
  return path.join(vaultPath, '.museai', 'codex-deepseek');
}

export function writeCodexDeepSeekConfig(plugin: ClaudianPlugin): string {
  const settings = getCodexDeepSeekProviderSettings(plugin.settings);
  const codexHome = getCodexDeepSeekHome(plugin);
  fs.mkdirSync(codexHome, { recursive: true });

  const configPath = path.join(codexHome, 'config.toml');
  const config = [
    'model_provider = "deepseek"',
    `model = "${escapeTomlString(settings.model)}"`,
    '',
    '[model_providers.deepseek]',
    'name = "DeepSeek"',
    `base_url = "${escapeTomlString(settings.baseUrl)}"`,
    `env_key = "${escapeTomlString(settings.envKey)}"`,
    `wire_api = "${escapeTomlString(settings.wireApi)}"`,
    '',
  ].join('\n');

  fs.writeFileSync(configPath, config, 'utf8');
  return codexHome;
}

export function applyCodexDeepSeekEnvironment(
  plugin: ClaudianPlugin,
  env: Record<string, string>,
): Record<string, string> {
  const settings = getCodexDeepSeekProviderSettings(plugin.settings);
  const codexHome = writeCodexDeepSeekConfig(plugin);
  const envKey = settings.envKey.trim();

  if (!envKey || !env[envKey]) {
    throw new Error(`Codex DeepSeek requires ${envKey || 'DEEPSEEK_API_KEY'} in environment variables.`);
  }

  return {
    ...env,
    CODEX_HOME: codexHome,
    CODEX_DEEPSEEK_HOME: codexHome,
  };
}
