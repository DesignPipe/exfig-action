import {
  parseExFigOutput,
  categorizeError,
  formatSlackMention,
  buildCommand,
  isValidCommand,
  validatePlatform,
  getBinaryInstallDir,
  getBinaryPath,
  getGitHubContext,
  buildSlackPayload,
} from './index';
import type { ActionInputs, SlackTemplateVars } from './types';
import * as fs from 'fs';
import * as os from 'os';

// Mock fs.existsSync for buildCommand tests
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn(),
  };
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */

// Mock @actions/core to prevent actual GitHub Actions calls
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  addPath: jest.fn(),
}));

describe('parseExFigOutput', () => {
  it('should parse assets exported count', () => {
    const output = `
✓ colors.yaml - 12 colors
✓ icons.yaml - 45 icons
✓ images.yaml - 8 images
`;
    const result = parseExFigOutput(output);
    expect(result.assetsExported).toBe(65);
    expect(result.exportedConfigs).toBe(3);
  });

  it('should parse validated (cached) configs', () => {
    const output = `
✓ colors.yaml - validated
✓ icons.yaml - validated
✓ images.yaml - 10 images
`;
    const result = parseExFigOutput(output);
    expect(result.validatedCount).toBe(2);
    expect(result.assetsExported).toBe(10);
    expect(result.exportedConfigs).toBe(1);
  });

  it('should parse failure count from batch output', () => {
    const output = `
✓ colors.yaml - 12 colors
✗ icons.yaml: Rate limit exceeded
Batch complete: 1 succeeded, 1 failed
`;
    const result = parseExFigOutput(output);
    expect(result.failedCount).toBe(1);
    expect(result.assetsExported).toBe(12);
  });

  it('should parse error message', () => {
    const output = `
✗ icons.yaml: Rate limit exceeded - please wait and retry
`;
    const result = parseExFigOutput(output);
    expect(result.errorMessage).toBe('icons.yaml: Rate limit exceeded - please wait and retry');
    expect(result.errorCategory).toBe('RATE_LIMIT');
  });

  it('should truncate long error messages to 100 chars', () => {
    const longError = 'A'.repeat(150);
    const output = `✗ ${longError}`;
    const result = parseExFigOutput(output);
    expect(result.errorMessage.length).toBe(103); // 100 + '...'
    expect(result.errorMessage.endsWith('...')).toBe(true);
  });

  it('should handle empty output', () => {
    const result = parseExFigOutput('');
    expect(result.assetsExported).toBe(0);
    expect(result.validatedCount).toBe(0);
    expect(result.exportedConfigs).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.errorMessage).toBe('');
    expect(result.errorCategory).toBe('');
  });
});

describe('categorizeError', () => {
  it('should categorize rate limit errors', () => {
    expect(categorizeError('Rate limit exceeded')).toBe('RATE_LIMIT');
    expect(categorizeError('rate limit reached')).toBe('RATE_LIMIT');
  });

  it('should categorize timeout errors', () => {
    expect(categorizeError('Request timeout')).toBe('TIMEOUT');
    expect(categorizeError('Connection timeout')).toBe('TIMEOUT');
  });

  it('should categorize auth errors', () => {
    expect(categorizeError('Authentication failed')).toBe('AUTH');
    expect(categorizeError('Invalid token')).toBe('AUTH');
  });

  it('should categorize forbidden errors', () => {
    expect(categorizeError('Access denied')).toBe('FORBIDDEN');
    expect(categorizeError('Forbidden')).toBe('FORBIDDEN');
  });

  it('should categorize not found errors', () => {
    expect(categorizeError('Resource not found')).toBe('NOT_FOUND');
    expect(categorizeError('404 error')).toBe('NOT_FOUND');
  });

  it('should categorize network errors', () => {
    expect(categorizeError('Connection refused')).toBe('NETWORK');
    expect(categorizeError('DNS lookup failed')).toBe('NETWORK');
    expect(categorizeError('Internet unavailable')).toBe('NETWORK');
    expect(categorizeError('Network error')).toBe('NETWORK');
  });

  it('should categorize server errors', () => {
    expect(categorizeError('Server error')).toBe('SERVER');
    expect(categorizeError('500 internal error')).toBe('SERVER');
    expect(categorizeError('502 bad gateway')).toBe('SERVER');
  });

  it('should categorize config errors', () => {
    expect(categorizeError('Invalid config')).toBe('CONFIG');
    expect(categorizeError('Config file error')).toBe('CONFIG');
  });

  it('should fallback to ERROR for unknown errors', () => {
    expect(categorizeError('Something went wrong')).toBe('ERROR');
    expect(categorizeError('Unknown issue')).toBe('ERROR');
  });
});

