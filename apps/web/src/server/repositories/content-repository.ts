import type { ContentStatus } from '@ai-content/shared/content';
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

/** Generated types give `status: string`; narrow to the CHECK-constrained set. */
export type Content = Omit<Tables<'content'>, 'status'> & { status: ContentStatus };

const CONTENT_COLUMNS = 'id, workspace_id, title, status, created_at, updated_at';

export async function listContentForWorkspace(
  supabase: ContentClient,
  workspaceId: string,
): Promise<Content[]> {
  const { data, error } = await supabase
    .from('content')
    .select(CONTENT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    throw new ContentRepositoryError('Unable to list content.', error);
  }

  return data as Content[];
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

/** Only title and status are writable; workspace_id is never part of the payload (§19). */
export async function updateContentInWorkspace(
  supabase: ContentClient,
  workspaceId: string,
  contentId: string,
  patch: { title: string; status: ContentStatus },
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
