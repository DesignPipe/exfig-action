# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-12-08

### Added

- Initial release of ExFig GitHub Action
- Support for all ExFig commands: colors, icons, images, typography, batch, fetch, download
- Built-in cache management via actions/cache@v4
- Binary caching to avoid re-downloading ExFig on every run
- Support for macOS and Linux runners
- Configurable inputs for all ExFig CLI options
- Outputs for assets_exported, changed_files, and cache_hit
- Automatic version resolution (latest or pinned)

[Unreleased]: https://github.com/alexey1312/exfig-action/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/alexey1312/exfig-action/releases/tag/v1.0.0
