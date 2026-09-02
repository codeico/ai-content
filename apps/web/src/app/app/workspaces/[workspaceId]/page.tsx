import { workspaceIdSchema } from '@ai-content/shared/workspace';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { deleteWorkspace, updateWorkspace } from '@/app/app/workspace-actions';
import { createContent } from '@/app/app/workspaces/[workspaceId]/content-actions';
import { CreateContentForm } from '@/app/app/workspaces/[workspaceId]/create-content-form';
import { DeleteWorkspaceButton } from '@/app/app/workspaces/[workspaceId]/delete-workspace-button';
import { RenameWorkspaceForm } from '@/app/app/workspaces/[workspaceId]/rename-workspace-form';
import { EmptyState, PageHeader, STATUS_LABEL, StatusMark } from '@/components/ui';
import { listContentForWorkspace } from '@/server/repositories/content-repository';
import { getWorkspaceForUser } from '@/server/repositories/workspace-repository';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

export const metadata: Metadata = { title: 'Workspace' };

/**
 * Workspace overview: the content list is the page. Status counts are derived
 * from the same rows (real data, nothing fabricated). Owner settings sit at the
 * bottom, out of the way of the daily task.
 */
export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceId } = await params;

  // A route param is untrusted input. A malformed id (not a UUID) cannot be a
  // real workspace, so reject it before it ever reaches a database query.
  const idResult = workspaceIdSchema.safeParse(workspaceId);

  if (!idResult.success) {
    notFound();
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createServerClient();
  const workspace = await getWorkspaceForUser(supabase, idResult.data, user.id);

  // null for both "missing" and "not a member": a 404 never confirms existence.
  if (!workspace) {
    notFound();
  }

  const content = await listContentForWorkspace(supabase, workspace.id);
  const counts = { draft: 0, ready: 0, archived: 0 };
  for (const item of content) counts[item.status]++;

  const canManage = workspace.role === 'owner';
  const boundUpdateWorkspace = updateWorkspace.bind(null, workspace.id);
  const boundDeleteWorkspace = deleteWorkspace.bind(null, workspace.id);
  const boundCreateContent = createContent.bind(null, workspace.id);

  return (
    <div className="rise">
      <PageHeader
        eyebrow={
          <Link href="/app" className="hover:text-ink">
            Workspaces
          </Link>
        }
        title={workspace.name}
        meta={
          content.length === 0 ? (
            'No content yet'
          ) : (
            <span className="tabular">
              {content.length} item{content.length === 1 ? '' : 's'}
              {(['draft', 'ready', 'archived'] as const)
                .filter((s) => counts[s] > 0)
                .map((s) => (
                  <span key={s}>
                    <span aria-hidden> / </span>
                    {counts[s]} {STATUS_LABEL[s].toLowerCase()}
                  </span>
                ))}
            </span>
          )
        }
      />

      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px] md:gap-12">
        <section aria-labelledby="content-heading">
          <h2 id="content-heading" className="sr-only">
            Content
          </h2>

          {content.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              body="Add a title for the first piece of content. Everything starts as a draft."
            />
          ) : (
            <ul className="border-t border-line">
              {content.map((item) => (
                <li key={item.id} className="border-b border-line">
                  <Link
                    href={`/app/workspaces/${workspace.id}/content/${item.id}`}
                    className="press -mx-2 flex min-h-14 items-center justify-between gap-4 rounded-control px-2 py-3 hover:bg-line/40"
                  >
                    <span className="min-w-0 truncate text-[16px] font-medium">{item.title}</span>
                    <StatusMark status={item.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-10">
          <CreateContentForm action={boundCreateContent} />

          {canManage ? (
            <section aria-labelledby="settings-heading" className="flex flex-col gap-5">
              <h2 id="settings-heading" className="border-t border-line pt-5 font-medium">
                Workspace settings
              </h2>
              <RenameWorkspaceForm action={boundUpdateWorkspace} currentName={workspace.name} />
              <DeleteWorkspaceButton action={boundDeleteWorkspace} workspaceName={workspace.name} />
            </section>
          ) : (
            <p className="border-t border-line pt-5 text-[14px] text-ink-soft">
              You are a member. Only the owner can rename or delete this workspace.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
