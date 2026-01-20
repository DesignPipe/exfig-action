# Changelog

All notable changes to this project will be documented in this file.

## [1.0.14] - 2026-01-20

### Bug Fixes

- **action**: Prevent Slack HTTP 400 on empty SUBTITLE in failure notifications by @alexey1312


## [1.0.13] - 2026-01-14

### Bug Fixes

- **action**: Use VALIDATED_COUNT for cache-hit detection in Slack notifications by @alexey1312


## [1.0.12] - 2026-01-14

### Features

- **action**: Show configs in Slack Command field for batch notifications by @alexey1312


## [1.0.11] - 2026-01-14

### Bug Fixes

- **action**: Escape newlines in CONFIGS_DISPLAY for sed substitution by @alexey1312


## [1.0.10] - 2026-01-14

### Bug Fixes

- **action**: Add || true for ASSETS_COUNT grep pipeline by @alexey1312


## [1.0.9] - 2026-01-14

### Bug Fixes

- **action**: Add || true for grep -c with set -e by @alexey1312


## [1.0.8] - 2026-01-14

### Bug Fixes

- **action**: Fix Slack notification bugs and add jq validation by @alexey1312


## [1.0.7] - 2026-01-14

### Features

- **action**: Add validated/exported config counts to outputs by @alexey1312


## [1.0.6] - 2026-01-14

### Bug Fixes

- **action**: Improve Slack notification accuracy and details by @alexey1312


### Features

- **action**: Add customizable Slack notification templates by @alexey1312

- **action**: Auto-format Slack mention IDs by @alexey1312


## [1.0.5] - 2026-01-14

### Features

- **action**: Add Slack notifications and exit_code output by @alexey1312


### Miscellaneous Tasks

- Migrate from pre-commit to hk hooks manager by @alexey1312


## [1.0.4] - 2025-12-24

### Bug Fixes

- **action**: Use -i flag instead of --config for batch command by @alexey1312


## [1.0.3] - 2025-12-19

### Documentation

- **action**: Add extra_args input for additional CLI flags by @alexey1312


## [1.0.2] - 2025-12-12

### Bug Fixes

- **action**: Handle batch command config paths correctly by @alexey1312

- **action**: Handle batch command config paths correctly by @alexey1312


### Miscellaneous Tasks

- **test**: Replace gh CLI with curl for API calls by @alexey1312


## [1.0.1] - 2025-12-09

### Bug Fixes

- **action**: Correct ExFig binary name to match release by @alexey1312


### Miscellaneous Tasks

- **test**: Rewrite tests to not require Figma credentials by @alexey1312


## [1.0.0] - 2025-12-08

### Features

- Initial commit by @alexey1312



