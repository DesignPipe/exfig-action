## Context

ExFig Action is a composite GitHub Action (~700 lines of shell in action.yml). Refactoring to TypeScript is the standard approach for complex GitHub Actions, providing type safety and testability.

Key stakeholders:
- Action users (should notice no changes)
- Developers (improved DX)

## Goals / Non-Goals

**Goals:**
- Type safety for inputs/outputs
- Unit-testable logic
- Improved error handling
- Single bundle with no runtime dependencies

**Non-Goals:**
- Changing API (inputs/outputs)
- Adding new features in this PR
- Windows support

## Decisions

### Decision: Monolithic src/index.ts

All logic in a single file (~500 lines). Types are extracted to separate src/types.ts.

**Alternative:** Split into modules (src/cache.ts, src/download.ts, etc.)
**Why rejected:** Overhead for an action of this size. Can refactor if it grows.

### Decision: @vercel/ncc for bundling

Compiles to a single dist/index.js without node_modules at runtime.

**Alternative:** esbuild, webpack
**Why chosen:** Standard for GitHub Actions (used in actions/toolkit examples).

### Decision: Preserve inputs/outputs structure

Full backward compatibility. Users don't change their workflows.

### Decision: Jest for testing

Standard choice for TypeScript projects in the actions ecosystem.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Logic regressions | Port existing tests + new unit tests |
| Bundle size increase | ncc tree-shaking, size monitoring |
| Slack template complexity | Use handlebars (optional) |

## Migration Plan

1. Create TypeScript infrastructure (package.json, tsconfig)
2. Implement core logic with unit tests
3. Update action.yml (runs: node20)
4. Run existing E2E tests
5. Release as patch version (if no breaking changes)

**Rollback:** Revert to previous tag (shell version preserved in git history)

## Open Questions

- [ ] Is handlebars needed for Slack templates or are template literals sufficient?
- [ ] Should source maps be included in production bundle for debugging?
