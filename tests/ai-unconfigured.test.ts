import { describe, expect, it } from 'vitest';

import { createAIProvider } from '../packages/ai/src/create-provider.ts';
import { AIError } from '../packages/ai/src/provider.ts';

/**
 * The router is optional configuration: the product must run with no AI
 * credentials at all (that is the current state of every developer machine and
 * of CI). These pin the failure mode as a typed, non-fatal AIError raised at
 * the point of use, never a crash at import time and never a leaked key.
 */
describe('createAIProvider when the router is unconfigured', () => {
  it('reports not_configured instead of throwing a generic error', () => {
    let caught: unknown;

    try {
      createAIProvider({});
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AIError);
    expect((caught as AIError).code).toBe('not_configured');
  });

  it('names every missing variable so the operator can fix it in one pass', () => {
    try {
      createAIProvider({});
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as AIError).message).toContain('AI_ROUTER_BASE_URL');
      expect((error as AIError).message).toContain('AI_ROUTER_API_KEY');
    }
  });

  it('still refuses when only the base URL is set', () => {
    try {
      createAIProvider({ AI_ROUTER_BASE_URL: 'https://router.example/v1' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as AIError).code).toBe('not_configured');
      expect((error as AIError).message).toContain('AI_ROUTER_API_KEY');
      expect((error as AIError).message).not.toContain('AI_ROUTER_BASE_URL');
    }
  });

  it('rejects a malformed base URL at configuration time, not on first request', () => {
    expect(() =>
      createAIProvider({ AI_ROUTER_BASE_URL: 'not-a-url', AI_ROUTER_API_KEY: 'k' }),
    ).toThrow();
  });

  it('constructs when both are present and never exposes the key on the instance', () => {
    const provider = createAIProvider({
      AI_ROUTER_BASE_URL: 'https://router.example/v1',
      AI_ROUTER_API_KEY: 'super-secret-key',
    });

    const surface = [
      JSON.stringify(provider) ?? '',
      String(provider),
      Object.keys(provider).join(','),
      Object.values(provider).join(','),
    ].join(' ');

    expect(surface).not.toContain('super-secret-key');
  });
});
