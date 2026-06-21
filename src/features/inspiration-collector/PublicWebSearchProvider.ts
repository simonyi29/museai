import {
  type InspirationHttpClient,
  isSuccessfulStatus,
  obsidianHttpClient,
} from './ObsidianHttpClient';
import type { SourceCandidate, SourceSearchProvider } from './types';

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./u, '');
  } catch {
    return '';
  }
}

function stripTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&quot;/gu, '"')
    .replace(/&amp;/gu, '&')
    .replace(/&#x27;|&#39;/gu, "'")
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/\s+/gu, ' ')
    .trim();
}

function buildQuery(topic: string, domains?: string[]): string {
  const queryParts = [topic.trim()];
  if (domains && domains.length > 0) {
    queryParts.push(domains.map((domain) => `site:${domain}`).join(' OR '));
  }
  return queryParts.join(' ');
}

function decodeDuckDuckGoUrl(rawHref: string): string {
  try {
    const url = new URL(rawHref, 'https://duckduckgo.com');
    const uddg = url.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : url.href;
  } catch {
    return rawHref;
  }
}

interface SearchEndpoint {
  name: string;
  buildUrl(query: string): string;
  parse(html: string, sourceMode: SourceCandidate['sourceMode']): SourceCandidate[];
}

function createCandidate(
  title: string,
  url: string,
  snippet: string,
  sourceMode: SourceCandidate['sourceMode'],
): SourceCandidate | null {
  const domain = extractDomain(url);
  const cleanTitle = stripTags(title);
  if (!domain || !cleanTitle) {
    return null;
  }

  return {
    title: cleanTitle,
    url,
    domain,
    snippet: stripTags(snippet),
    discoveredAt: new Date().toISOString(),
    sourceMode,
  };
}

function parseDuckDuckGo(html: string, sourceMode: SourceCandidate['sourceMode']): SourceCandidate[] {
  const candidates: SourceCandidate[] = [];
  const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>)?/giu;
  let match: RegExpExecArray | null;

  while ((match = resultPattern.exec(html)) !== null) {
    const candidate = createCandidate(
      match[2],
      decodeDuckDuckGoUrl(match[1]),
      match[3] ?? match[4] ?? '',
      sourceMode,
    );
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function parseBing(html: string, sourceMode: SourceCandidate['sourceMode']): SourceCandidate[] {
  const candidates: SourceCandidate[] = [];
  const blockPattern = /<li[^>]+class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/giu;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockPattern.exec(html)) !== null) {
    const block = blockMatch[1];
    const linkMatch = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/iu);
    if (!linkMatch) continue;

    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/iu);
    const candidate = createCandidate(
      linkMatch[2],
      linkMatch[1],
      snippetMatch?.[1] ?? '',
      sourceMode,
    );
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function parseGenericChineseSearch(html: string, sourceMode: SourceCandidate['sourceMode']): SourceCandidate[] {
  const candidates: SourceCandidate[] = [];
  const linkPattern = /<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>([\s\S]{0,600})/giu;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const candidate = createCandidate(match[2], match[1], match[3], sourceMode);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

const SEARCH_ENDPOINTS: SearchEndpoint[] = [
  {
    name: 'duckduckgo',
    buildUrl: (query) => `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    parse: parseDuckDuckGo,
  },
  {
    name: 'bing',
    buildUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    parse: parseBing,
  },
  {
    name: 'so',
    buildUrl: (query) => `https://www.so.com/s?q=${encodeURIComponent(query)}`,
    parse: parseGenericChineseSearch,
  },
  {
    name: 'sogou',
    buildUrl: (query) => `https://www.sogou.com/web?query=${encodeURIComponent(query)}`,
    parse: parseGenericChineseSearch,
  },
];

const timerHost: Pick<typeof globalThis, 'clearTimeout' | 'setTimeout'> =
  typeof window !== 'undefined' ? window : globalThis;

export class PublicWebSearchProvider implements SourceSearchProvider {
  constructor(
    private readonly httpClient: InspirationHttpClient = obsidianHttpClient,
    private readonly requestTimeoutMs = 8_000,
  ) {}

  async search(topic: string, options: { maxResults: number; domains?: string[] }): Promise<SourceCandidate[]> {
    const maxResults = Math.max(0, options.maxResults);
    if (maxResults === 0) return [];

    const domains = options.domains
      ?.map((domain) => domain.trim().replace(/^https?:\/\//iu, '').replace(/^www\./iu, '').replace(/\/.*$/u, ''))
      .filter((domain) => domain.length > 0);
    const sourceMode: SourceCandidate['sourceMode'] = domains && domains.length > 0 ? 'whitelist' : 'open-search';
    const query = buildQuery(topic, domains);
    const errors: string[] = [];

    for (const endpoint of SEARCH_ENDPOINTS) {
      try {
        const html = await this.fetchSearchHtml(endpoint.buildUrl(query));
        const candidates = endpoint.parse(html, sourceMode)
          .filter((candidate) => this.matchesDomains(candidate, domains))
          .slice(0, maxResults);
        if (candidates.length > 0) {
          return candidates;
        }
      } catch (error) {
        errors.push(`${endpoint.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(`All public search providers failed or returned no results. ${errors.join('; ')}`);
  }

  private async fetchSearchHtml(url: string): Promise<string> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        this.httpClient.request(url, {
          headers: {
            Accept: 'text/html',
            'User-Agent': 'Mozilla/5.0 MuseAI Inspiration Collector',
          },
        }),
        new Promise<never>((_, reject) => {
          timeout = timerHost.setTimeout(() => reject(new Error('Search request timed out')), this.requestTimeoutMs);
        }),
      ]);

      if (!isSuccessfulStatus(response.status)) {
        throw new Error(`Search request failed: ${response.status}`);
      }

      return response.text;
    } finally {
      if (timeout !== undefined) {
        timerHost.clearTimeout(timeout);
      }
    }
  }

  private matchesDomains(candidate: SourceCandidate, domains?: string[]): boolean {
    if (!domains || domains.length === 0) return true;
    return domains.some((domain) => candidate.domain === domain || candidate.domain.endsWith(`.${domain}`));
  }
}
