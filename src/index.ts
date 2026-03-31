import * as core from '@actions/core';
import * as cache from '@actions/cache';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';

import type {
  ActionInputs,
  ActionOutputs,
  ExFigCommand,
  Platform,
  RunnerOS,
  ExFigResult,
  ExFigMetrics,
  ErrorCategory,
  SlackTemplateVars,
  GitHubContext,
  BatchReport,
  ExportReport,
  LintReport,
} from './types';

// =============================================================================
// Constants
// =============================================================================

const VALID_COMMANDS: readonly ExFigCommand[] = [
  'colors',
  'icons',
  'images',
  'typography',
  'batch',
  'fetch',
  'download',
  'lint',
];

const EXFIG_REPO = 'DesignPipe/exfig';
const EXFIG_BINARY_NAME = 'ExFig'; // Capital letters
const PKL_VERSION = '0.31.1';

/** Commands that support --report for structured JSON output */
const REPORT_COMMANDS: readonly ExFigCommand[] = [
  'batch',
  'colors',
  'icons',
  'images',
  'typography',
];

// =============================================================================
// Input Parsing
// =============================================================================

function getInputs(): ActionInputs {
  const command = core.getInput('command', { required: true });
  if (!isValidCommand(command)) {
    throw new Error(`Invalid command '${command}'. Valid commands: ${VALID_COMMANDS.join(', ')}`);
  }

  return {
    figmaToken: core.getInput('figma_token', { required: true }),
    command,
    config: core.getInput('config') || 'exfig.pkl',
    filter: core.getInput('filter'),
    version: core.getInput('version') || 'latest',
    cache: core.getBooleanInput('cache'),
    cachePath: core.getInput('cache_path') || '.exfig-cache.json',
    cacheKeyPrefix: core.getInput('cache_key_prefix') || 'exfig-cache',
    granularCache: core.getBooleanInput('granular_cache'),
    concurrentDownloads: core.getInput('concurrent_downloads'),
    timeout: core.getInput('timeout'),
    failFast: core.getBooleanInput('fail_fast'),
    report: core.getInput('report'),
    rateLimit: parseInt(core.getInput('rate_limit') || '10', 10),
    maxRetries: parseInt(core.getInput('max_retries') || '3', 10),
    outputDir: core.getInput('output_dir'),
    verbose: core.getBooleanInput('verbose'),
    extraArgs: core.getInput('extra_args'),
    lintRules: core.getInput('lint_rules'),
    lintSeverity: core.getInput('lint_severity') || 'info',
    slackWebhook: core.getInput('slack_webhook'),
    slackMention: core.getInput('slack_mention'),
    slackTemplates: core.getInput('slack_templates'),
  };
}

// =============================================================================
// Version Resolution
// =============================================================================

async function resolveVersion(version: string, token: string): Promise<string> {
  if (version !== 'latest') {
    // Normalize: add 'v' prefix if missing
    return version.startsWith('v') ? version : `v${version}`;
  }

  core.info('Fetching latest ExFig version...');

  const latestVersion = await fetchLatestVersion(token);
  if (!latestVersion) {
    throw new Error(
      'Failed to fetch latest ExFig version. This may happen due to GitHub API rate limiting.'
    );
  }

  core.info(`Resolved ExFig version: ${latestVersion}`);
  return latestVersion;
}

