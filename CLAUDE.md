<!-- OPENSPEC:START -->

# OpenSpec Instructions

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

# ExFig Action

GitHub Action for automating Figma asset exports using ExFig CLI.

## Project Overview

- **Version**: 1.0.0
- **Type**: Composite GitHub Action (shell-based)
- **Platforms**: macOS, Linux (no Windows support)
- **Purpose**: Export Figma colors, icons, images, typography to iOS/Android/Flutter/Web

## Tech Stack

- Bash shell scripts (POSIX-compatible)
- actions/cache@v4 for caching
- ExFig binary from github.com/alexey1312/exfig

## Development Tools

| Tool       | Version   | Purpose                 |
| ---------- | --------- | ----------------------- |
| mise       | bootstrap | Tool version management |
| Python     | 3.13      | pre-commit runtime      |
| pre-commit | 4.5.0     | Git hooks               |
| git-cliff  | 2.10.1    | Changelog generation    |

## Project Structure

```
├── action.yml           # Main action definition (8 steps)
├── README.md            # User documentation
├── CHANGELOG.md         # Release notes (auto-generated)
├── docs/
│   ├── caching.md       # Caching strategy details
│   └── troubleshooting.md
├── examples/            # Workflow templates
│   ├── basic.yml
│   ├── multi-asset.yml
│   └── pr-trigger.yml
├── openspec/            # Spec-driven development
│   ├── project.md       # Project conventions
│   ├── AGENTS.md        # OpenSpec workflow guide
│   └── changes/         # Change proposals
└── .github/workflows/
    ├── test.yml         # Matrix testing (macOS + Linux)
    └── release.yml      # Auto-release on version tags
```

## Action Inputs

| Input            | Required | Default           | Description                                               |
| ---------------- | -------- | ----------------- | --------------------------------------------------------- |
| figma_token      | Yes      | -                 | Figma Personal Access Token                               |
| command          | Yes      | -                 | colors, icons, images, typography, batch, fetch, download |
| config           | No       | exfig.yml         | Path to config file                                       |
| filter           | No       | -                 | Asset filter pattern                                      |
| version          | No       | latest            | ExFig version                                             |
| cache            | No       | false             | Enable asset caching                                      |
| cache_path       | No       | .exfig-cache.json | Cache file location                                       |
| cache_key_prefix | No       | exfig-cache       | Cache key prefix                                          |
| granular_cache   | No       | false             | Experimental per-node caching                             |
| rate_limit       | No       | 10                | Figma API rate limit (req/sec)                            |
| max_retries      | No       | 3                 | Max retry attempts                                        |
| output_dir       | No       | -                 | Output directory                                          |
| verbose          | No       | false             | Enable verbose logging                                    |

## Action Outputs

- `assets_exported` - Number of assets exported
- `changed_files` - Modified file list (newline-separated)
- `cache_hit` - Cache restoration status (true/false)

## Caching Strategy

Two-tier caching:

1. **Binary Cache**: `exfig-binary-{os}-{version}` - Always enabled, caches ExFig binary
2. **Asset Cache**: `{prefix}-{run_id}` - User-controlled via `cache: true`, caches Figma metadata

## Commit Message Format

Use Conventional Commits: `<type>(<scope>): <description>`

**Types**: feat, fix, docs, style, refactor, perf, test, chore, ci, revert

**Scopes**: action, docs, ci, release

Example:

```
feat(action): add granular cache support

- Implement per-node hash tracking
- Add granular_cache input flag
```

## Common Tasks

```bash
# Initial setup
./bin/mise run setup

# Run pre-commit hooks
./bin/mise run pre-commit

# Lint YAML files
./bin/mise run lint-yaml

# Format markdown
./bin/mise run format-md

# Generate changelog
./bin/mise run changelog

# Preview unreleased changes
./bin/mise run changelog:unreleased
```

## Shell Code Style

- Use `set -e` for fail-fast behavior
- Quote all variable expansions: `"${VAR}"`
- Use lowercase for local variables, UPPERCASE for environment variables
- POSIX compatibility where possible

## Important Constraints

- Requires `FIGMA_PERSONAL_TOKEN` passed as secret
- macOS and Linux only (Windows not supported)
- ExFig releases must exist on alexey1312/exfig
- Binary downloaded from GitHub Releases per platform:
  - macOS: `exfig-macos.zip`
  - Linux: `exfig-linux-x64.tar.gz`

## Testing

Test matrix in `.github/workflows/test.yml`:

- Input validation (valid/invalid commands)
- Version resolution (latest version)
- Cache hit/miss scenarios
- Binary caching across versions
- Cross-platform (macOS + Linux)

## Release Process

1. Push version tag: `git tag v1.x.x && git push --tags`
2. `release.yml` auto-generates changelog via git-cliff
3. Creates GitHub Release with notes
4. Updates major version tag (`v1`) to point to latest
