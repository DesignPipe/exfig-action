## 1. Project Setup

- [x] 1.1 Create package.json with dependencies
- [x] 1.2 Create tsconfig.json for Node 20
- [x] 1.3 Add @vercel/ncc build configuration
- [x] 1.4 Update mise.toml with npm scripts
- [x] 1.5 Add .gitignore entries for node_modules, dist

## 2. Type Definitions

- [x] 2.1 Create src/types.ts with input/output interfaces
- [x] 2.2 Define ActionInputs interface matching action.yml inputs
- [x] 2.3 Define ActionOutputs interface matching action.yml outputs
- [x] 2.4 Define ExFigConfig interface for CLI options

## 3. Core Implementation

- [x] 3.1 Create src/index.ts entry point
- [x] 3.2 Implement input parsing with @actions/core
- [x] 3.3 Implement input validation logic
- [x] 3.4 Implement platform detection (darwin/linux)
- [x] 3.5 Implement version resolution (latest/pinned)
- [x] 3.6 Implement binary download with fetch
- [x] 3.7 Implement binary caching with @actions/cache
- [x] 3.8 Implement ExFig command builder
- [x] 3.9 Implement ExFig execution with @actions/exec
- [x] 3.10 Implement output parsing (metrics extraction)
- [x] 3.11 Implement asset cache restore/save
- [x] 3.12 Implement error handling and reporting
- [x] 3.13 Implement Slack notification (optional)

## 4. Action Configuration

- [x] 4.1 Update action.yml to use runs: 'node20'
- [x] 4.2 Remove all shell script steps
- [x] 4.3 Keep inputs/outputs definitions unchanged
- [x] 4.4 Add main: 'dist/index.js'

## 5. Build System

- [x] 5.1 Add npm run build script
- [x] 5.2 Add npm run lint script (eslint)
- [x] 5.3 Add npm run format script (prettier)
- [x] 5.4 Configure ncc to bundle all dependencies
- [x] 5.5 Add pre-commit hook for build verification

## 6. Testing

- [x] 6.1 Add jest configuration
- [x] 6.2 Write unit tests for input validation
- [x] 6.3 Write unit tests for version resolution
- [x] 6.4 Write unit tests for command builder
- [x] 6.5 Write unit tests for output parsing
- [x] 6.6 Update .github/workflows/test.yml for new structure
- [x] 6.7 Add build step to CI workflow
- [x] 6.8 Test on macOS runner
- [x] 6.9 Test on Linux runner

## 7. Documentation

- [x] 7.1 Update README.md (if needed)
- [x] 7.2 Add CONTRIBUTING.md with build instructions
- [x] 7.3 Update CLAUDE.md with new project structure

## 8. Release

- [x] 8.1 Verify backward compatibility
- [x] 8.2 Create release with changelog
- [x] 8.3 Update v1 major version tag
