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

/**
 * Phase 6 provenance. Neutral labels only: no value implies an integration.
 * Must match the CHECK in supabase/migrations/20260903100000_add_content_source_media.sql.
 */
export const CONTENT_SOURCE_TYPES = [
  'tiktok',
  'instagram',
  'youtube',
  'upload',
  'url',
  'other',
] as const;

export type ContentSourceType = (typeof CONTENT_SOURCE_TYPES)[number];

/**
 * Phase 6 media lifecycle, independent of `status`. Only `external_only` can
 * be produced by the product today; `available` needs a storage phase and
 * `missing` is an owner assertion. Must match the same migration's CHECK.
 */
export const MEDIA_STATUSES = ['external_only', 'available', 'missing'] as const;

export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const CONTENT_SOURCE_URL_MAX_LENGTH = 2048;
export const CONTENT_EXTERNAL_ID_MAX_LENGTH = 200;

export const contentSourceTypeSchema = z.enum(CONTENT_SOURCE_TYPES, {
  error: 'Choose a source type.',
});

/**
 * http(s) only. `z.url()` alone would accept `javascript:` and `data:`; the
 * protocol allow-list is the XSS gate, and the migration repeats it in SQL.
 * An empty string means "no link" and normalises to null.
 */
export const contentSourceUrlSchema = z
  .string()
  .trim()
  .max(CONTENT_SOURCE_URL_MAX_LENGTH, 'Link is too long.')
  .transform((value) => (value === '' ? null : value))
  .pipe(
    z
      .url({ protocol: /^https?$/, error: 'Enter a full link starting with https://' })
      // Canonical form: lowercases scheme and host so the SQL check
      // (`^https?://`) and any future dedupe see one spelling per link.
      .transform((value) => new URL(value).href)
      .nullable(),
  );

export const contentExternalIdSchema = z
  .string()
  .trim()
  .max(CONTENT_EXTERNAL_ID_MAX_LENGTH, 'Identifier is too long.')
  .transform((value) => (value === '' ? null : value));

/**
 * What the owner may assert about media. Zod accepts every lifecycle value so
 * a row that a storage phase has marked `available` can still have its link
 * edited; the Server Action refuses any *transition into* `available`, and
 * the database refuses `available` without a storage key regardless.
 */
export const mediaStatusSchema = z.enum(MEDIA_STATUSES, {
  error: 'Availability must be external only, available, or missing.',
});

/** The subset an owner can choose in the UI; `available` is system-set. */
export const OWNER_SETTABLE_MEDIA_STATUSES = [
  'external_only',
  'missing',
] as const satisfies readonly MediaStatus[];

/**
 * Author-written summary of the content, fed to the caption prompt.
 *
 * A bound, not a product rule: long enough for a real summary, short enough
 * that one row cannot dominate a model request. Mirrored by a CHECK in
 * 20260903160000_add_content_description.sql.
 */
export const CONTENT_DESCRIPTION_MAX_LENGTH = 2000;

/** Blank means "not described"; stored as null rather than an empty string. */
export const contentDescriptionSchema = z
  .string()
  .trim()
  .max(CONTENT_DESCRIPTION_MAX_LENGTH, 'Description is too long.')
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

/** Route/param ids are attacker-controlled; reject non-UUIDs before any query. */
export const contentIdSchema = z.uuid();

/**
 * A pagination cursor as it arrives in the query string.
 *
 * The cursor is user input that becomes part of a PostgREST filter expression,
 * so it is validated to exactly the shape the sort key has: an ISO timestamp
 * and a UUID. Anything else — a typo, a stale bookmark, an injection attempt —
 * is rejected here and the caller falls back to the first page rather than
 * failing the whole request.
 */
export const contentCursorSchema = z.object({
  created_at: z.string().datetime({ offset: true }),
  id: z.uuid(),
});

export type ContentCursorInput = z.infer<typeof contentCursorSchema>;

/**
 * Parses a cursor pair, returning null for anything malformed.
 *
 * Null means "start from the newest", which is what a user with a broken link
 * wants: the list they were looking at, not an error page.
 */
export function parseContentCursor(createdAt: unknown, id: unknown): ContentCursorInput | null {
  const parsed = contentCursorSchema.safeParse({ created_at: createdAt, id });
  return parsed.success ? parsed.data : null;
}

export const createContentSchema = z.object({
  title: contentTitleSchema,
});

export const updateContentSchema = z.object({
  title: contentTitleSchema,
  status: contentStatusSchema,
  // Optional at the boundary: a caller that omits it means "not described",
  // the same as sending blank. Prevents an older form or a partial payload
  // from failing validation on a field it never knew about.
  description: contentDescriptionSchema.optional().default(null),
});

/**
 * Source and media assertions edited together in one form. Storage fields are
 * absent on purpose: no code path may set storage_provider/storage_key in
 * this phase, so they are not even representable as input.
 */
export const updateContentSourceSchema = z.object({
  source_type: contentSourceTypeSchema,
  source_url: contentSourceUrlSchema,
  external_id: contentExternalIdSchema,
  media_status: mediaStatusSchema,
});

export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
export type UpdateContentSourceInput = z.infer<typeof updateContentSourceSchema>;

export type ContentFieldErrors = Partial<Record<keyof UpdateContentInput, string>>;
export type ContentSourceFieldErrors = Partial<Record<keyof UpdateContentSourceInput, string>>;

type Validation<T, E> = { success: true; data: T } | { success: false; fieldErrors: E };

/**
 * First message per field, for the fields the schema actually has. Deriving
 * the allow-list from the schema (rather than hard-coding names) means a new
 * field cannot silently lose its error message.
 */
function toFieldErrors<K extends string>(
  issues: z.core.$ZodIssue[],
  fields: readonly K[],
): Partial<Record<K, string>> {
  const fieldErrors: Partial<Record<K, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (
      typeof field === 'string' &&
      (fields as readonly string[]).includes(field) &&
      fieldErrors[field as K] === undefined
    ) {
      fieldErrors[field as K] = issue.message;
    }
  }

  return fieldErrors;
}

const CONTENT_FIELDS = Object.keys(updateContentSchema.shape) as (keyof UpdateContentInput)[];
const CONTENT_SOURCE_FIELDS = Object.keys(
  updateContentSourceSchema.shape,
) as (keyof UpdateContentSourceInput)[];

export function validateCreateContent(
  input: unknown,
): Validation<CreateContentInput, ContentFieldErrors> {
  const result = createContentSchema.safeParse(input);

  return result.success
    ? { success: true, data: result.data }
    : { success: false, fieldErrors: toFieldErrors(result.error.issues, CONTENT_FIELDS) };
}

export function validateUpdateContent(
  input: unknown,
): Validation<UpdateContentInput, ContentFieldErrors> {
  const result = updateContentSchema.safeParse(input);

  return result.success
    ? { success: true, data: result.data }
    : { success: false, fieldErrors: toFieldErrors(result.error.issues, CONTENT_FIELDS) };
}

export function validateUpdateContentSource(
  input: unknown,
): Validation<UpdateContentSourceInput, ContentSourceFieldErrors> {
  const result = updateContentSourceSchema.safeParse(input);

  return result.success
    ? { success: true, data: result.data }
    : {
        success: false,
        fieldErrors: toFieldErrors(result.error.issues, CONTENT_SOURCE_FIELDS),
      };
}
