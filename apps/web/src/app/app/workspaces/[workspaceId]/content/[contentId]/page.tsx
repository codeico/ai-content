import { contentIdSchema } from '@ai-content/shared/content';
import { workspaceIdSchema } from '@ai-content/shared/workspace';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { deleteContent, updateContent } from '@/app/app/workspaces/[workspaceId]/content-actions';
import { DeleteContentButton } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/delete-content-button';
import { EditContentForm } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/edit-content-form';
import { getContentInWorkspace } from '@/server/repositories/content-repository';
import { getWorkspaceForUser } from '@/server/repositories/workspace-repository';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

interface ContentPageProps {
  params: Promise<{ workspaceId: string; contentId: string }>;
}

/**
 * Content detail. Authorization order mirrors the workspace page: validate
 * both route ids, verify session, verify workspace membership, then fetch the
 * content scoped to that workspace. Any miss is a 404 so a tampered
 * workspaceId/contentId never confirms whether the other id exists.
 */
export default async function ContentPage({ params }: ContentPageProps) {
  const { workspaceId, contentId } = await params;

  const workspaceIdResult = workspaceIdSchema.safeParse(workspaceId);
  const contentIdResult = contentIdSchema.safeParse(contentId);

  if (!workspaceIdResult.success || !contentIdResult.success) {
    notFound();
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createServerClient();
  const workspace = await getWorkspaceForUser(supabase, workspaceIdResult.data, user.id);

  if (!workspace) {
    notFound();
  }

  const content = await getContentInWorkspace(supabase, workspace.id, contentIdResult.data);

  if (!content) {
    notFound();
  }

  const boundUpdateContent = updateContent.bind(null, workspace.id, content.id);
  const boundDeleteContent = deleteContent.bind(null, workspace.id, content.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <Link
        href={`/app/workspaces/${workspace.id}`}
        className="text-sm text-slate-400 underline underline-offset-4 hover:text-slate-200"
      >
        ← {workspace.name}
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{content.title}</h1>
        <p className="text-sm text-slate-400 capitalize">Status: {content.status}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-5 text-sm">
        <dt className="text-slate-400">Created</dt>
        <dd>{new Date(content.created_at).toLocaleString()}</dd>
        <dt className="text-slate-400">Updated</dt>
        <dd>{new Date(content.updated_at).toLocaleString()}</dd>
        <dt className="text-slate-400">Content ID</dt>
        <dd className="font-mono text-xs">{content.id}</dd>
      </dl>

      <div className="flex flex-col gap-6 rounded-lg border border-slate-800 p-5">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-slate-300">Edit content</h2>
          <EditContentForm
            action={boundUpdateContent}
            currentTitle={content.title}
            currentStatus={content.status}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-800 pt-6">
          <h2 className="text-sm font-medium text-slate-300">Danger zone</h2>
          <DeleteContentButton action={boundDeleteContent} title={content.title} />
        </div>
      </div>
    </main>
  );
}
