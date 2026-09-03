import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CreateWorkspaceForm } from '@/app/app/create-workspace-form';
import { Chevron, EmptyState, PageHeader } from '@/components/ui';
import { Sheet } from '@/components/sheet';
import { listWorkspacesForUser } from '@/server/repositories/workspace-repository';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Workspaces' };

/**
 * Workspace list.
 *
 * The layout already redirects unauthenticated users; this page re-checks
 * because a layout and its page render concurrently, so re-verifying here
 * means the list query never runs without a confirmed user.
 */
export default async function AppPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createServerClient();
  const items = await listWorkspacesForUser(supabase, user.id);

  return (
    <div className="rise">
      <PageHeader
        title="Workspaces"
        meta="Each workspace is one niche or brand with its own content."
      />

      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px] md:gap-12">
        <section aria-labelledby="workspaces-heading" className="min-w-0">
          <h2 id="workspaces-heading" className="sr-only">
            Your workspaces
          </h2>

          {items.length === 0 ? (
            <EmptyState
              title="No workspaces yet"
              body="Create your first workspace to start collecting content for a niche."
            />
          ) : (
            <ul className="border-t border-line">
              {items.map(({ workspace, role }) => (
                <li key={workspace.id} className="border-b border-line">
                  <Link
                    href={`/app/workspaces/${workspace.id}`}
                    className="cell -mx-2 flex items-center justify-between gap-3 rounded-control px-2 py-3"
                  >
                    <span className="min-w-0 truncate text-[17px] font-medium">
                      {workspace.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-faint">
                      <span className="capitalize">{role}</span>
                      <Chevron />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="md:pt-0">
          <Sheet trigger="New workspace" title="New workspace">
            <CreateWorkspaceForm />
          </Sheet>
        </aside>
      </div>
    </div>
  );
}
