# Creative Inspiration Collector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in MuseAI creative inspiration collector that accepts a topic, gathers source candidates, synthesizes one Markdown report, and saves it under `采集/{主题}/`.

**Architecture:** Keep the feature isolated under `src/features/inspiration-collector/`. Core collector logic is dependency-injected and testable without Obsidian, while integration points stay small: shared settings/defaults, a settings UI section, a `/collect` built-in command, and a plugin-owned service instance.

**Tech Stack:** TypeScript, Obsidian plugin APIs, existing `VaultFileAdapter`, existing built-in command parser, Jest unit tests.

---

## File Structure

- Create `src/features/inspiration-collector/types.ts` for settings, source candidate, extractor, synthesizer, writer, and collector result types.
- Create `src/features/inspiration-collector/path.ts` for topic normalization and unique report path generation.
- Create `src/features/inspiration-collector/SourceCandidateService.ts` for hybrid open-search plus whitelist candidate orchestration.
- Create `src/features/inspiration-collector/MarkdownReportSynthesizer.ts` for deterministic fallback report assembly and AI synthesizer interfaces.
- Create `src/features/inspiration-collector/CreativeInspirationStorage.ts` for vault-relative folder/file creation through `VaultFileAdapter`.
- Create `src/features/inspiration-collector/CreativeInspirationCollector.ts` for the end-to-end workflow.
- Create `src/features/inspiration-collector/index.ts` for exports.
- Modify `src/core/types/settings.ts` and `src/app/settings/defaultSettings.ts` for collector settings.
- Modify `src/features/settings/ClaudianSettings.ts`, `src/i18n/types.ts`, and all files under `src/i18n/locales/*.json` for settings UI text.
- Modify `src/core/commands/builtInCommands.ts` and `src/features/chat/controllers/InputController.ts` for `/collect`.
- Modify `src/main.ts` to create and expose the collector service.
- Add tests under `tests/unit/features/inspiration-collector/`.
- Extend `tests/unit/core/commands/builtInCommands.test.ts` and `tests/unit/features/chat/controllers/InputController.test.ts`.

## Task 1: Collector Settings and Path Utilities

**Files:**
- Create: `src/features/inspiration-collector/types.ts`
- Create: `src/features/inspiration-collector/path.ts`
- Create: `src/features/inspiration-collector/index.ts`
- Modify: `src/core/types/settings.ts`
- Modify: `src/app/settings/defaultSettings.ts`
- Test: `tests/unit/features/inspiration-collector/path.test.ts`

- [ ] **Step 1: Write failing path utility tests**

Create `tests/unit/features/inspiration-collector/path.test.ts`:

```ts
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
```

- [ ] **Step 2: Run path tests and confirm failure**

Run:

```bash
npm run test -- tests/unit/features/inspiration-collector/path.test.ts
```

Expected: FAIL because `@/features/inspiration-collector/path` does not exist.

- [ ] **Step 3: Add settings types and defaults**

In `src/core/types/settings.ts`, add:

```ts
export interface CreativeInspirationCollectorSettings {
  enabled: boolean;
  saveDirectory: string;
  whitelistDomains: string[];
  maxResults: number;
  aiSynthesisEnabled: boolean;
}
```

Add this field to `ClaudianSettings` near content settings:

```ts
creativeInspirationCollector: CreativeInspirationCollectorSettings;
```

In `src/app/settings/defaultSettings.ts`, add:

```ts
  creativeInspirationCollector: {
    enabled: false,
    saveDirectory: '采集',
    whitelistDomains: [],
    maxResults: 20,
    aiSynthesisEnabled: true,
  },
```

- [ ] **Step 4: Add implementation files**

Create `src/features/inspiration-collector/types.ts`:

