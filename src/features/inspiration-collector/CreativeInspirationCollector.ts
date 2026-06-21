import type { SourceCandidateService } from './SourceCandidateService';
import type {
  CollectionIndex,
  CollectionResult,
  CollectorStorage,
  ExtractedSourceContext,
  InspirationCollectorSettings,
  ReportSynthesizer,
  WebContextExtractor,
} from './types';

interface CreativeInspirationCollectorDeps {
  sourceService: Pick<SourceCandidateService, 'collect'>;
  extractor: WebContextExtractor;
  synthesizer: ReportSynthesizer;
  storage: CollectorStorage;
  now?: () => Date;
}

export class CreativeInspirationCollector {
  constructor(private readonly deps: CreativeInspirationCollectorDeps) {}

  async collect(topic: string, settings: InspirationCollectorSettings): Promise<CollectionResult> {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      throw new Error('Collection topic is required.');
    }
    if (!settings.enabled) {
      throw new Error('Creative inspiration collection is disabled.');
    }

    const now = this.deps.now?.() ?? new Date();
    const candidates = await this.deps.sourceService.collect(trimmedTopic, {
      maxResults: settings.maxResults,
      whitelistDomains: settings.whitelistDomains,
    });
    if (candidates.length === 0) {
      throw new Error('No source candidates were found.');
    }

    const index = await this.deps.storage.loadIndex({
      saveDirectory: settings.saveDirectory,
      topic: trimmedTopic,
    });
    const collectedAt = now.toISOString();
    const freshCandidates: typeof candidates = [];
    let skippedSourceCount = 0;

    for (const candidate of candidates) {
      const key = normalizeSourceUrl(candidate.url);
      if (!key) continue;
      const existing = index.seenUrls[key];
      if (existing) {
        skippedSourceCount += 1;
        index.seenUrls[key] = {
          ...existing,
          title: candidate.title || existing.title,
          domain: candidate.domain || existing.domain,
          lastSeenAt: collectedAt,
        };
        continue;
      }
      freshCandidates.push(candidate);
    }

    if (freshCandidates.length === 0) {
      await this.deps.storage.saveIndex({
        saveDirectory: settings.saveDirectory,
        topic: trimmedTopic,
        index,
      });
      return {
        sourceCount: 0,
        skippedSourceCount,
      };
    }

    const contexts: ExtractedSourceContext[] = [];
    for (const candidate of freshCandidates) {
      try {
        contexts.push(await this.deps.extractor.extract(candidate));
      } catch {
        contexts.push(candidate);
      }
    }

    const markdown = await this.deps.synthesizer.synthesize({
      topic: trimmedTopic,
      sources: contexts,
      now,
    });
    this.recordSources(index, contexts, collectedAt);
    const filePath = await this.deps.storage.writeReport({
      saveDirectory: settings.saveDirectory,
      topic: trimmedTopic,
      markdown,
      now,
    });
    await this.deps.storage.saveIndex({
      saveDirectory: settings.saveDirectory,
      topic: trimmedTopic,
      index,
    });

    return {
      filePath,
      sourceCount: contexts.length,
      skippedSourceCount,
    };
  }

  private recordSources(index: CollectionIndex, sources: ExtractedSourceContext[], collectedAt: string): void {
    for (const source of sources) {
      const key = normalizeSourceUrl(source.url);
      if (!key) continue;
      const existing = index.seenUrls[key];
      index.seenUrls[key] = {
        title: source.title,
        domain: source.domain,
        firstSeenAt: existing?.firstSeenAt ?? collectedAt,
        lastSeenAt: collectedAt,
      };
    }
  }
}

function normalizeSourceUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    return parsed.href.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}
