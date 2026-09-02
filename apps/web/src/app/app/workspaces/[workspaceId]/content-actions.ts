'use server';

import {
  validateCreateContent,
  validateUpdateContent,
  validateUpdateContentSource,
  type ContentFieldErrors,
  type ContentSourceFieldErrors,
} from '@ai-content/shared/content';
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

  const parsed = validateUpdateContent({
    title: formData.get('title'),
    status: formData.get('status'),
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

  const parsed = validateUpdateContentSource({
    source_type: formData.get('source_type'),
    source_url: formData.get('source_url') ?? '',
    external_id: formData.get('external_id') ?? '',
    media_status: formData.get('media_status'),
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

    // `available` means bytes exist at a storage key, which only a storage
    // phase can assert. An owner may keep it (editing the link on a stored
    // item) but never move a row into it. The DB check backs this up.
    if (parsed.data.media_status === 'available') {
      const existing = await getContentInWorkspace(supabase, workspaceId, contentId);

      if (!existing) {
        return { error: 'Content not found.' };
      }

      if (existing.media_status !== 'available') {
        return {
          fieldErrors: { media_status: 'Available is set by the system, not by hand.' },
        };
      }
    }

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

  const detailPath = `/app/workspaces/${workspaceId}/content/${contentId}`;

  let deleted = false;

  try {
    const supabase = await createServerClient();

    if (await getWorkspaceForUser(supabase, workspaceId, user.id)) {
      deleted = await deleteContentInWorkspace(supabase, workspaceId, contentId);
    }
  } catch (error) {
    if (error instanceof ContentRepositoryError) {
      redirect(detailPath);
    }

    throw error;
  }

  redirect(deleted ? `/app/workspaces/${workspaceId}` : detailPath);
}
