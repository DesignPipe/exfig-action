## 1. Project Setup

- [ ] 1.1 Create package.json with dependencies
- [ ] 1.2 Create tsconfig.json for Node 20
- [ ] 1.3 Add @vercel/ncc build configuration
- [ ] 1.4 Update mise.toml with npm scripts
- [ ] 1.5 Add .gitignore entries for node_modules, dist

## 2. Type Definitions

- [ ] 2.1 Create src/types.ts with input/output interfaces
- [ ] 2.2 Define ActionInputs interface matching action.yml inputs
- [ ] 2.3 Define ActionOutputs interface matching action.yml outputs
- [ ] 2.4 Define ExFigConfig interface for CLI options

## 3. Core Implementation

- [ ] 3.1 Create src/index.ts entry point
- [ ] 3.2 Implement input parsing with @actions/core
- [ ] 3.3 Implement input validation logic
- [ ] 3.4 Implement platform detection (darwin/linux)
- [ ] 3.5 Implement version resolution (latest/pinned)
- [ ] 3.6 Implement binary download with fetch
- [ ] 3.7 Implement binary caching with @actions/cache
- [ ] 3.8 Implement ExFig command builder
- [ ] 3.9 Implement ExFig execution with @actions/exec
- [ ] 3.10 Implement output parsing (metrics extraction)
- [ ] 3.11 Implement asset cache restore/save
- [ ] 3.12 Implement error handling and reporting
- [ ] 3.13 Implement Slack notification (optional)

## 4. Action Configuration

- [ ] 4.1 Update action.yml to use runs: 'node20'
- [ ] 4.2 Remove all shell script steps
- [ ] 4.3 Keep inputs/outputs definitions unchanged
- [ ] 4.4 Add main: 'dist/index.js'

## 5. Build System

- [ ] 5.1 Add npm run build script
- [ ] 5.2 Add npm run lint script (eslint)
- [ ] 5.3 Add npm run format script (prettier)
- [ ] 5.4 Configure ncc to bundle all dependencies
- [ ] 5.5 Add pre-commit hook for build verification

## 6. Testing

- [ ] 6.1 Add jest configuration
- [ ] 6.2 Write unit tests for input validation
- [ ] 6.3 Write unit tests for version resolution
- [ ] 6.4 Write unit tests for command builder
- [ ] 6.5 Write unit tests for output parsing
- [ ] 6.6 Update .github/workflows/test.yml for new structure
- [ ] 6.7 Add build step to CI workflow
- [ ] 6.8 Test on macOS runner
- [ ] 6.9 Test on Linux runner

## 7. Documentation

- [ ] 7.1 Update README.md (if needed)
- [ ] 7.2 Add CONTRIBUTING.md with build instructions
- [ ] 7.3 Update CLAUDE.md with new project structure

## 8. Release

- [ ] 8.1 Verify backward compatibility
- [ ] 8.2 Create release with changelog
- [ ] 8.3 Update v1 major version tag
