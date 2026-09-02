/**
 * Administrative Supabase client.
 *
 * Uses the service role key, which bypasses Row Level Security entirely. It is
 * reserved for trusted server workflows: background jobs and internal service
 * operations. It must never be constructed in code that reaches the browser.
 */
import { loadRuntimeEnv, loadServerEnv } from '@ai-content/shared/env';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../types/database.ts';

/**
 * Raised when the admin client is constructed in a browser-like environment.
 *
 * This is defence in depth. The primary protection is that the service role key
 * has no `NEXT_PUBLIC_` prefix and so is never inlined into a client bundle;
 * this guard catches the case where such code is imported by mistake.
 */
export class AdminClientEnvironmentError extends Error {
  constructor() {
    super(
      'The Supabase admin client cannot be created in a browser environment. ' +
        'It uses the service role key and must stay server-only.',
    );

    this.name = 'AdminClientEnvironmentError';
  }
}

function assertServerEnvironment(): void {
  // Checked via `globalThis` rather than a bare `window` reference so this
  // server-side package does not need the DOM type library.
  const browserGlobals = globalThis as { window?: unknown };

  if (typeof browserGlobals.window !== 'undefined') {
    throw new AdminClientEnvironmentError();
  }
}

/**
 * Creates a service-role Supabase client for trusted server-side work.
 *
 * Session persistence and token refresh are disabled: this client represents a
 * service, not a signed-in user, and must not adopt anyone's session.
 *
 * @throws {AdminClientEnvironmentError} when called from the browser.
 * @throws {EnvValidationError} when the Supabase URL or service role key is missing.
 */
export function createSupabaseAdminClient() {
  assertServerEnvironment();

  const { NEXT_PUBLIC_SUPABASE_URL: url } = loadRuntimeEnv();
  const { SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } = loadServerEnv();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
