import { formatCollectorDate } from './path';
import {
  type ReportSectionContent,
  type ReportSectionTitle,
  REPORT_SECTION_TITLES,
  renderInspirationReport,
} from './ReportTemplate';
import type {
  AiTextGenerator,
  ExtractedSourceContext,
  ReportSynthesizer,
} from './types';

function truncate(value: string | undefined, maxLength: number): string {
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function buildSystemPrompt(): string {
  return [
    '你是 MuseAI 的创作灵感素材库整理助手。',
    '你的任务是把公开网络线索提炼成原创写作灵感报告，而不是复制来源正文。',
    '必须使用中文输出，只能输出指定 Markdown 二级章节。',
    '不要输出开场白、问候语、日期、一级标题、分隔线或来源索引。',
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
    '请根据下面的公开网络线索，为固定报告模板填充章节内容。',
    '只能输出这些二级章节，不要增加、删除或改名：',
    REPORT_SECTION_TITLES.map((section) => `## ${section}`).join('\n'),
    '',
    '写作要求：',
    '- 不要输出一级标题。',
    '- 不要输出“来源索引”，来源索引会由程序自动生成。',
    '- 不要输出“好的”“以下是”等聊天式开场白。',
    '- 高频设定要提炼反复出现的题材模式。',
    '- 可发展灵感要给出能直接扩写成故事的原创点子。',
    '- 人物原型、冲突类型、世界观元素、情节钩子要具体。',
    '- 不要复制来源正文，不要输出版权受限长段落。',
    '',
    '公开网络线索：',
    sourceBlocks,
  ].join('\n');
}

function normalizeHeading(value: string): string {
  return value.replace(/[：:]\s*$/u, '').trim();
}

function parseAiSections(markdown: string): ReportSectionContent {
  const sections: ReportSectionContent = {};
  const allowedTitles = new Set<string>(REPORT_SECTION_TITLES);
  const headingPattern = /^##\s+(.+?)\s*$/gmu;
  const matches = Array.from(markdown.matchAll(headingPattern));

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = normalizeHeading(match[1]);
    if (!allowedTitles.has(title)) continue;

    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    const content = markdown.slice(start, end).trim();
    if (content) {
      sections[title as ReportSectionTitle] = content;
    }
  }

  return sections;
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
      return renderInspirationReport({
        ...input,
        sections: parseAiSections(markdown),
      });
    } catch (error) {
      const fallback = await this.fallbackSynthesizer.synthesize(input);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return `${fallback.trimEnd()}\n\n> AI 提炼失败：${message}\n`;
    }
  }
}
