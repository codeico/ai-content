import { createSupabaseServerClient } from '@ai-content/database/client';
import { isRuntimeEnvConfigured } from '@ai-content/shared/env';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Session refresh.
 *
 * Supabase access tokens expire. Server Components cannot write cookies, so
 * without a refresh here a user's session would lapse mid-visit. Running
 * `getUser()` on each matched request refreshes the token when needed and
 * writes the rotated cookies onto the response.
 *
 * This is NOT the access-control boundary. Next.js documents proxy as
 * CDN-deployable and separate from render, so authorization lives in the
 * server-rendered layout at app/app/layout.tsx. This only keeps cookies fresh.
 *
 * Named `proxy` because `middleware` is deprecated in Next.js 16.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Proxy runs on every matched route, including the public landing page. With
  // no Supabase project configured there is no session to refresh, and throwing
  // here would take down public pages that Phase 0 serves fine. Skipping keeps
  // the app usable before configuration; protected routes still deny access,
  // because the layout's getUser() cannot succeed without configuration either.
  if (!isRuntimeEnvConfigured()) {
    return response;
  }

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet) => {
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
    },
  });

  // Must be getUser(), not getSession(): only getUser() contacts the auth server
  // and triggers the refresh. The result is intentionally unused here.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Static assets are excluded: without a matcher this would run on every
  // request, including CSS and images, adding an auth round-trip to each.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
