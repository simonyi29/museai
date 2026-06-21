# Creative Inspiration Collector Design

Date: 2026-06-21
Status: Proposed

## Purpose

MuseAI will add a creative inspiration collector that turns a user-entered topic into one Obsidian Markdown report. The feature is for writing inspiration, not for copying full web fiction or building a general-purpose crawler.

The first version focuses on useful, traceable idea extraction:

- Find public web signals related to a topic.
- Combine open search with user-configured whitelist sources.
- Extract titles, links, summaries, metadata, and short public snippets where appropriate.
- Use the active AI provider to synthesize a creative inspiration report.
- Save the report into the vault under a predictable topic folder.

## User Flow

1. The user enables inspiration collection in MuseAI settings.
2. The user enters a topic, such as `科幻`.
3. MuseAI creates `采集/科幻/` in the vault if it does not already exist.
4. MuseAI collects public source candidates from open search and whitelist-filtered results.
5. MuseAI deduplicates and filters low-quality candidates.
6. MuseAI asks the selected AI provider to produce a structured inspiration report.
7. MuseAI writes the report to `采集/科幻/2026-06-21 科幻素材采集.md`.

For multi-word topics, MuseAI normalizes the folder and filename with a stable safe name, for example:

`采集/赛博朋克-太空殖民/2026-06-21 赛博朋克-太空殖民素材采集.md`

If a file already exists for the same topic and date, MuseAI should append a time suffix to avoid overwriting user content.

## Scope

### In Scope

- A settings toggle for enabling the feature.
- A default save directory setting, initially `采集`.
- A source mode that combines open search and whitelist filtering.
- A user-editable whitelist of preferred domains.
- A configurable maximum result count, defaulting to 20.
- A command or chat/sidebar action that accepts a topic and starts collection.
- Markdown report generation through the active AI provider.
- Vault file creation with automatic topic directory creation.
- Source links preserved in the output.

### Out of Scope for Version 1

- Deep crawling entire websites.
- Logging in to websites.
- Bypassing anti-bot measures or scraping restrictions.
- Bulk saving novel chapters or full copyrighted source text.
- Scheduled recurring collection.
- Splitting reports into multiple atomic Obsidian cards.
- Per-site custom adapters.

## Source Strategy

Version 1 uses the hybrid approach selected during brainstorming:

- Open search provides broad discovery.
- Whitelist domains guide or filter the search so users can prefer known useful sources.
- Generic webpage extraction gathers enough public context for summarization without trying to mirror the source page.

The whitelist is not a deep-crawl instruction in version 1. It is used to constrain search queries, prioritize results, and filter URLs.

## Report Format

The generated Markdown report should use this structure:

```md
# 科幻素材采集 - 2026-06-21

## 主题概览

## 高频设定

## 可发展灵感

## 人物原型

## 冲突类型

## 世界观元素

## 情节钩子

## 来源索引
```

Each inspiration item should be traceable to one or more source links. The report should avoid presenting copied source prose as reusable material. It should synthesize patterns, tropes, conflicts, worldbuilding elements, and story prompts.

## Proposed Components

### Collector Settings

Stored with shared MuseAI settings:

- `enabled`: boolean, default `false`
- `saveDirectory`: string, default `采集`
- `mode`: fixed to hybrid for version 1
- `whitelistDomains`: string array, default empty
- `maxResults`: number, default `20`
- `aiSynthesisEnabled`: boolean, default `true`

### Collection Orchestrator

Coordinates the complete workflow:

1. Validate the topic.
2. Resolve and create the destination folder.
3. Request source candidates.
4. Deduplicate and rank candidates.
5. Fetch lightweight page context where allowed.
6. Build the AI synthesis prompt.
7. Write the Markdown report.

### Source Candidate Provider

Provides source candidates from open search and whitelist-constrained search. Candidate records should contain:

- title
- url
- source domain
- summary or snippet
- discoveredAt
- source mode, such as `open-search` or `whitelist`

The implementation can start with an injectable search provider so future search APIs or local strategies can be added without changing the orchestration flow.

### Web Context Extractor

Fetches lightweight public page context for selected candidates. It should respect basic failure handling and avoid making repeated aggressive requests.

### AI Report Synthesizer

Uses the active provider-facing runtime path where practical. The prompt should ask for creative synthesis, not copying. The output should be constrained to the report template and include source attribution.

### Vault Writer

Uses Obsidian vault APIs to create folders and write Markdown files. It must avoid overwriting an existing report by creating a unique filename when needed.

## Error Handling

- Empty topic: show a validation error and do not run collection.
- No source candidates: create no file and show a clear message.
- Partial network failures: continue with successful candidates and mention skipped sources in the report or completion notice.
- AI synthesis failure: save a fallback source index report if useful, or surface the provider error without losing collected candidate metadata.
- File conflict: generate a unique filename with a time suffix.

## Privacy and Safety

The feature should be opt-in. It should not send vault notes to external services as part of collection unless the user explicitly uses the AI provider for synthesis. Network requests should be limited to the user's topic and configured sources.

The feature must not bypass access controls, copy protected full text, or present copyrighted prose as reusable content. It should generate original summaries, pattern analysis, and inspiration prompts with links back to sources.

## Testing Plan

- Unit test topic-to-path normalization.
- Unit test filename conflict handling.
- Unit test candidate deduplication.
- Unit test whitelist filtering.
- Unit test Markdown report assembly.
- Integration test the orchestrator with mocked search, extractor, AI synthesis, and vault writer services.
- Add UI/settings tests if the existing settings test patterns support them.

## Acceptance Criteria

- A user can enable the feature and keep the default save directory as `采集`.
- A user can enter `科幻` and receive one Markdown report under `采集/科幻/`.
- The generated report includes the agreed sections.
- The report includes source links.
- Existing files are never overwritten.
- The first implementation does not deep-crawl sites or store full source text.
