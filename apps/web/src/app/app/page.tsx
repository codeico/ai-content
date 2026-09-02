import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CreateWorkspaceForm } from '@/app/app/create-workspace-form';
import { signOut } from '@/app/(auth)/actions';
import { listWorkspacesForUser } from '@/server/repositories/workspace-repository';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

/**
 * Workspace list.
 *
 * The layout already redirects unauthenticated users; this page re-checks
 * for the same reason app/app/page.tsx originally did (Phase 1) — a layout
 * and its page render concurrently, so re-verifying here means the list
 * query never runs without a confirmed user.
 */
export default async function AppPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createServerClient();
  const items = await listWorkspacesForUser(supabase, user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Workspaces</h1>
          <p className="text-sm text-slate-400">Signed in as {user.email}</p>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-900"
          >
            Sign out
          </button>
        </form>
      </div>

      <CreateWorkspaceForm />

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">
          No workspaces yet. Create one above to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map(({ workspace, role }) => (
            <li key={workspace.id}>
              <Link
                href={`/app/workspaces/${workspace.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4 hover:border-slate-700"
              >
                <span className="font-medium">{workspace.name}</span>
                <span className="text-sm text-slate-400 capitalize">{role}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
