import type { CreativeInspirationCollectorSettings } from '../../core/types/settings';

export type InspirationCollectorSettings = CreativeInspirationCollectorSettings;

export interface SourceCandidate {
  title: string;
  url: string;
  domain: string;
  snippet?: string;
  discoveredAt: string;
  sourceMode: 'open-search' | 'whitelist';
}

export interface ExtractedSourceContext extends SourceCandidate {
  text?: string;
}

export interface SourceSearchProvider {
  search(topic: string, options: { maxResults: number; domains?: string[] }): Promise<SourceCandidate[]>;
}

export interface WebContextExtractor {
  extract(candidate: SourceCandidate): Promise<ExtractedSourceContext>;
}

export interface ReportSynthesizer {
  synthesize(input: {
    topic: string;
    sources: ExtractedSourceContext[];
    now: Date;
  }): Promise<string>;
}

export interface CollectorStorage {
  writeReport(input: {
    saveDirectory: string;
    topic: string;
    markdown: string;
    now: Date;
  }): Promise<string>;
}

export interface CollectionResult {
  filePath: string;
  sourceCount: number;
}
