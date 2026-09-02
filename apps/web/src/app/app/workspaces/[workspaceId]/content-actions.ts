'use server';

import {
  validateCreateContent,
  validateUpdateContent,
  type ContentFieldErrors,
} from '@ai-content/shared/content';
import { redirect } from 'next/navigation';

import {
  ContentRepositoryError,
  createContentInWorkspace,
  deleteContentInWorkspace,
  updateContentInWorkspace,
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
