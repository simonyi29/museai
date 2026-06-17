# MuseAI

MuseAI is a local Obsidian community plugin fork based on upstream
[YishenTu/claudian](https://github.com/YishenTu/claudian) `2.0.24`.

This repository is the Obsidian-loadable plugin project for the local `museai`
plugin. It keeps the local plugin identity as:

- `manifest.json` id: `museai`
- `manifest.json` name: `MuseAI`
- version: `2.0.24-local`

## What Is Included

- Source code under `src/`
- Build and test configuration
- Obsidian loadable build outputs: `main.js`, `styles.css`, `manifest.json`
- Provider support inherited from Claudian: Claude, Codex, OpenCode, and Pi

Compatibility note: historical storage paths, view type, settings keys, and CSS
classes still use `claudian` names, including `.claudian/` and
`claudian-view`. Do not rename these unless you are ready to migrate existing
local data.

## What Is Not Committed

Local runtime data stays out of git:

- `data.json`
- `data.json.bak-*`
- `*.bak-*`
- `node_modules/`
- local API keys, CLI paths, provider sessions, and machine-specific settings

Keep API keys and personal CLI paths in local Obsidian/plugin settings only.

## Development

Install dependencies:

```powershell
npm install --engine-strict=false
```

Run checks:

```powershell
npm run typecheck
npm test
npm run build
node --check main.js
```

The build writes `main.js` and `styles.css` at the plugin root so Obsidian can
load the plugin directly from this directory.

## Upstream Sync Notes

When pulling future changes from Claudian, keep these MuseAI-local decisions:

- Keep `id: museai` and `name: MuseAI`
- Keep `.claudian/` storage for existing sessions and settings
- Keep `claudian-*` CSS classes unless a migration is planned
- Keep OpenCode file access limited to the current workspace
- Keep provider initialization isolated so one provider failure does not block
  the full plugin
- Keep runtime client names as `museai` and `museai-aux`

If this becomes a long-term public development project, add a documented
upstream sync workflow and migration notes before doing larger refactors.
