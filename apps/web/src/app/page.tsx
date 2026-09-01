import { isRuntimeEnvConfigured } from '@ai-content/shared/env';
import Link from 'next/link';

/**
 * Public landing page.
 *
 * Stays public and unauthenticated: it reports foundation state and links into
 * the auth flow. The dashboard is a later phase and is deliberately absent.
 *
 * The configuration line reports environment state instead of enforcing it, so
 * the page still renders on a machine with no Supabase project yet.
 */
export default function HomePage() {
  const supabaseConfigured = isRuntimeEnvConfigured();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">AI Content</h1>
        <p className="text-lg text-slate-400">Project Foundation Ready</p>
      </div>

      <dl className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-5 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-400">Phase</dt>
          <dd className="font-medium">1 — Authentication</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-400">Supabase environment</dt>
          <dd className="font-medium">{supabaseConfigured ? 'Configured' : 'Not configured'}</dd>
        </div>
      </dl>

      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-md border border-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-900"
        >
          Create account
        </Link>
      </div>

      <p className="text-sm text-slate-500">
        Workspaces, content, and AI features are introduced in later phases.
      </p>
    </main>
  );
}