describe('formatSlackMention', () => {
  it('should return empty string for empty input', () => {
    expect(formatSlackMention('')).toBe('');
  });

  it('should format user ID', () => {
    expect(formatSlackMention('U123ABC')).toBe('<@U123ABC>');
  });

  it('should format group/subteam ID', () => {
    expect(formatSlackMention('S123ABC')).toBe('<!subteam^S123ABC>');
  });

  it('should pass through already formatted mentions', () => {
    expect(formatSlackMention('<@U123>')).toBe('<@U123>');
    expect(formatSlackMention('<!subteam^S123>')).toBe('<!subteam^S123>');
  });

  it('should pass through @channel and @here', () => {
    expect(formatSlackMention('@channel')).toBe('@channel');
    expect(formatSlackMention('@here')).toBe('@here');
  });

  it('should pass through unrecognized formats', () => {
    expect(formatSlackMention('some-user')).toBe('some-user');
    expect(formatSlackMention('@username')).toBe('@username');
  });
});

describe('buildCommand', () => {
  const mockExistsSync = fs.existsSync as jest.Mock;

  beforeEach(() => {
    mockExistsSync.mockReset();
  });

  const baseInputs: ActionInputs = {
    figmaToken: 'test-token',
    command: 'colors',
    config: 'exfig.yml',
    filter: '',
    version: 'latest',
    cache: false,
    cachePath: '.exfig-cache.json',
    cacheKeyPrefix: 'exfig-cache',
    granularCache: false,
    rateLimit: 10,
    maxRetries: 3,
    outputDir: '',
    verbose: false,
    extraArgs: '',
    slackWebhook: '',
    slackMention: '',
    slackTemplates: '',
  };

  it('should build basic command with config', () => {
    mockExistsSync.mockReturnValue(true);
    const { args } = buildCommand({ ...baseInputs });
    expect(args).toContain('colors');
    expect(args).toContain('-i');
    expect(args).toContain('exfig.yml');
    expect(args).toContain('--rate-limit');
    expect(args).toContain('10');
  });

  it('should add filter when provided', () => {
    mockExistsSync.mockReturnValue(true);
    const { args } = buildCommand({ ...baseInputs, filter: 'icon/*' });
    expect(args).toContain('icon/*');
  });

  it('should add cache flags when enabled', () => {
    mockExistsSync.mockReturnValue(true);
    const { args } = buildCommand({ ...baseInputs, cache: true });
    expect(args).toContain('--cache');
    expect(args).toContain('--cache-path');
    expect(args).toContain('.exfig-cache.json');
  });

  it('should add granular cache flag when enabled', () => {
    mockExistsSync.mockReturnValue(true);
    const { args } = buildCommand({ ...baseInputs, granularCache: true });
    expect(args).toContain('--experimental-granular-cache');
  });

  it('should add output directory when provided', () => {
    mockExistsSync.mockReturnValue(true);
    const { args } = buildCommand({ ...baseInputs, outputDir: './output' });
    expect(args).toContain('--output');
    expect(args).toContain('./output');
  });

  it('should add verbose flag when enabled', () => {
    mockExistsSync.mockReturnValue(true);
    const { args } = buildCommand({ ...baseInputs, verbose: true });
    expect(args).toContain('--verbose');
  });

  it('should add extra args when provided', () => {
    mockExistsSync.mockReturnValue(true);
    const { args } = buildCommand({ ...baseInputs, extraArgs: '--force --dry-run' });
    expect(args).toContain('--force');
    expect(args).toContain('--dry-run');
  });

  it('should handle batch command with multiple configs', () => {
    mockExistsSync.mockImplementation((path: string) => {
      return path === 'config1.yml' || path === 'config2.yml';
    });
    const { args, configPaths } = buildCommand({
      ...baseInputs,
      command: 'batch',
      config: 'config1.yml, config2.yml, missing.yml',
    });
    expect(args[0]).toBe('batch');
    expect(configPaths).toEqual(['config1.yml', 'config2.yml']);
    expect(args).toContain('config1.yml');
    expect(args).toContain('config2.yml');
    expect(args).not.toContain('missing.yml');
  });

  it('should throw error when no valid batch configs found', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() =>
      buildCommand({
        ...baseInputs,
        command: 'batch',
        config: 'missing1.yml, missing2.yml',
      })
    ).toThrow('No valid config files found for batch command');
  });
});

describe('isValidCommand', () => {
  it('should return true for valid commands', () => {
    expect(isValidCommand('colors')).toBe(true);
    expect(isValidCommand('icons')).toBe(true);
    expect(isValidCommand('images')).toBe(true);
    expect(isValidCommand('typography')).toBe(true);
    expect(isValidCommand('batch')).toBe(true);
    expect(isValidCommand('fetch')).toBe(true);
    expect(isValidCommand('download')).toBe(true);
  });

  it('should return false for invalid commands', () => {
    expect(isValidCommand('invalid')).toBe(false);
    expect(isValidCommand('')).toBe(false);
    expect(isValidCommand('COLORS')).toBe(false);
  });
});

describe('validatePlatform', () => {
  it('should return darwin for macOS', () => {
    expect(validatePlatform('macOS')).toBe('darwin');
  });

  it('should return linux for Linux', () => {
    expect(validatePlatform('Linux')).toBe('linux');
  });

  it('should throw error for unsupported platform', () => {
    expect(() => validatePlatform('Windows')).toThrow(
      'Unsupported platform: Windows. Only Linux and macOS are supported.'
    );
  });

  it('should throw error for empty string', () => {
    expect(() => validatePlatform('')).toThrow('Unsupported platform');
  });
});