async function fetchLatestVersion(token: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.github.com',
      path: `/repos/${EXFIG_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'exfig-action',
        Accept: 'application/vnd.github.v3+json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            core.warning(`GitHub API returned status ${res.statusCode}`);
            resolve(null);
            return;
          }
          const json = JSON.parse(data) as { tag_name?: string };
          resolve(json.tag_name ?? null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// =============================================================================
// Binary Cache & Download
// =============================================================================

async function cacheBinary(
  platform: Platform,
  version: string,
  runnerTemp: string
): Promise<boolean> {
  const installDir = getBinaryInstallDir(runnerTemp);
  const cacheKey = `exfig-binary-${platform === 'darwin' ? 'macOS' : 'Linux'}-${version}-pkl-${PKL_VERSION}`;

  const cacheHit = await cache.restoreCache([installDir], cacheKey);
  if (cacheHit) {
    core.info(`Binary cache hit: ${cacheKey}`);
    return true;
  }

  core.info(`Binary cache miss: ${cacheKey}`);
  return false;
}

async function downloadBinary(
  platform: Platform,
  version: string,
  runnerTemp: string
): Promise<void> {
  const installDir = getBinaryInstallDir(runnerTemp);
  await io.mkdirP(installDir);

  const archive = platform === 'darwin' ? 'exfig-macos.zip' : 'exfig-linux-x64.tar.gz';
  const downloadUrl = `https://github.com/${EXFIG_REPO}/releases/download/${version}/${archive}`;
  const archivePath = path.join(runnerTemp, archive);

  core.info(`Downloading ExFig ${version} (${archive})...`);
  core.info(`URL: ${downloadUrl}`);

  await downloadFile(downloadUrl, archivePath);

  // Extract using @actions/exec (safe, no shell injection)
  if (archive.endsWith('.zip')) {
    await exec.exec('unzip', ['-o', archivePath, '-d', installDir]);
  } else {
    await exec.exec('tar', ['-xzf', archivePath, '-C', installDir]);
  }

  // Make executable
  const binaryPath = getBinaryPath(installDir);
  await fs.promises.chmod(binaryPath, 0o755);
  core.info(`ExFig installed to ${binaryPath}`);
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const request = (currentUrl: string, redirectCount = 0): void => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      https
        .get(currentUrl, res => {
          // Handle redirects
          if (res.statusCode === 301 || res.statusCode === 302) {
            const location = res.headers.location;
            if (location) {
              request(location, redirectCount + 1);
              return;
            }
          }

          if (res.statusCode !== 200) {
            reject(new Error(`Failed to download. HTTP status: ${res.statusCode}`));
            return;
          }

          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', err => {
          fs.unlink(destPath, () => {}); // Clean up
          reject(err);
        });
    };

    request(url);
  });
}

// =============================================================================
// Pkl CLI Installation
// =============================================================================

export function getPklBinaryName(platform: Platform, arch: string): string {
  if (platform === 'darwin') {
    return arch === 'arm64' ? 'pkl-macos-aarch64' : 'pkl-macos-amd64';
  }
  return 'pkl-linux-amd64';
}

async function installPkl(platform: Platform, runnerTemp: string): Promise<void> {
  const installDir = getBinaryInstallDir(runnerTemp);
  const pklPath = path.join(installDir, 'pkl');
  const arch = os.arch();
  const binaryName = getPklBinaryName(platform, arch);
  const downloadUrl = `https://github.com/apple/pkl/releases/download/${PKL_VERSION}/${binaryName}`;

  core.info(`Installing pkl ${PKL_VERSION} (${binaryName})...`);
  await downloadFile(downloadUrl, pklPath);
  await fs.promises.chmod(pklPath, 0o755);
  core.info(`pkl ${PKL_VERSION} installed to ${pklPath}`);
}

// =============================================================================
// Asset Cache
// =============================================================================

async function restoreAssetCache(inputs: ActionInputs, runId: string): Promise<boolean> {
  if (!inputs.cache) return false;

  const key = `${inputs.cacheKeyPrefix}-${runId}`;
  const restoreKeys = [`${inputs.cacheKeyPrefix}-`];

  const cacheHit = await cache.restoreCache([inputs.cachePath], key, restoreKeys);
  if (cacheHit) {
    core.info(`Asset cache restored: ${cacheHit}`);
    return true;
  }

  core.info('Asset cache miss');
  return false;
}

async function saveAssetCache(inputs: ActionInputs, runId: string): Promise<void> {
  if (!inputs.cache) return;

  const key = `${inputs.cacheKeyPrefix}-${runId}`;

  try {
    await cache.saveCache([inputs.cachePath], key);
    core.info(`Asset cache saved: ${key}`);
  } catch (error) {
    // Cache save failures are non-fatal
    const message = error instanceof Error ? error.message : String(error);
    core.warning(`Failed to save asset cache: ${message}`);
  }
}

// =============================================================================
// ExFig Command Execution
// =============================================================================

// =============================================================================
// Exported for Testing
// =============================================================================

export function isValidCommand(cmd: string): cmd is ExFigCommand {
  return VALID_COMMANDS.includes(cmd as ExFigCommand);
}

export function validatePlatform(runnerOs: string): Platform {
  const platformMap: Record<string, Platform> = {
    macOS: 'darwin',
    Linux: 'linux',
  };

  const platform = platformMap[runnerOs];
  if (!platform) {
    throw new Error(`Unsupported platform: ${runnerOs}. Only Linux and macOS are supported.`);
  }

  return platform;
}

