import { AIError, createAIProvider } from '@ai-content/ai';
import { describe, expect, it } from 'vitest';

/**
 * A malformed AI_ROUTER_* value is a configuration fault in the same class as
 * a missing one. Left unmapped, EnvValidationError escaped as an unexpected
 * error and surfaced as a 500 — defeating the honest not-configured state the
 * caption feature depends on. Reproduced before the fix by passing a base URL
 * that is not a URL.
 */
const MALFORMED = [
  { AI_ROUTER_BASE_URL: 'not a url', AI_ROUTER_API_KEY: 'k' },
  { AI_ROUTER_BASE_URL: 'http://', AI_ROUTER_API_KEY: 'k' },
  { AI_ROUTER_BASE_URL: '   ', AI_ROUTER_API_KEY: 'k' },
];

describe('malformed AI Router configuration', () => {
  it.each(MALFORMED)('maps %j to not_configured, not an unexpected error', (source) => {
    let caught: unknown;

    try {
      createAIProvider(source);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AIError);
    expect((caught as AIError).code).toBe('not_configured');
  });

  it('does not echo the deployment configuration back to the caller', () => {
    let caught: AIError | undefined;

    try {
      createAIProvider({
        AI_ROUTER_BASE_URL: 'not a url',
        AI_ROUTER_API_KEY: 'super-secret-key-value',
      });
    } catch (error) {
      caught = error as AIError;
    }

    expect(caught?.message).not.toContain('super-secret-key-value');
    expect(caught?.message).not.toContain('not a url');
  });

  it('keeps the credential out of a serialised error even via cause', () => {
    let caught: AIError | undefined;

    try {
      createAIProvider({
        AI_ROUTER_BASE_URL: 'not a url',
        AI_ROUTER_API_KEY: 'super-secret-key-value',
      });
    } catch (error) {
      caught = error as AIError;
    }

    // cause carries the validation issues for logs; it must not carry the value.
    const serialised = JSON.stringify({
      message: caught?.message,
      cause: caught?.cause instanceof Error ? caught.cause.message : String(caught?.cause),
    });

    expect(serialised).not.toContain('super-secret-key-value');
  });

  it('still reports a genuinely missing variable distinctly from a malformed one', () => {
    let missing: AIError | undefined;

    try {
      createAIProvider({});
    } catch (error) {
      missing = error as AIError;
    }

    expect(missing?.code).toBe('not_configured');
    expect(missing?.message).toMatch(/missing/i);
  });
});
