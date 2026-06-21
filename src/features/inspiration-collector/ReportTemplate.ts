import { formatCollectorDate } from './path';
import type { ExtractedSourceContext } from './types';

export const REPORT_SECTION_TITLES = [
  '主题概览',
  '高频设定',
  '可发展灵感',
  '人物原型',
  '冲突类型',
  '世界观元素',
  '情节钩子',
] as const;

export type ReportSectionTitle = typeof REPORT_SECTION_TITLES[number];
export type ReportSectionContent = Partial<Record<ReportSectionTitle, string>>;

export function buildSourceIndex(sources: ExtractedSourceContext[]): string {
  if (sources.length === 0) {
    return '- 本次未收集到可用来源。';
  }

  return sources
    .map((source) => `- [${source.title}](${source.url}) - ${source.domain}`)
    .join('\n');
}

function defaultSectionContent(topic: string, sources: ExtractedSourceContext[]): ReportSectionContent {
  return {
    主题概览: `本次围绕“${topic}”收集了 ${sources.length} 条公开网络线索。`,
    高频设定: '- 待 AI 提炼。',
    可发展灵感: '- 待 AI 提炼。',
    人物原型: '- 待 AI 提炼。',
    冲突类型: '- 待 AI 提炼。',
    世界观元素: '- 待 AI 提炼。',
    情节钩子: '- 待 AI 提炼。',
  };
}

export function renderInspirationReport(input: {
  topic: string;
  sources: ExtractedSourceContext[];
  now: Date;
  sections?: ReportSectionContent;
}): string {
  const date = formatCollectorDate(input.now);
  const defaults = defaultSectionContent(input.topic, input.sources);
  const lines = [
    `# ${input.topic}素材采集 - ${date}`,
    '',
  ];

  for (const title of REPORT_SECTION_TITLES) {
    lines.push(`## ${title}`, '');
    lines.push((input.sections?.[title] ?? defaults[title] ?? '').trim(), '');
  }

  lines.push('## 来源索引', '', buildSourceIndex(input.sources), '');
  return lines.join('\n');
}
