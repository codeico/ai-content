import { createSupabaseServerClient } from '@ai-content/database/client';
import { isRuntimeEnvConfigured } from '@ai-content/shared/env';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase access.
 *
 * The `next/headers` import is itself the server-only boundary: Next.js fails
 * the build if a Client Component imports a module that reaches it, so this
 * session bridge cannot end up in a browser bundle.
 *
 * This bridges Next's `cookies()` into the framework-agnostic CookieAdapter that
 * packages/database already defines, rather than changing that package's shape.
 */

/**
 * Creates a request-scoped Supabase client.
 *
 * Writes are attempted but tolerated to fail: `cookies().set` throws inside a
 * Server Component, where the response headers are already committed. Session
 * refresh is handled by proxy.ts, so a dropped write there is not a lost session.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Server Component render: not writable, and not required here.
      }
    },
  });
}

/**
 * Returns the authenticated user, or null.
 *
 * Uses `getUser()`, which revalidates the token with the Supabase Auth server.
 * `getSession()` is deliberately not used for authorization: it reads the cookie
 * without verifying it, so a forged cookie would satisfy it.
 *
 * Returns null rather than throwing when Supabase is not configured. That keeps
 * the Phase 0 property that the app runs without credentials, and it fails
 * closed: no configuration means no authenticated user, so protected routes
 * redirect to login instead of rendering.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  if (!isRuntimeEnvConfigured()) {
    return null;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}
