import { formatCollectorDate } from './path';
import type {
  AiTextGenerator,
  ExtractedSourceContext,
  ReportSynthesizer,
} from './types';

const REPORT_SECTIONS = [
  '主题概览',
  '高频设定',
  '可发展灵感',
  '人物原型',
  '冲突类型',
  '世界观元素',
  '情节钩子',
  '来源索引',
];

function truncate(value: string | undefined, maxLength: number): string {
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function buildSourceIndex(sources: ExtractedSourceContext[]): string {
  return sources
    .map((source) => `- [${source.title}](${source.url}) - ${source.domain}`)
    .join('\n');
}

function ensureSourceIndex(markdown: string, sources: ExtractedSourceContext[]): string {
  if (/##\s+来源索引/u.test(markdown)) {
    return markdown.trimEnd();
  }

  return [
    markdown.trimEnd(),
    '',
    '## 来源索引',
    '',
    buildSourceIndex(sources),
  ].join('\n');
}

function buildSystemPrompt(): string {
  return [
    '你是 MuseAI 的创作灵感素材库整理助手。',
    '你的任务是把公开网络线索提炼成原创写作灵感报告，而不是复制来源正文。',
    '必须使用中文输出，必须保留 Markdown 结构，必须包含指定章节。',
    '不要大段引用来源原文；只总结题材模式、设定、人物原型、冲突和情节钩子。',
  ].join('\n');
}

function buildPrompt(input: {
  topic: string;
  sources: ExtractedSourceContext[];
  now: Date;
}): string {
  const sourceBlocks = input.sources.map((source, index) => [
    `### 来源 ${index + 1}`,
    `标题：${source.title}`,
    `链接：${source.url}`,
    `站点：${source.domain}`,
    `摘要：${truncate(source.snippet, 700)}`,
    `页面片段：${truncate(source.text, 1_200)}`,
  ].join('\n')).join('\n\n');

  return [
    `主题：${input.topic}`,
    `日期：${formatCollectorDate(input.now)}`,
    '',
    '请根据下面的公开网络线索，生成一篇创作灵感素材报告。',
    '报告必须包含这些章节：',
    REPORT_SECTIONS.map((section) => `- ${section}`).join('\n'),
    '',
    '写作要求：',
    '- 高频设定要提炼反复出现的题材模式。',
    '- 可发展灵感要给出能直接扩写成故事的原创点子。',
    '- 人物原型、冲突类型、世界观元素、情节钩子要具体。',
    '- 来源索引必须使用 Markdown 链接，格式为：- [标题](链接) - 站点。',
    '- 不要复制来源正文，不要输出版权受限长段落。',
    '',
    '公开网络线索：',
    sourceBlocks,
  ].join('\n');
}

export class AiReportSynthesizer implements ReportSynthesizer {
  constructor(
    private readonly generator: AiTextGenerator,
    private readonly fallbackSynthesizer: ReportSynthesizer,
  ) {}

  async synthesize(input: {
    topic: string;
    sources: ExtractedSourceContext[];
    now: Date;
  }): Promise<string> {
    try {
      const markdown = await this.generator.generate({
        systemPrompt: buildSystemPrompt(),
        prompt: buildPrompt(input),
      });
      return ensureSourceIndex(markdown, input.sources);
    } catch (error) {
      const fallback = await this.fallbackSynthesizer.synthesize(input);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return `${fallback.trimEnd()}\n\n> AI 提炼失败：${message}\n`;
    }
  }
}
