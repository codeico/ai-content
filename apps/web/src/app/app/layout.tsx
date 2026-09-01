import { redirect } from 'next/navigation';

import { getAuthenticatedUser } from '@/lib/supabase/server';

/**
 * Layout for the protected application area.
 *
 * This is the real access control. proxy.ts keeps the session cookie fresh but
 * is not the security boundary — it can be served from a CDN and does not render
 * the page. Every route under /app is gated here, on the server, so adding a
 * page cannot accidentally ship it unprotected.
 */

// Authorization depends on the request's cookies, so this subtree must never be
// prerendered or cached. Without this, a build performed while Supabase is
// unconfigured can statically emit these pages and serve them to everyone.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  return children;
}
