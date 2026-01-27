import { parseExFigOutput, categorizeError, formatSlackMention, buildCommand } from './index';
import type { ActionInputs } from './types';
import * as fs from 'fs';

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
