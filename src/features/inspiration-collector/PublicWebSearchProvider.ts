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

function decodeDuckDuckGoUrl(rawHref: string): string {
  try {
    const url = new URL(rawHref, 'https://duckduckgo.com');
    const uddg = url.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : url.href;
  } catch {
    return rawHref;
  }
}

export class PublicWebSearchProvider implements SourceSearchProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async search(topic: string, options: { maxResults: number; domains?: string[] }): Promise<SourceCandidate[]> {
    const queryParts = [topic.trim()];
    if (options.domains && options.domains.length > 0) {
      queryParts.push(`(${options.domains.map((domain) => `site:${domain}`).join(' OR ')})`);
    }

    const response = await this.fetchImpl(
      `https://duckduckgo.com/html/?q=${encodeURIComponent(queryParts.join(' '))}`,
      {
        headers: {
          Accept: 'text/html',
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Search request failed: ${response.status}`);
    }

    const html = await response.text();
    const candidates: SourceCandidate[] = [];
    const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>)?/giu;
    let match: RegExpExecArray | null;

    while ((match = resultPattern.exec(html)) !== null && candidates.length < options.maxResults) {
      const url = decodeDuckDuckGoUrl(match[1]);
      const domain = extractDomain(url);
      if (!domain) continue;
      if (options.domains && options.domains.length > 0 && !options.domains.some((allowed) => domain.endsWith(allowed))) {
        continue;
      }

      candidates.push({
        title: stripTags(match[2]),
        url,
        domain,
        snippet: stripTags(match[3] ?? match[4] ?? ''),
        discoveredAt: new Date().toISOString(),
        sourceMode: options.domains && options.domains.length > 0 ? 'whitelist' : 'open-search',
      });
    }

    return candidates;
  }
}
