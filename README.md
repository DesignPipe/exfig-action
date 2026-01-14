# ExFig Action

A GitHub Action for exporting Figma assets using [ExFig](https://github.com/alexey1312/exfig) CLI. Export colors, icons, images, and typography from Figma to your codebase with built-in caching.

## Usage

```yaml
- uses: alexey1312/exfig-action@v1
  with:
    figma_token: ${{ secrets.FIGMA_TOKEN }}
    command: icons
    cache: true
```

## Inputs

| Input              | Description                                                                            | Required | Default             |
| ------------------ | -------------------------------------------------------------------------------------- | -------- | ------------------- |
| `figma_token`      | Figma Personal Access Token                                                            | Yes      | -                   |
| `command`          | ExFig command: `colors`, `icons`, `images`, `typography`, `batch`, `fetch`, `download` | Yes      | -                   |
| `config`           | Path to exfig.yml config file                                                          | No       | `exfig.yml`         |
| `filter`           | Filter pattern for assets (e.g., `icon/*`)                                             | No       | -                   |
| `version`          | ExFig version to use                                                                   | No       | `latest`            |
| `cache`            | Enable caching for incremental exports                                                 | No       | `false`             |
| `cache_path`       | Path to cache file                                                                     | No       | `.exfig-cache.json` |
| `cache_key_prefix` | Prefix for cache key                                                                   | No       | `exfig-cache`       |
| `granular_cache`   | Enable experimental granular caching                                                   | No       | `false`             |
| `rate_limit`       | Figma API rate limit (requests/second)                                                 | No       | `10`                |
| `max_retries`      | Maximum retries for failed API requests                                                | No       | `3`                 |
| `output_dir`       | Output directory for exported assets                                                   | No       | -                   |
| `verbose`          | Enable verbose logging                                                                 | No       | `false`             |
| `extra_args`       | Additional CLI arguments to pass to ExFig (e.g., `--force --dry-run`)                  | No       | -                   |
| `slack_webhook`    | Slack Incoming Webhook URL for notifications                                           | No       | -                   |
| `slack_mention`    | User/group to mention on failure (`@channel`, `<@U123>`)                               | No       | -                   |

## Outputs

| Output            | Description                                       |
| ----------------- | ------------------------------------------------- |
| `assets_exported` | Number of assets exported                         |
| `changed_files`   | List of changed files (newline-separated)         |
| `cache_hit`       | Whether cache was restored                        |
| `exit_code`       | ExFig command exit code (0 = success)             |
| `failed_count`    | Number of failed configs in batch mode            |
| `duration`        | Execution duration (e.g., "5s")                   |
| `config_summary`  | Summary of config files processed (batch command) |

## Examples

### Basic Usage

Export icons with caching:

```yaml
name: Export Figma Icons
on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * *'  # Daily

jobs:
  export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: alexey1312/exfig-action@v1
        with:
          figma_token: ${{ secrets.FIGMA_TOKEN }}
          command: icons
          cache: true

      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -A
          git diff --staged --quiet || git commit -m "Update icons from Figma"
          git push
```

### Export Multiple Asset Types

```yaml
jobs:
  export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Export colors
        uses: alexey1312/exfig-action@v1
        with:
          figma_token: ${{ secrets.FIGMA_TOKEN }}
          command: colors
          cache: true
          cache_key_prefix: exfig-colors

      - name: Export icons
        uses: alexey1312/exfig-action@v1
        with:
          figma_token: ${{ secrets.FIGMA_TOKEN }}
          command: icons
          cache: true
          cache_key_prefix: exfig-icons

      - name: Export typography
        uses: alexey1312/exfig-action@v1
        with:
          figma_token: ${{ secrets.FIGMA_TOKEN }}
          command: typography
          cache: true
          cache_key_prefix: exfig-typography
```

### Filter Specific Assets

```yaml
- uses: alexey1312/exfig-action@v1
  with:
    figma_token: ${{ secrets.FIGMA_TOKEN }}
    command: icons
    filter: 'navigation/*'
    cache: true
```

### Pin ExFig Version

```yaml
- uses: alexey1312/exfig-action@v1
  with:
    figma_token: ${{ secrets.FIGMA_TOKEN }}
    command: icons
    version: 'v1.2.0'
```

### Extra CLI Arguments

Pass additional flags directly to ExFig CLI:

```yaml
- uses: alexey1312/exfig-action@v1
  with:
    figma_token: ${{ secrets.FIGMA_TOKEN }}
    command: icons
    extra_args: '--force'
```

### macOS Runner

```yaml
jobs:
  export:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - uses: alexey1312/exfig-action@v1
        with:
          figma_token: ${{ secrets.FIGMA_TOKEN }}
          command: icons
```

## Caching

The action supports two levels of caching:

### 1. Binary Caching

The ExFig binary is automatically cached per OS and version to avoid re-downloading on every run.

### 2. Asset Caching

When `cache: true`, the action uses ExFig's built-in cache to enable incremental exports. Only changed assets are re-exported, significantly reducing Figma API calls and export time.

```yaml
- uses: alexey1312/exfig-action@v1
  with:
    figma_token: ${{ secrets.FIGMA_TOKEN }}
    command: icons
    cache: true
    cache_path: '.exfig-cache.json'  # Default
    cache_key_prefix: 'exfig-cache'   # Default
```

The cache is saved even on failure to support checkpoint resume for large exports.

### Granular Cache (Experimental)

For better performance with large asset libraries:

```yaml
- uses: alexey1312/exfig-action@v1
  with:
    figma_token: ${{ secrets.FIGMA_TOKEN }}
    command: icons
    cache: true
    granular_cache: true
```

## Supported Platforms

- Ubuntu (Linux x64)
- macOS (Universal binary: arm64 + x86_64)

## Configuration

Create an `exfig.yml` in your repository root:

```yaml
figma:
  file_key: YOUR_FIGMA_FILE_KEY

icons:
  page: Icons
  output: src/assets/icons
  format: svg

colors:
  page: Colors
  output: src/styles/colors.json

typography:
  page: Typography
  output: src/styles/typography.json
```

See [ExFig documentation](https://github.com/alexey1312/exfig) for full configuration options.

## Slack Notifications

Send notifications to Slack when exports complete or fail:

```yaml
- uses: alexey1312/exfig-action@v1
  with:
    figma_token: ${{ secrets.FIGMA_TOKEN }}
    command: batch
    config: 'exfig/colors.yaml, exfig/icons.yaml'
    slack_webhook: ${{ secrets.SLACK_WEBHOOK }}
    slack_mention: '<@U123456>'  # Mention on failure only
```

### Notification Types

| Status    | Icon | Description                                 |
| --------- | ---- | ------------------------------------------- |
| Success   | ✅   | Export completed successfully               |
| Failure   | ❌   | Export failed (mentions user if configured) |
| Cache hit | 💨   | No changes detected, all assets up to date  |

### Message Contents

- **Command**: Shows command and config files (e.g., `batch (colors.yaml, icons.yaml)`)
- **Assets**: Number of exported assets
- **Duration**: Execution time
- **Repository**: Link to GitHub Actions run

## Troubleshooting

### Invalid Figma Token

```
Error: Request failed with status 403
```

Ensure your `FIGMA_TOKEN` secret has read access to the Figma file.

### Rate Limiting

```
Error: Rate limit exceeded
```

Reduce `rate_limit` input or wait before retrying:

```yaml
- uses: alexey1312/exfig-action@v1
  with:
    figma_token: ${{ secrets.FIGMA_TOKEN }}
    command: icons
    rate_limit: 5
    max_retries: 6
```

### Cache Not Working

Ensure caching is enabled and the cache path is accessible:

```yaml
- uses: alexey1312/exfig-action@v1
  with:
    figma_token: ${{ secrets.FIGMA_TOKEN }}
    command: icons
    cache: true
    verbose: true  # Enable verbose logging to debug
```

## License

MIT License - see [LICENSE](LICENSE) for details.
