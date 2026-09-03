import type { Database, Tables } from '@ai-content/database/client';
import type { WorkspaceProfileInput } from '@ai-content/shared/workspace/profile';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Workspace profile data access.
 *
 * Same contract as workspace-repository.ts: the caller passes its own
 * session-bound Supabase client and an explicit actor id where a write is
 * involved; this module never reads a session. Every query carries an
 * explicit `workspace_id` predicate; RLS enforces the same boundary
 * underneath (members read, owner writes).
 */

type ProfileClient = SupabaseClient<Database>;

export class WorkspaceProfileRepositoryError extends Error {
  constructor(
    message: string,
    public override readonly cause: unknown,
  ) {
    super(message);
    this.name = 'WorkspaceProfileRepositoryError';
  }
}

export type WorkspaceProfile = Tables<'workspace_profiles'>;

const PROFILE_COLUMNS =
  'id, workspace_id, niche, description, target_audience, tone, writing_style, content_goals, restrictions, created_at, updated_at';

/**
 * Fetches the profile of one workspace, or `null` when it has not been
 * created yet. The caller must already have verified membership
 * (`getWorkspaceForUser`); RLS returns nothing for non-members regardless.
 */
export async function getProfileForWorkspace(
  supabase: ProfileClient,
  workspaceId: string,
): Promise<WorkspaceProfile | null> {
  const { data, error } = await supabase
    .from('workspace_profiles')
    .select(PROFILE_COLUMNS)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    throw new WorkspaceProfileRepositoryError('Unable to load workspace profile.', error);
  }

  return data;
}

/**
 * Creates or replaces the profile of a workspace the actor owns.
 *
 * Ownership is checked explicitly before the write, mirroring the RLS
 * policies, so a non-owner gets `null` (rendered as "no access") instead of
 * an RLS violation surfacing as a generic failure. The upsert is keyed on the
 * unique `workspace_id`, so the first save creates the row and later saves
 * update it; `workspace_id` comes from the server-bound argument, never from
 * the validated patch, which by construction contains only profile fields.
 */
export async function upsertProfileAsOwner(
  supabase: ProfileClient,
  workspaceId: string,
  actorId: string,
  patch: WorkspaceProfileInput,
): Promise<WorkspaceProfile | null> {
  const { data: owned, error: ownerError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', actorId)
    .maybeSingle();

  if (ownerError) {
    throw new WorkspaceProfileRepositoryError('Unable to save workspace profile.', ownerError);
  }

  if (!owned) {
    return null;
  }

  // Patch first, id last: even if a caller bypassed Zod and smuggled a
  // `workspace_id`, the verified argument wins.
  const { data, error } = await supabase
    .from('workspace_profiles')
    .upsert({ ...patch, workspace_id: workspaceId }, { onConflict: 'workspace_id' })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    throw new WorkspaceProfileRepositoryError('Unable to save workspace profile.', error);
  }

  return data;
}
