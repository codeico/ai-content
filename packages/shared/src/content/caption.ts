/**
 * Caption domain primitives, shared by the repository, Server Actions and the
 * page. Same split as ./content.ts: constants that the migration mirrors in
 * CHECK constraints live here so a test can assert they agree.
 */
import { z } from 'zod';

/**
 * Lifecycle of one caption version. Must match the CHECK in
 * supabase/migrations/20260903130000_create_captions.sql.
 *
 *   draft    — generated, not chosen
 *   active   — the one caption this content currently uses (at most one)
 *   archived — superseded; kept because regenerate never deletes (§17)
 */
export const CAPTION_STATUSES = ['draft', 'active', 'archived'] as const;

export type CaptionStatus = (typeof CAPTION_STATUSES)[number];

/**
 * Instagram's own caption limit is 2200. The cap is looser so a model that
 * overshoots produces a visible, editable draft rather than a silent
 * truncation or a rejected insert. Mirrored by a CHECK constraint.
 */
export const CAPTION_BODY_MAX_LENGTH = 4000;

/** Route/param ids are attacker-controlled; reject non-UUIDs before any query. */
export const captionIdSchema = z.uuid();

/**
 * What a model response must look like to be stored. Trimmed; blank means the
 * generation failed and nothing is inserted (the DB refuses blank too).
 */
export const captionBodySchema = z
  .string()
  .trim()
  .min(1, 'The model returned an empty caption.')
  .max(CAPTION_BODY_MAX_LENGTH, `Caption exceeded ${CAPTION_BODY_MAX_LENGTH} characters.`);
