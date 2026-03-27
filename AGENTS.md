# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- OPENSPEC:START -->

## OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## Project Overview

ExFig Action is a TypeScript-based GitHub Action that exports Figma assets using ExFig CLI. Supports macOS and Linux only.

**Key Files:**

- `action.yml` - Action definition (inputs/outputs, runs: node22)
- `src/index.ts` - Main logic (~1050 lines)
- `src/types.ts` - TypeScript interfaces
- `dist/index.js` - Compiled bundle (committed)
- `hk.pkl` - Linting/formatting configuration

## Development

`./bin/mise` is self-contained bootstrap (no global install needed). It manages Node.js 22 and all tools.

```bash
./bin/mise run lint         # Format, lint and fix all files
./bin/mise run changelog    # Regenerate CHANGELOG.md
./bin/mise run test         # Run unit tests
./bin/mise run build        # Build dist/index.js
```

Git hooks auto-configure via `hooks.enter` in mise.toml.

**Note:** Run `npm ci` first if `node_modules/` is missing. `npx jest` works when `./bin/mise run test` fails to find jest.

## Code Style

- TypeScript strict mode, ESLint (flat config `eslint.config.mjs`) + Prettier via hk
- Use `@actions/exec` for subprocess execution
- Conventional Commits: `<type>(<scope>): <description>`

## Architecture

Single Node.js process executes: validate inputs → resolve version → cache/download binary → run ExFig → parse output → save cache → Slack notification.

**Binary naming:** `ExFig` (capital letters), not `exfig`.

**Pkl dependency:** ExFig v2 requires `pkl` CLI (Apple Pkl). Version pinned as `PKL_VERSION` in `src/index.ts` **and** `.github/workflows/test.yml`. Update both when bumping. Both binaries cached together in `installDir`.

**ESM gotcha:** `@actions/*` v3+ are ESM-only. Jest needs `jest-resolver.js` (custom resolver) to find them. `tsconfig.json` uses `module: ESNext` + `moduleResolution: bundler` for ncc compatibility.

**Cache gotcha:** `saveCache([installDir])` captures entire directory. New binaries must be installed _before_ `saveCache()` call in `run()` — not inside `downloadBinary()`.

**Slack notification:** Uses raw `https.request` (no libraries). All errors are non-fatal (`resolve()`, never `reject()`). Always `res.resume()` response body to avoid holding the socket open.

## Testing

- Unit tests: `parseExFigOutput`, `categorizeError`, `formatSlackMention`, `buildCommand`, `getPklBinaryName`, `detectCrash`, `parseReportFile`
- E2E: `.github/workflows/test.yml` (build, version resolution, binary download)

## Release

1. `npm run build` and commit `dist/`
2. `git tag v1.x.x && git push --tags`
3. `release.yml` creates GitHub Release with changelog
