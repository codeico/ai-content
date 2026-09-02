import { workspaceIdSchema } from '@ai-content/shared/workspace';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { deleteWorkspace, updateWorkspace } from '@/app/app/workspace-actions';
import { DeleteWorkspaceButton } from '@/app/app/workspaces/[workspaceId]/delete-workspace-button';
import { RenameWorkspaceForm } from '@/app/app/workspaces/[workspaceId]/rename-workspace-form';
import { getWorkspaceForUser } from '@/server/repositories/workspace-repository';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Workspace detail.
 *
 * Not a dashboard — see docs/PHASE_2_PROMPT.md §18. It exists to prove
 * workspace context, authorization, and workspace-scoped routing work.
 */
export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceId } = await params;

  // A route param is untrusted input. A malformed id (not a UUID) cannot be a
  // real workspace, so reject it before it ever reaches a database query
  // rather than letting Postgres return a generic invalid-input-syntax error.
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

  // getWorkspaceForUser returns null both when the workspace does not exist
  // and when the caller is not a member — see the repository's doc comment
  // for why that ambiguity is intentional. Either way, the correct response
  // to a route param naming a workspace this user cannot see is a 404, not a
  // 403 that would confirm the workspace exists (docs/PHASE_2_PROMPT.md §17).
  if (!workspace) {
    notFound();
  }

  const canManage = workspace.role === 'owner';
  const boundUpdateWorkspace = updateWorkspace.bind(null, workspace.id);
  const boundDeleteWorkspace = deleteWorkspace.bind(null, workspace.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <Link
        href="/app"
        className="text-sm text-slate-400 underline underline-offset-4 hover:text-slate-200"
      >
        ← All workspaces
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{workspace.name}</h1>
        <p className="text-sm text-slate-400 capitalize">Your role: {workspace.role}</p>
      </div>

      <dl className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/50 p-5 text-sm">
        <dt className="text-slate-400">Workspace ID</dt>
        <dd className="font-mono text-xs">{workspace.id}</dd>
      </dl>

      {canManage ? (
        <div className="flex flex-col gap-6 rounded-lg border border-slate-800 p-5">
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-slate-300">Rename workspace</h2>
            <RenameWorkspaceForm action={boundUpdateWorkspace} currentName={workspace.name} />
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800 pt-6">
            <h2 className="text-sm font-medium text-slate-300">Danger zone</h2>
            <DeleteWorkspaceButton action={boundDeleteWorkspace} workspaceName={workspace.name} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Only the workspace owner can rename or delete this workspace.
        </p>
      )}
    </main>
  );
}
