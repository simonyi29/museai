import { QueryBackedInlineEditService } from '../../../core/auxiliary/QueryBackedInlineEditService';
import type { ProviderId } from '../../../core/providers/types';
import type ClaudianPlugin from '../../../main';
import { CodexAuxQueryRunner } from '../runtime/CodexAuxQueryRunner';
import { DEFAULT_CODEX_PRIMARY_MODEL } from '../types/models';

export class CodexInlineEditService extends QueryBackedInlineEditService {
  constructor(
    plugin: ClaudianPlugin,
    providerId: ProviderId = 'codex',
    defaultModel: string = DEFAULT_CODEX_PRIMARY_MODEL,
  ) {
    super(new CodexAuxQueryRunner(plugin, providerId, defaultModel));
  }
}
