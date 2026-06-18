import type { ProviderRegistration } from '../../core/providers/types';
import { CodexInlineEditService } from '../codex/auxiliary/CodexInlineEditService';
import { CodexInstructionRefineService } from '../codex/auxiliary/CodexInstructionRefineService';
import { CodexTaskResultInterpreter } from '../codex/auxiliary/CodexTaskResultInterpreter';
import { CodexTitleGenerationService } from '../codex/auxiliary/CodexTitleGenerationService';
import { CodexConversationHistoryService } from '../codex/history/CodexConversationHistoryService';
import { codexSubagentLifecycleAdapter } from '../codex/normalization/codexSubagentNormalization';
import { CodexChatRuntime } from '../codex/runtime/CodexChatRuntime';
import { CODEX_DEEPSEEK_PROVIDER_CAPABILITIES } from './capabilities';
import { codexDeepSeekSettingsReconciler } from './env/CodexDeepSeekSettingsReconciler';
import { getCodexDeepSeekProviderSettings } from './settings';
import {
  CODEX_DEEPSEEK_PROVIDER_ID,
  DEFAULT_CODEX_DEEPSEEK_MODEL,
} from './types/models';
import { codexDeepSeekChatUIConfig } from './ui/CodexDeepSeekChatUIConfig';

export const codexDeepSeekProviderRegistration: ProviderRegistration = {
  displayName: 'Codex DeepSeek',
  blankTabOrder: 16,
  isEnabled: settings => getCodexDeepSeekProviderSettings(settings).enabled,
  capabilities: CODEX_DEEPSEEK_PROVIDER_CAPABILITIES,
  environmentKeyPatterns: [/^DEEPSEEK_/i, /^CODEX_DEEPSEEK_/i],
  chatUIConfig: codexDeepSeekChatUIConfig,
  settingsReconciler: codexDeepSeekSettingsReconciler,
  createRuntime: ({ plugin }) => new CodexChatRuntime(plugin, {
    capabilities: CODEX_DEEPSEEK_PROVIDER_CAPABILITIES,
    defaultModel: DEFAULT_CODEX_DEEPSEEK_MODEL,
    getSafeMode: settings => getCodexDeepSeekProviderSettings(settings).safeMode,
    providerId: CODEX_DEEPSEEK_PROVIDER_ID,
    uiConfig: codexDeepSeekChatUIConfig,
  }),
  createTitleGenerationService: plugin => new CodexTitleGenerationService(plugin, {
    defaultModel: DEFAULT_CODEX_DEEPSEEK_MODEL,
    providerId: CODEX_DEEPSEEK_PROVIDER_ID,
    uiConfig: codexDeepSeekChatUIConfig,
  }),
  createInstructionRefineService: plugin => new CodexInstructionRefineService(
    plugin,
    CODEX_DEEPSEEK_PROVIDER_ID,
    DEFAULT_CODEX_DEEPSEEK_MODEL,
  ),
  createInlineEditService: plugin => new CodexInlineEditService(
    plugin,
    CODEX_DEEPSEEK_PROVIDER_ID,
    DEFAULT_CODEX_DEEPSEEK_MODEL,
  ),
  historyService: new CodexConversationHistoryService(),
  taskResultInterpreter: new CodexTaskResultInterpreter(),
  subagentLifecycleAdapter: codexSubagentLifecycleAdapter,
};
