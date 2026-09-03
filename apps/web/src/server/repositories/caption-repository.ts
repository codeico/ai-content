import type { CaptionStatus } from '@ai-content/shared/content/caption';
import type { Database, Tables } from '@ai-content/database/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Caption data access. Same contract as content-repository.ts: takes the
 * caller's authenticated client, never reads a session, and puts an explicit
 * `workspace_id` AND `content_id` predicate on every query even though RLS
 * enforces the workspace boundary — the predicates are the visible scoping
 * step, RLS is the backstop.
 *
 * Every function is scoped by (workspaceId, contentId) by signature. There is
 * no way to reach a caption by its own id alone, so a tampered captionId under
 * a different content or workspace cannot match.
 */

type CaptionClient = SupabaseClient<Database>;

export class CaptionRepositoryError extends Error {
  constructor(
    message: string,
    public override readonly cause: unknown,
  ) {
    super(message);
    this.name = 'CaptionRepositoryError';
  }
}

/** Narrow the CHECK-constrained status column to the shared enum. */
export type Caption = Omit<Tables<'captions'>, 'status'> & { status: CaptionStatus };

const CAPTION_COLUMNS =
  'id, content_id, workspace_id, version, body, status, model_name, prompt_version, created_by, created_at, updated_at';

/** Postgres unique_violation: the version (or the single-active slot) was taken concurrently. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  );
}

/**
 * How many versions this content already has. Used to bound paid generation
 * before a model is called; scoped by both ids like every other query here.
 */
export async function countCaptionsForContent(
  supabase: CaptionClient,
  workspaceId: string,
  contentId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('captions')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('content_id', contentId);

  if (error) {
    throw new CaptionRepositoryError('Unable to count captions.', error);
  }

  return count ?? 0;
}

/** Newest version first, so the page reads top-down from latest to oldest. */
export async function listCaptionsForContent(
  supabase: CaptionClient,
  workspaceId: string,
  contentId: string,
): Promise<Caption[]> {
  const { data, error } = await supabase
    .from('captions')
    .select(CAPTION_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('content_id', contentId)
    .order('version', { ascending: false });

  if (error) {
    throw new CaptionRepositoryError('Unable to list captions.', error);
  }

  return data as Caption[];
}

export interface NewCaption {
  body: string;
  model_name: string;
  prompt_version: string;
  created_by: string;
}

/**
 * Inserts the next version for a content row. The version is computed as
 * MAX(version) + 1 in the application, per this codebase's rule that logic is
 * explicit in repositories; the UNIQUE(content_id, version) constraint turns a
 * concurrent double-generate into a unique_violation, which the caller may
 * retry once. `workspace_id` and `content_id` come from the verified
 * arguments, never from the caption payload.
 */
export async function insertNextCaptionVersion(
  supabase: CaptionClient,
  workspaceId: string,
  contentId: string,
  caption: NewCaption,
): Promise<Caption> {
  const { data: latest, error: latestError } = await supabase
    .from('captions')
    .select('version')
    .eq('workspace_id', workspaceId)
    .eq('content_id', contentId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new CaptionRepositoryError('Unable to save caption.', latestError);
  }

  const version = (latest?.version ?? 0) + 1;

  const { data, error } = await supabase
    .from('captions')
    .insert({ ...caption, workspace_id: workspaceId, content_id: contentId, version })
    .select(CAPTION_COLUMNS)
    .single();

  if (error) {
    throw new CaptionRepositoryError('Unable to save caption.', error);
  }

  return data as Caption;
}

/**
 * Makes one caption the active one for its content, archiving whichever was
 * active before.
 *
 * The target is verified FIRST. Archiving before knowing the target exists
 * would let a stale page or a tampered id strip the content's active caption
 * and then fail — the user would see "not found" while quietly losing their
 * selection. Verify, archive, activate.
 *
 * Two write statements are still needed because the partial unique index
 * permits only one active row. If the second fails, the content is left with
 * no active caption rather than two: recoverable by selecting again, and never
 * a violated invariant.
 *
 * Returns null when the caption is not in this workspace/content (RLS or
 * predicate miss) — indistinguishable from "does not exist" on purpose.
 */
export async function selectCaptionAsActive(
  supabase: CaptionClient,
  workspaceId: string,
  contentId: string,
  captionId: string,
): Promise<Caption | null> {
  const { data: target, error: targetError } = await supabase
    .from('captions')
    .select('id, status')
    .eq('workspace_id', workspaceId)
    .eq('content_id', contentId)
    .eq('id', captionId)
    .maybeSingle();

  if (targetError) {
    throw new CaptionRepositoryError('Unable to select caption.', targetError);
  }

  if (!target) {
    return null;
  }

  const { error: archiveError } = await supabase
    .from('captions')
    .update({ status: 'archived' })
    .eq('workspace_id', workspaceId)
    .eq('content_id', contentId)
    .eq('status', 'active')
    .neq('id', captionId);

  if (archiveError) {
    throw new CaptionRepositoryError('Unable to select caption.', archiveError);
  }

  const { data, error } = await supabase
    .from('captions')
    .update({ status: 'active' })
    .eq('workspace_id', workspaceId)
    .eq('content_id', contentId)
    .eq('id', captionId)
    .select(CAPTION_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new CaptionRepositoryError('Unable to select caption.', error);
  }

  return data as Caption | null;
}
