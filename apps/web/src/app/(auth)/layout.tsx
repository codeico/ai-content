import { redirect } from 'next/navigation';

import { getAuthenticatedUser } from '@/lib/supabase/server';

/**
 * Layout for the public authentication pages.
 *
 * Redirecting here rather than in each page keeps the rule in one place: an
 * already-authenticated user has no reason to see login or signup.
 */

// The redirect decision reads the session cookie, so these pages must be
// rendered per request rather than prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect('/app');
  }

  return children;
}
