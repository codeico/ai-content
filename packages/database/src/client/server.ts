/**
 * Server Supabase client.
 *
 * Runs with the anon key and the caller's session, so Row Level Security still
 * applies. This is the client that request handlers and server components should
 * use; it is not a privileged client.
 *
 * Cookie handling is injected rather than imported from `next/headers` so that
 * this package stays framework-agnostic and unit-testable.
 */
import { loadRuntimeEnv } from '@ai-content/shared/env';
import { createServerClient } from '@supabase/ssr';

/** A single cookie as read from, or written to, the request/response pair. */
export interface CookieRecord {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

/**
 * The cookie access the Supabase SSR client needs.
 *
 * `setAll` may be a no-op in contexts where the response is already sent —
 * for example React Server Components — which is why it is allowed to do nothing.
 */
export interface CookieAdapter {
  getAll(): CookieRecord[];
  setAll(cookies: CookieRecord[]): void;
}

/**
 * Creates a Supabase client bound to the current request's session.
 *
 * @throws {EnvValidationError} when the public Supabase variables are missing.
 */
export function createSupabaseServerClient(cookies: CookieAdapter) {
  const env = loadRuntimeEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookies.setAll(cookiesToSet);
      },
    },
  });
}
