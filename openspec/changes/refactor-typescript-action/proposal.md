# Change: Refactor ExFig Action to TypeScript

## Why

The current shell-based implementation (action.yml ~700 lines) has limitations:
- Difficult debugging and error handling in bash
- No type safety for inputs/outputs
- Harder to unit test
- Limited extensibility (Slack integration, complex logic)

TypeScript Action solves these problems and is the standard for complex GitHub Actions.

## What Changes

- **BREAKING**: Minimum Node.js version is 20 (supported by GitHub runners)
- Migration of all logic from shell steps to TypeScript (`src/index.ts`)
- New dependencies: `@actions/core`, `@actions/cache`, `@actions/exec`, `@actions/glob`
- Build via `@vercel/ncc` into single file `dist/index.js`
- Simplification of `action.yml` to ~50 lines (runs: 'node20')
- Removal of embedded shell scripts from action.yml

## Impact

- Affected specs: `github-action` (delta: implementation details)
- Affected code:
  - `action.yml` — complete rewrite
  - `src/` — new directory with TypeScript code
  - `dist/` — compiled bundle
  - `package.json`, `tsconfig.json` — new configuration files
  - `.github/workflows/test.yml` — test updates
- Dependencies: Node.js 20+, npm packages

## Backward Compatibility

All existing inputs and outputs are preserved unchanged. Users will not notice any difference in action usage.
