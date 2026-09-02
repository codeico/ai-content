/**
 * Workspace validation and authorization primitives.
 *
 * Shared so the same rules run in the browser (fast feedback) and in Server
 * Actions (the boundary that actually matters). Browser validation is a
 * convenience; the server never trusts it. Row Level Security is the final
 * backstop — these functions and the database policies must agree.
 */
import { z } from 'zod';

/**
 * Maximum workspace name length.
 *
 * No product requirement dictates this number; it exists so an unbounded
 * string cannot reach the database. 100 matches the name field length used by
 * comparable products (e.g. GitHub organization names).
 */
export const WORKSPACE_NAME_MAX_LENGTH = 100;

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, 'Workspace name is required.')
  .max(
    WORKSPACE_NAME_MAX_LENGTH,
    `Workspace name must be at most ${WORKSPACE_NAME_MAX_LENGTH} characters.`,
  );

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

/** Field-level messages, keyed by field name. */
export type WorkspaceFieldErrors = Partial<Record<keyof CreateWorkspaceInput, string>>;

/**
 * Validates raw form input for creating or renaming a workspace.
 *
 * Takes `unknown` because the input is untrusted `FormData` — the caller has
 * no type guarantee to hand over.
 *
 * Returns a result rather than throwing: an invalid name is an expected
 * outcome of a form submission, not an exceptional condition.
 */
export function validateWorkspaceName(
  input: unknown,
):
  | { success: true; data: CreateWorkspaceInput }
  | { success: false; fieldErrors: WorkspaceFieldErrors } {
  const result = createWorkspaceSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const fieldErrors: WorkspaceFieldErrors = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0];

    // First message per field only: showing every failed rule at once is noise.
    if (field === 'name' && fieldErrors.name === undefined) {
      fieldErrors.name = issue.message;
    }
  }

  return { success: false, fieldErrors };
}

/**
 * Validates a workspace ID taken from a route parameter.
 *
 * A route param is attacker-controlled input, not a trusted identifier —
 * this must be checked before it ever reaches a database query, so a
 * malformed value fails fast as "not found" instead of surfacing a raw
 * database error.
 */
export const workspaceIdSchema = z.uuid();

/**
 * The two Phase 2 membership roles.
 *
 * Kept intentionally minimal — see docs/PHASE_2_PROMPT.md §9. Do not add
 * admin/editor/viewer/etc. without a documented product requirement.
 */
export type WorkspaceRole = 'owner' | 'member';

/**
 * Whether a role may rename or delete the workspace.
 *
 * A pure function so the rule can be unit tested without a database, and
 * reused anywhere the UI needs to decide what to render. It is not itself the
 * security boundary — RLS and each Server Action's own `owner_id` check are —
 * but it keeps the UI and the authorization rule from silently drifting apart.
 */
export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === 'owner';
}
