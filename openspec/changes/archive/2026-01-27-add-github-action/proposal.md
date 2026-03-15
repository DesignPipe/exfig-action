# Change: Add GitHub Action for ExFig

## Why

Users currently need to manually set up ExFig in CI/CD workflows, including binary download, cache management, and
command construction. A dedicated GitHub Action would simplify integration and encourage adoption.

## What Changes

- Create new repository `DesignPipe/exfig-action` with composite GitHub Action
- Publish to GitHub Marketplace
- Support all ExFig commands: colors, icons, images, typography, batch, fetch, download
- Built-in cache management via actions/cache@v4
- Support macOS and Linux runners
- Binary distribution from ExFig releases

## Impact

- Affected specs: Creates new `github-action` capability
- Affected code: New repository (no changes to ExFig core)
- Dependencies: Requires ExFig binary releases on GitHub
