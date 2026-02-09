# Troubleshooting

Common issues and solutions when using ExFig Action.

## Authentication Errors

### Error: Request failed with status 403

**Cause:** Invalid or expired Figma Personal Access Token.

**Solution:**

1. Generate a new token in Figma: Settings > Account > Personal Access Tokens
2. Update your GitHub secret `FIGMA_TOKEN`
3. Ensure the token has read access to the target Figma file

### Error: Request failed with status 404

**Cause:** The Figma file doesn't exist or the token doesn't have access.

**Solution:**

1. Verify the file key in your `exfig.pkl` configuration
2. Ensure your Figma token has access to the file
3. Check if the file has been moved or deleted

## Rate Limiting

### Error: Rate limit exceeded

**Cause:** Too many requests to Figma API in a short period.

**Solution:**

1. Reduce the rate limit:

```yaml
- uses: alexey1312/exfig-action@v2
  with:
    rate_limit: 5  # Reduce from default 10
```

2. Increase max retries:

```yaml
- uses: alexey1312/exfig-action@v2
  with:
    max_retries: 6  # Increase from default 3
```

3. Enable caching to reduce API calls:

```yaml
- uses: alexey1312/exfig-action@v2
  with:
    cache: true
```

## Binary Download Issues

### Error: Failed to fetch latest ExFig version

**Cause:** GitHub API rate limiting or network issues.

**Solution:**

1. Pin a specific version instead of using `latest`:

```yaml
- uses: alexey1312/exfig-action@v2
  with:
    version: 'v1.2.0'
```

2. Ensure `GITHUB_TOKEN` has permissions (usually automatic)

### Error: Binary not found after download

**Cause:** Archive extraction failed or incorrect archive name.

**Solution:**

1. Enable verbose logging to debug:

```yaml
- uses: alexey1312/exfig-action@v2
  with:
    verbose: true
```

2. Check if the ExFig release contains the expected archive names:
   - macOS: `exfig-macos.zip`
   - Linux: `exfig-linux-x64.tar.gz`

## Cache Issues

### Cache not being restored

**Cause:** Cache key mismatch or cache doesn't exist.

**Solution:**

1. Check cache key prefix is consistent:

```yaml
- uses: alexey1312/exfig-action@v2
  with:
    cache: true
    cache_key_prefix: exfig-icons  # Use consistent prefix
```

2. Verify cache path is accessible:

```yaml
- uses: alexey1312/exfig-action@v2
  with:
    cache: true
    cache_path: '.exfig-cache.json'  # Default location
```

### Cache always misses

**Cause:** The cache key includes `github.run_id`, which changes every run.

**Expected behavior:** The restore phase uses `restore-keys` to match the prefix, so previous caches should be restored even with different `run_id`.

If caches are still not being restored:

1. Check GitHub Actions cache storage isn't full (10 GB limit)
2. Verify cache wasn't evicted (7-day retention policy)

## Configuration Issues

### Error: Config file not found

**Cause:** `exfig.pkl` doesn't exist at the specified path.

**Solution:**

1. Create the config file:

```pkl
amends "package://github.com/alexey1312/ExFig/releases/download/v2.0.0/exfig@2.0.0#/ExFig.pkl"

figma {
  fileId = "YOUR_FILE_KEY"
}

icons {
  new {
    figma { page = "Icons" }
    iOS { output = "src/icons" }
  }
}
```

2. Or specify a different path:

```yaml
- uses: alexey1312/exfig-action@v2
  with:
    config: 'config/exfig.pkl'
```

### Error: Invalid command

**Cause:** Using an unsupported ExFig command.

**Solution:**

Use one of the supported commands:

- `colors`
- `icons`
- `images`
- `typography`
- `batch`
- `fetch`
- `download`

## Platform Issues

### Error: Unsupported platform

**Cause:** Running on Windows or an unsupported runner.

**Solution:**

Use a supported runner:

```yaml
jobs:
  export:
    runs-on: ubuntu-latest  # or macos-latest
```

Windows is not supported.

## Debugging

### Enable Verbose Logging

```yaml
- uses: alexey1312/exfig-action@v2
  with:
    verbose: true
```

### View Step Outputs

Check the workflow run logs for:

- Resolved ExFig version
- Cache hit/miss status
- Number of assets exported
- Changed files list

### Manual Testing

To reproduce the issue locally:

```bash
# Download ExFig
curl -L -o exfig.zip https://github.com/alexey1312/exfig/releases/latest/download/exfig-macos.zip
unzip exfig.zip
chmod +x exfig

# Run the same command
export FIGMA_PERSONAL_TOKEN="your-token"
./exfig icons -i exfig.pkl --verbose
```

## Getting Help

If you can't resolve the issue:

1. Check [ExFig documentation](https://github.com/alexey1312/exfig)
2. Search [existing issues](https://github.com/alexey1312/exfig-action/issues)
3. Open a new issue with:
   - Workflow file (redact secrets)
   - Error message
   - Runner OS
   - ExFig version
