import type { Database, Tables } from '@ai-content/database/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * How many workspaces one account can list.
 *
 * The membership query fed an `.in(...)` filter built from its own result, so
 * an account with many workspaces produced a query whose size grew with the
 * data. This bounds it. It is deliberately generous: nobody legitimately
 * running this product has more, and anyone who does needs a real list UI
 * rather than a longer query.
 */
export const WORKSPACE_LIST_LIMIT = 100;

/**
 * Workspace data access.
 *
 * No `server-only` import: the package is not a dependency (see Phase 1's
 * same decision in apps/web/src/lib/supabase/server.ts — not adding it per
 * docs/CODING_RULES.md §44 when an existing constraint already does the job).
 * Here the constraint is that this module only ever receives a Supabase
 * client from its caller and touches no secret itself, so an accidental
 * client-bundle import would fail at the `SupabaseClient` type's own
 * dependencies before it could leak anything.
 *
 * Every exported function takes the caller's already-authenticated Supabase
 * client and, where relevant, an explicit user id — this module never reads
 * a session itself. That keeps authentication (who is calling) visibly
 * separate from data access (what the query does), per docs/CODING_RULES.md
 * §20, and makes each function testable with a mocked client.
 *
 * Ownership queries add an explicit `owner_id` predicate even though Row
 * Level Security enforces the same rule at the database layer. The two are
 * intentionally redundant: RLS is the backstop that holds even if this code
 * has a bug, and the explicit predicate here is what docs/CODING_RULES.md §21
 * means by "Authorize workspace access" as a visible step, not an inferred
 * side effect of an error/empty-result branch.
 */

type WorkspaceClient = SupabaseClient<Database>;

/** Raised when a Supabase query fails. Wraps the driver error rather than
 * exposing it, so callers can log the cause while showing users a safe,
 * generic message (docs/CODING_RULES.md §22). */
export class WorkspaceRepositoryError extends Error {
  constructor(
    message: string,
    public override readonly cause: unknown,
  ) {
    super(message);
    this.name = 'WorkspaceRepositoryError';
  }
}

export type WorkspaceSummary = Pick<Tables<'workspaces'>, 'id' | 'name' | 'created_at'>;

export type WorkspaceMembershipRole = Tables<'workspace_members'>['role'];

export interface WorkspaceListItem {
  workspace: WorkspaceSummary;
  role: WorkspaceMembershipRole;
}

export type WorkspaceDetail = Tables<'workspaces'> & { role: WorkspaceMembershipRole };

/**
 * Lists the workspaces a user is a member of, most recently created first.
 *
 * Queries `workspace_members` and `workspaces` separately rather than a
 * PostgREST embedded select. This keeps the returned shape an explicit,
 * hand-written type instead of the embedding inference, and avoids an
 * ambiguous relationship error: `workspace_members` has two foreign keys
 * that reach `profiles` (`user_id`) — an embed of `workspaces` alone is
 * unambiguous today, but a hand-rolled two-query join does not depend on
 * that staying true as the schema grows.
 */
export async function listWorkspacesForUser(
  supabase: WorkspaceClient,
  userId: string,
): Promise<WorkspaceListItem[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId)
    // Bounded so the follow-up .in(...) cannot grow into an unbounded filter
    // list. A person with more workspaces than this has a product problem the
    // list UI would need to solve anyway; silently building a 500-element
    // query is not the answer.
    .limit(WORKSPACE_LIST_LIMIT);

  if (membershipError) {
    throw new WorkspaceRepositoryError('Unable to list workspaces.', membershipError);
  }

  if (memberships.length === 0) {
    return [];
  }

  const roleByWorkspaceId = new Map(memberships.map((m) => [m.workspace_id, m.role]));

  const { data: workspaces, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .in(
      'id',
      memberships.map((m) => m.workspace_id),
    )
    .order('created_at', { ascending: false });

  if (workspaceError) {
    throw new WorkspaceRepositoryError('Unable to list workspaces.', workspaceError);
  }

  return workspaces.map((workspace) => ({
    workspace,
    // Falls back to 'member' only if a membership row were ever missing for a
    // workspace this query returned, which RLS should make impossible; the
    // fallback exists so a schema/RLS regression degrades to the least
    // privileged role display rather than throwing.
    role: roleByWorkspaceId.get(workspace.id) ?? 'member',
  }));
}

/**
 * Fetches one workspace, scoped to a member's access.
 *
 * Returns `null` when the workspace does not exist *or* the user is not a
 * member — the two are indistinguishable to the caller on purpose, so a page
 * cannot leak whether a given workspace id exists to someone with no access
 * to it (docs/PHASE_2_PROMPT.md §17).
 */
export async function getWorkspaceForUser(
  supabase: WorkspaceClient,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceDetail | null> {
  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) {
    throw new WorkspaceRepositoryError('Unable to load workspace.', membershipError);
  }

  if (!membership) {
    return null;
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, owner_id, created_at, updated_at')
    .eq('id', workspaceId)
    .maybeSingle();

  if (workspaceError) {
    throw new WorkspaceRepositoryError('Unable to load workspace.', workspaceError);
  }

  // A membership row referencing a workspace that no longer exists should not
  // happen (workspace_id cascades on delete), but treating it as "not found"
  // rather than crashing is the safer response to an unexpected state.
  if (!workspace) {
    return null;
  }

  return { ...workspace, role: membership.role };
}

/**
 * Creates a workspace owned by `userId` and, via the database trigger defined
 * in the Phase 2 migration, its owner membership row.
 */
export async function createWorkspaceForUser(
  supabase: WorkspaceClient,
  userId: string,
  name: string,
): Promise<Tables<'workspaces'>> {
  const { data, error } = await supabase
    .from('workspaces')
    .insert({ name, owner_id: userId })
    .select('id, name, owner_id, created_at, updated_at')
    .single();

  if (error) {
    throw new WorkspaceRepositoryError('Unable to create workspace.', error);
  }

  return data;
}

/**
 * Renames a workspace. Returns `null` when `actorId` does not own it (or it
 * does not exist), which the caller renders as an authorization error.
 *
 * The `owner_id` predicate is this function's explicit authorization check;
 * see the module doc comment for why it duplicates the RLS policy.
 */
export async function renameWorkspaceAsOwner(
  supabase: WorkspaceClient,
  workspaceId: string,
  actorId: string,
  name: string,
): Promise<Tables<'workspaces'> | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .update({ name })
    .eq('id', workspaceId)
    .eq('owner_id', actorId)
    .select('id, name, owner_id, created_at, updated_at')
    .maybeSingle();

  if (error) {
    throw new WorkspaceRepositoryError('Unable to rename workspace.', error);
  }

  return data;
}

/**
 * Deletes a workspace. Returns `false` when `actorId` does not own it (or it
 * does not exist already), which the caller renders as an authorization error.
 *
 * Dependent `workspace_members` rows are removed by the migration's
 * `on delete cascade`, so no separate cleanup query is needed here.
 */
export async function deleteWorkspaceAsOwner(
  supabase: WorkspaceClient,
  workspaceId: string,
  actorId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', workspaceId)
    .eq('owner_id', actorId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new WorkspaceRepositoryError('Unable to delete workspace.', error);
  }

  return data !== null;
}
