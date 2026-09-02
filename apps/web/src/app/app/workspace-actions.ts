'use server';

import { validateWorkspaceName, type WorkspaceFieldErrors } from '@ai-content/shared/workspace';
import { redirect } from 'next/navigation';

import {
  createWorkspaceForUser,
  deleteWorkspaceAsOwner,
  renameWorkspaceAsOwner,
  WorkspaceRepositoryError,
} from '@/server/repositories/workspace-repository';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

/**
 * Workspace Server Actions.
 *
 * Every action re-derives the caller from the session (`getAuthenticatedUser`)
 * rather than trusting a client-supplied user id — see docs/PHASE_2_PROMPT.md
 * §25 and docs/CODING_RULES.md §16. `redirect('/login')` is used instead of
 * returning an error state: an unauthenticated POST to one of these actions
 * is not a form-validation failure, it is a missing prerequisite, the same
 * way the protected layout treats a missing session.
 */

export interface WorkspaceFormState {
  /** Message shown above the form. */
  error?: string;
  /** Per-field validation messages. */
  fieldErrors?: WorkspaceFieldErrors;
}

/**
 * Creates a workspace and sends the owner straight to it.
 *
 * Uses the caller's own session-bound client, not the admin client: the
 * "Authenticated users can create a workspace they own" RLS policy exists
 * precisely so this insert can run under RLS, `with check (owner_id =
 * auth.uid())` — reaching for the service-role client here would bypass that
 * check for no reason and contradict docs/CODING_RULES.md §18, which
 * reserves the service role for background jobs and internal service
 * operations, not user-initiated CRUD that already has a working RLS path.
 * The owner membership row is created by the `on_workspace_created` trigger,
 * which runs `security definer` specifically so it does not depend on the
 * caller having a write grant on `workspace_members` (there is deliberately
 * no client-writable policy for that table — see the Phase 2 migration).
 * `owner_id` is still pinned to the verified session user, never to
 * client input, so a caller cannot create a workspace they do not own.
 */
export async function createWorkspace(
  _prevState: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  const parsed = validateWorkspaceName({ name: formData.get('name') });

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors };
  }

  let workspace;

  try {
    const supabase = await createServerClient();
    workspace = await createWorkspaceForUser(supabase, user.id, parsed.data.name);
  } catch (error) {
    if (error instanceof WorkspaceRepositoryError) {
      return { error: 'Unable to create workspace. Please try again.' };
    }

    throw error;
  }

  redirect(`/app/workspaces/${workspace.id}`);
}

/**
 * Renames a workspace. Only the owner's session client is used — RLS's
 * "Owner can update their workspace" policy is the sole authority here, so
 * a non-owner's request affects zero rows and is reported the same way a
 * genuinely missing workspace would be (docs/PHASE_2_PROMPT.md §27:
 * "You do not have access to this workspace", not a raw permission error).
 */
export async function updateWorkspace(
  workspaceId: string,
  _prevState: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  const parsed = validateWorkspaceName({ name: formData.get('name') });

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors };
  }

  let renamed;

  try {
    const supabase = await createServerClient();
    renamed = await renameWorkspaceAsOwner(supabase, workspaceId, user.id, parsed.data.name);
  } catch (error) {
    if (error instanceof WorkspaceRepositoryError) {
      return { error: 'Unable to rename workspace. Please try again.' };
    }

    throw error;
  }

  if (!renamed) {
    return { error: 'You do not have access to this workspace.' };
  }

  return {};
}

/**
 * Deletes a workspace. Redirects to the workspace list on success so the
 * caller is never left on a page for a workspace that no longer exists.
 *
 * Failure (not found / not owner) is intentionally silent to the caller
 * beyond the redirect target staying the detail page: per
 * docs/PHASE_2_PROMPT.md §20 this is an owner-only destructive action, and
 * an indistinguishable "no effect" response to a non-owner's forged request
 * avoids confirming the workspace's existence to them.
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createServerClient();

  let deleted: boolean;

  try {
    deleted = await deleteWorkspaceAsOwner(supabase, workspaceId, user.id);
  } catch (error) {
    if (error instanceof WorkspaceRepositoryError) {
      // Repository already logged the cause via the thrown error's `cause`;
      // the action has no UI to report to on a delete, so send the owner
      // back to a page that will simply show the workspace still exists.
      redirect(`/app/workspaces/${workspaceId}`);
    }

    throw error;
  }

  redirect(deleted ? '/app' : `/app/workspaces/${workspaceId}`);
}
