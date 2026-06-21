import { CreativeInspirationCollector } from '@/features/inspiration-collector/CreativeInspirationCollector';

describe('CreativeInspirationCollector', () => {
  it('rejects empty topics', async () => {
    const collector = new CreativeInspirationCollector({
      sourceService: { collect: jest.fn() },
      extractor: { extract: jest.fn() },
      synthesizer: { synthesize: jest.fn() },
      storage: {
        loadIndex: jest.fn(),
        saveIndex: jest.fn(),
        writeReport: jest.fn(),
      },
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
      storage: {
        loadIndex: jest.fn().mockResolvedValue({ topic: '科幻', seenUrls: {} }),
        saveIndex: jest.fn().mockResolvedValue(undefined),
        writeReport: jest.fn().mockResolvedValue('采集/科幻/2026-06-21 科幻素材采集.md'),
      },
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
      skippedSourceCount: 0,
    });
  });

  it('skips sources that already exist in the topic index and records only new sources', async () => {
    const existingSource = {
      title: 'Existing',
      url: 'https://example.com/existing',
      domain: 'example.com',
      snippet: 'old',
      discoveredAt: '2026-06-21T00:00:00.000Z',
      sourceMode: 'open-search' as const,
    };
    const newSource = {
      title: 'New',
      url: 'https://example.com/new',
      domain: 'example.com',
      snippet: 'new',
      discoveredAt: '2026-06-21T00:00:00.000Z',
      sourceMode: 'open-search' as const,
    };
    const storage = {
      loadIndex: jest.fn().mockResolvedValue({
        topic: '科幻',
        seenUrls: {
          'https://example.com/existing': {
            title: 'Existing',
            domain: 'example.com',
            firstSeenAt: '2026-06-20T00:00:00.000Z',
            lastSeenAt: '2026-06-20T00:00:00.000Z',
          },
        },
      }),
      saveIndex: jest.fn().mockResolvedValue(undefined),
      writeReport: jest.fn().mockResolvedValue('采集/科幻/2026-06-21 科幻素材采集.md'),
    };
    const extractor = { extract: jest.fn().mockResolvedValue({ ...newSource, text: 'new text' }) };
    const synthesizer = { synthesize: jest.fn().mockResolvedValue('# report') };
    const collector = new CreativeInspirationCollector({
      sourceService: { collect: jest.fn().mockResolvedValue([existingSource, newSource]) },
      extractor,
      synthesizer,
      storage,
      now: () => new Date('2026-06-21T08:30:00+08:00'),
    });

    const result = await collector.collect('科幻', {
      enabled: true,
      saveDirectory: '采集',
      whitelistDomains: [],
      maxResults: 20,
      aiSynthesisEnabled: true,
    });

    expect(extractor.extract).toHaveBeenCalledTimes(1);
    expect(extractor.extract).toHaveBeenCalledWith(newSource);
    expect(synthesizer.synthesize).toHaveBeenCalledWith(expect.objectContaining({
      sources: [{ ...newSource, text: 'new text' }],
    }));
    expect(storage.saveIndex).toHaveBeenCalledWith(expect.objectContaining({
      index: expect.objectContaining({
        seenUrls: expect.objectContaining({
          'https://example.com/existing': expect.objectContaining({
            firstSeenAt: '2026-06-20T00:00:00.000Z',
            lastSeenAt: '2026-06-21T00:30:00.000Z',
          }),
          'https://example.com/new': expect.objectContaining({
            title: 'New',
            domain: 'example.com',
            firstSeenAt: '2026-06-21T00:30:00.000Z',
            lastSeenAt: '2026-06-21T00:30:00.000Z',
          }),
        }),
      }),
    }));
    expect(result).toEqual({
      filePath: '采集/科幻/2026-06-21 科幻素材采集.md',
      sourceCount: 1,
      skippedSourceCount: 1,
    });
  });

  it('returns a no-op result when every candidate has already been collected', async () => {
    const source = {
      title: 'Existing',
      url: 'https://example.com/existing',
      domain: 'example.com',
      snippet: 'old',
      discoveredAt: '2026-06-21T00:00:00.000Z',
      sourceMode: 'open-search' as const,
    };
    const storage = {
      loadIndex: jest.fn().mockResolvedValue({
        topic: '科幻',
        seenUrls: {
          'https://example.com/existing': {
            title: 'Existing',
            domain: 'example.com',
            firstSeenAt: '2026-06-20T00:00:00.000Z',
            lastSeenAt: '2026-06-20T00:00:00.000Z',
          },
        },
      }),
      saveIndex: jest.fn().mockResolvedValue(undefined),
      writeReport: jest.fn(),
    };
    const extractor = { extract: jest.fn() };
    const synthesizer = { synthesize: jest.fn() };
    const collector = new CreativeInspirationCollector({
      sourceService: { collect: jest.fn().mockResolvedValue([source]) },
      extractor,
      synthesizer,
      storage,
      now: () => new Date('2026-06-21T08:30:00+08:00'),
    });

    const result = await collector.collect('科幻', {
      enabled: true,
      saveDirectory: '采集',
      whitelistDomains: [],
      maxResults: 20,
      aiSynthesisEnabled: true,
    });

    expect(extractor.extract).not.toHaveBeenCalled();
    expect(synthesizer.synthesize).not.toHaveBeenCalled();
    expect(storage.writeReport).not.toHaveBeenCalled();
    expect(storage.saveIndex).toHaveBeenCalledWith(expect.objectContaining({
      index: expect.objectContaining({
        seenUrls: expect.objectContaining({
          'https://example.com/existing': expect.objectContaining({
            lastSeenAt: '2026-06-21T00:30:00.000Z',
          }),
        }),
      }),
    }));
    expect(result).toEqual({
      sourceCount: 0,
      skippedSourceCount: 1,
    });
  });
});
