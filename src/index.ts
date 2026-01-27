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
];

const EXFIG_REPO = 'alexey1312/exfig';
const EXFIG_BINARY_NAME = 'ExFig'; // Capital letters

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
    config: core.getInput('config') || 'exfig.yml',
    filter: core.getInput('filter'),
    version: core.getInput('version') || 'latest',
    cache: core.getBooleanInput('cache'),
    cachePath: core.getInput('cache_path') || '.exfig-cache.json',
    cacheKeyPrefix: core.getInput('cache_key_prefix') || 'exfig-cache',
    granularCache: core.getBooleanInput('granular_cache'),
    rateLimit: parseInt(core.getInput('rate_limit') || '10', 10),
    maxRetries: parseInt(core.getInput('max_retries') || '3', 10),
    outputDir: core.getInput('output_dir'),
    verbose: core.getBooleanInput('verbose'),
    extraArgs: core.getInput('extra_args'),
    slackWebhook: core.getInput('slack_webhook'),
    slackMention: core.getInput('slack_mention'),
    slackTemplates: core.getInput('slack_templates'),
  };
}

function isValidCommand(cmd: string): cmd is ExFigCommand {
  return VALID_COMMANDS.includes(cmd as ExFigCommand);
}

function getGitHubContext(): GitHubContext {
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

// =============================================================================
// Platform Validation
// =============================================================================

function validatePlatform(runnerOs: RunnerOS): Platform {
  const platformMap: Record<RunnerOS, Platform> = {
    macOS: 'darwin',
    Linux: 'linux',
  };

  const platform = platformMap[runnerOs];
  if (!platform) {
    throw new Error(`Unsupported platform: ${runnerOs}. Only Linux and macOS are supported.`);
  }

  return platform;
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

function getBinaryInstallDir(runnerTemp: string): string {
  return path.join(runnerTemp, 'exfig');
}

function getBinaryPath(installDir: string): string {
  return path.join(installDir, EXFIG_BINARY_NAME);
}

async function cacheBinary(
  platform: Platform,
  version: string,
  runnerTemp: string
): Promise<boolean> {
  const installDir = getBinaryInstallDir(runnerTemp);
  const cacheKey = `exfig-binary-${platform === 'darwin' ? 'macOS' : 'Linux'}-${version}`;

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

  // Save to cache
  const cacheKey = `exfig-binary-${platform === 'darwin' ? 'macOS' : 'Linux'}-${version}`;
  await cache.saveCache([installDir], cacheKey);
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

export function buildCommand(inputs: ActionInputs): { args: string[]; configPaths: string[] } {
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

  // Add extra arguments
  if (inputs.extraArgs) {
    args.push(...inputs.extraArgs.split(/\s+/).filter(Boolean));
  }

  return { args, configPaths };
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

function buildSlackPayload(
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
      .replace(/\{\{RUN_URL\}\}/g, vars.runUrl);

    return JSON.parse(payload) as Record<string, unknown>;
  }

  // Build inline payload
  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${vars.icon} ExFig: ${vars.title}`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Command:*\n\`${vars.command}\`${vars.configs}` },
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
      if (res.statusCode === 200) {
        core.info('Slack notification sent successfully');
        resolve();
      } else {
        core.warning(`Slack notification failed with HTTP ${res.statusCode}`);
        resolve(); // Non-fatal
      }
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
  };

  let inputs: ActionInputs | null = null;
  let context: GitHubContext | null = null;

  try {
    // Step 1: Parse and validate inputs
    inputs = getInputs();
    context = getGitHubContext();

    // Step 2: Validate platform
    const platform = validatePlatform(context.runnerOs);
    core.info(`Platform: ${context.runnerOs} (${platform})`);

    // Step 3: Resolve version
    const version = await resolveVersion(inputs.version, context.token);

    // Step 4: Cache/download binary
    const installDir = getBinaryInstallDir(context.runnerTemp);
    const binaryPath = getBinaryPath(installDir);

    const binaryCacheHit = await cacheBinary(platform, version, context.runnerTemp);
    if (!binaryCacheHit) {
      await downloadBinary(platform, version, context.runnerTemp);
    }

    // Step 5: Add to PATH
    core.addPath(installDir);

    // Step 6: Restore asset cache
    outputs.cacheHit = await restoreAssetCache(inputs, context.runId);

    // Step 7: Build and run command
    const { args, configPaths } = buildCommand(inputs);

    // Build config summary for batch command
    if (configPaths.length > 0) {
      outputs.configSummary = configPaths.map(p => path.basename(p)).join(', ');
    }

    const result = await runExFig(binaryPath, args, inputs.figmaToken);
    outputs.duration = `${result.durationSeconds}s`;

    // Parse output
    const metrics = parseExFigOutput(result.stdout + result.stderr);
    outputs.assetsExported = metrics.assetsExported;
    outputs.validatedCount = metrics.validatedCount;
    outputs.exportedConfigs = metrics.exportedConfigs;
    outputs.failedCount = metrics.failedCount;
    outputs.errorMessage = metrics.errorMessage;
    outputs.errorCategory = metrics.errorCategory;

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
      await handleSlackNotification(inputs, outputs as ActionOutputs, context);
    }

    // Fail if ExFig failed
    if (exitCode !== 0) {
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
        await handleSlackNotification(inputs, outputs as ActionOutputs, context);
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
}

async function handleSlackNotification(
  inputs: ActionInputs,
  outputs: ActionOutputs,
  context: GitHubContext
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
    if (outputs.validatedCount > 0 && outputs.assetsExported === 0) {
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
    title = 'Export failed';
    templateName = 'failure.json';

    if (outputs.failedCount > 0) {
      if (outputs.errorMessage) {
        subtitle = `[${outputs.errorCategory}] ${outputs.failedCount} failed: ${outputs.errorMessage}`;
      } else {
        subtitle = `[ERROR] ${outputs.failedCount} config(s) failed`;
      }
    } else {
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
      assets: assetsDisplay,
      duration: outputs.duration,
      repo: context.repository,
      runUrl,
    },
    templatePath
  );

  await sendSlackNotification(inputs.slackWebhook, payload);
}

// Run
void run();
