import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppNav } from '@/components/app-nav';

import { getAuthenticatedUser } from '@/lib/supabase/server';

/**
 * Layout for the protected application area.
 *
 * This is the real access control. proxy.ts keeps the session cookie fresh but
 * is not the security boundary — it can be served from a CDN and does not render
 * the page. Every route under /app is gated here, on the server, so adding a
 * page cannot accidentally ship it unprotected.
 *
 * Also the app shell: a slim top bar (wordmark + desktop nav) and, on phones,
 * a fixed bottom tab bar. Main content reserves space for the tab bar so it is
 * never covered.
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

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-20 focus:rounded-control focus:bg-ink focus:px-3 focus:py-2 focus:text-surface"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/app"
            className="inline-flex min-h-11 items-center font-semibold tracking-[-0.01em]"
          >
            AI Content
          </Link>
          <div className="hidden md:block">
            <AppNav placement="top" />
          </div>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 sm:px-6 sm:pt-8 md:pb-12"
      >
        {children}
      </main>

      <AppNav placement="bottom" />
    </div>
  );
}
