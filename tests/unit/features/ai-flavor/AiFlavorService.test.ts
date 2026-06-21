import {
  AiFlavorService,
  extractCurrentMarkdownChapter,
} from '@/features/ai-flavor/AiFlavorService';

describe('AiFlavorService', () => {
  it('scores formulaic writing higher than grounded natural writing', () => {
    const service = new AiFlavorService();

    const formulaic = [
      '在当今社会，人工智能的发展具有重要意义。',
      '值得注意的是，这一现象不仅体现了技术进步，也反映了时代趋势。',
      '综上所述，我们应该充分认识其重要性，并采取有效措施加以推进。',
    ].join('\n');
    const natural = [
      '雨停的时候，楼下的早餐摊刚把炉火拧小。',
      '他站在门口犹豫了半分钟，最后还是把那封没写完的信塞回口袋。',
      '街边的水坑里映着广告牌，红得有点刺眼。',
    ].join('\n');

    expect(service.analyze(formulaic).score).toBeGreaterThan(30);
    expect(service.analyze(natural).score).toBeLessThan(30);
  });

  it('rewrites selected text until the local AI-flavor score is below the target', async () => {
    const generator = {
      generate: jest.fn()
        .mockResolvedValueOnce('在当今社会，这件事具有重要意义。综上所述，应当重视。')
        .mockResolvedValueOnce('夜里风很冷，他把话咽回去，只问她要不要再走一段。'),
    };
    const service = new AiFlavorService(generator);

    const result = await service.rewriteBelowTarget(
      '在当今社会，这一选择具有重要意义。综上所述，我们应当重视。',
      { targetScore: 30 },
    );

    expect(generator.generate).toHaveBeenCalledTimes(2);
    expect(result.score).toBeLessThanOrEqual(30);
    expect(result.text).toBe('夜里风很冷，他把话咽回去，只问她要不要再走一段。');
  });
});

describe('extractCurrentMarkdownChapter', () => {
  it('extracts the heading section around the cursor and falls back to the whole note', () => {
    const markdown = [
      '# 第一章',
      '开头',
      '## 第一节',
      '这里是当前章节。',
      '还有一行。',
      '## 第二节',
      '后文',
    ].join('\n');

    expect(extractCurrentMarkdownChapter(markdown, 3)).toBe('## 第一节\n这里是当前章节。\n还有一行。');
    expect(extractCurrentMarkdownChapter('没有标题\n只有正文', 1)).toBe('没有标题\n只有正文');
  });
});
