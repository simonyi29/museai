import type { ProviderCapabilities } from '../../core/providers/types';
import { CODEX_DEEPSEEK_PROVIDER_ID } from './types/models';

export const CODEX_DEEPSEEK_PROVIDER_CAPABILITIES: Readonly<ProviderCapabilities> = Object.freeze({
  providerId: CODEX_DEEPSEEK_PROVIDER_ID,
  supportsPersistentRuntime: true,
  supportsNativeHistory: true,
  supportsPlanMode: true,
  supportsRewind: false,
  supportsFork: true,
  supportsProviderCommands: false,
  supportsImageAttachments: true,
  supportsInstructionMode: true,
  supportsMcpTools: false,
  supportsTurnSteer: true,
  reasoningControl: 'effort',
});
