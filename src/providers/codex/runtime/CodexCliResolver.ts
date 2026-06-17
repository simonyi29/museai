import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type { HostnameCliPaths } from '../../../core/types/settings';
import { isExistingFile } from '../../../utils/cliBinaryLocator';
import { getHostnameKey } from '../../../utils/env';
import type { CodexInstallationMethod } from '../settings';
import { getCodexProviderSettings } from '../settings';
import { isWindowsStyleCliReference, resolveCodexCliPath } from './CodexBinaryLocator';

export class CodexCliResolver {
  private resolvedPath: string | null = null;
  private lastHostnamePath = '';
  private lastLegacyPath = '';
  private lastEnvText = '';
  private lastInstallationMethod = '';
  private readonly cachedHostname = getHostnameKey();

  private canReuseResolvedPath(installationMethod: CodexInstallationMethod): boolean {
    const resolvedPath = this.resolvedPath?.trim();
    if (!resolvedPath) {
      return false;
    }

    if (process.platform === 'win32' && installationMethod === 'wsl') {
      return !isWindowsStyleCliReference(resolvedPath) || isExistingFile(resolvedPath);
    }

    return isExistingFile(resolvedPath);
  }

  resolveFromSettings(settings: Record<string, unknown>): string | null {
    const codexSettings = getCodexProviderSettings(settings);
    const hostnamePath = (codexSettings.cliPathsByHost[this.cachedHostname] ?? '').trim();
    const legacyPath = codexSettings.cliPath.trim();
    const envText = getRuntimeEnvironmentText(settings, 'codex');
    const installationMethod = codexSettings.installationMethod;

    if (
      this.resolvedPath &&
      this.canReuseResolvedPath(installationMethod) &&
      hostnamePath === this.lastHostnamePath &&
      legacyPath === this.lastLegacyPath &&
      envText === this.lastEnvText &&
      installationMethod === this.lastInstallationMethod
    ) {
      return this.resolvedPath;
    }

    this.lastHostnamePath = hostnamePath;
    this.lastLegacyPath = legacyPath;
    this.lastEnvText = envText;
    this.lastInstallationMethod = installationMethod;

    this.resolvedPath = resolveCodexCliPath(hostnamePath, legacyPath, envText, {
      installationMethod,
    });
    return this.resolvedPath;
  }

  resolve(
    hostnamePaths: HostnameCliPaths | undefined,
    legacyPath: string | undefined,
    envText: string,
    options: {
      installationMethod?: CodexInstallationMethod;
      hostPlatform?: NodeJS.Platform;
    } = {},
  ): string | null {
    const hostnamePath = (hostnamePaths?.[this.cachedHostname] ?? '').trim();
    const normalizedLegacyPath = (legacyPath ?? '').trim();
    return resolveCodexCliPath(hostnamePath, normalizedLegacyPath, envText, options);
  }

  reset(): void {
    this.resolvedPath = null;
    this.lastHostnamePath = '';
    this.lastLegacyPath = '';
    this.lastEnvText = '';
    this.lastInstallationMethod = '';
  }
}
