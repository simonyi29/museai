import type { SourceCandidateService } from './SourceCandidateService';
import type {
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

    const contexts: ExtractedSourceContext[] = [];
    for (const candidate of candidates) {
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
    const filePath = await this.deps.storage.writeReport({
      saveDirectory: settings.saveDirectory,
      topic: trimmedTopic,
      markdown,
      now,
    });

    return {
      filePath,
      sourceCount: contexts.length,
    };
  }
}
