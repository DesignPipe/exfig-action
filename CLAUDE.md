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

ExFig Action is a composite GitHub Action (shell-based) that exports Figma assets using ExFig CLI. It supports macOS and Linux only (no Windows).

**Key Files:**

- `action.yml` - Main action definition with 9 sequential steps
- `mise.toml` - Tool versions and task definitions
- `cliff.toml` - Changelog generation config

## Action Architecture

The action executes these steps in order:

1. **Validate inputs** - Check command validity and platform support
2. **Resolve version** - Fetch latest from GitHub API or normalize user-provided version
3. **Cache binary** - Restore ExFig binary from `actions/cache@v4`
4. **Download binary** - If cache miss, download platform-specific archive from GitHub Releases
5. **Add to PATH** - Make ExFig available to subsequent steps
6. **Restore asset cache** - Optionally restore `.exfig-cache.json` for incremental exports
7. **Run ExFig** - Execute command with all flags, capture output metrics
8. **Save asset cache** - Persist cache even on failure (checkpoint resume)
9. **Send Slack notification** - If webhook configured, send status notification

**Binary naming:** The ExFig binary is named `ExFig` (capital letters), not `exfig`.

**Batch command handling:** Uses positional arguments for config paths, not `--config` flag.

## Development Commands

No global mise installation required - `./bin/mise` is a self-contained bootstrap binary.

```bash
./bin/mise run setup              # Show git hooks status
./bin/mise run pre-commit         # Run all checks (hk check)
./bin/mise run format             # Auto-fix all formatting issues
./bin/mise run format-md          # Format markdown files (dprint)
./bin/mise run lint-yaml          # YAML linting only
./bin/mise run lint-actions       # Lint GitHub Actions workflows
./bin/mise run changelog          # Regenerate CHANGELOG.md
./bin/mise run changelog:unreleased  # Preview unreleased changes
```

Git hooks are configured automatically via `hooks.enter` in mise.toml when entering the directory. Hooks use `hk` (git hooks manager) with configuration in `hk.pkl`.

## Commit Conventions

Use Conventional Commits: `<type>(<scope>): <description>`

**Types:** feat, fix, docs, style, refactor, perf, test, chore, ci, revert
**Scopes:** action, docs, ci, release

## Shell Code Style

- Quote all variable expansions: `"${VAR}"`
- Use lowercase for local variables, UPPERCASE for environment variables
- Prefer POSIX-compatible constructs
- With `set -e`: use `((var++)) || true` for arithmetic — `((0))` returns exit code 1

## Caching

Two-tier caching:

1. **Binary cache** (always on): `exfig-binary-{os}-{version}`
2. **Asset cache** (user-controlled): `{prefix}-{run_id}` with restore-keys fallback

## Release Process

1. Tag: `git tag v1.x.x && git push --tags`
2. `release.yml` generates changelog via git-cliff and creates GitHub Release
3. Major version tag (`v1`) auto-updates to point to latest

## Testing

Tests in `.github/workflows/test.yml` validate action logic without Figma credentials:

- Input validation
- Version resolution and normalization
- Binary download (macOS + Linux matrix)
- Cache behavior
