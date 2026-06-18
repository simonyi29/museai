import '@/providers';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ProviderWorkspaceRegistry } from '@/core/providers/ProviderWorkspaceRegistry';
import {
  repairMuseAIDiagnostics,
  runMuseAIDiagnostics,
} from '@/features/settings/diagnostics';

describe('MuseAI diagnostics', () => {
  let tempDir: string;
  let previousCodexHome: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'museai-diagnostics-'));
    previousCodexHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = path.join(tempDir, '.codex');
    ProviderWorkspaceRegistry.clear();
  });

  afterEach(() => {
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createPlugin(settings: Record<string, unknown>) {
    return {
      app: {
        vault: {
          adapter: {
            basePath: tempDir,
          },
        },
      },
      getAllViews: jest.fn().mockReturnValue([]),
      saveSettings: jest.fn().mockResolvedValue(undefined),
      settings,
    } as any;
  }

  it('reports unsupported Codex DeepSeek direct mode as repairable', () => {
    const plugin = createPlugin({
      model: 'deepseek/deepseek-chat',
      settingsProvider: 'codex-deepseek',
      savedProviderModel: {
        'codex-deepseek': 'deepseek/deepseek-chat',
      },
      providerConfigs: {
        'codex-deepseek': {
          enabled: true,
          wireApi: 'chat',
        },
      },
    });

    const result = runMuseAIDiagnostics(plugin);

    expect(result.repairableCount).toBeGreaterThan(0);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        message: expect.stringContaining('Codex DeepSeek direct mode'),
      }),
    ]));
  });

  it('repairs Codex DeepSeek routing and private wire_api config', async () => {
    const privateConfigDir = path.join(tempDir, '.museai', 'codex-deepseek');
    fs.mkdirSync(privateConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(privateConfigDir, 'config.toml'),
      'model_provider = "deepseek"\nwire_api = "chat"\n',
      'utf8',
    );

    const plugin = createPlugin({
      model: 'deepseek/deepseek-chat',
      settingsProvider: 'codex-deepseek',
      savedProviderModel: {
        'codex-deepseek': 'deepseek/deepseek-chat',
        opencode: 'opencode:deepseek/deepseek-v4-pro',
      },
      providerConfigs: {
        'codex-deepseek': {
          enabled: true,
          wireApi: 'chat',
        },
        opencode: {
          enabled: false,
        },
      },
    });

    const repairs = await repairMuseAIDiagnostics(plugin);

    expect(repairs).toBeGreaterThan(0);
    expect(plugin.settings.settingsProvider).toBe('opencode');
    expect(plugin.settings.model).toBe('opencode:deepseek/deepseek-v4-pro');
    expect(plugin.settings.providerConfigs['codex-deepseek']).toEqual(expect.objectContaining({
      enabled: false,
      wireApi: 'responses',
    }));
    expect(plugin.settings.providerConfigs.opencode.enabled).toBe(true);
    expect(fs.readFileSync(path.join(privateConfigDir, 'config.toml'), 'utf8'))
      .toContain('wire_api = "responses"');
    expect(plugin.saveSettings).toHaveBeenCalled();
  });
});
