import type { ProviderUIOption } from '../../../core/providers/types';

export const CODEX_DEEPSEEK_PROVIDER_ID = 'codex-deepseek';
export const DEFAULT_CODEX_DEEPSEEK_MODEL = 'deepseek/deepseek-chat';
export const CODEX_DEEPSEEK_MODEL_GROUP = 'Codex DeepSeek';

export const DEFAULT_CODEX_DEEPSEEK_MODELS: ProviderUIOption[] = [
  {
    value: DEFAULT_CODEX_DEEPSEEK_MODEL,
    label: 'DeepSeek Chat',
    description: 'Codex custom provider route',
    group: CODEX_DEEPSEEK_MODEL_GROUP,
  },
];

export const DEFAULT_CODEX_DEEPSEEK_MODEL_SET = new Set(
  DEFAULT_CODEX_DEEPSEEK_MODELS.map(model => model.value),
);

export function isDeepSeekModelId(model: string): boolean {
  const trimmed = model.trim();
  return /^deepseek\//i.test(trimmed) || /^deepseek-/i.test(trimmed);
}
