const DEFAULT_SAVE_DIRECTORY = '采集';
const FALLBACK_TOPIC_SLUG = 'topic';

function collapseDashes(value: string): string {
  return value.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function normalizeTopicSlug(topic: string): string {
  const normalized = collapseDashes(
    topic
      .trim()
      .replace(/[\\/:*?"<>|#^[\]]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/\.+/g, '-'),
  );
  return normalized || FALLBACK_TOPIC_SLUG;
}

export function normalizeCollectorDirectory(directory: string): string {
  const normalized = directory
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/');
  return normalized || DEFAULT_SAVE_DIRECTORY;
}

export function formatCollectorDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildTopicFolderPath(saveDirectory: string, topic: string): string {
  return `${normalizeCollectorDirectory(saveDirectory)}/${normalizeTopicSlug(topic)}`;
}

export function buildReportBaseName(topic: string, now: Date): string {
  return `${formatCollectorDate(now)} ${normalizeTopicSlug(topic)}素材采集.md`;
}

export function buildTopicIndexPath(saveDirectory: string, topic: string): string {
  return `${buildTopicFolderPath(saveDirectory, topic)}/.museai-index.json`;
}