export function getBinaryInstallDir(runnerTemp: string): string {
  return path.join(runnerTemp, 'exfig');
}

export function getBinaryPath(installDir: string): string {
  return path.join(installDir, EXFIG_BINARY_NAME);
}

export function getGitHubContext(): GitHubContext {
  return {
    repository: process.env.GITHUB_REPOSITORY ?? '',
    runId: process.env.GITHUB_RUN_ID ?? '',
    serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
    token: process.env.GITHUB_TOKEN ?? '',
    runnerTemp: process.env.RUNNER_TEMP ?? os.tmpdir(),
    runnerOs: (process.env.RUNNER_OS as RunnerOS) ?? 'Linux',
    actionPath: process.env.GITHUB_ACTION_PATH ?? '',
  };
}

export function buildSlackPayload(
  vars: SlackTemplateVars,
  templatePath?: string
): Record<string, unknown> {
  // Try to load template
  if (templatePath && fs.existsSync(templatePath)) {
    const template = fs.readFileSync(templatePath, 'utf-8');
    const payload = template
      .replace(/\{\{COLOR\}\}/g, vars.color)
      .replace(/\{\{ICON\}\}/g, vars.icon)
      .replace(/\{\{TITLE\}\}/g, vars.title)
      .replace(/\{\{COMMAND\}\}/g, vars.command)
      .replace(/\{\{CONFIGS\}\}/g, vars.configs)
      .replace(/\{\{ASSETS\}\}/g, vars.assets)
      .replace(/\{\{DURATION\}\}/g, vars.duration)
      .replace(/\{\{REPO\}\}/g, vars.repo)
      .replace(/\{\{SUBTITLE\}\}/g, vars.subtitle)
      .replace(/\{\{RUN_URL\}\}/g, vars.runUrl)
      .replace(/\{\{VERSION\}\}/g, vars.version)
      .replace(/\{\{PLATFORM\}\}/g, vars.platform)
      .replace(/\{\{CONFIG_COUNT\}\}/g, vars.configCount.toString())
      .replace(/\{\{VALIDATED_COUNT\}\}/g, vars.validatedCount.toString());

    return JSON.parse(payload) as Record<string, unknown>;
  }

  // Build inline payload
  let commandDisplay = `\`${vars.command}\``;
  if (vars.configCount > 0) {
    commandDisplay = `\`${vars.command}\` - ${vars.configCount}`;
  } else if (vars.validatedCount > 0) {
    commandDisplay = `\`${vars.command}\` - ${vars.validatedCount} (cached)`;
  }

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${vars.icon} ExFig: ${vars.title}`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Command:*\n${commandDisplay}${vars.configs}` },
        { type: 'mrkdwn', text: `*Assets:*\n${vars.assets}` },
      ],
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Repository:*\n${vars.repo}` },
        { type: 'mrkdwn', text: `*Duration:*\n${vars.duration}` },
      ],
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${vars.platform} • ExFig \`${vars.version}\`` }],
    },
  ];

  if (vars.subtitle) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: vars.subtitle }],
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View Run', emoji: true },
        url: vars.runUrl,
      },
    ],
  });

  return {
    attachments: [{ color: vars.color, blocks }],
  };
}

