import {
  buildReportBaseName,
  buildTopicFolderPath,
  normalizeCollectorDirectory,
  normalizeTopicSlug,
} from '@/features/inspiration-collector/path';

describe('inspiration collector paths', () => {
  it('uses Chinese topic text as a safe folder slug', () => {
    expect(normalizeTopicSlug(' 科幻 ')).toBe('科幻');
  });

  it('normalizes multi-word topics with hyphens', () => {
    expect(normalizeTopicSlug('赛博朋克 太空殖民')).toBe('赛博朋克-太空殖民');
  });

  it('removes path separators and unsupported filename characters', () => {
    expect(normalizeTopicSlug('../科幻:AI*失控?')).toBe('科幻-AI-失控');
  });

  it('falls back to topic when normalized topic is empty', () => {
    expect(normalizeTopicSlug('///')).toBe('topic');
  });

  it('normalizes save directory to a vault-relative folder', () => {
    expect(normalizeCollectorDirectory(' /采集//素材/ ')).toBe('采集/素材');
    expect(normalizeCollectorDirectory('')).toBe('采集');
  });

  it('builds the topic folder under the configured save directory', () => {
    expect(buildTopicFolderPath('采集', '科幻')).toBe('采集/科幻');
  });

  it('builds the dated report base name', () => {
    expect(buildReportBaseName('科幻', new Date('2026-06-21T08:30:00+08:00'))).toBe(
      '2026-06-21 科幻素材采集.md',
    );
  });
});
