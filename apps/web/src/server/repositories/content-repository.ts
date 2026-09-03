import type {
  ContentSourceType,
  ContentStatus,
  MediaStatus,
  UpdateContentSourceInput,
} from '@ai-content/shared/content';
import type { Database, Tables } from '@ai-content/database/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Content data access. Same contract as workspace-repository.ts: takes the
 * caller's authenticated client, never reads a session, and puts an explicit
 * `workspace_id` predicate on every query even though RLS enforces the same
 * boundary — RLS is the backstop, the predicate is the visible scoping step.
 *
 * Every function is workspace-scoped by signature: there is no way to fetch
 * content by id alone, so a tampered contentId under a different workspaceId
 * cannot match (docs/PHASE_3_PROMPT.md §18, §34).
 */

type ContentClient = SupabaseClient<Database>;

export class ContentRepositoryError extends Error {
  constructor(
    message: string,
    public override readonly cause: unknown,
  ) {
    super(message);
    this.name = 'ContentRepositoryError';
  }
}

/**
 * Generated types give the CHECK-constrained columns as `string`; narrow them
 * to the shared enums. storage_provider/storage_key are read here but never
 * written by any function in this file: no storage phase exists yet.
 */
export type Content = Omit<Tables<'content'>, 'status' | 'source_type' | 'media_status'> & {
  status: ContentStatus;
  source_type: ContentSourceType;
  media_status: MediaStatus;
};

const CONTENT_COLUMNS =
  'id, workspace_id, title, status, description, source_type, source_url, external_id, storage_provider, storage_key, media_status, created_at, updated_at';

/**
 * How many content rows one page request loads.
 *
 * The list was unbounded: every workspace page fetched every row a workspace
 * had ever held, so page weight grew without limit and one busy workspace
 * could dominate a request. A silent cap would be worse than unbounded — it
 * hides rows the user knows exist — so this is paired with an explicit
 * "load more" affordance and an exact total.
 */
export const CONTENT_PAGE_SIZE = 25;

/** A position in the list, not an offset: the sort key of the last row seen. */
export interface ContentCursor {
  created_at: string;
  id: string;
}

export interface ContentPage {
  items: Content[];
  /** Pass to the next call to continue; null when the list is exhausted. */
  nextCursor: ContentCursor | null;
}

/**
 * One page of content, newest first.
 *
 * Keyset, not offset: the ordering is (created_at desc, id desc) and
 * content_workspace_id_created_at_idx matches it exactly, so each page is an
 * index range scan whose cost does not grow with how deep the user has paged.
 * Offset would re-scan every skipped row and can also skip or repeat items
 * when a row is inserted mid-paging; a keyset cannot.
 *
 * `id` breaks ties so two rows created in the same millisecond still have a
 * total order — without it a cursor could loop or drop rows.
 */
