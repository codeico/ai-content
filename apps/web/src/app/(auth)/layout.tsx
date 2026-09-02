import Link from 'next/link';
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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 pt-6 sm:px-8">
        <Link href="/" className="font-semibold tracking-[-0.01em]">
          AI Content
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10 sm:px-0">
        {children}
      </main>
    </div>
  );
}
