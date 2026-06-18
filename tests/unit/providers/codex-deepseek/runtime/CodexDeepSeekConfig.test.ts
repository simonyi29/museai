import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  applyCodexDeepSeekEnvironment,
  writeCodexDeepSeekConfig,
} from '@/providers/codex-deepseek/runtime/CodexDeepSeekConfig';

describe('CodexDeepSeekConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-deepseek-config-'));
  });

  afterEach(() => {
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
      settings,
    } as any;
  }

  it('writes a private Codex config for the DeepSeek model provider', () => {
    const plugin = createPlugin({
      providerConfigs: {
        'codex-deepseek': {
          model: 'deepseek/deepseek-chat',
          baseUrl: 'https://api.deepseek.com',
          envKey: 'DEEPSEEK_API_KEY',
          wireApi: 'responses',
        },
      },
    });

    const codexHome = writeCodexDeepSeekConfig(plugin);
    const config = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');

    expect(codexHome).toBe(path.join(tempDir, '.museai', 'codex-deepseek'));
    expect(config).toContain('model_provider = "deepseek"');
    expect(config).toContain('model = "deepseek/deepseek-chat"');
    expect(config).toContain('[model_providers.deepseek]');
    expect(config).toContain('base_url = "https://api.deepseek.com"');
    expect(config).toContain('env_key = "DEEPSEEK_API_KEY"');
    expect(config).toContain('wire_api = "responses"');
  });

  it('sets CODEX_HOME to the private config directory when the API key is available', () => {
    const plugin = createPlugin({
      providerConfigs: {
        'codex-deepseek': {
          envKey: 'DEEPSEEK_API_KEY',
        },
      },
    });

    const env = applyCodexDeepSeekEnvironment(plugin, {
      PATH: 'test-path',
      DEEPSEEK_API_KEY: 'sk-test',
    });

    expect(env.CODEX_HOME).toBe(path.join(tempDir, '.museai', 'codex-deepseek'));
    expect(env.CODEX_DEEPSEEK_HOME).toBe(env.CODEX_HOME);
    expect(env.DEEPSEEK_API_KEY).toBe('sk-test');
  });

  it('fails early when the configured DeepSeek API key is missing', () => {
    const plugin = createPlugin({
      providerConfigs: {
        'codex-deepseek': {
          envKey: 'DEEPSEEK_API_KEY',
        },
      },
    });

    expect(() => applyCodexDeepSeekEnvironment(plugin, {})).toThrow(
      'Codex DeepSeek requires DEEPSEEK_API_KEY',
    );
  });
});