describe('getBinaryInstallDir', () => {
  it('should return correct path with exfig subdirectory', () => {
    expect(getBinaryInstallDir('/tmp/runner')).toBe('/tmp/runner/exfig');
    expect(getBinaryInstallDir('/home/user/.cache')).toBe('/home/user/.cache/exfig');
  });
});

describe('getBinaryPath', () => {
  it('should return correct binary path with ExFig name', () => {
    expect(getBinaryPath('/tmp/runner/exfig')).toBe('/tmp/runner/exfig/ExFig');
    expect(getBinaryPath('/usr/local/bin')).toBe('/usr/local/bin/ExFig');
  });
});

describe('getGitHubContext', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return context from environment variables', () => {
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_RUN_ID = '12345';
    process.env.GITHUB_SERVER_URL = 'https://github.example.com';
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.RUNNER_TEMP = '/tmp/runner';
    process.env.RUNNER_OS = 'Linux';
    process.env.GITHUB_ACTION_PATH = '/path/to/action';

    const context = getGitHubContext();

    expect(context.repository).toBe('owner/repo');
    expect(context.runId).toBe('12345');
    expect(context.serverUrl).toBe('https://github.example.com');
    expect(context.token).toBe('test-token');
    expect(context.runnerTemp).toBe('/tmp/runner');
    expect(context.runnerOs).toBe('Linux');
    expect(context.actionPath).toBe('/path/to/action');
  });

  it('should use defaults for missing environment variables', () => {
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_RUN_ID;
    delete process.env.GITHUB_SERVER_URL;
    delete process.env.GITHUB_TOKEN;
    delete process.env.RUNNER_TEMP;
    delete process.env.RUNNER_OS;
    delete process.env.GITHUB_ACTION_PATH;

    const context = getGitHubContext();

    expect(context.repository).toBe('');
    expect(context.runId).toBe('');
    expect(context.serverUrl).toBe('https://github.com');
    expect(context.token).toBe('');
    expect(context.runnerTemp).toBe(os.tmpdir());
    expect(context.runnerOs).toBe('Linux');
    expect(context.actionPath).toBe('');
  });
});

describe('buildSlackPayload', () => {
  const baseVars: SlackTemplateVars = {
    color: '#36a64f',
    icon: '✅',
    title: 'Export completed',
    subtitle: '',
    command: 'colors',
    configs: '',
    configCount: 0,
    validatedCount: 0,
    assets: '42 exported',
    duration: '5s',
    repo: 'owner/repo',
    runUrl: 'https://github.com/owner/repo/actions/runs/123',
    version: 'v1.2.3',
    platform: 'macOS',
  };

  it('should build inline payload without template', () => {
    const payload = buildSlackPayload(baseVars);

    expect(payload).toHaveProperty('attachments');
    const attachments = payload.attachments as Array<{ color: string; blocks: unknown[] }>;
    expect(attachments).toHaveLength(1);
    expect(attachments[0].color).toBe('#36a64f');
    expect(attachments[0].blocks).toHaveLength(5); // header, section x2, context (version), actions
  });

  it('should include context block when subtitle is provided', () => {
    const varsWithSubtitle = { ...baseVars, subtitle: 'Some context info' };
    const payload = buildSlackPayload(varsWithSubtitle);

    const attachments = payload.attachments as Array<{ blocks: unknown[] }>;
    expect(attachments[0].blocks).toHaveLength(6); // header, section x2, context (version), context (subtitle), actions
  });

  it('should include configs in command section', () => {
    const varsWithConfigs = { ...baseVars, configs: '\n• config1.yml\n• config2.yml' };
    const payload = buildSlackPayload(varsWithConfigs);

    const attachments = payload.attachments as Array<{
      blocks: Array<{ fields?: Array<{ text: string }> }>;
    }>;
    const sectionBlock = attachments[0].blocks[1];
    expect(sectionBlock.fields?.[0].text).toContain('config1.yml');
  });

  it('should replace all template variables', () => {
    // Test all variable replacements in inline payload
    const fullVars: SlackTemplateVars = {
      color: '#dc3545',
      icon: '❌',
      title: 'Export failed',
      subtitle: 'Error: Rate limit exceeded',
      command: 'batch',
      configs: '\n• colors.yml\n• icons.yml',
      configCount: 2,
      validatedCount: 0,
      assets: '0 exported',
      duration: '120s',
      repo: 'test/project',
      runUrl: 'https://github.com/test/project/actions/runs/999',
      version: 'v2.0.0',
      platform: 'Linux',
    };

    const payload = buildSlackPayload(fullVars);

    const attachments = payload.attachments as Array<{ color: string; blocks: unknown[] }>;
    expect(attachments[0].color).toBe('#dc3545');

    // Check header contains icon and title
    const header = attachments[0].blocks[0] as { text: { text: string } };
    expect(header.text.text).toContain('❌');
    expect(header.text.text).toContain('Export failed');
  });
});
