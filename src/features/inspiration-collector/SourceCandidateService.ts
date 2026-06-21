import type { SourceCandidate, SourceSearchProvider } from './types';

export class SourceCandidateService {
  constructor(private readonly provider: SourceSearchProvider) {}

  async collect(topic: string, options: {
    maxResults: number;
    whitelistDomains: string[];
  }): Promise<SourceCandidate[]> {
    const maxResults = Math.max(0, options.maxResults);
    const whitelistDomains = options.whitelistDomains
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0);
    const openResults = await this.provider.search(topic, { maxResults });
    const whitelistResults = whitelistDomains.length > 0
      ? await this.provider.search(topic, {
        maxResults,
        domains: whitelistDomains,
      })
      : [];

    const seen = new Set<string>();
    const merged: SourceCandidate[] = [];
    for (const candidate of [...openResults, ...whitelistResults]) {
      const key = candidate.url.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(candidate);
      if (merged.length >= maxResults) break;
    }
    return merged;
  }
}
