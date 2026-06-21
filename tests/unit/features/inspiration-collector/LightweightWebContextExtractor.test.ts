import { LightweightWebContextExtractor } from '@/features/inspiration-collector/LightweightWebContextExtractor';

describe('LightweightWebContextExtractor', () => {
  const originalWindowFetch = window.fetch;

  afterEach(() => {
    window.fetch = originalWindowFetch;
  });

  it('uses window.fetch with the correct Window receiver by default', async () => {
    window.fetch = jest.fn(function (this: Window) {
      if (this !== window) {
        throw new TypeError('Illegal invocation');
      }
      return Promise.resolve(new Response('<main>星际殖民与 AI 冲突。</main>', {
        headers: { 'content-type': 'text/html' },
        status: 200,
      }));
    }) as unknown as typeof fetch;
    const extractor = new LightweightWebContextExtractor();

    const result = await extractor.extract({
      title: '科幻素材',
      url: 'https://example.com/scifi',
      domain: 'example.com',
      discoveredAt: '2026-06-21T00:00:00.000Z',
      sourceMode: 'open-search',
    });

    expect(result.text).toBe('星际殖民与 AI 冲突。');
  });
});
