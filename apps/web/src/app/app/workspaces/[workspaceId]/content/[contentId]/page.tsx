import { contentIdSchema } from '@ai-content/shared/content';
import { workspaceIdSchema } from '@ai-content/shared/workspace';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import {
  deleteContent,
  updateContent,
  updateContentSource,
} from '@/app/app/workspaces/[workspaceId]/content-actions';
import {
  editCaption,
  generateCaption,
  selectCaption,
} from '@/app/app/workspaces/[workspaceId]/content/[contentId]/caption-actions';
import { CaptionVersion } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/caption-version';
import { DeleteContentButton } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/delete-content-button';
import { EditContentForm } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/edit-content-form';
import { EditSourceForm } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/edit-source-form';
import { GenerateCaptionButton } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/generate-caption-button';
import { MediaStatusMark, PageHeader, SOURCE_TYPE_LABEL, StatusMark } from '@/components/ui';
import { describeProfile } from '@/server/ai/caption-prompt';
import {
  HUMAN_EDIT_MODEL_NAME,
  listCaptionsForContent,
} from '@/server/repositories/caption-repository';
import { getContentInWorkspace } from '@/server/repositories/content-repository';
import { getProfileForWorkspace } from '@/server/repositories/workspace-profile-repository';
import { getWorkspaceForUser } from '@/server/repositories/workspace-repository';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

interface ContentPageProps {
  params: Promise<{ workspaceId: string; contentId: string }>;
}

export const metadata: Metadata = { title: 'Content' };

/**
 * Later pipeline stages. Listed so the shape of the product is visible, but
 * each is plainly marked unavailable. None of them is wired to anything.
 * Source left this list in Phase 6, Caption in Phase 7B, when they became
 * real sections.
 */
const UPCOMING_STAGES = ['Creative', 'Publish'] as const;

const dateFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * Short display form of a source link. The DB check only guarantees an
 * https:// prefix, so a value written outside the app can still fail the URL
 * parser; fall back to the raw string rather than 500 the page.
 */
