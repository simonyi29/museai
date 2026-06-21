import { MarkdownReportSynthesizer } from '@/features/inspiration-collector/MarkdownReportSynthesizer';

describe('MarkdownReportSynthesizer', () => {
  it('builds the agreed report structure and source index', async () => {
    const synthesizer = new MarkdownReportSynthesizer();

    const markdown = await synthesizer.synthesize({
      topic: '科幻',
      now: new Date('2026-06-21T08:30:00+08:00'),
      sources: [{
        title: 'AI colonies',
        url: 'https://example.com/a',
        domain: 'example.com',
        snippet: 'A public summary',
        discoveredAt: '2026-06-21T00:00:00.000Z',
        sourceMode: 'open-search',
      }],
    });

    expect(markdown).toContain('# 科幻素材采集 - 2026-06-21');
    expect(markdown).toContain('## 主题概览');
    expect(markdown).toContain('## 高频设定');
    expect(markdown).toContain('## 可发展灵感');
    expect(markdown).toContain('## 来源索引');
    expect(markdown).toContain('- [AI colonies](https://example.com/a) - example.com');
  });
});
