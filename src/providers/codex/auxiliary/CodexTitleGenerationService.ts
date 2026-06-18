import { QueryBackedTitleGenerationService } from '../../../core/auxiliary/QueryBackedTitleGenerationService';
import type { ProviderChatUIConfig, ProviderId } from '../../../core/providers/types';
import type ClaudianPlugin from '../../../main';
import { CodexAuxQueryRunner } from '../runtime/CodexAuxQueryRunner';
import { DEFAULT_CODEX_PRIMARY_MODEL } from '../types/models';
import { codexChatUIConfig } from '../ui/CodexChatUIConfig';

export interface CodexTitleGenerationServiceOptions {
  providerId?: ProviderId;
  uiConfig?: ProviderChatUIConfig;
  defaultModel?: string;
}

export class CodexTitleGenerationService extends QueryBackedTitleGenerationService {
  constructor(plugin: ClaudianPlugin, options: CodexTitleGenerationServiceOptions = {}) {
    const providerId = options.providerId ?? 'codex';
    const uiConfig = options.uiConfig ?? codexChatUIConfig;
    const defaultModel = options.defaultModel ?? DEFAULT_CODEX_PRIMARY_MODEL;

    super({
      createRunner: () => new CodexAuxQueryRunner(plugin, providerId, defaultModel),
      resolveModel: () => {
        const settings = plugin.settings as unknown as Record<string, unknown>;
        const titleModel = typeof settings.titleGenerationModel === 'string'
          ? settings.titleGenerationModel
          : '';
        return uiConfig.ownsModel(titleModel, settings)
          ? titleModel
          : undefined;
      },
    });
  }
}