export async function listContentForWorkspace(
  supabase: ContentClient,
  workspaceId: string,
  options: { cursor?: ContentCursor | null; limit?: number } = {},
): Promise<ContentPage> {
  const limit = options.limit ?? CONTENT_PAGE_SIZE;

  let query = supabase
    .from('content')
    .select(CONTENT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    // One extra row answers "is there more?" without a second round trip.
    .limit(limit + 1);

  if (options.cursor) {
    // Strictly after the cursor in (created_at desc, id desc) order.
    query = query.or(
      `created_at.lt.${options.cursor.created_at},and(created_at.eq.${options.cursor.created_at},id.lt.${options.cursor.id})`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new ContentRepositoryError('Unable to list content.', error);
  }

  const rows = data as Content[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items,
    nextCursor: hasMore && last ? { created_at: last.created_at, id: last.id } : null,
  };
}

/**
 * Status totals for the whole workspace.
 *
 * Counted in the database, never by tallying a page: once the list is
 * paginated, counting the rows in hand would silently report "3 drafts" for a
 * workspace holding 300. Selects only the status column so the payload stays
 * small even for a large workspace.
 */
/**
 * Every content row the caller can see, newest first, across all their
 * workspaces.
 *
 * There is no workspace predicate here, and that is the one place in this
 * file where that is correct: the Content tab is explicitly cross-workspace,
 * and RLS already restricts the rows to workspaces the caller belongs to via
 * workspace_ids_for_current_user(). Adding a client-supplied workspace filter
 * would narrow it, not secure it.
 *
 * Bounded like every other list. The join pulls the workspace name so the UI
 * can say which workspace a row belongs to without an N+1.
 */
export async function listAllContentForUser(
  supabase: ContentClient,
  options: { limit?: number } = {},
): Promise<(Content & { workspace_name: string })[]> {
  const limit = options.limit ?? CONTENT_PAGE_SIZE;

  const { data, error } = await supabase
    .from('content')
    .select(`${CONTENT_COLUMNS}, workspaces(name)`)
    // Archived rows are excluded and the sort is by recency of WORK, not of
    // creation: this is a single stream with no filter UI, so without both it
    // silts up into a junk drawer the user cannot escape.
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) {
    throw new ContentRepositoryError('Unable to load content.', error);
  }

  return (data ?? []).map((row) => {
    const { workspaces, ...content } = row as Content & {
      workspaces: { name: string } | { name: string }[] | null;
    };
    // PostgREST returns an object for a to-one embed and an array when it
    // cannot prove the relationship is to-one; handle both rather than guess.
    const related = Array.isArray(workspaces) ? workspaces[0] : workspaces;

    return { ...content, workspace_name: related?.name ?? 'Unknown workspace' };
  });
}

export async function countContentByStatus(
  supabase: ContentClient,
  workspaceId: string,
): Promise<{ total: number; draft: number; ready: number; archived: number }> {
  const { data, error } = await supabase
    .from('content')
    .select('status')
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new ContentRepositoryError('Unable to count content.', error);
  }

  const rows = data as { status: ContentStatus }[];
  const counts = { total: rows.length, draft: 0, ready: 0, archived: 0 };

  for (const row of rows) {
    counts[row.status] += 1;
  }

  return counts;
}

/** `null` for both "does not exist" and "not in this workspace" — indistinguishable on purpose. */
export async function getContentInWorkspace(
  supabase: ContentClient,
  workspaceId: string,
  contentId: string,
): Promise<Content | null> {
  const { data, error } = await supabase
    .from('content')
    .select(CONTENT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('id', contentId)
    .maybeSingle();

  if (error) {
    throw new ContentRepositoryError('Unable to load content.', error);
  }

  return data as Content | null;
}

/** Status defaults to 'draft' at the database. */
export async function createContentInWorkspace(
  supabase: ContentClient,
  workspaceId: string,
  title: string,
): Promise<Content> {
  const { data, error } = await supabase
    .from('content')
    .insert({ workspace_id: workspaceId, title })
    .select(CONTENT_COLUMNS)
    .single();

  if (error) {
    throw new ContentRepositoryError('Unable to create content.', error);
  }

  return data as Content;
}

/**
 * Only title, status and description are writable; workspace_id is never part
 * of the payload (§19).
 */
export async function updateContentInWorkspace(
  supabase: ContentClient,
  workspaceId: string,
  contentId: string,
  patch: { title: string; status: ContentStatus; description: string | null },
): Promise<Content | null> {
  const { data, error } = await supabase
    .from('content')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', contentId)
    .select(CONTENT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new ContentRepositoryError('Unable to update content.', error);
  }

  return data as Content | null;
}

/**
 * Source and media assertions. Same scoping as updateContentInWorkspace; the
 * patch type is the validated Zod output, so storage_provider/storage_key can
 * never be part of it — the database's `available requires storage_key`
 * check is therefore unreachable from here by construction.
 */
export async function updateContentSourceInWorkspace(
  supabase: ContentClient,
  workspaceId: string,
  contentId: string,
  patch: UpdateContentSourceInput,
): Promise<Content | null> {
  const { data, error } = await supabase
    .from('content')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('id', contentId)
    .select(CONTENT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new ContentRepositoryError('Unable to update content source.', error);
  }

  return data as Content | null;
}

export async function deleteContentInWorkspace(
  supabase: ContentClient,
  workspaceId: string,
  contentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('content')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', contentId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new ContentRepositoryError('Unable to delete content.', error);
  }

  return data !== null;
}
