import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { normalizeLegacyCodexConfigServiceTier } from '@/providers/codex/runtime/codexAppServerSupport';

describe('codexAppServerSupport', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-app-server-support-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('migrates legacy default service_tier in Codex config to flex', () => {
    const configPath = path.join(tempDir, 'config.toml');
    fs.writeFileSync(configPath, [
      'model = "gpt-5.5"',
      'service_tier = "default"',
      'sandbox_mode = "workspace-write"',
      '',
    ].join('\n'));

    normalizeLegacyCodexConfigServiceTier({ CODEX_HOME: tempDir });

    expect(fs.readFileSync(configPath, 'utf8')).toContain('service_tier = "flex"');
  });

  it('leaves valid service_tier values unchanged', () => {
    const configPath = path.join(tempDir, 'config.toml');
    const original = [
      'model = "gpt-5.5"',
      'service_tier = "fast"',
      '',
    ].join('\n');
    fs.writeFileSync(configPath, original);

    normalizeLegacyCodexConfigServiceTier({ CODEX_HOME: tempDir });

    expect(fs.readFileSync(configPath, 'utf8')).toBe(original);
  });

  it('does nothing when Codex config does not exist', () => {
    expect(() => normalizeLegacyCodexConfigServiceTier({ CODEX_HOME: tempDir })).not.toThrow();
  });
});
