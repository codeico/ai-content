/**
 * Workspace AI profile validation.
 *
 * The profile is the workspace's editorial identity: what the account is about
 * and who it speaks to. It exists so AI features (later phases) draw context
 * from stored configuration rather than hardcoded prompts
 * (docs/MASTER_PRODUCT_SPEC.md §17). This phase stores and edits it; nothing
 * reads it for generation yet.
 *
 * Same split as ./workspace.ts and ../content/content.ts: shared so browser
 * and Server Actions run identical rules, with RLS as the final backstop.
 */
import { z } from 'zod';

/**
 * Short single-line field. 100 matches WORKSPACE_NAME_MAX_LENGTH: a niche is
 * a label ("home cooking for students"), not a paragraph.
 */
export const PROFILE_SHORT_MAX_LENGTH = 100;

/**
 * Free-text field. 1000 characters is roughly 150 words: enough for a
 * paragraph of restrictions or goals, small enough that a prompt built from
 * every field stays bounded. Both caps are mirrored by CHECK constraints in
 * the workspace_profiles migration; change them together.
 */
export const PROFILE_LONG_MAX_LENGTH = 1000;

/**
 * Optional text: blank or whitespace-only input means "not set" and is stored
 * as null, so the database never holds an empty string and the UI never has
 * to distinguish "" from null.
 */
const optionalText = (max: number, label: string) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    },
    z.string().max(max, `${label} must be at most ${max} characters.`).nullable(),
  );

export const workspaceProfileSchema = z.object({
  niche: optionalText(PROFILE_SHORT_MAX_LENGTH, 'Niche'),
  description: optionalText(PROFILE_LONG_MAX_LENGTH, 'Description'),
  target_audience: optionalText(PROFILE_LONG_MAX_LENGTH, 'Target audience'),
  tone: optionalText(PROFILE_LONG_MAX_LENGTH, 'Tone'),
  writing_style: optionalText(PROFILE_LONG_MAX_LENGTH, 'Writing style'),
  content_goals: optionalText(PROFILE_LONG_MAX_LENGTH, 'Content goals'),
  restrictions: optionalText(PROFILE_LONG_MAX_LENGTH, 'Restrictions'),
});

export type WorkspaceProfileInput = z.infer<typeof workspaceProfileSchema>;

export type WorkspaceProfileFieldErrors = Partial<Record<keyof WorkspaceProfileInput, string>>;

/** Field order the form renders in; also the allow-list for error mapping. */
export const WORKSPACE_PROFILE_FIELDS = Object.keys(
  workspaceProfileSchema.shape,
) as (keyof WorkspaceProfileInput)[];

/**
 * Validates raw form input for the workspace profile.
 *
 * Takes `unknown` because the input is untrusted `FormData`. Unknown keys are
 * stripped by the object schema, so a client cannot smuggle `workspace_id` or
 * any other column through this path.
 */
export function validateWorkspaceProfile(
  input: unknown,
):
  | { success: true; data: WorkspaceProfileInput }
  | { success: false; fieldErrors: WorkspaceProfileFieldErrors } {
  const result = workspaceProfileSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const fieldErrors: WorkspaceProfileFieldErrors = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0];

    if (
      typeof field === 'string' &&
      (WORKSPACE_PROFILE_FIELDS as readonly string[]).includes(field) &&
      fieldErrors[field as keyof WorkspaceProfileInput] === undefined
    ) {
      fieldErrors[field as keyof WorkspaceProfileInput] = issue.message;
    }
  }

  return { success: false, fieldErrors };
}

/** True when every field is null: the profile has not been filled in yet. */
export function isWorkspaceProfileEmpty(profile: WorkspaceProfileInput): boolean {
  return WORKSPACE_PROFILE_FIELDS.every((field) => profile[field] === null);
}
