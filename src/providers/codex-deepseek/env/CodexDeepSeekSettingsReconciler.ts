import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type { ProviderSettingsReconciler } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import { parseEnvironmentVariables } from '../../../utils/env';
import {
  getCodexDeepSeekProviderSettings,
  updateCodexDeepSeekProviderSettings,
} from '../settings';
import {
  CODEX_DEEPSEEK_PROVIDER_ID,
  DEFAULT_CODEX_DEEPSEEK_MODEL,
} from '../types/models';
import { codexDeepSeekChatUIConfig } from '../ui/CodexDeepSeekChatUIConfig';

function computeCodexDeepSeekEnvHash(
  envText: string,
  settings: Record<string, unknown>,
): string {
  const providerSettings = getCodexDeepSeekProviderSettings(settings);
  const envVars = parseEnvironmentVariables(envText || '');
  const envKey = providerSettings.envKey.trim();

  return [
    `baseUrl=${providerSettings.baseUrl}`,
    `envKey=${envKey}`,
    `model=${providerSettings.model}`,
    `wireApi=${providerSettings.wireApi}`,
    envKey && envVars[envKey] ? `${envKey}=${envVars[envKey]}` : '',
  ].filter(Boolean).sort().join('|');
}

export const codexDeepSeekSettingsReconciler: ProviderSettingsReconciler = {
  reconcileModelWithEnvironment(
    settings: Record<string, unknown>,
    conversations: Conversation[],
  ): { changed: boolean; invalidatedConversations: Conversation[] } {
    const providerSettings = getCodexDeepSeekProviderSettings(settings);
    const envText = getRuntimeEnvironmentText(settings, CODEX_DEEPSEEK_PROVIDER_ID);
    const currentHash = computeCodexDeepSeekEnvHash(envText, settings);

    if (!providerSettings.enabled && !providerSettings.environmentHash) {
      return { changed: false, invalidatedConversations: [] };
    }

    if (currentHash === providerSettings.environmentHash) {
      return { changed: false, invalidatedConversations: [] };
    }

    const invalidatedConversations: Conversation[] = [];
    for (const conversation of conversations) {
      if (conversation.providerId === CODEX_DEEPSEEK_PROVIDER_ID && conversation.sessionId) {
        conversation.sessionId = null;
        conversation.providerState = undefined;
        invalidatedConversations.push(conversation);
      }
    }

    if (!codexDeepSeekChatUIConfig.ownsModel(String(settings.model ?? ''), settings)) {
      settings.model = DEFAULT_CODEX_DEEPSEEK_MODEL;
    }

    updateCodexDeepSeekProviderSettings(settings, { environmentHash: currentHash });
    return { changed: true, invalidatedConversations };
  },

  normalizeModelVariantSettings(settings: Record<string, unknown>): boolean {
    const model = settings.model;
    if (typeof model !== 'string' || !model) {
      return false;
    }

    const normalizedModel = codexDeepSeekChatUIConfig.normalizeModelVariant(model, settings);
    if (normalizedModel === model) {
      return false;
    }

    settings.model = normalizedModel;
    return true;
  },
};
