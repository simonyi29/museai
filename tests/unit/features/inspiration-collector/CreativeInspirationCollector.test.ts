import { CreativeInspirationCollector } from '@/features/inspiration-collector/CreativeInspirationCollector';

describe('CreativeInspirationCollector', () => {
  it('rejects empty topics', async () => {
    const collector = new CreativeInspirationCollector({
      sourceService: { collect: jest.fn() },
      extractor: { extract: jest.fn() },
      synthesizer: { synthesize: jest.fn() },
      storage: { writeReport: jest.fn() },
      now: () => new Date('2026-06-21T08:30:00+08:00'),
    });

    await expect(collector.collect('   ', {
      enabled: true,
      saveDirectory: '采集',
      whitelistDomains: [],
      maxResults: 20,
      aiSynthesisEnabled: true,
    })).rejects.toThrow('Collection topic is required.');
  });

  it('runs collection and writes a report', async () => {
    const source = {
      title: 'Open result',
      url: 'https://example.com/a',
      domain: 'example.com',
      snippet: 'open',
      discoveredAt: '2026-06-21T00:00:00.000Z',
      sourceMode: 'open-search' as const,
    };
    const collector = new CreativeInspirationCollector({
      sourceService: { collect: jest.fn().mockResolvedValue([source]) },
      extractor: { extract: jest.fn().mockResolvedValue(source) },
      synthesizer: { synthesize: jest.fn().mockResolvedValue('# report') },
      storage: { writeReport: jest.fn().mockResolvedValue('采集/科幻/2026-06-21 科幻素材采集.md') },
      now: () => new Date('2026-06-21T08:30:00+08:00'),
    });

    const result = await collector.collect('科幻', {
      enabled: true,
      saveDirectory: '采集',
      whitelistDomains: [],
      maxResults: 20,
      aiSynthesisEnabled: true,
    });

    expect(result).toEqual({
      filePath: '采集/科幻/2026-06-21 科幻素材采集.md',
      sourceCount: 1,
    });
  });
});