```ts
import type { CreativeInspirationCollectorSettings } from '../../core/types/settings';

export type InspirationCollectorSettings = CreativeInspirationCollectorSettings;

export interface SourceCandidate {
  title: string;
  url: string;
  domain: string;
  snippet?: string;
  discoveredAt: string;
  sourceMode: 'open-search' | 'whitelist';
}

export interface ExtractedSourceContext extends SourceCandidate {
  text?: string;
}

export interface SourceSearchProvider {
  search(topic: string, options: { maxResults: number; domains?: string[] }): Promise<SourceCandidate[]>;
}

export interface WebContextExtractor {
  extract(candidate: SourceCandidate): Promise<ExtractedSourceContext>;
}

export interface ReportSynthesizer {
  synthesize(input: {
    topic: string;
    sources: ExtractedSourceContext[];
    now: Date;
  }): Promise<string>;
}

export interface CollectorStorage {
  writeReport(input: {
    saveDirectory: string;
    topic: string;
    markdown: string;
    now: Date;
  }): Promise<string>;
}

export interface CollectionResult {
  filePath: string;
  sourceCount: number;
}
```

Create `src/features/inspiration-collector/path.ts`:

```ts
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
```

Create `src/features/inspiration-collector/index.ts`:

```ts
export * from './path';
export * from './types';
```

- [ ] **Step 5: Run path tests**

Run:

```bash
npm run test -- tests/unit/features/inspiration-collector/path.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/types/settings.ts src/app/settings/defaultSettings.ts src/features/inspiration-collector tests/unit/features/inspiration-collector/path.test.ts
git commit -m "feat: add inspiration collector settings and paths"
```

## Task 2: Storage and Report Synthesis Core

**Files:**
- Create: `src/features/inspiration-collector/CreativeInspirationStorage.ts`
- Create: `src/features/inspiration-collector/MarkdownReportSynthesizer.ts`
- Modify: `src/features/inspiration-collector/index.ts`
- Test: `tests/unit/features/inspiration-collector/CreativeInspirationStorage.test.ts`
- Test: `tests/unit/features/inspiration-collector/MarkdownReportSynthesizer.test.ts`

- [ ] **Step 1: Write failing storage tests**

Create `tests/unit/features/inspiration-collector/CreativeInspirationStorage.test.ts`:

```ts
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
```

- [ ] **Step 2: Write failing synthesizer tests**

Create `tests/unit/features/inspiration-collector/MarkdownReportSynthesizer.test.ts`:

```ts
import { MarkdownReportSynthesizer } from '@/features/inspiration-collector/MarkdownReportSynthesizer';

describe('MarkdownReportSynthesizer', () => {
  it('builds the agreed report structure and source index', async () => {
    const synthesizer = new MarkdownReportSynthesizer();

    const markdown = await synthesizer.synthesize({
      topic: '科幻',
      now: new Date('2026-06-21T08:30:00+08:00'),
      sources: [{
        title: 'AI colonies',
        url: 'https://example.com/a',
        domain: 'example.com',
        snippet: 'A public summary',
        discoveredAt: '2026-06-21T00:00:00.000Z',
        sourceMode: 'open-search',
      }],
    });

    expect(markdown).toContain('# 科幻素材采集 - 2026-06-21');
    expect(markdown).toContain('## 主题概览');
    expect(markdown).toContain('## 高频设定');
    expect(markdown).toContain('## 可发展灵感');
    expect(markdown).toContain('## 来源索引');
    expect(markdown).toContain('- [AI colonies](https://example.com/a) - example.com');
  });
});
```

- [ ] **Step 3: Run tests and confirm failure**

Run:

```bash
npm run test -- tests/unit/features/inspiration-collector/CreativeInspirationStorage.test.ts tests/unit/features/inspiration-collector/MarkdownReportSynthesizer.test.ts
```

Expected: FAIL because files do not exist.

- [ ] **Step 4: Implement storage and synthesizer**

Create `src/features/inspiration-collector/CreativeInspirationStorage.ts`:

```ts
import {
  buildReportBaseName,
  buildTopicFolderPath,
} from './path';
import type { CollectorStorage } from './types';

interface VaultWriter {
  exists(path: string): Promise<boolean>;
  write(path: string, content: string): Promise<void>;
}

function addTimeSuffix(fileName: string, now: Date): string {
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return fileName.replace(/\.md$/u, `-${hours}${minutes}.md`);
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

    if (await this.adapter.exists(filePath)) {
      filePath = `${folder}/${addTimeSuffix(baseName, input.now)}`;
    }

    await this.adapter.write(filePath, input.markdown);
    return filePath;
  }
}
```

