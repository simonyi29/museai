import { DEFAULT_CODEX_DEEPSEEK_MODEL } from '@/providers/codex-deepseek/types/models';
import { codexDeepSeekChatUIConfig } from '@/providers/codex-deepseek/ui/CodexDeepSeekChatUIConfig';

describe('CodexDeepSeekChatUIConfig', () => {
  it('returns the configured DeepSeek model option', () => {
    const options = codexDeepSeekChatUIConfig.getModelOptions({
      providerConfigs: {
        'codex-deepseek': {
          model: 'deepseek/deepseek-reasoner',
        },
      },
    });

    expect(options.map(option => option.value)).toEqual([
      DEFAULT_CODEX_DEEPSEEK_MODEL,
      'deepseek/deepseek-reasoner',
    ]);
    expect(options[0]).toMatchObject({
      group: 'Codex DeepSeek',
      label: 'DeepSeek Chat',
    });
  });

  it('owns DeepSeek model identifiers only', () => {
    expect(codexDeepSeekChatUIConfig.ownsModel('deepseek/deepseek-chat', {})).toBe(true);
    expect(codexDeepSeekChatUIConfig.ownsModel('deepseek-chat', {})).toBe(true);
    expect(codexDeepSeekChatUIConfig.ownsModel('gpt-5.5', {})).toBe(false);
  });

  it('applies model defaults to the provider-specific model field', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        'codex-deepseek': {
          model: DEFAULT_CODEX_DEEPSEEK_MODEL,
        },
      },
    };

    codexDeepSeekChatUIConfig.applyModelDefaults('deepseek/deepseek-reasoner', settings);

    expect(settings).toMatchObject({
      model: 'deepseek/deepseek-reasoner',
      effortLevel: 'medium',
      providerConfigs: {
        'codex-deepseek': {
          model: 'deepseek/deepseek-reasoner',
        },
      },
    });
  });
});
