/**
 * ExFig Action Type Definitions
 * These types mirror the inputs/outputs defined in action.yml
 */

/** Valid ExFig commands */
export type ExFigCommand =
  | 'colors'
  | 'icons'
  | 'images'
  | 'typography'
  | 'batch'
  | 'fetch'
  | 'download'
  | 'lint';

/** Valid lint severity levels */
export type LintSeverity = 'error' | 'warning' | 'info';

/** Supported platforms (no Windows support) */
export type Platform = 'darwin' | 'linux';

/** Runner OS values from GitHub Actions */
export type RunnerOS = 'macOS' | 'Linux';

/**
 * Action inputs matching action.yml inputs
 */
export interface ActionInputs {
  /** Figma Personal Access Token */
  figmaToken: string;
  /** ExFig command to run */
  command: ExFigCommand;
  /** Path to exfig.pkl config file (can be comma-separated for batch) */
  config: string;
  /** Filter pattern for assets */
  filter: string;
  /** ExFig version to use */
  version: string;
  /** Enable caching for incremental exports */
  cache: boolean;
  /** Path to cache file */
  cachePath: string;
  /** Prefix for cache key */
  cacheKeyPrefix: string;
  /** Enable experimental granular caching */
  granularCache: boolean;
  /** CDN download parallelism */
  concurrentDownloads: string;
  /** API timeout in seconds */
  timeout: string;
  /** Stop on first batch error */
  failFast: boolean;
  /** JSON report output path */
  report: string;
  /** Figma API rate limit (requests per second) */
  rateLimit: number;
  /** Maximum retries for failed API requests */
  maxRetries: number;
  /** Output directory for exported assets */
  outputDir: string;
  /** Enable verbose logging */
  verbose: boolean;
  /** Additional CLI arguments */
  extraArgs: string;
  /** Comma-separated lint rule IDs (lint command only) */
  lintRules: string;
  /** Minimum lint severity (lint command only) */
  lintSeverity: LintSeverity;
  /** Slack Incoming Webhook URL */
  slackWebhook: string;
  /** User/group to mention on failure */
  slackMention: string;
  /** Path to custom Slack templates directory */
  slackTemplates: string;
}

/**
 * Action outputs matching action.yml outputs
 */
export interface ActionOutputs {
  /** Number of assets exported */
  assetsExported: number;
  /** List of changed files (newline-separated) */
  changedFiles: string;
  /** Whether cache was restored */
  cacheHit: boolean;
  /** ExFig command exit code (null if process was killed by signal) */
  exitCode: number | null;
  /** Number of failed configs in batch mode */
  failedCount: number;
  /** Execution duration in seconds */
  duration: string;
  /** Summary of config files processed */
  configSummary: string;
  /** Number of configs validated from cache */
  validatedCount: number;
  /** Number of configs that exported new assets */
  exportedConfigs: number;
  /** Error category code */
  errorCategory: ErrorCategory | '';
  /** First error message from failed config */
  errorMessage: string;
  /** Raw JSON report content */
  reportJson: string;
  /** Number of lint errors (lint command only) */
  lintErrors: number;
  /** Number of lint warnings (lint command only) */
  lintWarnings: number;
}

/** Error categories for Slack notifications */
export type ErrorCategory =
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'AUTH'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'NETWORK'
  | 'SERVER'
  | 'CONFIG'
  | 'CRASH'
  | 'ERROR';

/**
 * ExFig command execution result
 */
export interface ExFigResult {
  /** Exit code from ExFig CLI (null if process was killed by signal) */
  exitCode: number | null;
  /** Raw stdout output */
  stdout: string;
  /** Raw stderr output */
  stderr: string;
  /** Execution duration in seconds */
  durationSeconds: number;
}

/**
 * Parsed metrics from ExFig output
 */
export interface ExFigMetrics {
  /** Total assets exported */
  assetsExported: number;
  /** Number of configs validated (cached) */
  validatedCount: number;
  /** Number of configs with actual exports */
  exportedConfigs: number;
  /** Number of failed configs */
  failedCount: number;
  /** First error message */
  errorMessage: string;
  /** Categorized error type */
  errorCategory: ErrorCategory | '';
}

/**
 * Binary cache configuration
 */
export interface BinaryCache {
  /** Cache key pattern */
  key: string;
  /** Path to cached binary */
  path: string;
}

/**
 * Asset cache configuration
 */
export interface AssetCache {
  /** Primary cache key */
  key: string;
  /** Restore keys for fallback */
  restoreKeys: string[];
  /** Path to cache file */
  path: string;
}

/**
 * Slack notification payload variables
 */
export interface SlackTemplateVars {
  color: string;
  icon: string;
  title: string;
  subtitle: string;
  command: string;
  configs: string;
  configCount: number;
  validatedCount: number;
  assets: string;
  duration: string;
  repo: string;
  runUrl: string;
  version: string;
  platform: string;
  lintDiagnostics: LintDiagnostic[];
}

/**
 * GitHub context information
 */
export interface GitHubContext {
  /** Repository name (owner/repo) */
  repository: string;
  /** Workflow run ID */
  runId: string;
  /** GitHub server URL */
  serverUrl: string;
  /** GitHub token */
  token: string;
  /** Runner temp directory */
  runnerTemp: string;
  /** Runner OS */
  runnerOs: RunnerOS;
  /** Action path */
  actionPath: string;
}

/**
 * Structured batch report from ExFig CLI (--report flag)
 * Mirrors Batch.swift:884-907 BatchReport struct
 */
export interface BatchReport {
  startTime: string;
  endTime: string;
  duration: number;
  totalConfigs: number;
  successCount: number;
  failureCount: number;
  results: BatchConfigReport[];
}

export interface BatchConfigReport {
  name: string;
  path: string;
  success: boolean;
  error: string | null;
  stats: BatchConfigStats | null;
}

export interface BatchConfigStats {
  colors: number;
  icons: number;
  images: number;
  typography: number;
}

/** Single-export commands that produce ExportReport */
export type SingleExportCommand = 'colors' | 'icons' | 'images' | 'typography';

/**
 * Structured export report from ExFig CLI (--report flag, single commands)
 * Mirrors ExportReport struct for colors/icons/images/typography commands
 */
export interface ExportReport {
  version: number;
  command: SingleExportCommand;
  config: string;
  startTime: string;
  endTime: string;
  duration: number;
  success: boolean;
  error: string | null;
  stats: BatchConfigStats;
  warnings: string[];
  manifest: AssetManifest | null;
}

/**
 * Asset manifest from ExFig CLI export.
 * Currently deserialized but not consumed; reserved for future
 * changed-files output without requiring a git working tree.
 */
export interface AssetManifest {
  outputDirectory: string;
  files: AssetManifestFile[];
  deleted: string[];
}

export interface AssetManifestFile {
  path: string;
  assetType: string;
}

/**
 * Lint report from ExFig CLI (--format json)
 */
export interface LintReport {
  diagnosticsCount: number;
  errorsCount: number;
  warningsCount: number;
  diagnostics: LintDiagnostic[];
}

export interface LintDiagnostic {
  ruleId: string;
  ruleName: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  componentName: string | null;
  nodeId: string | null;
  suggestion: string | null;
}
