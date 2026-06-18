import { QueryBackedInstructionRefineService } from '../../../core/auxiliary/QueryBackedInstructionRefineService';
import type { ProviderId } from '../../../core/providers/types';
import type ClaudianPlugin from '../../../main';
import { CodexAuxQueryRunner } from '../runtime/CodexAuxQueryRunner';
import { DEFAULT_CODEX_PRIMARY_MODEL } from '../types/models';

export class CodexInstructionRefineService extends QueryBackedInstructionRefineService {
  constructor(
    plugin: ClaudianPlugin,
    providerId: ProviderId = 'codex',
    defaultModel: string = DEFAULT_CODEX_PRIMARY_MODEL,
  ) {
    super(new CodexAuxQueryRunner(plugin, providerId, defaultModel));
  }
}
