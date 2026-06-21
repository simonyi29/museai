import { SourceCandidateService } from '@/features/inspiration-collector/SourceCandidateService';

describe('SourceCandidateService', () => {
  it('combines open and whitelist searches and deduplicates URLs', async () => {
    const provider = {
      search: jest.fn()
        .mockResolvedValueOnce([
          {
            title: 'Open result',
            url: 'https://example.com/a',
            domain: 'example.com',
            snippet: 'open',
            discoveredAt: '2026-06-21T00:00:00.000Z',
            sourceMode: 'open-search',
          },
        ])
        .mockResolvedValueOnce([
          {
            title: 'Duplicate result',
            url: 'https://example.com/a',
            domain: 'example.com',
            snippet: 'duplicate',
            discoveredAt: '2026-06-21T00:00:00.000Z',
            sourceMode: 'whitelist',
          },
          {
            title: 'Whitelist result',
            url: 'https://white.example/b',
            domain: 'white.example',
            snippet: 'white',
            discoveredAt: '2026-06-21T00:00:00.000Z',
            sourceMode: 'whitelist',
          },
        ]),
    };

    const service = new SourceCandidateService(provider);
    const result = await service.collect('科幻', {
      maxResults: 10,
      whitelistDomains: ['white.example'],
    });

    expect(provider.search).toHaveBeenCalledWith('科幻', { maxResults: 10 });
    expect(provider.search).toHaveBeenCalledWith('科幻', {
      maxResults: 10,
      domains: ['white.example'],
    });
    expect(result.map((candidate) => candidate.url)).toEqual([
      'https://example.com/a',
      'https://white.example/b',
    ]);
  });
});
