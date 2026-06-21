import { requestUrl } from 'obsidian';
import { PublicWebSearchProvider } from '@/features/inspiration-collector/PublicWebSearchProvider';

describe('PublicWebSearchProvider', () => {
  const requestUrlMock = requestUrl as jest.MockedFunction<typeof requestUrl>;

  afterEach(() => {
    requestUrlMock.mockReset();
  });

  it('uses Obsidian requestUrl by default so external searches bypass renderer fetch limits', async () => {
    requestUrlMock.mockResolvedValue({
      arrayBuffer: new ArrayBuffer(0),
      headers: {},
      json: {},
      status: 200,
      text: `
        <li class="b_algo">
          <h2><a href="https://example.com/scifi">科幻素材</a></h2>
          <p>星际殖民与 AI 冲突。</p>
        </li>
      `,
    });
    const provider = new PublicWebSearchProvider();

    const results = await provider.search('科幻', { maxResults: 1 });

    expect(requestUrlMock).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      url: expect.stringContaining('duckduckgo.com'),
    }));
    expect(results[0].url).toBe('https://example.com/scifi');
  });

  it('falls back to Bing when DuckDuckGo is unavailable', async () => {
    const httpClient = {
      request: jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        headers: {},
        status: 200,
        text: `
        <html>
          <body>
            <li class="b_algo">
              <h2><a href="https://example.com/scifi">科幻素材</a></h2>
              <p>星际殖民与 AI 冲突。</p>
            </li>
          </body>
        </html>
      `,
      }),
    };
    const provider = new PublicWebSearchProvider(httpClient);

    const results = await provider.search('科幻', { maxResults: 3 });

    expect(httpClient.request).toHaveBeenCalledTimes(2);
    expect(String(httpClient.request.mock.calls[0][0])).toContain('duckduckgo.com');
    expect(String(httpClient.request.mock.calls[1][0])).toContain('bing.com');
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
    const httpClient = {
      request: jest.fn()
      .mockResolvedValueOnce({ headers: {}, status: 500, text: '' })
      .mockResolvedValueOnce({
        headers: {},
        status: 200,
        text: `
        <li class="b_algo">
          <h2><a href="https://allowed.example/a">Allowed</a></h2>
          <p>Allowed summary.</p>
        </li>
        <li class="b_algo">
          <h2><a href="https://other.example/b">Other</a></h2>
          <p>Other summary.</p>
        </li>
      `,
      }),
    };
    const provider = new PublicWebSearchProvider(httpClient);

    const results = await provider.search('科幻', {
      maxResults: 5,
      domains: ['allowed.example'],
    });

    expect(String(httpClient.request.mock.calls[1][0])).toContain('site%3Aallowed.example');
    expect(results.map((result) => result.url)).toEqual(['https://allowed.example/a']);
    expect(results[0].sourceMode).toBe('whitelist');
  });
});
