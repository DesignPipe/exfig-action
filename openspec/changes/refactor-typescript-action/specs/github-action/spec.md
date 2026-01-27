## MODIFIED Requirements

### Requirement: Action Runtime

The action SHALL execute as a Node.js 20 JavaScript action with compiled TypeScript bundle.

#### Scenario: Node.js action execution

- **GIVEN** a workflow using exfig-action
- **WHEN** the action executes
- **THEN** GitHub runs `node dist/index.js`
- **AND** all dependencies are bundled in single file
- **AND** no external npm packages required at runtime

#### Scenario: TypeScript compilation

- **GIVEN** source code in `src/index.ts`
- **WHEN** `npm run build` executes
- **THEN** `@vercel/ncc` compiles to `dist/index.js`
- **AND** all imports are inlined
- **AND** source maps are excluded from production

### Requirement: Action Inputs Validation

The action SHALL validate all inputs using typed interfaces and provide clear error messages.

#### Scenario: Type-safe input parsing

- **GIVEN** inputs defined in action.yml
- **WHEN** action starts
- **THEN** `@actions/core.getInput()` retrieves values
- **AND** values are validated against TypeScript interfaces
- **AND** invalid inputs throw ActionError with descriptive message

#### Scenario: Required input missing

- **GIVEN** `figma_token` input is not provided
- **WHEN** action validates inputs
- **THEN** action fails with error "Input required and not supplied: figma_token"

### Requirement: Build System

The action SHALL use npm scripts for build, test, and lint operations.

#### Scenario: Build produces single bundle

- **GIVEN** source files in `src/`
- **WHEN** `npm run build` executes
- **THEN** `dist/index.js` is created
- **AND** file size is under 2MB
- **AND** no `node_modules` directory needed for execution

#### Scenario: Tests run with Jest

- **GIVEN** test files in `src/__tests__/`
- **WHEN** `npm test` executes
- **THEN** Jest runs all test suites
- **AND** coverage report is generated
- **AND** exit code reflects test results

## ADDED Requirements

### Requirement: Error Handling

The action SHALL provide structured error handling with typed exceptions.

#### Scenario: ExFig command failure

- **GIVEN** ExFig CLI returns non-zero exit code
- **WHEN** action catches the error
- **THEN** error message includes CLI stderr output
- **AND** action sets `conclusion` output to `failure`
- **AND** GitHub Actions annotation shows error location

#### Scenario: Network failure during download

- **GIVEN** GitHub Releases API is unreachable
- **WHEN** action attempts to download binary
- **THEN** action retries up to 3 times with exponential backoff
- **AND** if all retries fail, action fails with "Failed to download ExFig binary"

### Requirement: Logging

The action SHALL use GitHub Actions logging groups for organized output.

#### Scenario: Grouped log output

- **GIVEN** action executes multiple steps
- **WHEN** each step runs
- **THEN** logs are wrapped in `core.startGroup()`/`core.endGroup()`
- **AND** group names describe the operation (e.g., "Downloading ExFig v1.0.6")

#### Scenario: Debug logging

- **GIVEN** `ACTIONS_STEP_DEBUG` is set to `true`
- **WHEN** action executes
- **THEN** `core.debug()` messages are visible
- **AND** command arguments are logged (except secrets)
