import { AiReportSynthesizer } from '@/features/inspiration-collector/AiReportSynthesizer';
import { MarkdownReportSynthesizer } from '@/features/inspiration-collector/MarkdownReportSynthesizer';

const source = {
  title: 'AI colonies',
  url: 'https://example.com/a',
  domain: 'example.com',
  snippet: '星际殖民与 AI 冲突',
  text: '公开页面摘要：殖民飞船、企业治理、AI 自主意识。',
  discoveredAt: '2026-06-21T00:00:00.000Z',
  sourceMode: 'open-search' as const,
};

describe('AiReportSynthesizer', () => {
  it('asks the AI generator to synthesize sources into the report template', async () => {
    const generator = {
      generate: jest.fn().mockResolvedValue([
        '# 科幻素材采集 - 2026-06-21',
        '',
        '## 主题概览',
        '',
        'AI 生成的概览。',
        '',
        '## 来源索引',
        '',
        '- [AI colonies](https://example.com/a) - example.com',
      ].join('\n')),
    };
    const synthesizer = new AiReportSynthesizer(generator, new MarkdownReportSynthesizer());

    const markdown = await synthesizer.synthesize({
      topic: '科幻',
      now: new Date('2026-06-21T08:30:00+08:00'),
      sources: [source],
    });

    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(generator.generate.mock.calls[0][0].systemPrompt).toContain('创作灵感素材库');
    expect(generator.generate.mock.calls[0][0].prompt).toContain('AI colonies');
    expect(generator.generate.mock.calls[0][0].prompt).toContain('公开页面摘要');
    expect(markdown).toContain('AI 生成的概览。');
    expect(markdown).toContain('- [AI colonies](https://example.com/a) - example.com');
  });

  it('falls back to deterministic markdown when AI generation fails', async () => {
    const generator = {
      generate: jest.fn().mockRejectedValue(new Error('AI unavailable')),
    };
    const synthesizer = new AiReportSynthesizer(generator, new MarkdownReportSynthesizer());

    const markdown = await synthesizer.synthesize({
      topic: '科幻',
      now: new Date('2026-06-21T08:30:00+08:00'),
      sources: [source],
    });

    expect(markdown).toContain('# 科幻素材采集 - 2026-06-21');
    expect(markdown).toContain('- [AI colonies](https://example.com/a) - example.com');
    expect(markdown).toContain('AI 提炼失败：AI unavailable');
  });
});
