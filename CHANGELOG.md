# Changelog

All notable changes to this project will be documented in this file.

## [2.0.1] - 2026-02-10

### Features

- Add pkl CLI installation alongside ExFig by @alexey1312


### Miscellaneous Tasks

- Update mise by @alexey1312


## [2.0.0] - 2026-02-09

### Features

- Add batch report parsing and new CLI flags by @alexey1312


## [1.2.1] - 2026-02-02

### Features

- Improve crash detection and diagnostics by @alexey1312


### Miscellaneous Tasks

- Mise fmt by @alexey1312


## [1.2.0] - 2026-01-29

### Features

- **slack**: Add version and platform info to notifications by @alexey1312


## [1.1.1] - 2026-01-27

### Bug Fixes

- Include dist/ in repository for GitHub Actions by @alexey1312


## [1.1.0] - 2026-01-27

### Features

- **refactor**: Convert action to TypeScript, add ESLint & Jest by @alexey1312


### Miscellaneous Tasks

- Update README.md by @alexey1312

- Test covverandge by @alexey1312


### Other

- Merge pull request #1 from alexey1312/feature-ts

feat(refactor): convert action to TypeScript, add ESLint & Jest by @alexey1312 in [#1](https://github.com/alexey1312/exfig-action/pull/1)


### Refactor

- **agent-docs**: Consolidate and update agent documentation by @alexey1312


## [1.0.16] - 2026-01-27

### Features

- Add error handling and reporting for ExFig action by @alexey1312

- Add ExFig output parsing tests by @alexey1312


## [1.0.15] - 2026-01-21

### Bug Fixes

- **action**: Preserve newlines in Slack config list by fixing escape_for_sed by @alexey1312


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



