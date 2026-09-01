import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { signOut } from '@/app/(auth)/actions';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'AI Content',
};

/**
 * Minimal protected page.
 *
 * Exists only to prove that authentication, route protection, and server-side
 * user retrieval work. The dashboard is a later phase.
 */
export default async function AppPage() {
  // The layout redirects too, but a layout and its page render concurrently, so
  // the page body can be produced before the layout's redirect resolves.
  // Re-checking here means the markup is never built without a verified user.
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">AI Content</h1>
        <p className="text-lg text-slate-400">Authenticated successfully</p>
      </div>

      <dl className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/50 p-5 text-sm">
        <dt className="text-slate-400">Signed in as</dt>
        <dd className="font-medium">{user.email}</dd>
      </dl>

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-900"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