function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
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

  // All four reads are independently scoped: every table's SELECT policy gates
  // on workspace_ids_for_current_user(), so a non-member gets zero rows from
  // each one regardless of order. The sequential chain was costing a full
  // network round-trip per step (~120ms each, measured against the remote
  // database) to enforce nothing the policies do not already enforce.
  //
  // Authorisation is still decided before anything renders — the checks below
  // run on the resolved values, and captions/profile are discarded unread if
  // the workspace or content turns out not to be visible.
  const [workspace, contentRow, captionRows, profileRow] = await Promise.all([
    getWorkspaceForUser(supabase, workspaceIdResult.data, user.id),
    getContentInWorkspace(supabase, workspaceIdResult.data, contentIdResult.data),
    listCaptionsForContent(supabase, workspaceIdResult.data, contentIdResult.data),
    getProfileForWorkspace(supabase, workspaceIdResult.data),
  ]);

  if (!workspace) {
    notFound();
  }

  const content = contentRow;

  if (!content) {
    notFound();
  }

  const captions = captionRows;
  const profile = profileRow;

  // Same rule the prompt uses, so the hint and the model agree on "empty".
  const profileIsEmpty = describeProfile(profile) === null;

  const boundUpdateContent = updateContent.bind(null, workspace.id, content.id);
  const boundGenerateCaption = generateCaption.bind(null, workspace.id, content.id);
  const boundUpdateContentSource = updateContentSource.bind(null, workspace.id, content.id);
  const boundDeleteContent = deleteContent.bind(null, workspace.id, content.id);

  // Everything the owner can see about provenance in one glance. A row with
  // no value still renders, as "Not set", so the shape is stable and honest.
  const hasSource = content.source_type !== 'other' || content.source_url !== null;
  const sourceHost = content.source_url ? hostOf(content.source_url) : null;

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

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-10">
          <section aria-labelledby="edit-heading" className="border-t border-line pt-5">
            <h2 id="edit-heading" className="mb-4 font-medium">
              Details
            </h2>
            <EditContentForm
              action={boundUpdateContent}
              currentTitle={content.title}
              currentStatus={content.status}
              currentDescription={content.description}
            />
          </section>

          <section aria-labelledby="source-heading" className="border-t border-line pt-5">
            <h2 id="source-heading" className="mb-1 font-medium">
              Source
            </h2>
            <p className="mb-4 text-[14px] text-ink-soft">
              {hasSource
                ? 'Where this content comes from. Nothing is downloaded or fetched.'
                : 'No source yet. Say where this content comes from; a link is optional.'}
            </p>
            <EditSourceForm
              action={boundUpdateContentSource}
              current={{
                source_type: content.source_type,
                source_url: content.source_url,
                external_id: content.external_id,
                media_status: content.media_status,
              }}
            />
          </section>

          <section aria-labelledby="captions-heading" className="border-t border-line pt-5">
            <h2 id="captions-heading" className="mb-1 font-medium">
              Caption
            </h2>
            <p className="mb-4 text-[14px] text-ink-soft">
              {captions.length === 0
                ? 'Written from what this content is about and the workspace AI profile. Every version is kept.'
                : 'Every version is kept. Pick the one to use; writing another never replaces it.'}
            </p>

            {profileIsEmpty ? (
              <p className="mb-4 text-[14px] text-ink-soft">
                The workspace has no AI profile yet, so captions will be generic.{' '}
                <Link
                  href={`/app/workspaces/${workspace.id}/profile`}
                  className="underline underline-offset-2 hover:text-ink"
                >
                  {workspace.owner_id === user.id ? 'Fill it in' : 'See the profile'}
                </Link>
                .
              </p>
            ) : null}

            <GenerateCaptionButton
              action={boundGenerateCaption}
              hasCaptions={captions.length > 0}
            />

            {captions.length > 0 ? (
              <ol className="mt-6" aria-label="Caption versions">
                {captions.map((caption) => (
                  <CaptionVersion
                    key={caption.id}
                    caption={caption}
                    createdLabel={dateFormat.format(new Date(caption.created_at))}
                    isHumanEdited={caption.model_name === HUMAN_EDIT_MODEL_NAME}
                    action={selectCaption.bind(null, workspace.id, content.id, caption.id)}
                    editAction={editCaption.bind(null, workspace.id, content.id, caption.id)}
                  />
                ))}
              </ol>
            ) : null}
          </section>

          <section aria-labelledby="stages-heading" className="border-t border-line pt-5">
            <h2 id="stages-heading" className="mb-1 font-medium">
              Pipeline
            </h2>
            <p className="mb-4 text-[14px] text-ink-soft">
              Later stages. Nothing here is active yet.
            </p>
            <ol className="grid grid-cols-2 gap-x-6">
              {UPCOMING_STAGES.map((stage) => (
                <li key={stage} className="border-t border-dashed border-line-strong py-3">
                  <span className="block text-[15px] text-ink-faint">{stage}</span>
                  <span className="block text-[12px] text-ink-faint">Not available yet</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-8">
          <dl className="border-t border-line pt-5 text-[14px]">
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="text-ink-faint">Source</dt>
              <dd className="text-right">{SOURCE_TYPE_LABEL[content.source_type]}</dd>
            </div>
            {/* The only tappable row: 44px tall, no py so it sits on the same
                baseline rhythm as its neighbours. */}
            <div className="flex min-h-11 items-center justify-between gap-4">
              <dt className="shrink-0 text-ink-faint">Link</dt>
              <dd className="flex min-w-0 justify-end text-right">
                {content.source_url ? (
                  <a
                    href={content.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={content.source_url}
                    className="inline-flex min-h-11 max-w-full items-center underline underline-offset-2 hover:text-ink"
                  >
                    <span className="truncate">{sourceHost}</span>
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                ) : (
                  <span className="text-ink-faint">Not set</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="shrink-0 text-ink-faint">Platform ID</dt>
              <dd className="min-w-0 text-right">
                {content.external_id ? (
                  <span
                    className="block truncate font-mono text-[12px]"
                    title={content.external_id}
                  >
                    {content.external_id}
                  </span>
                ) : (
                  <span className="text-ink-faint">Not set</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="text-ink-faint">Media</dt>
              <dd className="text-right">
                <MediaStatusMark status={content.media_status} />
              </dd>
            </div>
          </dl>

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
            <DeleteContentButton
              action={boundDeleteContent}
              title={content.title}
              captionCount={captions.length}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
