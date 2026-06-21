import { CreativeInspirationStorage } from '@/features/inspiration-collector/CreativeInspirationStorage';

describe('CreativeInspirationStorage', () => {
  it('writes to the topic folder and returns the vault path', async () => {
    const adapter = {
      exists: jest.fn().mockResolvedValue(false),
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
});