Create `src/features/inspiration-collector/MarkdownReportSynthesizer.ts`:

```ts
import { formatCollectorDate } from './path';
import type { ExtractedSourceContext, ReportSynthesizer } from './types';

function buildSourceIndex(sources: ExtractedSourceContext[]): string {
  if (sources.length === 0) {
    return '- 本次未收集到可用来源。';
  }

  return sources
    .map((source) => `- [${source.title}](${source.url}) - ${source.domain}`)
    .join('\n');
}

export class MarkdownReportSynthesizer implements ReportSynthesizer {
  async synthesize(input: {
    topic: string;
    sources: ExtractedSourceContext[];
    now: Date;
  }): Promise<string> {
    const date = formatCollectorDate(input.now);

    return [
      `# ${input.topic}素材采集 - ${date}`,
      '',
      '## 主题概览',
      '',
      `本次围绕“${input.topic}”收集了 ${input.sources.length} 条公开网络线索。`,
      '',
      '## 高频设定',
      '',
      '- 待 AI 提炼。',
      '',
      '## 可发展灵感',
      '',
      '- 待 AI 提炼。',
      '',
      '## 人物原型',
      '',
      '- 待 AI 提炼。',
      '',
      '## 冲突类型',
      '',
      '- 待 AI 提炼。',
      '',
      '## 世界观元素',
      '',
      '- 待 AI 提炼。',
      '',
      '## 情节钩子',
      '',
      '- 待 AI 提炼。',
      '',
      '## 来源索引',
      '',
      buildSourceIndex(input.sources),
      '',
    ].join('\n');
  }
}
```

Update `src/features/inspiration-collector/index.ts`:

```ts
export * from './CreativeInspirationStorage';
export * from './MarkdownReportSynthesizer';
export * from './path';
export * from './types';
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- tests/unit/features/inspiration-collector/CreativeInspirationStorage.test.ts tests/unit/features/inspiration-collector/MarkdownReportSynthesizer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/inspiration-collector tests/unit/features/inspiration-collector
git commit -m "feat: add inspiration collector storage and report synthesis"
```

## Task 3: Source Candidate Service and Orchestrator

**Files:**
- Create: `src/features/inspiration-collector/SourceCandidateService.ts`
- Create: `src/features/inspiration-collector/CreativeInspirationCollector.ts`
- Modify: `src/features/inspiration-collector/index.ts`
- Test: `tests/unit/features/inspiration-collector/SourceCandidateService.test.ts`
- Test: `tests/unit/features/inspiration-collector/CreativeInspirationCollector.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `tests/unit/features/inspiration-collector/SourceCandidateService.test.ts`:

```ts
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
```

Create `tests/unit/features/inspiration-collector/CreativeInspirationCollector.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm run test -- tests/unit/features/inspiration-collector/SourceCandidateService.test.ts tests/unit/features/inspiration-collector/CreativeInspirationCollector.test.ts
```

Expected: FAIL because implementation files do not exist.

- [ ] **Step 3: Implement source service and orchestrator**

Create `src/features/inspiration-collector/SourceCandidateService.ts`:

```ts
import type { SourceCandidate, SourceSearchProvider } from './types';

export class SourceCandidateService {
  constructor(private readonly provider: SourceSearchProvider) {}

  async collect(topic: string, options: {
    maxResults: number;
    whitelistDomains: string[];
  }): Promise<SourceCandidate[]> {
    const openResults = await this.provider.search(topic, { maxResults: options.maxResults });
    const whitelistResults = options.whitelistDomains.length > 0
      ? await this.provider.search(topic, {
        maxResults: options.maxResults,
        domains: options.whitelistDomains,
      })
      : [];

    const seen = new Set<string>();
    const merged: SourceCandidate[] = [];
    for (const candidate of [...openResults, ...whitelistResults]) {
      const key = candidate.url.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(candidate);
      if (merged.length >= options.maxResults) break;
    }
    return merged;
  }
}
```

Create `src/features/inspiration-collector/CreativeInspirationCollector.ts`:

