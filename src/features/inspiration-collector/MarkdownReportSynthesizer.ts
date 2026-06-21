import { formatCollectorDate } from './path';
import type { ExtractedSourceContext, ReportSynthesizer } from './types';

function buildSourceIndex(sources: ExtractedSourceContext[]): string {
  if (sources.length === 0) {
    return '- 本次未收集到可用来源。';
  }

  return sources
    .map((source) => `- [${source.title}](${source.url}) - ${source.domain}`)
    .join('\n');
}

export class MarkdownReportSynthesizer implements ReportSynthesizer {
  async synthesize(input: {
    topic: string;
    sources: ExtractedSourceContext[];
    now: Date;
  }): Promise<string> {
    const date = formatCollectorDate(input.now);

    return [
      `# ${input.topic}素材采集 - ${date}`,
      '',
      '## 主题概览',
      '',
      `本次围绕“${input.topic}”收集了 ${input.sources.length} 条公开网络线索。`,
      '',
      '## 高频设定',
      '',
      '- 待 AI 提炼。',
      '',
      '## 可发展灵感',
      '',
      '- 待 AI 提炼。',
      '',
      '## 人物原型',
      '',
      '- 待 AI 提炼。',
      '',
      '## 冲突类型',
      '',
      '- 待 AI 提炼。',
      '',
      '## 世界观元素',
      '',
      '- 待 AI 提炼。',
      '',
      '## 情节钩子',
      '',
      '- 待 AI 提炼。',
      '',
      '## 来源索引',
      '',
      buildSourceIndex(input.sources),
      '',
    ].join('\n');
  }
}
