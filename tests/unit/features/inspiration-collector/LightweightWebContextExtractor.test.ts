import { requestUrl } from 'obsidian';
import { LightweightWebContextExtractor } from '@/features/inspiration-collector/LightweightWebContextExtractor';

describe('LightweightWebContextExtractor', () => {
  const requestUrlMock = requestUrl as jest.MockedFunction<typeof requestUrl>;

  afterEach(() => {
    requestUrlMock.mockReset();
  });

  it('uses Obsidian requestUrl by default so page extraction bypasses renderer fetch limits', async () => {
    requestUrlMock.mockResolvedValue({
      arrayBuffer: new ArrayBuffer(0),
      headers: { 'content-type': 'text/html' },
      json: {},
      status: 200,
      text: '<main>星际殖民与 AI 冲突。</main>',
    });
    const extractor = new LightweightWebContextExtractor();

    const result = await extractor.extract({
      title: '科幻素材',
      url: 'https://example.com/scifi',
      domain: 'example.com',
      discoveredAt: '2026-06-21T00:00:00.000Z',
      sourceMode: 'open-search',
    });

    expect(requestUrlMock).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      url: 'https://example.com/scifi',
    }));
    expect(result.text).toBe('星际殖民与 AI 冲突。');
  });
});
