import { renderInspirationReport } from './ReportTemplate';
import type { ExtractedSourceContext, ReportSynthesizer } from './types';

export class MarkdownReportSynthesizer implements ReportSynthesizer {
  async synthesize(input: {
    topic: string;
    sources: ExtractedSourceContext[];
    now: Date;
  }): Promise<string> {
    return renderInspirationReport(input);
  }
}
