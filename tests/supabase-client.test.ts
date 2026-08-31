import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AdminClientEnvironmentError,
  createSupabaseAdminClient,
} from '../packages/database/src/client/index.ts';

const supabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function stubEnv(values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) {
    vi.stubEnv(key, value);
  }
}

describe('createSupabaseAdminClient', () => {
  it('refuses to construct when a browser global is present', () => {
    stubEnv(supabaseEnv);
    // Simulates the mistake this guard exists to catch: server-only code being
    // pulled into a client bundle, which would ship the service role key.
    vi.stubGlobal('window', {});

    expect(() => createSupabaseAdminClient()).toThrow(AdminClientEnvironmentError);
  });

  it('constructs a client in a server environment', () => {
    stubEnv(supabaseEnv);

    expect(() => createSupabaseAdminClient()).not.toThrow();
  });

  it('checks the environment before reading the service role key', () => {
    // Ordering matters: the guard must fire even when configuration is absent,
    // otherwise a browser bundle would surface a config error instead of the
    // real problem, which is that this code should not run there at all.
    vi.stubGlobal('window', {});

    expect(() => createSupabaseAdminClient()).toThrow(AdminClientEnvironmentError);
  });
});