```ts
import type {
  CollectionResult,
  CollectorStorage,
  ExtractedSourceContext,
  InspirationCollectorSettings,
  ReportSynthesizer,
  WebContextExtractor,
} from './types';
import { SourceCandidateService } from './SourceCandidateService';

interface CreativeInspirationCollectorDeps {
  sourceService: Pick<SourceCandidateService, 'collect'>;
  extractor: WebContextExtractor;
  synthesizer: ReportSynthesizer;
  storage: CollectorStorage;
  now?: () => Date;
}

export class CreativeInspirationCollector {
  constructor(private readonly deps: CreativeInspirationCollectorDeps) {}

  async collect(topic: string, settings: InspirationCollectorSettings): Promise<CollectionResult> {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      throw new Error('Collection topic is required.');
    }
    if (!settings.enabled) {
      throw new Error('Creative inspiration collection is disabled.');
    }

    const now = this.deps.now?.() ?? new Date();
    const candidates = await this.deps.sourceService.collect(trimmedTopic, {
      maxResults: settings.maxResults,
      whitelistDomains: settings.whitelistDomains,
    });
    if (candidates.length === 0) {
      throw new Error('No source candidates were found.');
    }

    const contexts: ExtractedSourceContext[] = [];
    for (const candidate of candidates) {
      try {
        contexts.push(await this.deps.extractor.extract(candidate));
      } catch {
        contexts.push(candidate);
      }
    }

    const markdown = await this.deps.synthesizer.synthesize({
      topic: trimmedTopic,
      sources: contexts,
      now,
    });
    const filePath = await this.deps.storage.writeReport({
      saveDirectory: settings.saveDirectory,
      topic: trimmedTopic,
      markdown,
      now,
    });

    return {
      filePath,
      sourceCount: contexts.length,
    };
  }
}
```

Update `src/features/inspiration-collector/index.ts`:

```ts
export * from './CreativeInspirationCollector';
export * from './CreativeInspirationStorage';
export * from './MarkdownReportSynthesizer';
export * from './path';
export * from './SourceCandidateService';
export * from './types';
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- tests/unit/features/inspiration-collector/SourceCandidateService.test.ts tests/unit/features/inspiration-collector/CreativeInspirationCollector.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/inspiration-collector tests/unit/features/inspiration-collector
git commit -m "feat: add inspiration collector orchestration"
```

## Task 4: Command and Plugin Integration

**Files:**
- Modify: `src/core/commands/builtInCommands.ts`
- Modify: `src/features/chat/controllers/InputController.ts`
- Modify: `src/main.ts`
- Test: `tests/unit/core/commands/builtInCommands.test.ts`
- Test: `tests/unit/features/chat/controllers/InputController.test.ts`

- [ ] **Step 1: Add failing command parser tests**

Append to `tests/unit/core/commands/builtInCommands.test.ts`:

```ts
    it('detects /collect command with a topic', () => {
      const result = detectBuiltInCommand('/collect 科幻');
      expect(result).not.toBeNull();
      expect(result?.command.name).toBe('collect');
      expect(result?.command.action).toBe('collect');
      expect(result?.args).toBe('科幻');
    });
```

Also update expectations that currently assume four built-ins:

```ts
expect(commands.map(c => c.name)).toEqual(['clear', 'add-dir', 'resume', 'fork', 'collect']);
```

- [ ] **Step 2: Run parser tests and confirm failure**

Run:

```bash
npm run test -- tests/unit/core/commands/builtInCommands.test.ts
```

Expected: FAIL because `/collect` is unknown.

- [ ] **Step 3: Add built-in command metadata**

In `src/core/commands/builtInCommands.ts`, update:

```ts
export type BuiltInCommandAction = 'clear' | 'add-dir' | 'resume' | 'fork' | 'collect';
```

Add to `BUILT_IN_COMMANDS`:

```ts
  {
    name: 'collect',
    aliases: ['collect-material'],
    description: 'Collect creative inspiration for a topic',
    action: 'collect',
    hasArgs: true,
    argumentHint: '[topic]',
  },
```

- [ ] **Step 4: Add collector dependency and execution path**

In `src/features/chat/controllers/InputController.ts`, add a dependency to `InputControllerDeps`:

```ts
  runInspirationCollection?: (topic: string) => Promise<{ filePath: string; sourceCount: number }>;
```