export function buildCommand(inputs: ActionInputs): {
  args: string[];
  configPaths: string[];
  reportPath: string;
} {
  const args: string[] = [inputs.command];
  const configPaths: string[] = [];

  // Handle config based on command type
  if (inputs.command === 'batch') {
    // Parse comma-separated paths
    const configs = inputs.config
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);
    for (const cfg of configs) {
      if (fs.existsSync(cfg)) {
        configPaths.push(cfg);
      } else {
        core.warning(`Config file not found: ${cfg}`);
      }
    }
    if (configPaths.length === 0) {
      throw new Error('No valid config files found for batch command');
    }
  } else if (fs.existsSync(inputs.config)) {
    args.push('-i', inputs.config);
  }

  // Add filter if provided
  if (inputs.filter) {
    args.push(inputs.filter);
  }

  // Add cache flags
  if (inputs.cache) {
    args.push('--cache', '--cache-path', inputs.cachePath);
  }

  // Add granular cache flag
  if (inputs.granularCache) {
    args.push('--experimental-granular-cache');
  }

  // Add new CLI flags
  if (inputs.concurrentDownloads) {
    args.push('--concurrent-downloads', inputs.concurrentDownloads);
  }
  if (inputs.timeout) {
    args.push('--timeout', inputs.timeout);
  }
  if (inputs.failFast) {
    args.push('--fail-fast');
  }

  // Lint-specific flags
  if (inputs.command === 'lint') {
    args.push('--format', 'json');
    if (inputs.lintRules) {
      args.push('--rules', inputs.lintRules);
    }
    if (inputs.lintSeverity) {
      args.push('--severity', inputs.lintSeverity);
    }
  }

  // Add rate limit and retries
  args.push('--rate-limit', inputs.rateLimit.toString());
  args.push('--max-retries', inputs.maxRetries.toString());

  // Add output directory
  if (inputs.outputDir) {
    args.push('--output', inputs.outputDir);
  }

  // Add verbose flag
  if (inputs.verbose) {
    args.push('--verbose');
  }

  // Add config paths at the end for batch command
  if (configPaths.length > 0) {
    args.push(...configPaths);
  }

  // Auto-inject --report for commands that support structured JSON output
  let reportPath = '';
  if (REPORT_COMMANDS.includes(inputs.command)) {
    reportPath = inputs.report || path.join(os.tmpdir(), 'exfig-report.json');
    args.push('--report', reportPath);
  }

  // Add extra arguments
  if (inputs.extraArgs) {
    args.push(...inputs.extraArgs.split(/\s+/).filter(Boolean));
  }

  return { args, configPaths, reportPath };
}

async function runExFig(
  binaryPath: string,
  args: string[],
  figmaToken: string
): Promise<ExFigResult> {
  let stdout = '';
  let stderr = '';

  const startTime = Date.now();

  core.info(`Running: ${EXFIG_BINARY_NAME} ${args.join(' ')}`);

  // Using @actions/exec which is safe and doesn't use shell
  const exitCode = await exec.exec(binaryPath, args, {
    env: {
      ...process.env,
      FIGMA_PERSONAL_TOKEN: figmaToken,
    },
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      },
    },
  });

  const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

  return { exitCode, stdout, stderr, durationSeconds };
}

// =============================================================================
// Output Parsing
// =============================================================================

export function parseExFigOutput(output: string): ExFigMetrics {
  // Parse assets count: "checkmark config.yaml - N colors/icons"
  const assetMatches = output.match(/^✓.*- (\d+) /gm) ?? [];
  const assetsExported = assetMatches.reduce((sum, match) => {
    const num = match.match(/(\d+)/);
    return sum + (num ? parseInt(num[1], 10) : 0);
  }, 0);

  // Parse validated (cached) configs: "checkmark config.yaml - validated"
  const validatedMatches = output.match(/^✓.*- validated/gm) ?? [];
  const validatedCount = validatedMatches.length;

  // Count configs with actual exports
  const exportedMatches = output.match(/^✓.*- \d+ /gm) ?? [];
  const exportedConfigs = exportedMatches.length;

  // Parse failure count from batch output: "Batch complete: X succeeded, Y failed"
  const failedMatch = output.match(/(\d+) failed/);
  const failedCount = failedMatch ? parseInt(failedMatch[1], 10) : 0;

  // Parse first error message: "cross config.yaml: Error message"
  const errorMatch = output.match(/^✗ (.+)$/m);
  let errorMessage = '';
  let errorCategory: ErrorCategory | '' = '';

  if (errorMatch) {
    const rawError = errorMatch[1].replace(/^✗\s*/, '');
    errorMessage = rawError.substring(0, 100);
    if (rawError.length > 100) {
      errorMessage += '...';
    }
    errorCategory = categorizeError(rawError);
  }

  return {
    assetsExported,
    validatedCount,
    exportedConfigs,
    failedCount,
    errorMessage,
    errorCategory,
  };
}

