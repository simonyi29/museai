import { getProviderConfig, setProviderConfig } from '../../core/providers/providerConfig';
import { getProviderEnvironmentVariables } from '../../core/providers/providerEnvironment';
import type { HostnameCliPaths } from '../../core/types/settings';
import {
  getHostnameKey,
  getLegacyHostnameKey,
  migrateLegacyHostnameKeyedMap,
} from '../../utils/env';
import {
  CODEX_DEEPSEEK_PROVIDER_ID,
  DEFAULT_CODEX_DEEPSEEK_MODEL,
} from './types/models';

export type CodexDeepSeekSafeMode = 'workspace-write' | 'read-only';

export interface CodexDeepSeekProviderSettings {
  enabled: boolean;
  safeMode: CodexDeepSeekSafeMode;
  cliPath: string;
  cliPathsByHost: HostnameCliPaths;
  model: string;
  baseUrl: string;
  envKey: string;
  wireApi: string;
  environmentVariables: string;
  environmentHash: string;
}

export const DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS: Readonly<CodexDeepSeekProviderSettings> = Object.freeze({
  enabled: false,
  safeMode: 'workspace-write',
  cliPath: '',
  cliPathsByHost: {},
  model: DEFAULT_CODEX_DEEPSEEK_MODEL,
  baseUrl: 'https://api.deepseek.com',
  envKey: 'DEEPSEEK_API_KEY',
  wireApi: 'chat',
  environmentVariables: '',
  environmentHash: '',
});

function normalizeHostnameCliPaths(value: unknown): HostnameCliPaths {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: HostnameCliPaths = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.trim()) {
      result[key] = entry.trim();
    }
  }
  return result;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeSafeMode(value: unknown): CodexDeepSeekSafeMode {
  return value === 'read-only' ? 'read-only' : 'workspace-write';
}

export function getCodexDeepSeekProviderSettings(
  settings: Record<string, unknown>,
): CodexDeepSeekProviderSettings {
  const config = getProviderConfig(settings, CODEX_DEEPSEEK_PROVIDER_ID);
  const normalizedCliPathsByHost = normalizeHostnameCliPaths(config.cliPathsByHost);
  const cliPathsByHost = Object.keys(normalizedCliPathsByHost).length > 0
    ? migrateLegacyHostnameKeyedMap(
      normalizedCliPathsByHost,
      getHostnameKey(),
      getLegacyHostnameKey(),
    )
    : normalizedCliPathsByHost;

  return {
    enabled: (config.enabled as boolean | undefined)
      ?? DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.enabled,
    safeMode: normalizeSafeMode(config.safeMode),
    cliPath: (config.cliPath as string | undefined)
      ?? DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.cliPath,
    cliPathsByHost,
    model: normalizeString(config.model, DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.model),
    baseUrl: normalizeString(config.baseUrl, DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.baseUrl),
    envKey: normalizeString(config.envKey, DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.envKey),
    wireApi: normalizeString(config.wireApi, DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.wireApi),
    environmentVariables: (config.environmentVariables as string | undefined)
      ?? getProviderEnvironmentVariables(settings, CODEX_DEEPSEEK_PROVIDER_ID)
      ?? DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.environmentVariables,
    environmentHash: (config.environmentHash as string | undefined)
      ?? DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.environmentHash,
  };
}

export function updateCodexDeepSeekProviderSettings(
  settings: Record<string, unknown>,
  updates: Partial<CodexDeepSeekProviderSettings>,
): CodexDeepSeekProviderSettings {
  const current = getCodexDeepSeekProviderSettings(settings);
  const hostnameKey = getHostnameKey();
  const cliPathsByHost = 'cliPathsByHost' in updates
    ? normalizeHostnameCliPaths(updates.cliPathsByHost)
    : { ...current.cliPathsByHost };
  let cliPath = 'cliPathsByHost' in updates
    ? (
      typeof updates.cliPath === 'string'
        ? updates.cliPath.trim()
        : DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.cliPath
    )
    : current.cliPath.trim();

  if ('cliPath' in updates && !('cliPathsByHost' in updates)) {
    const trimmedCliPath = typeof updates.cliPath === 'string' ? updates.cliPath.trim() : '';
    if (trimmedCliPath) {
      cliPathsByHost[hostnameKey] = trimmedCliPath;
    } else {
      delete cliPathsByHost[hostnameKey];
    }
    cliPath = DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.cliPath;
  }

  const next: CodexDeepSeekProviderSettings = {
    ...current,
    ...updates,
    cliPath,
    cliPathsByHost,
    safeMode: normalizeSafeMode(updates.safeMode ?? current.safeMode),
    model: normalizeString(updates.model ?? current.model, DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.model),
    baseUrl: normalizeString(updates.baseUrl ?? current.baseUrl, DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.baseUrl),
    envKey: normalizeString(updates.envKey ?? current.envKey, DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.envKey),
    wireApi: normalizeString(updates.wireApi ?? current.wireApi, DEFAULT_CODEX_DEEPSEEK_PROVIDER_SETTINGS.wireApi),
  };

  setProviderConfig(settings, CODEX_DEEPSEEK_PROVIDER_ID, {
    enabled: next.enabled,
    safeMode: next.safeMode,
    cliPath: next.cliPath,
    cliPathsByHost: next.cliPathsByHost,
    model: next.model,
    baseUrl: next.baseUrl,
    envKey: next.envKey,
    wireApi: next.wireApi,
    environmentVariables: next.environmentVariables,
    environmentHash: next.environmentHash,
  });

  return next;
}
