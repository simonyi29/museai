import {
  getResponseHeader,
  type InspirationHttpClient,
  isSuccessfulStatus,
  obsidianHttpClient,
} from './ObsidianHttpClient';
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

export class LightweightWebContextExtractor implements WebContextExtractor {
  constructor(
    private readonly httpClient: InspirationHttpClient = obsidianHttpClient,
    private readonly maxCharacters = 4_000,
  ) {}

  async extract(candidate: SourceCandidate): Promise<ExtractedSourceContext> {
    const response = await this.httpClient.request(candidate.url, {
      headers: {
        Accept: 'text/html,text/plain',
      },
    });
    if (!isSuccessfulStatus(response.status)) {
      return candidate;
    }

    const contentType = getResponseHeader(response, 'content-type') ?? '';
    const rawText = response.text;
    const text = contentType.includes('text/html')
      ? stripHtml(rawText)
      : rawText.replace(/\s+/gu, ' ').trim();

    return {
      ...candidate,
      text: text.slice(0, this.maxCharacters),
    };
  }
}
