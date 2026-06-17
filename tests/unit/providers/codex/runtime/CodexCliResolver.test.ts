import * as fs from 'fs';
import * as path from 'path';

import { CodexCliResolver } from '@/providers/codex/runtime/CodexCliResolver';
import { getHostnameKey } from '@/utils/env';

jest.mock('fs');
jest.mock('@/utils/env', () => {
  const actual = jest.requireActual('@/utils/env');
  return {
    ...actual,
    getHostnameKey: jest.fn(() => 'current-host'),
  };
});

const mockedExists = fs.existsSync as jest.Mock;
const mockedStat = fs.statSync as jest.Mock;
const mockedDeviceKey = getHostnameKey as jest.Mock;

describe('CodexCliResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDeviceKey.mockReturnValue('current-host');
  });

  it('uses the current host path instead of another synced host path', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/current/codex');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new CodexCliResolver();
    const resolved = resolver.resolve(
      {
        'other-host': '/other/codex',
        'current-host': '/current/codex',
      },
      '/legacy/codex',
      '',
    );

    expect(resolved).toBe('/current/codex');
  });

  it('falls back to the legacy path when the current host has no custom path', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/legacy/codex');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new CodexCliResolver();
    const resolved = resolver.resolve(
      { 'other-host': '/other/codex' },
      '/legacy/codex',
      '',
    );

    expect(resolved).toBe('/legacy/codex');
  });

  it('auto-detects from the runtime PATH when no configured path is valid', () => {
    const binaryName = process.platform === 'win32' ? 'codex.exe' : 'codex';
    const binaryDir = '/custom/bin';
    const binaryPath = path.join(binaryDir, binaryName);

    mockedExists.mockImplementation((filePath: string) => filePath === binaryPath);
    mockedStat.mockImplementation((filePath: string) => ({
      isFile: () => filePath === binaryPath,
    }));

    const resolver = new CodexCliResolver();
    const resolved = resolver.resolve(
      { 'other-host': '/other/codex' },
      '',
      `PATH=${binaryDir}`,
    );

    expect(resolved).toBe(binaryPath);
  });

  it('refreshes the cached path when the previously resolved executable disappears', () => {
    const oldPath = 'C:\\Users\\me\\AppData\\Local\\OpenAI\\Codex\\bin\\old\\codex.exe';
    const newPath = 'C:\\Users\\me\\AppData\\Local\\OpenAI\\Codex\\bin\\codex.exe';
    const newPathDir = 'C:\\Users\\me\\AppData\\Local\\OpenAI\\Codex\\bin';

    mockedExists.mockImplementation((filePath: string) => filePath === oldPath);
    mockedStat.mockImplementation((filePath: string) => ({
      isFile: () => filePath === oldPath,
    }));

    const resolver = new CodexCliResolver();
    const settings = {
      providerConfigs: {
        codex: {
          cliPath: oldPath,
          cliPathsByHost: {},
          environmentVariables: `PATH=${newPathDir}`,
        },
      },
    };

    expect(resolver.resolveFromSettings(settings)).toBe(oldPath);

    mockedExists.mockImplementation((filePath: string) => filePath === newPath);
    mockedStat.mockImplementation((filePath: string) => ({
      isFile: () => filePath === newPath,
    }));

    expect(resolver.resolveFromSettings(settings)).toBe(newPath);
  });

  it('returns a Linux-side command in WSL mode without host filesystem validation', () => {
    mockedExists.mockReturnValue(false);

    const resolver = new CodexCliResolver();
    const resolved = resolver.resolve(
      {
        'current-host': 'codex',
      },
      '',
      '',
      { installationMethod: 'wsl', hostPlatform: 'win32' },
    );

    expect(resolved).toBe('codex');
  });

  it('falls back to the Linux command when a Windows-native CLI path is configured in WSL mode', () => {
    mockedExists.mockReturnValue(false);

    const resolver = new CodexCliResolver();
    const resolved = resolver.resolve(
      {
        'current-host': 'C:\\Users\\user\\AppData\\Roaming\\npm\\codex.exe',
      },
      '',
      '',
      { installationMethod: 'wsl', hostPlatform: 'win32' },
    );

    expect(resolved).toBe('codex');
  });
});
