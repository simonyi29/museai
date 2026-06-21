import { CreativeInspirationStorage } from '@/features/inspiration-collector/CreativeInspirationStorage';

describe('CreativeInspirationStorage', () => {
  it('writes to the topic folder and returns the vault path', async () => {
    const adapter = {
      exists: jest.fn().mockResolvedValue(false),
      read: jest.fn(),
      write: jest.fn().mockResolvedValue(undefined),
    };
    const storage = new CreativeInspirationStorage(adapter);

    const path = await storage.writeReport({
      saveDirectory: '采集',
      topic: '科幻',
      markdown: '# report',
      now: new Date('2026-06-21T08:30:00+08:00'),
    });

    expect(path).toBe('采集/科幻/2026-06-21 科幻素材采集.md');
    expect(adapter.write).toHaveBeenCalledWith(path, '# report');
  });

  it('adds a time suffix when the dated report already exists', async () => {
    const adapter = {
      exists: jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      read: jest.fn(),
      write: jest.fn().mockResolvedValue(undefined),
    };
    const storage = new CreativeInspirationStorage(adapter);

    const path = await storage.writeReport({
      saveDirectory: '采集',
      topic: '科幻',
      markdown: '# report',
      now: new Date('2026-06-21T15:30:00+08:00'),
    });

    expect(path).toBe('采集/科幻/2026-06-21 科幻素材采集-1530.md');
  });

  it('loads an empty topic index when the index file does not exist', async () => {
    const adapter = {
      exists: jest.fn().mockResolvedValue(false),
      read: jest.fn(),
      write: jest.fn(),
    };
    const storage = new CreativeInspirationStorage(adapter);

    const index = await storage.loadIndex({
      saveDirectory: '采集',
      topic: '科幻',
    });

    expect(index).toEqual({
      topic: '科幻',
      seenUrls: {},
    });
    expect(adapter.read).not.toHaveBeenCalled();
  });

  it('writes the topic index under the topic collection folder', async () => {
    const adapter = {
      exists: jest.fn().mockResolvedValue(false),
      read: jest.fn(),
      write: jest.fn().mockResolvedValue(undefined),
    };
    const storage = new CreativeInspirationStorage(adapter);

    await storage.saveIndex({
      saveDirectory: '采集',
      topic: '科幻',
      index: {
        topic: '科幻',
        seenUrls: {
          'https://example.com/a': {
            title: 'A',
            domain: 'example.com',
            firstSeenAt: '2026-06-21T00:30:00.000Z',
            lastSeenAt: '2026-06-21T00:30:00.000Z',
          },
        },
      },
    });

    expect(adapter.write).toHaveBeenCalledWith(
      '采集/科幻/.museai-index.json',
      expect.stringContaining('"https://example.com/a"'),
    );
  });
});
