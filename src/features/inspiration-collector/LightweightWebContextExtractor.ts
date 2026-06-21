import type { ExtractedSourceContext, SourceCandidate, WebContextExtractor } from './types';

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/giu, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&quot;/gu, '"')
    .replace(/&amp;/gu, '&')
    .replace(/&#x27;|&#39;/gu, "'")
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/\s+/gu, ' ')
    .trim();
}

const defaultFetch: typeof fetch = (input, init) => {
  if (typeof window !== 'undefined') {
    return window.fetch(input, init);
  }
  return fetch(input, init);
};

export class LightweightWebContextExtractor implements WebContextExtractor {
  constructor(
    private readonly fetchImpl: typeof fetch = defaultFetch,
    private readonly maxCharacters = 4_000,
  ) {}

  async extract(candidate: SourceCandidate): Promise<ExtractedSourceContext> {
    const response = await this.fetchImpl(candidate.url, {
      headers: {
        Accept: 'text/html,text/plain',
      },
    });
    if (!response.ok) {
      return candidate;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const rawText = await response.text();
    const text = contentType.includes('text/html')
      ? stripHtml(rawText)
      : rawText.replace(/\s+/gu, ' ').trim();

    return {
      ...candidate,
      text: text.slice(0, this.maxCharacters),
    };
  }
}
