/**
 * Content validation primitives. Same split as ../workspace/workspace.ts:
 * shared so browser and Server Actions run identical rules; the server never
 * trusts the browser, and RLS is the final backstop.
 */
import { z } from 'zod';

/** Same reasoning as WORKSPACE_NAME_MAX_LENGTH: a bound, not a product rule. */
export const CONTENT_TITLE_MAX_LENGTH = 200;

/**
 * Phase 3 lifecycle. Must match the CHECK constraint in
 * supabase/migrations/20260902100000_create_content.sql. Do not add
 * automation states here (docs/PHASE_3_PROMPT.md §8).
 */
export const CONTENT_STATUSES = ['draft', 'ready', 'archived'] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const contentTitleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required.')
  .max(CONTENT_TITLE_MAX_LENGTH, `Title must be at most ${CONTENT_TITLE_MAX_LENGTH} characters.`);

export const contentStatusSchema = z.enum(CONTENT_STATUSES, {
  error: 'Status must be draft, ready, or archived.',
});

/** Route/param ids are attacker-controlled; reject non-UUIDs before any query. */
export const contentIdSchema = z.uuid();

export const createContentSchema = z.object({
  title: contentTitleSchema,
});

export const updateContentSchema = z.object({
  title: contentTitleSchema,
  status: contentStatusSchema,
});

export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;

export type ContentFieldErrors = Partial<Record<keyof UpdateContentInput, string>>;

type Validation<T> =
  { success: true; data: T } | { success: false; fieldErrors: ContentFieldErrors };

function toFieldErrors(issues: z.core.$ZodIssue[]): ContentFieldErrors {
  const fieldErrors: ContentFieldErrors = {};

  for (const issue of issues) {
    const field = issue.path[0];

    // First message per field only.
    if ((field === 'title' || field === 'status') && fieldErrors[field] === undefined) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

export function validateCreateContent(input: unknown): Validation<CreateContentInput> {
  const result = createContentSchema.safeParse(input);

  return result.success
    ? { success: true, data: result.data }
    : { success: false, fieldErrors: toFieldErrors(result.error.issues) };
}

export function validateUpdateContent(input: unknown): Validation<UpdateContentInput> {
  const result = updateContentSchema.safeParse(input);

  return result.success
    ? { success: true, data: result.data }
    : { success: false, fieldErrors: toFieldErrors(result.error.issues) };
}
