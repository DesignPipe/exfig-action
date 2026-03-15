## Context

ExFig is a Swift CLI tool for exporting Figma assets. Users need to integrate it into CI/CD pipelines for automated
design-to-code synchronization. Currently, users must manually handle binary installation, caching, and command
construction.

Reference implementation: [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) demonstrates
patterns for complex GitHub Actions with multi-provider auth, MCP integration, and extensive input/output handling.

## Goals / Non-Goals

**Goals:**

- Simple setup: one action call exports assets
- Built-in cache management (restore/save pattern)
- Support all ExFig commands and options
- Publish to GitHub Marketplace
- Support macOS and Linux runners

**Non-Goals:**

- Windows support (v1)
- PR comment trigger `/figma` commands (v1)
- JavaScript/TypeScript action (composite is sufficient)
- Self-hosted runner auto-setup

## Decisions

### Decision 1: Composite Action over JavaScript Action

**Choice:** Composite Action (shell scripts)

**Rationale:**

- ExFig is pre-compiled binary - no build step needed
- Shell scripts directly invoke CLI, making behavior predictable
- Users can debug by copying commands locally
- Simpler maintenance - action mirrors CLI documentation
- No additional runtime dependencies (Node.js not required)

**Alternatives considered:**

- JavaScript action: Would add complexity without benefit since ExFig is already compiled
- Docker action: Would limit to Linux-only, excluding macOS

### Decision 2: Built-in Cache Management

**Choice:** Action handles cache restore/save internally

**Rationale:**

- Reduces boilerplate in user workflows
- Ensures correct timing (save even on failure for checkpoint resume)
- Users can opt-out with `cache: false`

**Pattern:**

```yaml
# Internal step 1: Restore
- uses: actions/cache/restore@v4
  with:
    path: ${{ inputs.cache_path }}
    key: ${{ inputs.cache_key_prefix }}-${{ github.run_id }}
    restore-keys: ${{ inputs.cache_key_prefix }}-

# Internal step N: Save (always)
- uses: actions/cache/save@v4
  if: always()
  with:
    path: ${{ inputs.cache_path }}
    key: ${{ inputs.cache_key_prefix }}-${{ github.run_id }}
```

### Decision 3: Binary Distribution via GitHub Releases

**Choice:** Download from DesignPipe/exfig releases

**Rationale:**

- ExFig already publishes releases with platform-specific archives
- Binary caching avoids re-download on every run
- Version pinning allows reproducible builds

**Archives:**

- macOS: `exfig-macos.zip` (Universal binary arm64 + x86_64)
- Linux: `exfig-linux-x64.tar.gz`

### Decision 4: Input Mapping to CLI Flags

**Choice:** Direct mapping from action inputs to CLI flags

**Example:**

| Input                   | CLI Flag                         |
| ----------------------- | -------------------------------- |
| `cache: true`           | `--cache`                        |
| `granular_cache: true`  | `--experimental-granular-cache`  |
| `max_retries: 6`        | `--max-retries 6`                |
| `filter: "icon/*"`      | `"icon/*"` (positional argument) |

## Risks / Trade-offs

| Risk                        | Mitigation                                   |
| --------------------------- | -------------------------------------------- |
| Breaking changes in ExFig   | Version pinning with `version` input         |
| Figma API rate limits       | Default conservative `rate_limit: 10`        |
| Large cache files           | Document cache size expectations             |
| Token exposure in logs      | Pass via env var, GitHub auto-masks          |

## Migration Plan

For users with manual ExFig workflows:

**Before:**

```yaml
- name: Download ExFig
  run: |
    curl -L -o exfig.zip https://github.com/DesignPipe/exfig/releases/latest/...
    unzip exfig.zip

- uses: actions/cache/restore@v4
  with:
    path: .exfig-cache.json
    key: exfig-cache-${{ github.run_id }}

- run: ./exfig icons --cache
  env:
    FIGMA_PERSONAL_TOKEN: ${{ secrets.FIGMA_TOKEN }}

- uses: actions/cache/save@v4
  if: always()
  with:
    path: .exfig-cache.json
    key: exfig-cache-${{ github.run_id }}
```

**After:**

```yaml
- uses: DesignPipe/exfig-action@v1
  with:
    figma_token: ${{ secrets.FIGMA_TOKEN }}
    command: icons
    cache: true
```

## Open Questions

- Should action support multiple commands in single step? (e.g., `colors,icons`)
- Should granular cache be enabled by default when cache is enabled?
