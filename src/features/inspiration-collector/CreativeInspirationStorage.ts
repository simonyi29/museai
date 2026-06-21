import {
  buildReportBaseName,
  buildTopicFolderPath,
} from './path';
import type { CollectorStorage } from './types';

interface VaultWriter {
  exists(path: string): Promise<boolean>;
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
