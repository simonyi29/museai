import {
  buildReportBaseName,
  buildTopicIndexPath,
  buildTopicFolderPath,
} from './path';
import type { CollectionIndex, CollectorStorage } from './types';

interface VaultWriter {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
}

function addTimeSuffix(fileName: string, now: Date, conflictIndex: number): string {
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const suffix = conflictIndex === 0 ? `${hours}${minutes}` : `${hours}${minutes}-${conflictIndex + 1}`;
  return fileName.replace(/\.md$/u, `-${suffix}.md`);
}

export class CreativeInspirationStorage implements CollectorStorage {
  constructor(private readonly adapter: VaultWriter) {}

  async loadIndex(input: {
    saveDirectory: string;
    topic: string;
  }): Promise<CollectionIndex> {
    const indexPath = buildTopicIndexPath(input.saveDirectory, input.topic);
    if (!(await this.adapter.exists(indexPath))) {
      return {
        topic: input.topic,
        seenUrls: {},
      };
    }

    try {
      const parsed = JSON.parse(await this.adapter.read(indexPath)) as Partial<CollectionIndex>;
      return {
        topic: typeof parsed.topic === 'string' ? parsed.topic : input.topic,
        seenUrls: parsed.seenUrls && typeof parsed.seenUrls === 'object' ? parsed.seenUrls : {},
      };
    } catch {
      return {
        topic: input.topic,
        seenUrls: {},
      };
    }
  }

  async saveIndex(input: {
    saveDirectory: string;
    topic: string;
    index: CollectionIndex;
  }): Promise<void> {
    await this.adapter.write(
      buildTopicIndexPath(input.saveDirectory, input.topic),
      `${JSON.stringify(input.index, null, 2)}\n`,
    );
  }

  async writeReport(input: {
    saveDirectory: string;
    topic: string;
    markdown: string;
    now: Date;
  }): Promise<string> {
    const folder = buildTopicFolderPath(input.saveDirectory, input.topic);
    const baseName = buildReportBaseName(input.topic, input.now);
    let filePath = `${folder}/${baseName}`;
    let conflictIndex = 0;

    while (await this.adapter.exists(filePath)) {
      filePath = `${folder}/${addTimeSuffix(baseName, input.now, conflictIndex)}`;
      conflictIndex += 1;
    }

    await this.adapter.write(filePath, input.markdown);
    return filePath;
  }
}