export function parseReportFile(reportPath: string): ExFigMetrics | null {
  if (!fs.existsSync(reportPath)) return null;

  let content: string;
  try {
    content = fs.readFileSync(reportPath, 'utf-8');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.warning(`Failed to read report file ${reportPath}: ${msg}`);
    return null;
  }

  let report: Record<string, unknown>;
  try {
    report = JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.warning(`Failed to parse report JSON from ${reportPath}: ${msg}`);
    return null;
  }

  // Discriminate batch vs single export report by structure
  if ('results' in report && Array.isArray(report.results)) {
    return parseBatchReport(report as unknown as BatchReport);
  }
  if ('command' in report && typeof report.command === 'string' && report.stats != null) {
    return parseSingleReport(report as unknown as ExportReport);
  }

  core.warning(
    `Unknown report format in ${reportPath}: expected 'results' (batch) or 'command' (single export) key`
  );
  return null;
}

function parseBatchReport(report: BatchReport): ExFigMetrics {
  let assetsExported = 0;
  let validatedCount = 0;
  let exportedConfigs = 0;
  let errorMessage = '';
  let errorCategory: ErrorCategory | '' = '';

  for (const r of report.results) {
    if (r.success && r.stats) {
      const total = r.stats.colors + r.stats.icons + r.stats.images + r.stats.typography;
      if (total > 0) {
        assetsExported += total;
        exportedConfigs++;
      } else {
        validatedCount++;
      }
    } else if (!r.success && r.error && !errorMessage) {
      errorMessage = r.error.substring(0, 100);
      if (r.error.length > 100) errorMessage += '...';
      errorCategory = categorizeError(r.error);
    }
  }

  return {
    assetsExported,
    validatedCount,
    exportedConfigs,
    failedCount: report.failureCount,
    errorMessage,
    errorCategory,
  };
}

function parseSingleReport(report: ExportReport): ExFigMetrics {
  const stats = report.stats ?? { colors: 0, icons: 0, images: 0, typography: 0 };
  const assetsExported = stats.colors + stats.icons + stats.images + stats.typography;

  let errorMessage = '';
  let errorCategory: ErrorCategory | '' = '';

  if (!report.success && report.error) {
    errorMessage = report.error.substring(0, 100);
    if (report.error.length > 100) errorMessage += '...';
    errorCategory = categorizeError(report.error);
  }

  return {
    assetsExported,
    validatedCount: report.success && assetsExported === 0 ? 1 : 0,
    exportedConfigs: assetsExported > 0 ? 1 : 0,
    failedCount: report.success ? 0 : 1,
    errorMessage,
    errorCategory,
  };
}

function parseLintOutput(stdout: string): LintReport | null {
  try {
    const report = JSON.parse(stdout) as LintReport;
    if (typeof report.diagnosticsCount === 'number') {
      return report;
    }
    return null;
  } catch {
    return null;
  }
}

export function categorizeError(error: string): ErrorCategory {
  const errorLower = error.toLowerCase();

  if (errorLower.includes('rate limit')) return 'RATE_LIMIT';
  if (errorLower.includes('timeout')) return 'TIMEOUT';
  if (errorLower.includes('authentication') || errorLower.includes('token')) return 'AUTH';
  if (errorLower.includes('access denied') || errorLower.includes('forbidden')) return 'FORBIDDEN';
  if (errorLower.includes('not found') || errorLower.includes('404')) return 'NOT_FOUND';
  if (
    errorLower.includes('connection') ||
    errorLower.includes('internet') ||
    errorLower.includes('dns') ||
    errorLower.includes('network')
  )
    return 'NETWORK';
  if (errorLower.includes('server error') || /50\d/.test(errorLower)) return 'SERVER';
  if (errorLower.includes('invalid') || errorLower.includes('config')) return 'CONFIG';

  return 'ERROR';
}

/** Known crash patterns in Swift runtime / ExFig output */
const CRASH_PATTERNS = [
  'freed pointer was not the last allocation',
  'malloc:',
  'double free',
  'heap corruption',
  'segmentation fault',
  'bus error',
  'abort trap',
  'fatal error:',
  'Swift runtime failure',
  'EXC_BAD_ACCESS',
  'EXC_CRASH',
  'SIGABRT',
  'SIGSEGV',
  'SIGBUS',
];

/**
 * Detect if output indicates a crash
 * @returns crash message if detected, empty string otherwise
 */
export function detectCrash(stdout: string, stderr: string): string {
  const combined = `${stdout}\n${stderr}`.toLowerCase();

  for (const pattern of CRASH_PATTERNS) {
    if (combined.includes(pattern.toLowerCase())) {
      // Find the actual line containing the crash pattern
      const lines = `${stdout}\n${stderr}`.split('\n');
      const crashLine = lines.find(line => line.toLowerCase().includes(pattern.toLowerCase()));
      const trimmed = crashLine?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : pattern;
    }
  }

  return '';
}

