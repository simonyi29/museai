import type {
  ProviderChatUIConfig,
  ProviderPermissionModeToggleConfig,
  ProviderReasoningOption,
  ProviderUIOption,
} from '../../../core/providers/types';
import { OPENAI_PROVIDER_ICON } from '../../../shared/icons';
import { getCodexDeepSeekProviderSettings, updateCodexDeepSeekProviderSettings } from '../settings';
import {
  CODEX_DEEPSEEK_MODEL_GROUP,
  DEFAULT_CODEX_DEEPSEEK_MODEL,
  DEFAULT_CODEX_DEEPSEEK_MODEL_SET,
  DEFAULT_CODEX_DEEPSEEK_MODELS,
  isDeepSeekModelId,
} from '../types/models';

const EFFORT_LEVELS: ProviderReasoningOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'XHigh' },
];

const CODEX_DEEPSEEK_PERMISSION_MODE_TOGGLE: ProviderPermissionModeToggleConfig = {
  inactiveValue: 'normal',
  inactiveLabel: 'Safe',
  activeValue: 'yolo',
  activeLabel: 'YOLO',
  planValue: 'plan',
  planLabel: 'Plan',
};

const DEFAULT_CONTEXT_WINDOW = 128_000;

function getCodexDeepSeekModelOptions(settings: Record<string, unknown>): ProviderUIOption[] {
  const providerSettings = getCodexDeepSeekProviderSettings(settings);
  const configuredModel = providerSettings.model.trim() || DEFAULT_CODEX_DEEPSEEK_MODEL;
  const options = [...DEFAULT_CODEX_DEEPSEEK_MODELS];

  if (!options.some(option => option.value === configuredModel)) {
    options.push({
      value: configuredModel,
      label: configuredModel,
      description: 'Configured Codex DeepSeek model',
      group: CODEX_DEEPSEEK_MODEL_GROUP,
    });
  }

  return options;
}

export const codexDeepSeekChatUIConfig: ProviderChatUIConfig = {
  getModelOptions(settings: Record<string, unknown>): ProviderUIOption[] {
    return getCodexDeepSeekModelOptions(settings);
  },

  ownsModel(model: string): boolean {
    return isDeepSeekModelId(model);
  },

  isAdaptiveReasoningModel(): boolean {
    return true;
  },

  getReasoningOptions(): ProviderReasoningOption[] {
    return [...EFFORT_LEVELS];
  },

  getDefaultReasoningValue(): string {
    return 'medium';
  },

  getContextWindowSize(): number {
    return DEFAULT_CONTEXT_WINDOW;
  },

  isDefaultModel(model: string): boolean {
    return DEFAULT_CODEX_DEEPSEEK_MODEL_SET.has(model);
  },

  applyModelDefaults(model: string, settings: unknown): void {
    if (!settings || typeof settings !== 'object' || !isDeepSeekModelId(model)) {
      return;
    }

    const settingsBag = settings as Record<string, unknown>;
    settingsBag.model = model;
    settingsBag.effortLevel = 'medium';
    updateCodexDeepSeekProviderSettings(settingsBag, { model });
  },

  normalizeModelVariant(model: string, settings: Record<string, unknown>): string {
    if (getCodexDeepSeekModelOptions(settings).some(option => option.value === model)) {
      return model;
    }
    return DEFAULT_CODEX_DEEPSEEK_MODEL;
  },

  getCustomModelIds(): Set<string> {
    return new Set<string>();
  },

  getPermissionModeToggle(): ProviderPermissionModeToggleConfig {
    return CODEX_DEEPSEEK_PERMISSION_MODE_TOGGLE;
  },

  getProviderIcon() {
    return OPENAI_PROVIDER_ICON;
  },
};