In `executeBuiltInCommand`, add a case:

```ts
      case 'collect': {
        if (!args.trim()) {
          new Notice('请输入要采集的主题，例如：/collect 科幻');
          return;
        }
        if (!this.deps.runInspirationCollection) {
          new Notice('素材采集服务不可用。');
          return;
        }
        try {
          new Notice(`开始采集素材：${args.trim()}`);
          const result = await this.deps.runInspirationCollection(args.trim());
          new Notice(`素材采集完成：${result.filePath}（${result.sourceCount} 个来源）`);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          new Notice(`素材采集失败：${message}`);
        }
        return;
      }
```

In `src/main.ts`, import collector classes and create a private collector field:

```ts
import {
  CreativeInspirationCollector,
  CreativeInspirationStorage,
  MarkdownReportSynthesizer,
  SourceCandidateService,
} from './features/inspiration-collector';
```

Add methods:

```ts
  private inspirationCollector: CreativeInspirationCollector | null = null;

  getInspirationCollector(): CreativeInspirationCollector {
    if (!this.inspirationCollector) {
      const emptySearchProvider = {
        search: async () => [],
      };
      const passthroughExtractor = {
        extract: async (candidate) => candidate,
      };
      this.inspirationCollector = new CreativeInspirationCollector({
        sourceService: new SourceCandidateService(emptySearchProvider),
        extractor: passthroughExtractor,
        synthesizer: new MarkdownReportSynthesizer(),
        storage: new CreativeInspirationStorage(this.storage.getAdapter()),
      });
    }
    return this.inspirationCollector;
  }

  async runInspirationCollection(topic: string): Promise<{ filePath: string; sourceCount: number }> {
    return this.getInspirationCollector().collect(topic, this.settings.creativeInspirationCollector);
  }
```

When constructing `InputController` dependencies in the chat view/tab code, pass:

```ts
runInspirationCollection: (topic) => plugin.runInspirationCollection(topic),
```

If `InputController` deps are assembled outside `main.ts`, place the dependency there and keep `main.ts` as the service owner.

- [ ] **Step 5: Run command tests**

Run:

```bash
npm run test -- tests/unit/core/commands/builtInCommands.test.ts tests/unit/features/chat/controllers/InputController.test.ts
```

Expected: PASS after updating existing mocks to include `runInspirationCollection` only where needed.

- [ ] **Step 6: Commit**

```bash
git add src/core/commands/builtInCommands.ts src/features/chat/controllers/InputController.ts src/main.ts tests/unit/core/commands/builtInCommands.test.ts tests/unit/features/chat/controllers/InputController.test.ts
git commit -m "feat: add collect command integration"
```

## Task 5: Settings UI and Localization

**Files:**
- Modify: `src/features/settings/ClaudianSettings.ts`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: all other locale JSON files
- Test: `tests/unit/i18n/locales.test.ts`

- [ ] **Step 1: Add i18n keys**

In `src/i18n/types.ts`, add keys:

```ts
  | 'settings.inspirationCollector'
  | 'settings.inspirationCollectorEnabled.name'
  | 'settings.inspirationCollectorEnabled.desc'
  | 'settings.inspirationCollectorSaveDirectory.name'
  | 'settings.inspirationCollectorSaveDirectory.desc'
  | 'settings.inspirationCollectorWhitelist.name'
  | 'settings.inspirationCollectorWhitelist.desc'
  | 'settings.inspirationCollectorMaxResults.name'
  | 'settings.inspirationCollectorMaxResults.desc'
  | 'settings.inspirationCollectorAiSynthesis.name'
  | 'settings.inspirationCollectorAiSynthesis.desc'
```

In `src/i18n/locales/en.json`, add under `settings`:

```json
"inspirationCollector": "Creative inspiration collection",
"inspirationCollectorEnabled": {
  "name": "Enable inspiration collection",
  "desc": "Collect public web signals for a topic and save one Markdown inspiration report."
},
"inspirationCollectorSaveDirectory": {
  "name": "Save directory",
  "desc": "Vault folder where collected topic folders are created."
},
"inspirationCollectorWhitelist": {
  "name": "Whitelist domains",
  "desc": "One domain per line. These domains guide and filter preferred collection sources."
},
"inspirationCollectorMaxResults": {
  "name": "Maximum results",
  "desc": "Maximum source candidates to keep for one collection run."
},
"inspirationCollectorAiSynthesis": {
  "name": "AI synthesis",
  "desc": "Ask the active AI provider to synthesize source signals into creative inspiration."
}
```

