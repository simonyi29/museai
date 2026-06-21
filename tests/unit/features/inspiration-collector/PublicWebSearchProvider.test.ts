import { PublicWebSearchProvider } from '@/features/inspiration-collector/PublicWebSearchProvider';

describe('PublicWebSearchProvider', () => {
  it('falls back to Bing when DuckDuckGo is unavailable', async () => {
    const fetchImpl = jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(new Response(`
        <html>
          <body>
            <li class="b_algo">
              <h2><a href="https://example.com/scifi">科幻素材</a></h2>
              <p>星际殖民与 AI 冲突。</p>
            </li>
          </body>
        </html>
      `, { status: 200 }));
    const provider = new PublicWebSearchProvider(fetchImpl as unknown as typeof fetch);

    const results = await provider.search('科幻', { maxResults: 3 });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('duckduckgo.com');
    expect(String(fetchImpl.mock.calls[1][0])).toContain('bing.com');
    expect(results).toEqual([{
      title: '科幻素材',
      url: 'https://example.com/scifi',
      domain: 'example.com',
      snippet: '星际殖民与 AI 冲突。',
      discoveredAt: expect.any(String),
      sourceMode: 'open-search',
    }]);
  });

  it('uses whitelist mode and filters unexpected domains', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(new Response(`
        <li class="b_algo">
          <h2><a href="https://allowed.example/a">Allowed</a></h2>
          <p>Allowed summary.</p>
        </li>
        <li class="b_algo">
          <h2><a href="https://other.example/b">Other</a></h2>
          <p>Other summary.</p>
        </li>
      `, { status: 200 }));
    const provider = new PublicWebSearchProvider(fetchImpl as unknown as typeof fetch);

    const results = await provider.search('科幻', {
      maxResults: 5,
      domains: ['allowed.example'],
    });

    expect(String(fetchImpl.mock.calls[1][0])).toContain('site%3Aallowed.example');
    expect(results.map((result) => result.url)).toEqual(['https://allowed.example/a']);
    expect(results[0].sourceMode).toBe('whitelist');
  });
});
