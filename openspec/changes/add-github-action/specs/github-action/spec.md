## ADDED Requirements

### Requirement: GitHub Action Core Functionality

The action SHALL provide a composite GitHub Action that executes ExFig commands in CI/CD workflows.

#### Scenario: Basic color export

- **GIVEN** a workflow with exfig-action configured
- **AND** `figma_token` secret is set
- **AND** `command: colors` is specified
- **WHEN** the workflow runs
- **THEN** ExFig downloads colors from Figma
- **AND** generates platform-specific output files
- **AND** `conclusion` output is `success`

#### Scenario: Missing figma_token fails with clear error

- **GIVEN** a workflow with exfig-action
- **AND** `figma_token` is not provided
- **WHEN** the workflow runs
- **THEN** the action fails immediately
- **AND** error message states "figma_token is required"

#### Scenario: Invalid command fails with validation error

- **GIVEN** a workflow with `command: invalid`
- **WHEN** the workflow runs
- **THEN** the action fails
- **AND** error message lists valid commands

### Requirement: Platform Support

The action SHALL support macOS and Linux GitHub runners.

#### Scenario: macOS runner execution

- **GIVEN** a workflow running on `macos-latest`
- **WHEN** the action executes
- **THEN** ExFig macOS binary is downloaded
- **AND** command executes successfully

#### Scenario: Linux runner execution

- **GIVEN** a workflow running on `ubuntu-latest`
- **WHEN** the action executes
- **THEN** ExFig Linux binary is downloaded
- **AND** command executes successfully

#### Scenario: Unsupported platform fails gracefully

- **GIVEN** a workflow running on `windows-latest`
- **WHEN** the action executes
- **THEN** the action fails
- **AND** error message states "Unsupported platform: Windows"

### Requirement: Built-in Cache Management

The action SHALL manage ExFig cache automatically when `cache: true`.

#### Scenario: Cache restore on first run

- **GIVEN** `cache: true` is set
- **AND** no previous cache exists
- **WHEN** the action runs
- **THEN** cache restore step completes (cache miss)
- **AND** `cache_hit` output is `false`
- **AND** export runs fully
- **AND** cache is saved after completion

#### Scenario: Cache restore with existing cache

- **GIVEN** `cache: true` is set
- **AND** previous run saved cache with key `exfig-12345`
- **WHEN** the action runs
- **THEN** cache is restored from `exfig-` prefix match
- **AND** `cache_hit` output is `true`
- **AND** unchanged assets are skipped

#### Scenario: Cache save on failure

- **GIVEN** `cache: true` is set
- **AND** export partially completes before failure
- **WHEN** the action fails
- **THEN** cache is still saved
- **AND** next run can resume from checkpoint

#### Scenario: Custom cache key prefix

- **GIVEN** `cache_key_prefix: ios-assets` is set
- **WHEN** the action runs
- **THEN** cache key is `ios-assets-{run_id}`
- **AND** restore uses `ios-assets-` prefix

#### Scenario: Granular cache enabled

- **GIVEN** `cache: true` and `granular_cache: true`
- **WHEN** the action runs
- **THEN** `--experimental-granular-cache` flag is passed to ExFig
- **AND** per-node hash tracking is enabled

### Requirement: Binary Distribution

The action SHALL download ExFig binary from GitHub Releases.

#### Scenario: Latest version resolution

- **GIVEN** `version: latest` (default)
- **WHEN** the action runs
- **THEN** latest release tag is fetched from GitHub API
- **AND** corresponding binary is downloaded

#### Scenario: Pinned version download

- **GIVEN** `version: 1.0.6`
- **WHEN** the action runs
- **THEN** binary for v1.0.6 is downloaded
- **AND** version is not auto-updated

#### Scenario: Binary caching across runs

- **GIVEN** ExFig v1.0.6 was downloaded in previous run
- **WHEN** a new run with same version starts
- **THEN** binary is restored from cache
- **AND** no download occurs

### Requirement: Command Input Mapping

The action SHALL map inputs to ExFig CLI flags.

#### Scenario: Fetch command with required options

- **GIVEN** `command: fetch`
- **AND** `file_id: abc123`
- **AND** `frame_name: Icons`
- **AND** `output_path: ./icons`
- **WHEN** the action runs
- **THEN** command is `exfig fetch --file-id abc123 --frame Icons --output ./icons`

#### Scenario: Fault tolerance options

- **GIVEN** `max_retries: 6`
- **AND** `rate_limit: 15`
- **AND** `timeout: 60`
- **WHEN** the action runs
- **THEN** command includes `--max-retries 6 --rate-limit 15 --timeout 60`

#### Scenario: Filter pattern

- **GIVEN** `filter: "icon/*"`
- **WHEN** the action runs
- **THEN** filter is passed as positional argument

### Requirement: Action Outputs

The action SHALL provide structured outputs for workflow integration.

#### Scenario: Successful export outputs

- **GIVEN** export completes successfully
- **AND** 42 assets were exported
- **WHEN** action completes
- **THEN** `conclusion` is `success`
- **AND** `assets_exported` is `42`
- **AND** `duration` is export time in seconds

#### Scenario: Changed files detection

- **GIVEN** export creates new files
- **WHEN** action completes
- **THEN** `changed_files` contains newline-separated list of modified paths

#### Scenario: Failure outputs

- **GIVEN** export fails due to API error
- **WHEN** action completes
- **THEN** `conclusion` is `failure`
- **AND** `assets_exported` is `0`

### Requirement: Marketplace Publication

The action SHALL be published to GitHub Marketplace.

#### Scenario: Action metadata for Marketplace

- **GIVEN** action.yml is properly configured
- **THEN** `name` is "ExFig - Figma Asset Export"
- **AND** `description` explains purpose
- **AND** `author` is "alexey1312"
- **AND** `branding.icon` is "download-cloud"
- **AND** `branding.color` is "purple"

### Requirement: Security

The action SHALL handle Figma token securely.

#### Scenario: Token passed via environment variable

- **GIVEN** `figma_token` input is provided
- **WHEN** ExFig command executes
- **THEN** token is passed via `FIGMA_PERSONAL_TOKEN` env var
- **AND** token is not visible in command line arguments
- **AND** token is masked in GitHub Actions logs
