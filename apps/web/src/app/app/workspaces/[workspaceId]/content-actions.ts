'use server';

import {
  validateCreateContent,
  validateUpdateContent,
  validateUpdateContentSource,
  type ContentFieldErrors,
  type ContentSourceFieldErrors,
} from '@ai-content/shared/content';
import { isContentId, isWorkspaceId } from '@/server/action-ids';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  ContentRepositoryError,
  createContentInWorkspace,
  deleteContentInWorkspace,
  getContentInWorkspace,
  updateContentInWorkspace,
  updateContentSourceInWorkspace,
} from '@/server/repositories/content-repository';
import { getWorkspaceForUser } from '@/server/repositories/workspace-repository';
import { ContentMediaStorageError, removeContentMedia } from '@/server/storage/content-media';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

/**
 * Content Server Actions. Same shape as workspace-actions.ts: session is
 * re-read server-side, workspaceId/contentId arrive via `.bind` in the
 * encrypted action reference (not editable form input), membership is checked
 * explicitly via getWorkspaceForUser before any write, and RLS enforces the
 * same boundary underneath with the caller's own client — never the admin
 * client.
 */

export interface ContentFormState {
  error?: string;
  fieldErrors?: ContentFieldErrors;
}

export interface ContentSourceFormState {
  error?: string;
  fieldErrors?: ContentSourceFieldErrors;
}

const NO_ACCESS = 'You do not have access to this workspace.';

export async function createContent(
  workspaceId: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  if (!isWorkspaceId(workspaceId)) {
    return { error: NO_ACCESS };
  }

  const parsed = validateCreateContent({ title: formData.get('title') });

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors };
  }

  let content;

  try {
    const supabase = await createServerClient();

    if (!(await getWorkspaceForUser(supabase, workspaceId, user.id))) {
      return { error: NO_ACCESS };
    }

    content = await createContentInWorkspace(supabase, workspaceId, parsed.data.title);
  } catch (error) {
    if (error instanceof ContentRepositoryError) {
      return { error: 'Unable to create content. Please try again.' };
    }

    throw error;
  }

  redirect(`/app/workspaces/${workspaceId}/content/${content.id}`);
}

export async function updateContent(
  workspaceId: string,
  contentId: string,
  _prevState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  if (!isWorkspaceId(workspaceId) || !isContentId(contentId)) {
    return { error: NO_ACCESS };
  }

  const parsed = validateUpdateContent({
    title: formData.get('title'),
    status: formData.get('status'),
    description: formData.get('description') ?? '',
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors };
  }

  let updated;

  try {
    const supabase = await createServerClient();

    if (!(await getWorkspaceForUser(supabase, workspaceId, user.id))) {
      return { error: NO_ACCESS };
    }

    updated = await updateContentInWorkspace(supabase, workspaceId, contentId, parsed.data);
  } catch (error) {
    if (error instanceof ContentRepositoryError) {
      return { error: 'Unable to update content. Please try again.' };
    }

    throw error;
  }

  if (!updated) {
    return { error: 'Content not found.' };
  }

  // Re-render the current route so the header/list reflect the new values.
  refresh();

  return {};
}

/**
 * Source and media assertions for one content item. Identical gate to
 * updateContent: session, Zod, membership, workspace-scoped repository. The
 * form can only submit the four owner-editable fields; storage fields have
 * no input path at all.
 */
export async function updateContentSource(
  workspaceId: string,
  contentId: string,
  _prevState: ContentSourceFormState,
  formData: FormData,
): Promise<ContentSourceFormState> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  if (!isWorkspaceId(workspaceId) || !isContentId(contentId)) {
    return { error: NO_ACCESS };
  }

  const parsed = validateUpdateContentSource({
    source_type: formData.get('source_type'),
    source_url: formData.get('source_url') ?? '',
    external_id: formData.get('external_id') ?? '',
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors };
  }

  let updated;

  try {
    const supabase = await createServerClient();

    if (!(await getWorkspaceForUser(supabase, workspaceId, user.id))) {
      return { error: NO_ACCESS };
    }

    // media_status is deliberately absent here: it is owned by the storage
    // verbs (reserve/confirm/release) and never accepted from a form.
    updated = await updateContentSourceInWorkspace(supabase, workspaceId, contentId, parsed.data);
  } catch (error) {
    if (error instanceof ContentRepositoryError) {
      return { error: 'Unable to save the source. Please try again.' };
    }

    throw error;
  }

  if (!updated) {
    return { error: 'Content not found.' };
  }

  refresh();

  return {};
}

export async function deleteContent(workspaceId: string, contentId: string): Promise<void> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  // Void action: mirror the existing not-found redirect rather than reporting.
  if (!isWorkspaceId(workspaceId) || !isContentId(contentId)) {
    redirect('/app');
  }

  const detailPath = `/app/workspaces/${workspaceId}/content/${contentId}`;

  let deleted = false;
  let cleanupFailed = false;

  try {
    const supabase = await createServerClient();

    if (await getWorkspaceForUser(supabase, workspaceId, user.id)) {
      const content = await getContentInWorkspace(supabase, workspaceId, contentId);

      if (content?.storage_key) {
        // Storage API first, then release the reference, then delete the row.
        // The database trigger refuses the opposite order so a future caller
        // cannot silently orphan bytes by skipping this sequence.
        cleanupFailed = !(await removeContentMedia(
          supabase,
          workspaceId,
          contentId,
          content.storage_key,
        ));
      }

      if (content && !cleanupFailed) {
        deleted = await deleteContentInWorkspace(supabase, workspaceId, contentId);
      }
    }
  } catch (error) {
    if (error instanceof ContentRepositoryError || error instanceof ContentMediaStorageError) {
      redirect(detailPath);
    }

    throw error;
  }

  redirect(deleted ? `/app/workspaces/${workspaceId}` : detailPath);
}