async function getChangedFiles(): Promise<string> {
  try {
    let output = '';
    // Using @actions/exec which is safe
    await exec.exec('git', ['diff', '--name-only'], {
      ignoreReturnCode: true,
      silent: true,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
      },
    });
    return output.trim();
  } catch {
    return '';
  }
}

// =============================================================================
// Slack Notifications
// =============================================================================

export function formatSlackMention(mention: string): string {
  if (!mention) return '';

  // Skip if already formatted or is @channel/@here
  if (
    mention.startsWith('<') ||
    mention.startsWith('@') ||
    mention === '@channel' ||
    mention === '@here'
  ) {
    return mention;
  }

  // User ID: U... -> <@U...>
  if (/^U[A-Z0-9]+$/.test(mention)) {
    return `<@${mention}>`;
  }

  // Group ID: S... -> <!subteam^S...>
  if (/^S[A-Z0-9]+$/.test(mention)) {
    return `<!subteam^${mention}>`;
  }

  return mention;
}

async function sendSlackNotification(
  webhook: string,
  payload: Record<string, unknown>
): Promise<void> {
  return new Promise((resolve, _reject) => {
    const data = JSON.stringify(payload);
    const url = new URL(webhook);

    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, res => {
      res.resume(); // Drain response body to free socket immediately
      if (res.statusCode === 200) {
        core.info('Slack notification sent successfully');
        resolve();
      } else {
        core.warning(`Slack notification failed with HTTP ${res.statusCode}`);
        resolve(); // Non-fatal
      }
    });

    req.setTimeout(30_000, () => {
      core.warning('Slack notification timed out after 30s');
      req.destroy();
      resolve();
    });

    req.on('error', err => {
      core.warning(`Slack notification error: ${err.message}`);
      resolve(); // Non-fatal
    });

    req.write(data);
    req.end();
  });
}

// =============================================================================
// Main
// =============================================================================

