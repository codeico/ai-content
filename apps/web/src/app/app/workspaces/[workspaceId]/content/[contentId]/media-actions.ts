'use server';

import { validateContentMediaFile } from '@ai-content/shared/content';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';

import { isContentId, isWorkspaceId } from '@/server/action-ids';
import { getContentInWorkspace } from '@/server/repositories/content-repository';
import { getWorkspaceForUser } from '@/server/repositories/workspace-repository';
import {
  confirmContentMediaUpload,
  ContentMediaStorageError,
  createContentMediaUploadTicket,
  removeContentMedia,
  type ContentMediaUploadTicket,
} from '@/server/storage/content-media';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

const NO_ACCESS = 'You do not have access to this content.';

export type RequestMediaUploadResult = ContentMediaUploadTicket | { error: string };
export type ConfirmMediaUploadResult = { ok: true } | { error: string };

/**
 * Authorise a direct browser → Storage upload.
 *
 * Only metadata crosses this Server Action. The actual File stays in the
 * browser; after this returns, uploadToSignedUrl sends it directly to Storage.
 */
export async function requestContentMediaUpload(
  workspaceId: string,
  contentId: string,
  input: { name: string; type: string; size: number },
): Promise<RequestMediaUploadResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  if (!isWorkspaceId(workspaceId) || !isContentId(contentId)) {
    return { error: NO_ACCESS };
  }

  const parsed = validateContentMediaFile(input);

  if (!parsed.success) {
    return {
      error:
        parsed.fieldErrors.type ?? parsed.fieldErrors.size ?? 'Choose a valid video to upload.',
    };
  }

  const supabase = await createServerClient();
  const workspace = await getWorkspaceForUser(supabase, workspaceId, user.id);

  if (!workspace) {
    return { error: NO_ACCESS };
  }

  const content = await getContentInWorkspace(supabase, workspaceId, contentId);

  if (!content) {
    return { error: NO_ACCESS };
  }

  try {
    return await createContentMediaUploadTicket(
      supabase,
      workspaceId,
      contentId,
      parsed.data.extension,
    );
  } catch (error) {
    if (error instanceof ContentMediaStorageError) {
      return { error: 'Unable to prepare the upload. Please try again.' };
    }

    throw error;
  }
}

/**
 * Confirm the exact path returned by requestContentMediaUpload. The prefix
 * check cheaply rejects tampering before a client is constructed; the SQL RPC
 * then verifies membership, the row's exact reserved key, and object existence
 * atomically.
 */
export async function confirmContentMedia(
  workspaceId: string,
  contentId: string,
  path: string,
): Promise<ConfirmMediaUploadResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  if (
    !isWorkspaceId(workspaceId) ||
    !isContentId(contentId) ||
    !path.startsWith(`${workspaceId}/${contentId}/`)
  ) {
    return { error: NO_ACCESS };
  }

  const supabase = await createServerClient();
  const workspace = await getWorkspaceForUser(supabase, workspaceId, user.id);

  if (!workspace) {
    return { error: NO_ACCESS };
  }

  const content = await getContentInWorkspace(supabase, workspaceId, contentId);

  if (!content) {
    return { error: NO_ACCESS };
  }

  try {
    if (!(await confirmContentMediaUpload(supabase, workspaceId, contentId, path))) {
      return { error: 'Upload is not available yet. Try again.' };
    }
  } catch (error) {
    if (error instanceof ContentMediaStorageError) {
      return { error: 'Unable to confirm the upload. Please try again.' };
    }

    throw error;
  }

  refresh();
  return { ok: true };
}

/**
 * Remove the content's current object without accepting its key from the
 * browser. This makes retries and later content/workspace deletion possible
 * without turning an arbitrary path into a deletion capability.
 */
export async function removeContentMediaUpload(
  workspaceId: string,
  contentId: string,
): Promise<ConfirmMediaUploadResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  if (!isWorkspaceId(workspaceId) || !isContentId(contentId)) {
    return { error: NO_ACCESS };
  }

  const supabase = await createServerClient();
  const workspace = await getWorkspaceForUser(supabase, workspaceId, user.id);

  if (!workspace) {
    return { error: NO_ACCESS };
  }

  const content = await getContentInWorkspace(supabase, workspaceId, contentId);

  if (!content) {
    return { error: NO_ACCESS };
  }

  if (!content.storage_key) {
    return { error: 'No stored video to remove.' };
  }

  try {
    if (!(await removeContentMedia(supabase, workspaceId, contentId, content.storage_key))) {
      return { error: 'Unable to remove the video. Please try again.' };
    }
  } catch (error) {
    if (error instanceof ContentMediaStorageError) {
      return { error: 'Unable to remove the video. Please try again.' };
    }

    throw error;
  }

  refresh();
  return { ok: true };
}
