# Caching Strategy

ExFig Action implements a multi-level caching strategy to optimize performance and reduce Figma API calls.

## Cache Levels

### Level 1: Binary Cache

The ExFig binary is cached using `actions/cache@v4` with a key based on:

- Runner OS (Linux or macOS)
- ExFig version

This ensures the binary is only downloaded once per version per platform.

**Cache key format:** `exfig-binary-{os}-{version}`

### Level 2: Asset Cache

When `cache: true` is set, ExFig's built-in caching is enabled. This stores metadata about previously exported assets, allowing subsequent runs to skip unchanged assets.

**Cache key format:** `{cache_key_prefix}-{github.run_id}`

The cache uses `restore-keys` to fall back to previous runs:

```
{cache_key_prefix}-
```

This ensures the most recent cache is restored even if the exact key doesn't match.

## Cache Behavior

### Restore Phase

Before running ExFig, the action restores the cache:

```yaml
- uses: actions/cache/restore@v4
  with:
    path: ${{ inputs.cache_path }}
    key: ${{ inputs.cache_key_prefix }}-${{ github.run_id }}
    restore-keys: |
      ${{ inputs.cache_key_prefix }}-
```

### Save Phase

After ExFig completes (success or failure), the cache is saved:

```yaml
- uses: actions/cache/save@v4
  if: always()
  with:
    path: ${{ inputs.cache_path }}
    key: ${{ inputs.cache_key_prefix }}-${{ github.run_id }}
```

**Important:** The cache is saved even on failure to support checkpoint resume for large exports.

## Configuration Options

| Input              | Default             | Description                        |
| ------------------ | ------------------- | ---------------------------------- |
| `cache`            | `false`             | Enable/disable asset caching       |
| `cache_path`       | `.exfig-cache.json` | Path to cache file                 |
| `cache_key_prefix` | `exfig-cache`       | Prefix for cache key               |
| `granular_cache`   | `false`             | Enable experimental granular cache |

## Best Practices

### Separate Cache Keys for Different Commands

When exporting multiple asset types, use different cache key prefixes:

```yaml
- name: Export colors
  uses: alexey1312/exfig-action@v2
  with:
    command: colors
    cache: true
    cache_key_prefix: exfig-colors

- name: Export icons
  uses: alexey1312/exfig-action@v2
  with:
    command: icons
    cache: true
    cache_key_prefix: exfig-icons
```

### Clearing the Cache

To force a fresh export, you can:

1. Change the `cache_key_prefix` temporarily
2. Use GitHub's cache management to delete the cache
3. Disable caching for a single run with `cache: false`

## Cache Size Considerations

The cache file (`.exfig-cache.json`) contains metadata only, not the actual assets. Typical sizes:

- Small projects (< 100 assets): < 100 KB
- Medium projects (100-1000 assets): 100 KB - 1 MB
- Large projects (1000+ assets): 1-10 MB

GitHub Actions provides 10 GB of cache storage per repository, which is more than sufficient for ExFig caches.

## Granular Cache

The experimental granular cache feature (`granular_cache: true`) provides finer-grained caching at the individual asset level. This can improve performance for:

- Large asset libraries
- Partial updates to specific asset groups
- Workflows that filter specific assets

Enable with:

```yaml
- uses: alexey1312/exfig-action@v2
  with:
    cache: true
    granular_cache: true
```
