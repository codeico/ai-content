import { parseContentCursor } from '@ai-content/shared/content';
import { workspaceIdSchema } from '@ai-content/shared/workspace';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { deleteWorkspace, updateWorkspace } from '@/app/app/workspace-actions';
import { createContent } from '@/app/app/workspaces/[workspaceId]/content-actions';
import { CreateContentForm } from '@/app/app/workspaces/[workspaceId]/create-content-form';
import { DeleteWorkspaceButton } from '@/app/app/workspaces/[workspaceId]/delete-workspace-button';
import { RenameWorkspaceForm } from '@/app/app/workspaces/[workspaceId]/rename-workspace-form';
import {
  ButtonLink,
  Chevron,
  EmptyState,
  PageHeader,
  SOURCE_TYPE_LABEL,
  STATUS_LABEL,
  StatusMark,
} from '@/components/ui';
import { AppBar } from '@/components/app-bar';
import {
  countContentByStatus,
  listContentForWorkspace,
} from '@/server/repositories/content-repository';
import { getProfileForWorkspace } from '@/server/repositories/workspace-profile-repository';
import { getWorkspaceForUser } from '@/server/repositories/workspace-repository';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = { title: 'Workspace' };

/**
 * Workspace overview: the content list is the page. Status counts come from the
 * database so they describe the whole workspace, not the page in hand. Owner
 * settings sit at the bottom, out of the way of the daily task.
 */
export default async function WorkspacePage({ params, searchParams }: WorkspacePageProps) {
  const { workspaceId } = await params;
  const search = await searchParams;

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

  // The cursor is a position in the list, not an offset. It is read from the
  // query string so "load more" is a plain link that works without JS and can
  // be shared or reloaded.
  // Validated, not trusted: the cursor becomes part of a PostgREST filter
  // expression. A malformed one (stale bookmark, typo, injection attempt) is
  // rejected here and falls back to the newest page — the list the user wants
  // — rather than failing the whole request.
  const cursor = parseContentCursor(search.after, search.afterId);

  // All four reads are independently scoped by RLS: every table's SELECT
  // policy gates on workspace_ids_for_current_user(), so a non-member gets
  // zero rows from each one whatever the order. Waiting for the membership
  // check before starting the other three bought nothing the policies do not
  // already guarantee, and cost a full round trip (~120ms against the remote
  // database) to do it.
  //
  // Counts come from the database, not from tallying the page: once the list
  // is paginated, counting rows in hand would report "3 drafts" for a
  // workspace holding 300.
  const [workspace, page, profile, counts] = await Promise.all([
    getWorkspaceForUser(supabase, idResult.data, user.id),
    listContentForWorkspace(supabase, idResult.data, { cursor }),
    getProfileForWorkspace(supabase, idResult.data),
    countContentByStatus(supabase, idResult.data),
  ]);

  // null for both "missing" and "not a member": a 404 never confirms existence.
  // Still decided before anything renders; the other three results are simply
  // discarded when the workspace is not visible.
  if (!workspace) {
    notFound();
  }

  const content = page.items;

  const canManage = workspace.role === 'owner';
  const roleLabel = canManage ? 'Owner' : 'Member';
  const profileHref = `/app/workspaces/${workspace.id}/profile`;
  const boundUpdateWorkspace = updateWorkspace.bind(null, workspace.id);
  const boundDeleteWorkspace = deleteWorkspace.bind(null, workspace.id);
  const boundCreateContent = createContent.bind(null, workspace.id);

  return (
    <div className="screen-in">
      <AppBar title={workspace.name} backHref="/app" backLabel="Back to Workspaces" />

      <PageHeader
        hideTitle
        title={workspace.name}
        meta={
          <>
            {profile?.niche ? (
              <span className="block break-words">
                {roleLabel} · {profile.niche}
              </span>
            ) : null}
            {counts.total === 0 ? (
              'No content yet'
            ) : (
              <span className="tabular">
                {counts.total} item{counts.total === 1 ? '' : 's'}
                {(['draft', 'ready', 'archived'] as const)
                  .filter((s) => counts[s] > 0)
                  .map((s) => (
                    <span key={s}>
                      <span aria-hidden> / </span>
                      {counts[s]} {STATUS_LABEL[s].toLowerCase()}
                    </span>
                  ))}
              </span>
            )}
          </>
        }
      />

      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px] md:gap-12">
        <section aria-labelledby="content-heading">
          <h2 id="content-heading" className="sr-only">
            Content
          </h2>

          {counts.total === 0 ? (
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
                    className="cell -mx-2 flex items-center justify-between gap-3 rounded-control px-2 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-medium">{item.title}</span>
                      {item.source_type !== 'other' ? (
                        <span className="block text-[13px] text-ink-faint">
                          {SOURCE_TYPE_LABEL[item.source_type]}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <StatusMark status={item.status} />
                      <Chevron />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {page.nextCursor ? (
            <p className="mt-6">
              {/* A plain link, not a button: it works without JS, survives a
                  reload, and can be shared. */}
              <ButtonLink
                variant="secondary"
                href={`/app/workspaces/${workspace.id}?after=${encodeURIComponent(
                  page.nextCursor.created_at,
                )}&afterId=${encodeURIComponent(page.nextCursor.id)}`}
                className="w-full sm:w-auto"
              >
                Show older
              </ButtonLink>
            </p>
          ) : null}

          {cursor ? (
            <p className="mt-4 text-[14px]">
              <Link
                href={`/app/workspaces/${workspace.id}`}
                className="underline-offset-2 hover:underline"
              >
                Back to newest
              </Link>
            </p>
          ) : null}
        </section>

        <aside className="flex flex-col gap-10">
          <CreateContentForm action={boundCreateContent} />

          {canManage ? (
            <section aria-labelledby="settings-heading" className="flex flex-col gap-5">
              <h2 id="settings-heading" className="border-t border-line pt-5 font-medium">
                Workspace settings
              </h2>
              <div className="flex flex-col gap-1.5">
                <ButtonLink href={profileHref} variant="secondary" className="w-full">
                  Edit profile
                </ButtonLink>
                <p className="text-[13px] text-ink-faint">
                  What this workspace is about and how it should sound.
                </p>
              </div>
              <RenameWorkspaceForm action={boundUpdateWorkspace} currentName={workspace.name} />
              <DeleteWorkspaceButton
                action={boundDeleteWorkspace}
                workspaceName={workspace.name}
                contentCount={counts.total}
                hasProfile={profile !== null}
              />
            </section>
          ) : (
            <div className="border-t border-line pt-5 text-[14px] text-ink-soft">
              <p>You are a member. Only the owner can rename or delete this workspace.</p>
              <Link
                href={profileHref}
                className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-ink"
              >
                View profile
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