async function run(): Promise<void> {
  const outputs: Partial<ActionOutputs> = {
    assetsExported: 0,
    changedFiles: '',
    cacheHit: false,
    exitCode: 0,
    failedCount: 0,
    duration: '0s',
    configSummary: '',
    validatedCount: 0,
    exportedConfigs: 0,
    errorCategory: '',
    errorMessage: '',
    reportJson: '',
    lintErrors: 0,
    lintWarnings: 0,
  };

  let inputs: ActionInputs | null = null;
  let context: GitHubContext | null = null;
  let version = 'unknown';
  let platform: Platform = 'linux';

  try {
    // Step 1: Parse and validate inputs
    inputs = getInputs();
    context = getGitHubContext();

    // Step 2: Validate platform
    platform = validatePlatform(context.runnerOs);
    core.info(`Platform: ${context.runnerOs} (${platform})`);

    // Step 3: Resolve version
    version = await resolveVersion(inputs.version, context.token);

    // Step 4: Cache/download binary
    const installDir = getBinaryInstallDir(context.runnerTemp);
    const binaryPath = getBinaryPath(installDir);

    const binaryCacheHit = await cacheBinary(platform, version, context.runnerTemp);
    if (!binaryCacheHit) {
      await downloadBinary(platform, version, context.runnerTemp);

      // Step 4b: Install pkl CLI (required by ExFig for .pkl config parsing)
      await installPkl(platform, context.runnerTemp);

      // Save both ExFig and pkl to cache
      const cacheKey = `exfig-binary-${platform === 'darwin' ? 'macOS' : 'Linux'}-${version}-pkl-${PKL_VERSION}`;
      await cache.saveCache([installDir], cacheKey);
    }

    // Step 5: Add to PATH
    core.addPath(installDir);

    // Step 6: Restore asset cache
    outputs.cacheHit = await restoreAssetCache(inputs, context.runId);

    // Step 7: Build and run command
    const { args, configPaths, reportPath } = buildCommand(inputs);

    // Build config summary for batch command
    if (configPaths.length > 0) {
      outputs.configSummary = configPaths.map(p => path.basename(p)).join(', ');
    }

    const result = await runExFig(binaryPath, args, inputs.figmaToken);
    outputs.duration = `${result.durationSeconds}s`;

    // Parse lint JSON output
    if (inputs.command === 'lint') {
      const lintResult = parseLintOutput(result.stdout);
      if (lintResult) {
        outputs.lintErrors = lintResult.errorsCount;
        outputs.lintWarnings = lintResult.warningsCount;
        outputs.reportJson = result.stdout;
      }
    }

    // Parse output: prefer structured report when available, fallback to regex
    let metrics: ExFigMetrics;
    if (REPORT_COMMANDS.includes(inputs.command) && reportPath) {
      const reportMetrics = parseReportFile(reportPath);
      if (reportMetrics) {
        metrics = reportMetrics;
        try {
          outputs.reportJson = fs.readFileSync(reportPath, 'utf-8');
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          core.warning(`Failed to read report file for output: ${msg}`);
        }
      } else {
        core.warning('Failed to parse report file, falling back to output parsing');
        metrics = parseExFigOutput(result.stdout + result.stderr);
      }
    } else {
      metrics = parseExFigOutput(result.stdout + result.stderr);
    }

    outputs.assetsExported = metrics.assetsExported;
    outputs.validatedCount = metrics.validatedCount;
    outputs.exportedConfigs = metrics.exportedConfigs;
    outputs.failedCount = metrics.failedCount;
    outputs.errorMessage = metrics.errorMessage;
    outputs.errorCategory = metrics.errorCategory;

    // Detect crash (process killed by signal)
    const crashMessage = detectCrash(result.stdout, result.stderr);
    const isCrash = result.exitCode === null || crashMessage !== '';

    if (isCrash) {
      core.error('ExFig process crashed (killed by signal)');
      if (crashMessage) {
        core.error(`Crash indicator: ${crashMessage}`);
      }
      outputs.errorCategory = 'CRASH';
      outputs.errorMessage = crashMessage || 'Process killed by signal';
    }

    // Override exit code if failures reported but exit was 0
    let exitCode = result.exitCode;
    if (metrics.failedCount > 0 && exitCode === 0) {
      core.warning(`ExFig reported ${metrics.failedCount} failure(s) but returned exit code 0`);
      exitCode = 1;
    }
    outputs.exitCode = exitCode;

    // Get changed files
    outputs.changedFiles = await getChangedFiles();

    // Set all outputs
    setOutputs(outputs as ActionOutputs);

    // Step 8: Save asset cache (always, for checkpoint resume)
    await saveAssetCache(inputs, context.runId);

    // Step 9: Send Slack notification if configured
    if (inputs.slackWebhook) {
      await handleSlackNotification(inputs, outputs as ActionOutputs, context, version, platform);
    }

    // Fail if ExFig failed or crashed
    if (isCrash) {
      const hint = crashMessage.includes('freed pointer')
        ? ' Try reducing parallelism or disabling --experimental-granular-cache.'
        : '';
      core.setFailed(`ExFig crashed (signal termination).${hint}`);
    } else if (exitCode !== 0) {
      core.setFailed(`ExFig command failed with exit code ${exitCode}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputs.exitCode = 1;
    outputs.errorMessage = message.substring(0, 100);
    outputs.errorCategory = 'ERROR';

    setOutputs(outputs as ActionOutputs);

    // Save cache on failure
    if (inputs && context) {
      await saveAssetCache(inputs, context.runId);

      // Send Slack notification on failure
      if (inputs.slackWebhook) {
        await handleSlackNotification(inputs, outputs as ActionOutputs, context, version, platform);
      }
    }

    core.setFailed(message);
  }
}

function setOutputs(outputs: ActionOutputs): void {
  core.setOutput('assets_exported', outputs.assetsExported);
  core.setOutput('changed_files', outputs.changedFiles);
  core.setOutput('cache_hit', outputs.cacheHit);
  core.setOutput('exit_code', outputs.exitCode);
  core.setOutput('failed_count', outputs.failedCount);
  core.setOutput('duration', outputs.duration);
  core.setOutput('config_summary', outputs.configSummary);
  core.setOutput('validated_count', outputs.validatedCount);
  core.setOutput('exported_configs', outputs.exportedConfigs);
  core.setOutput('error_category', outputs.errorCategory);
  core.setOutput('error_message', outputs.errorMessage);
  core.setOutput('report_json', outputs.reportJson);
  core.setOutput('lint_errors', outputs.lintErrors ?? 0);
  core.setOutput('lint_warnings', outputs.lintWarnings ?? 0);
}

async function handleSlackNotification(
  inputs: ActionInputs,
  outputs: ActionOutputs,
  context: GitHubContext,
  version: string,
  platform: Platform
): Promise<void> {
  const runUrl = `${context.serverUrl}/${context.repository}/actions/runs/${context.runId}`;
  const mention = formatSlackMention(inputs.slackMention);

  // Build assets display
  let assetsDisplay: string;
  if (outputs.validatedCount > 0) {
    if (outputs.assetsExported > 0) {
      assetsDisplay = `${outputs.assetsExported} exported, ${outputs.validatedCount} cached`;
    } else {
      assetsDisplay = `${outputs.validatedCount} cached (no changes)`;
    }
  } else {
    assetsDisplay = `${outputs.assetsExported} exported`;
  }

  // Build configs display for batch
  let configsDisplay = '';
  if (outputs.configSummary) {
    configsDisplay =
      '\n' +
      outputs.configSummary
        .split(', ')
        .map(c => `• ${c}`)
        .join('\n');
  }

  // Determine status
  let color: string;
  let icon: string;
  let title: string;
  let subtitle = '';
  let templateName: string;

  if (outputs.exitCode === 0) {
    if (inputs.command === 'lint') {
      color = '#36a64f';
      icon = '\u2705';
      title = 'Lint passed';
      subtitle =
        outputs.lintWarnings > 0 ? `${outputs.lintWarnings} warning(s)` : 'All checks passed';
      templateName = 'success.json';
    } else if (outputs.validatedCount > 0 && outputs.assetsExported === 0) {
      color = '#36a64f';
      icon = '\uD83D\uDCA8'; // dash
      title = 'No changes detected';
      subtitle = 'Cache hit - all assets up to date';
      templateName = 'cache-hit.json';
    } else {
      color = '#36a64f';
      icon = '\u2705'; // checkmark
      title = 'Export completed';
      templateName = 'success.json';
    }
  } else {
    color = '#dc3545';
    icon = '\u274C'; // X
    templateName = 'failure.json';

    // Handle crash (exit code null or CRASH category)
    if (outputs.exitCode === null || outputs.errorCategory === 'CRASH') {
      title = 'ExFig crashed';
      icon = '\uD83D\uDCA5'; // explosion emoji
      if (outputs.errorMessage) {
        subtitle = `[CRASH] ${outputs.errorMessage}`;
      } else {
        subtitle = '[CRASH] Process killed by signal - check workflow logs';
      }
    } else if (inputs.command === 'lint' && outputs.lintErrors > 0) {
      title = 'Lint failed';
      subtitle = `${outputs.lintErrors} error(s), ${outputs.lintWarnings} warning(s)`;
    } else if (outputs.failedCount > 0) {
      title = 'Export failed';
      if (outputs.errorMessage) {
        subtitle = `[${outputs.errorCategory}] ${outputs.failedCount} failed: ${outputs.errorMessage}`;
      } else {
        subtitle = `[ERROR] ${outputs.failedCount} config(s) failed`;
      }
    } else {
      title = 'Export failed';
      subtitle = 'See workflow logs for details';
    }

    if (mention) {
      subtitle += ` ${mention}`;
    }
  }

  // Resolve template path
  let templatePath: string | undefined;
  if (inputs.slackTemplates) {
    const customPath = path.join(inputs.slackTemplates, templateName);
    if (fs.existsSync(customPath)) {
      templatePath = customPath;
    }
  }
  if (!templatePath && context.actionPath) {
    const defaultPath = path.join(context.actionPath, 'templates', 'slack', templateName);
    if (fs.existsSync(defaultPath)) {
      templatePath = defaultPath;
    }
  }

  const payload = buildSlackPayload(
    {
      color,
      icon,
      title,
      subtitle,
      command: inputs.command,
      configs: configsDisplay,
      configCount: outputs.exportedConfigs,
      validatedCount: outputs.validatedCount,
      assets: assetsDisplay,
      duration: outputs.duration,
      repo: context.repository,
      runUrl,
      version,
      platform: platform === 'darwin' ? 'macOS' : 'Linux',
    },
    templatePath
  );

  await sendSlackNotification(inputs.slackWebhook, payload);
}

// Run
void run();
