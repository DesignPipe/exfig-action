# Project Context

## Purpose

ExFig Action is a GitHub Action that simplifies integration of ExFig CLI into CI/CD workflows. It automates Figma asset
exports (colors, icons, images, typography) to iOS, Android, and Flutter projects with built-in cache management.

## Tech Stack

- GitHub Actions Composite Action (shell scripts)
- Bash for cross-platform scripting
- actions/cache@v4 for cache management
- ExFig binary from GitHub Releases

## Project Conventions

### Code Style

- Shell scripts follow POSIX compatibility where possible
- Use `set -e` for fail-fast behavior
- Quote all variable expansions: `"${VAR}"`
- Use lowercase for local variables, UPPERCASE for environment variables

### Architecture Patterns

- Composite action with sequential steps
- Input validation before execution
- Platform detection (macOS/Linux)
- Binary caching separate from export cache
- Direct CLI flag mapping from inputs

### Testing Strategy

- Test workflows in `.github/workflows/`
- Matrix testing: macOS + Linux runners
- Test both cache hit and miss scenarios
- Test error handling paths

### Git Workflow

- Conventional commits: `<type>(<scope>): <description>`
- Scopes: action, docs, ci, release
- Major version tag (`v1`) points to latest minor/patch

## Domain Context

- Wraps ExFig CLI for GitHub Actions environment
- Two cache types: binary cache (ExFig download) and export cache (Figma asset tracking)
- Supports all ExFig commands: colors, icons, images, typography, batch, fetch, download

## Important Constraints

- Requires `FIGMA_PERSONAL_TOKEN` passed as secret
- macOS and Linux only (Windows not supported in v1)
- ExFig releases must exist on DesignPipe/exfig

## External Dependencies

- ExFig CLI binary releases: `github.com/DesignPipe/exfig/releases`
- actions/cache@v4 for caching
- GitHub REST API for latest version resolution
