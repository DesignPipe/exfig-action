# Contributing

## Setup

```bash
git clone https://github.com/DesignPipe/exfig-action.git
cd exfig-action
npm install
```

`./bin/mise` manages Node.js 20 and tools automatically.

## Development

```bash
./bin/mise run lint         # Format, lint and fix all files
./bin/mise run test         # Run unit tests
./bin/mise run build        # Build dist/index.js
```

## Before Committing

1. Run `./bin/mise run lint`
2. Run `./bin/mise run test`
3. Run `./bin/mise run build`
4. Commit `dist/` changes

Git hooks auto-configure on directory entry.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(action): add new input
fix(action): handle edge case
docs: update README
```

## Pull Requests

1. Create feature branch
2. Make changes
3. Ensure all checks pass
4. Submit PR
