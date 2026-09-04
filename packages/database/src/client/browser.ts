/**
 * Browser Supabase client.
 *
 * Only ever receives the anon key. The anon key is safe to ship to the browser
 * because access is constrained by Row Level Security, which later phases define.
 */
import { loadBrowserRuntimeEnv } from '@ai-content/shared/env/browser';
import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '../types/database.ts';

/**
 * Creates a Supabase client for use in browser/client components.
 *
 * @throws {EnvValidationError} when the public Supabase variables are missing.
 */
export function createSupabaseBrowserClient() {
  const env = loadBrowserRuntimeEnv();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
