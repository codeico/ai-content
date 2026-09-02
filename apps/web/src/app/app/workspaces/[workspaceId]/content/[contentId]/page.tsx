import { contentIdSchema } from '@ai-content/shared/content';
import { workspaceIdSchema } from '@ai-content/shared/workspace';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { deleteContent, updateContent } from '@/app/app/workspaces/[workspaceId]/content-actions';
import { DeleteContentButton } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/delete-content-button';
import { EditContentForm } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/edit-content-form';
import { PageHeader, StatusMark } from '@/components/ui';
import { getContentInWorkspace } from '@/server/repositories/content-repository';
import { getWorkspaceForUser } from '@/server/repositories/workspace-repository';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

interface ContentPageProps {
  params: Promise<{ workspaceId: string; contentId: string }>;
}

export const metadata: Metadata = { title: 'Content' };

/**
 * Future pipeline stages. Listed so the shape of the product is visible, but
 * each is plainly marked unavailable. None of them is wired to anything.
 */
const UPCOMING_STAGES = ['Source', 'Creative', 'Caption', 'Publish'] as const;

const dateFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

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
    <div className="rise">
      <PageHeader
        eyebrow={
          <Link href={`/app/workspaces/${workspace.id}`} className="hover:text-ink">
            {workspace.name}
          </Link>
        }
        title={content.title}
        meta={<StatusMark status={content.status} />}
      />

      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px] md:gap-12">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="edit-heading" className="border-t border-line pt-5">
            <h2 id="edit-heading" className="mb-4 font-medium">
              Details
            </h2>
            <EditContentForm
              action={boundUpdateContent}
              currentTitle={content.title}
              currentStatus={content.status}
            />
          </section>

          <section aria-labelledby="stages-heading" className="border-t border-line pt-5">
            <h2 id="stages-heading" className="font-medium">
              Pipeline
            </h2>
            <p className="mt-1 text-[14px] text-ink-soft">
              These stages arrive in later releases. Nothing here is active yet.
            </p>
            <ol className="mt-4 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
              {UPCOMING_STAGES.map((stage) => (
                <li key={stage} className="border-t border-dashed border-line-strong py-3">
                  <span className="block text-[15px] text-ink-faint">{stage}</span>
                  <span className="block text-[12px] text-ink-faint">Not available yet</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-8">
          <dl className="border-t border-line pt-5 text-[14px]">
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="text-ink-faint">Created</dt>
              <dd className="tabular text-right">
                {dateFormat.format(new Date(content.created_at))}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="text-ink-faint">Updated</dt>
              <dd className="tabular text-right">
                {dateFormat.format(new Date(content.updated_at))}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="text-ink-faint">ID</dt>
              <dd className="font-mono text-[12px] break-all">{content.id}</dd>
            </div>
          </dl>

          <div className="border-t border-line pt-5">
            <DeleteContentButton action={boundDeleteContent} title={content.title} />
          </div>
        </aside>
      </div>
    </div>
  );
}
