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

  it('detects density problems even when no single sentence is catastrophic', () => {
    const service = new AiFlavorService();
    const smoothButArtificial = [
      '他看着门口，没有马上回答，只是抬眼扫过那张表。',
      '她沉默片刻，心里一沉，手指在杯沿停了一下。',
      '这意味着局面已经发生变化，本质上，他们没有更多选择。',
      '他看了她一眼，又盯着屏幕，像是在等待一个解释。',
    ].join('\n');

    const analysis = service.analyze(smoothButArtificial);

    expect(analysis.score).toBeGreaterThanOrEqual(30);
    expect(analysis.reasons).toEqual(expect.arrayContaining([
      '缓冲动作密度偏高',
      '抽象判断密度偏高',
      '同类动作重复偏多',
    ]));
  });

  it('detects rhythm that is too smooth and explanatory for a fiction scene', () => {
    const service = new AiFlavorService();
    const overlySmoothScene = [
      '雨声落在窗外，房间里的灯光保持着稳定的亮度，他看着桌面，心里明白这意味着新的风险。',
      '风从门缝里进来，她抬眼看着对方，本质上，这场谈话已经不只是误会，而是选择。',
      '走廊尽头传来脚步声，他没有马上回答，因为这说明他们必须重新判断彼此的位置。',
      '玻璃映出两个人的影子，她沉默片刻，换句话说，他们都知道局面已经改变。',
    ].join('\n\n');

    const analysis = service.analyze(overlySmoothScene);

    expect(analysis.score).toBeGreaterThanOrEqual(30);
    expect(analysis.reasons).toEqual(expect.arrayContaining([
      '段落长度过于均匀',
      '连续段落结构过于相似',
      '解释型对话或旁白偏多',
    ]));
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
