import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { ProviderId } from '../../../core/providers/types';
import type ClaudianPlugin from '../../../main';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { getVaultPath } from '../../../utils/path';
import { applyCodexDeepSeekEnvironment } from '../../codex-deepseek/runtime/CodexDeepSeekConfig';
import { CODEX_DEEPSEEK_PROVIDER_ID } from '../../codex-deepseek/types/models';
import type { InitializeResult } from './codexAppServerTypes';
import { buildCodexLaunchSpec } from './CodexLaunchSpecBuilder';
import type { CodexLaunchSpec } from './codexLaunchTypes';
import type { CodexRpcTransport } from './CodexRpcTransport';

const CODEX_APP_SERVER_CLIENT_INFO = Object.freeze({
  name: 'museai',
  version: '1.0.0',
});

function getCodexConfigPath(env: Record<string, string | undefined>): string {
  const codexHome = env.CODEX_HOME?.trim() || path.join(os.homedir(), '.codex');
  return path.join(codexHome, 'config.toml');
}

export function normalizeLegacyCodexConfigServiceTier(
  env: Record<string, string | undefined> = process.env,
): void {
  const configPath = getCodexConfigPath(env);

  try {
    if (!fs.existsSync(configPath)) {
      return;
    }

    const original = fs.readFileSync(configPath, 'utf8');
    const next = original.replace(
      /^(\s*service_tier\s*=\s*)(["'])default\2(\s*(?:#.*)?)$/gm,
      (_match, prefix: string, _quote: string, suffix: string) => `${prefix}"flex"${suffix}`,
    );

    if (next !== original) {
      fs.writeFileSync(configPath, next, 'utf8');
    }
  } catch {
    // Best effort: an unreadable Codex config should not prevent MuseAI from
    // showing the original Codex startup error.
  }
}

export function getCodexAppServerWorkingDirectory(plugin: ClaudianPlugin): string {
  return getVaultPath(plugin.app) ?? process.cwd();
}

export function buildCodexAppServerEnvironment(
  plugin: ClaudianPlugin,
  providerId: ProviderId = 'codex',
): Record<string, string> {
  const customEnv = parseEnvironmentVariables(plugin.getActiveEnvironmentVariables(providerId));
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  const enhancedPath = getEnhancedPath(customEnv.PATH);

  let env: Record<string, string> = {
    ...baseEnv,
    ...customEnv,
    PATH: enhancedPath,
  };

  if (providerId === CODEX_DEEPSEEK_PROVIDER_ID) {
    env = applyCodexDeepSeekEnvironment(plugin, env);
  }

  normalizeLegacyCodexConfigServiceTier(env);

  return env;
}

export function resolveCodexAppServerLaunchSpec(
  plugin: ClaudianPlugin,
  providerId: ProviderId = 'codex',
): CodexLaunchSpec {
  return buildCodexLaunchSpec({
    settings: plugin.settings,
    resolvedCliCommand: plugin.getResolvedProviderCliPath(providerId),
    hostVaultPath: getCodexAppServerWorkingDirectory(plugin),
    env: buildCodexAppServerEnvironment(plugin, providerId),
  });
}

export async function initializeCodexAppServerTransport(
  transport: CodexRpcTransport,
): Promise<InitializeResult> {
  const result = await transport.request<InitializeResult>('initialize', {
    clientInfo: CODEX_APP_SERVER_CLIENT_INFO,
    capabilities: { experimentalApi: true },
  });

  transport.notify('initialized');
  return result;
}
