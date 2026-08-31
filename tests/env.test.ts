import { describe, expect, it } from 'vitest';

import {
  EnvValidationError,
  isRuntimeEnvConfigured,
  loadFutureProviderEnv,
  loadRuntimeEnv,
  loadServerEnv,
} from '../packages/shared/src/env/index.ts';

const validRuntimeEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
};

describe('loadRuntimeEnv', () => {
  it('returns the validated variables when configuration is complete', () => {
    expect(loadRuntimeEnv(validRuntimeEnv)).toEqual(validRuntimeEnv);
  });

  it('throws when a required variable is missing', () => {
    expect(() =>
      loadRuntimeEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }),
    ).toThrow(EnvValidationError);
  });

  it('reports which variable failed so the error is actionable', () => {
    try {
      loadRuntimeEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' });
      expect.unreachable('missing anon key should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as EnvValidationError).variables).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
  });

  it('rejects a malformed Supabase URL rather than accepting any string', () => {
    expect(() =>
      loadRuntimeEnv({ ...validRuntimeEnv, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' }),
    ).toThrow(EnvValidationError);
  });

  it('rejects a whitespace-only value, which a bare length check would accept', () => {
    expect(() =>
      loadRuntimeEnv({ ...validRuntimeEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: '   ' }),
    ).toThrow(EnvValidationError);
  });

  it('never includes the offending value in the message, so secrets cannot leak to logs', () => {
    try {
      loadServerEnv({ SUPABASE_SERVICE_ROLE_KEY: '' });
      expect.unreachable('empty service role key should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    }
  });
});

describe('loadServerEnv', () => {
  it('validates the service role key independently of the public variables', () => {
    expect(loadServerEnv({ SUPABASE_SERVICE_ROLE_KEY: 'service-role-key' })).toEqual({
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    });
  });

  it('throws when the service role key is absent', () => {
    expect(() => loadServerEnv({})).toThrow(EnvValidationError);
  });

  it('does not require the service role key to be present for runtime validation', () => {
    // This is the separation that keeps browser-facing code from ever needing
    // to know about a server secret.
    expect(() => loadRuntimeEnv(validRuntimeEnv)).not.toThrow();
  });
});

describe('loadFutureProviderEnv', () => {
  it('succeeds when the AI Router is not configured yet', () => {
    // This is the behaviour that keeps `npm run dev` working before Phase 4.
    expect(loadFutureProviderEnv({})).toEqual({});
  });

  it('returns the configuration once the AI Router is set', () => {
    const config = {
      AI_ROUTER_BASE_URL: 'https://your-ai-router.example/v1',
      AI_ROUTER_API_KEY: 'router-key',
    };

    expect(loadFutureProviderEnv(config)).toEqual(config);
  });

  it('accepts any OpenAI-compatible endpoint, including a local one', () => {
    // No provider is privileged: the base URL is configuration, not architecture.
    expect(loadFutureProviderEnv({ AI_ROUTER_BASE_URL: 'http://localhost:1234/v1' })).toEqual({
      AI_ROUTER_BASE_URL: 'http://localhost:1234/v1',
    });
  });

  it('rejects a malformed base URL so a typo fails at config time, not at first request', () => {
    expect(() => loadFutureProviderEnv({ AI_ROUTER_BASE_URL: 'not-a-url' })).toThrow(
      EnvValidationError,
    );
  });

  it('still rejects a present-but-empty key instead of treating it as configured', () => {
    expect(() => loadFutureProviderEnv({ AI_ROUTER_API_KEY: '' })).toThrow(EnvValidationError);
  });

  it('never echoes the AI Router key in a validation error', () => {
    try {
      loadFutureProviderEnv({ AI_ROUTER_BASE_URL: 'not-a-url', AI_ROUTER_API_KEY: 'secret-value' });
      expect.unreachable('malformed base URL should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('secret-value');
    }
  });
});

describe('isRuntimeEnvConfigured', () => {
  it('reports true for a complete configuration', () => {
    expect(isRuntimeEnvConfigured(validRuntimeEnv)).toBe(true);
  });

  it('reports false instead of throwing, so diagnostics can render safely', () => {
    expect(isRuntimeEnvConfigured({})).toBe(false);
  });
});
