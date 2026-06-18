import type { ProviderCommandCatalog } from '../../../core/providers/commands/ProviderCommandCatalog';
import { ProviderWorkspaceRegistry } from '../../../core/providers/ProviderWorkspaceRegistry';
import type {
  ProviderCliResolver,
  ProviderWorkspaceRegistration,
  ProviderWorkspaceServices,
} from '../../../core/providers/types';
import type { HomeFileAdapter } from '../../../core/storage/HomeFileAdapter';
import type { VaultFileAdapter } from '../../../core/storage/VaultFileAdapter';
import type ClaudianPlugin from '../../../main';
import { getVaultPath } from '../../../utils/path';
import { CodexAgentMentionProvider } from '../../codex/agents/CodexAgentMentionProvider';
import { CodexSkillCatalog } from '../../codex/commands/CodexSkillCatalog';
import { CodexCliResolver } from '../../codex/runtime/CodexCliResolver';
import { CodexSkillListingService } from '../../codex/skills/CodexSkillListingService';
import { CodexSkillStorage } from '../../codex/storage/CodexSkillStorage';
import { CodexSubagentStorage } from '../../codex/storage/CodexSubagentStorage';
import { CODEX_DEEPSEEK_PROVIDER_ID } from '../types/models';
import { codexDeepSeekSettingsTabRenderer } from '../ui/CodexDeepSeekSettingsTab';

export interface CodexDeepSeekWorkspaceServices extends ProviderWorkspaceServices {
  subagentStorage: CodexSubagentStorage;
  commandCatalog: ProviderCommandCatalog;
  agentMentionProvider: CodexAgentMentionProvider;
  cliResolver: ProviderCliResolver;
}

export async function createCodexDeepSeekWorkspaceServices(
  plugin: ClaudianPlugin,
  vaultAdapter: VaultFileAdapter,
  homeAdapter: HomeFileAdapter,
): Promise<CodexDeepSeekWorkspaceServices> {
  const subagentStorage = new CodexSubagentStorage(vaultAdapter);
  const agentMentionProvider = new CodexAgentMentionProvider(subagentStorage);
  await agentMentionProvider.loadAgents();

  const skillListProvider = new CodexSkillListingService(plugin);
  const commandCatalog = new CodexSkillCatalog(
    new CodexSkillStorage(vaultAdapter, homeAdapter),
    skillListProvider,
    getVaultPath(plugin.app),
  );

  return {
    subagentStorage,
    commandCatalog,
    agentMentionProvider,
    cliResolver: new CodexCliResolver(CODEX_DEEPSEEK_PROVIDER_ID),
    settingsTabRenderer: codexDeepSeekSettingsTabRenderer,
    refreshAgentMentions: async () => {
      await agentMentionProvider.loadAgents();
    },
  };
}

export const codexDeepSeekWorkspaceRegistration: ProviderWorkspaceRegistration<CodexDeepSeekWorkspaceServices> = {
  initialize: async ({ plugin, vaultAdapter, homeAdapter }) => createCodexDeepSeekWorkspaceServices(
    plugin,
    vaultAdapter,
    homeAdapter,
  ),
};

export function maybeGetCodexDeepSeekWorkspaceServices(): CodexDeepSeekWorkspaceServices | null {
  return ProviderWorkspaceRegistry.getServices(CODEX_DEEPSEEK_PROVIDER_ID) as CodexDeepSeekWorkspaceServices | null;
}