Add equivalent values to all locale files. It is acceptable to use English fallback text for non-Chinese locales if no translation is available. Use Simplified Chinese for `zh-CN` and Traditional Chinese for `zh-TW`.

- [ ] **Step 2: Add settings controls**

In `src/features/settings/ClaudianSettings.ts`, inside `renderGeneralTab` after the Content section's media folder setting, add:

```ts
    new Setting(container).setName(t('settings.inspirationCollector')).setHeading();

    new Setting(container)
      .setName(t('settings.inspirationCollectorEnabled.name'))
      .setDesc(t('settings.inspirationCollectorEnabled.desc'))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.creativeInspirationCollector.enabled)
          .onChange(async (value) => {
            this.plugin.settings.creativeInspirationCollector.enabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(container)
      .setName(t('settings.inspirationCollectorSaveDirectory.name'))
      .setDesc(t('settings.inspirationCollectorSaveDirectory.desc'))
      .addText((text) => {
        text
          .setPlaceholder('采集')
          .setValue(this.plugin.settings.creativeInspirationCollector.saveDirectory)
          .onChange(async (value) => {
            this.plugin.settings.creativeInspirationCollector.saveDirectory = value.trim() || '采集';
            await this.plugin.saveSettings();
          });
      });

    new Setting(container)
      .setName(t('settings.inspirationCollectorWhitelist.name'))
      .setDesc(t('settings.inspirationCollectorWhitelist.desc'))
      .addTextArea((text) => {
        text
          .setPlaceholder('example.com\nexample.org')
          .setValue(this.plugin.settings.creativeInspirationCollector.whitelistDomains.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.creativeInspirationCollector.whitelistDomains = value
              .split(/\r?\n/)
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 3;
      });

    new Setting(container)
      .setName(t('settings.inspirationCollectorMaxResults.name'))
      .setDesc(t('settings.inspirationCollectorMaxResults.desc'))
      .addSlider((slider) => {
        slider
          .setLimits(5, 50, 5)
          .setValue(this.plugin.settings.creativeInspirationCollector.maxResults)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.creativeInspirationCollector.maxResults = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(container)
      .setName(t('settings.inspirationCollectorAiSynthesis.name'))
      .setDesc(t('settings.inspirationCollectorAiSynthesis.desc'))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.creativeInspirationCollector.aiSynthesisEnabled)
          .onChange(async (value) => {
            this.plugin.settings.creativeInspirationCollector.aiSynthesisEnabled = value;
            await this.plugin.saveSettings();
          })
      );
```

- [ ] **Step 3: Run locale tests**

Run:

```bash
npm run test -- tests/unit/i18n/locales.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/ClaudianSettings.ts src/i18n/types.ts src/i18n/locales
git commit -m "feat: add inspiration collector settings UI"
```

## Task 6: Verification and Build

**Files:**
- Modify only files needed to fix test, typecheck, lint, or build failures.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- tests/unit/features/inspiration-collector tests/unit/core/commands/builtInCommands.test.ts tests/unit/i18n/locales.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit any verification fixes**

If fixes were needed:

```bash
git add <changed files>
git commit -m "fix: stabilize inspiration collector integration"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: settings, default `采集` directory, topic folder creation, one Markdown report, source link preservation, no overwrite behavior, and `/collect` entry are covered.
- Known version 1 limitation: network search is behind an injectable provider. The default implementation is a no-result stub until a concrete search API is configured, so the first code slice establishes the plugin feature boundary without deep crawling.
- Incomplete-marker scan: this plan intentionally avoids deferred work markers in code snippets; every step has exact files and commands.
- Type consistency: `creativeInspirationCollector`, `CreativeInspirationCollector`, `SourceCandidateService`, and result shape `{ filePath, sourceCount }` are consistent across tasks.
