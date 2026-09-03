import { captionIdSchema } from '@ai-content/shared/content/caption';
import { contentIdSchema } from '@ai-content/shared/content';
import { workspaceIdSchema } from '@ai-content/shared/workspace';

/**
 * Route-id guards for Server Actions.
 *
 * Pages validate ids before querying; actions did not. Ids arrive via `.bind`
 * inside an encrypted action reference, but a direct POST can carry anything,
 * and a malformed id reached Postgres and raised 22P02 (verified against the
 * linked database) — an unhandled 500 rather than a clean refusal.
 *
 * The refusal deliberately reuses the same wording the not-found path uses, so
 * the shape of an id teaches a caller nothing, and never echoes the rejected
 * value back.
 */

/** Same sentence the membership miss returns, so the two are indistinguishable. */
export const NO_ACCESS = 'You do not have access to this workspace.';

/** Same sentence a real missing row returns. */
export const CONTENT_NOT_FOUND = 'Content not found.';
export const CAPTION_NOT_FOUND = 'Caption not found.';

export function isWorkspaceId(value: string): boolean {
  return workspaceIdSchema.safeParse(value).success;
}

export function isContentId(value: string): boolean {
  return contentIdSchema.safeParse(value).success;
}

export function isCaptionId(value: string): boolean {
  return captionIdSchema.safeParse(value).success;
}
