/**
 * Custom Jest resolver that handles ESM-only packages (exports map with only "import" condition).
 * Required for @actions/* v3+ packages which are pure ESM.
 */
const path = require('path');
const fs = require('fs');

module.exports = (request, options) => {
  try {
    return options.defaultResolver(request, options);
  } catch {
    // If default resolver fails, try resolving via package.json exports map
    const pkgName = request.startsWith('@')
      ? request.split('/').slice(0, 2).join('/')
      : request.split('/')[0];

    // Find package directory by walking up from basedir
    const pkgDir = path.join(options.rootDir || process.cwd(), 'node_modules', pkgName);
    const pkgJsonPath = path.join(pkgDir, 'package.json');

    if (fs.existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const subpath = request === pkgName ? '.' : './' + request.slice(pkgName.length + 1);

      // Resolve via exports map
      if (pkg.exports) {
        const entry = pkg.exports[subpath];
        if (entry) {
          const resolved = typeof entry === 'string' ? entry
            : entry.import || entry.default || entry.require;
          if (resolved) {
            return path.resolve(pkgDir, resolved);
          }
        }
      }

      // Fallback to main
      if (pkg.main) {
        return path.resolve(pkgDir, pkg.main);
      }
    }

    throw new Error(`Cannot resolve module '${request}'`);
  }
};
