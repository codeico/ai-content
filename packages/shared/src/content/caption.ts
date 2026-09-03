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

/**
 * How many versions one content item may accumulate.
 *
 * Every generate is a real, paid model call, and the button being disabled
 * while pending is cosmetic: a direct Server Action POST ignores it. Without a
 * ceiling any member can loop spend against the workspace's router key. Twenty
 * drafts is far more than anyone needs to pick a caption, so the cap costs
 * nothing in practice and bounds the damage.
 *
 * Not a rate limit. A real one needs shared state this app does not have yet
 * (Redis is queue-only today); this bounds total spend per content item, not
 * the rate of it.
 *
 * Scope, stated plainly: this is an APPLICATION bound, checked in
 * generateCaption/editCaption. The captions INSERT policy
 * (20260903130000) checks workspace membership only, so a member using the
 * anon key directly can still insert past it. That costs them nothing and
 * spends none of our model budget — the paid call happens in the action the
 * cap guards — so the bound does what it was added for. Enforcing a count in
 * the database would need a trigger counting siblings on every insert; worth
 * doing when a row's existence (not its generation) starts costing something.
 */
export const CAPTION_MAX_VERSIONS = 20;

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
