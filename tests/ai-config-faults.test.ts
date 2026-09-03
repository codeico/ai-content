import { describe, expect, it } from 'vitest';

import { AIError, createAIProvider } from '../packages/ai/src/index.ts';

/**
 * Every way the AI Router can be misconfigured must arrive as
 * AIError('not_configured'), because that is the state the content page
 * renders honestly. Anything unmapped escapes the Server Action's catch as a
 * 500, which tells the user the app is broken when the truth is that a
 * deployment variable is wrong.
 *
 * Nathan raised the unmapped EnvValidationError; Sophia re-ranked it upward
 * because the not-configured state is what the whole feature's honesty rests
 * on. Both the missing-variable and the malformed-value paths are covered
 * here, plus the scheme case that used to slip through: z.url() accepts
 * ftp:// and file://, so a wrong scheme passed configuration validation and
 * failed later as an opaque network error.
 */
const VALID = {
  AI_ROUTER_BASE_URL: 'https://router.example.test/v1',
  AI_ROUTER_API_KEY: 'test-key',
  AI_ROUTER_MODEL: 'test-model',
};

function attempt(env: Record<string, string | undefined>): unknown {
  try {
    createAIProvider(env as never);
    return null;
  } catch (error) {
    return error;
  }
}

describe('a malformed value is a configuration fault, not a crash', () => {
  it.each([
    ['a base URL that is not a URL', 'not-a-url'],
    ['an empty base URL', ''],
    ['whitespace only', '   '],
    ['a scheme that is not http(s)', 'ftp://router.example.test/v1'],
    ['a file URL', 'file:///etc/passwd'],
  ])('%s', (_label, baseUrl) => {
    const error = attempt({ ...VALID, AI_ROUTER_BASE_URL: baseUrl });

    expect(error).toBeInstanceOf(AIError);
    expect((error as AIError).code).toBe('not_configured');
  });

  it('accepts plain http, which a self-hosted router legitimately uses', () => {
    expect(attempt({ ...VALID, AI_ROUTER_BASE_URL: 'http://127.0.0.1:8787/v1' })).toBeNull();
  });

  it('accepts a normal https router', () => {
    expect(attempt(VALID)).toBeNull();
  });
});

describe('a missing variable reports which one', () => {
  it.each([
    ['AI_ROUTER_BASE_URL', { ...VALID, AI_ROUTER_BASE_URL: undefined }],
    ['AI_ROUTER_API_KEY', { ...VALID, AI_ROUTER_API_KEY: undefined }],
  ])('%s', (name, env) => {
    const error = attempt(env);

    expect(error).toBeInstanceOf(AIError);
    expect((error as AIError).code).toBe('not_configured');
    // Naming the variable is safe and is the only way an operator can fix it.
    expect((error as AIError).message).toContain(name);
  });
});

describe('configuration detail never reaches the user-facing message', () => {
  it('does not echo the malformed value back', () => {
    const secretish = 'https://internal-router.corp.example/v1/../../admin';
    const error = attempt({ ...VALID, AI_ROUTER_BASE_URL: `ftp://${secretish}` });

    expect((error as AIError).message).not.toContain('internal-router');
    expect((error as AIError).message).toBe('AI Router configuration is invalid.');
  });

  it('never puts the API key in the message', () => {
    const error = attempt({ ...VALID, AI_ROUTER_BASE_URL: 'nope', AI_ROUTER_API_KEY: 'sk-secret' });

    expect((error as AIError).message).not.toContain('sk-secret');
  });

  it('keeps the underlying issues on cause for logs', () => {
    // Diagnosable by an operator reading logs, invisible to the user.
    const error = attempt({ ...VALID, AI_ROUTER_BASE_URL: 'nope' }) as AIError;

    expect(error.cause).toBeDefined();
  });
});

describe('every configuration fault is the same code the page renders', () => {
  it('uses not_configured for missing and malformed alike', () => {
    // The page branches on this single code; a second code for malformed
    // values would need a second branch that does not exist.
    const missing = attempt({ ...VALID, AI_ROUTER_API_KEY: undefined }) as AIError;
    const malformed = attempt({ ...VALID, AI_ROUTER_BASE_URL: 'nope' }) as AIError;

    expect(missing.code).toBe(malformed.code);
  });
});
