import type { Database } from '@ai-content/database/client';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ContentMediaFile } from '@ai-content/shared/content';

export const CONTENT_MEDIA_BUCKET = 'content-media';

export interface ContentMediaUploadTicket {
  bucket: typeof CONTENT_MEDIA_BUCKET;
  path: string;
}

export class ContentMediaStorageError extends Error {
  constructor(
    message: string,
    public override readonly cause: unknown,
  ) {
    super(message);
    this.name = 'ContentMediaStorageError';
  }
}

/**
 * Reserve an immutable key in Postgres. The browser uploads to that path with
 * its existing authenticated Supabase session, so the exact-key INSERT policy
 * is checked at upload time. No long-lived bearer upload capability is minted.
 *
 * File bytes never cross this server; the response contains only the private
 * bucket identifier and server-generated path.
 */
export async function createContentMediaUploadTicket(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  contentId: string,
  extension: ContentMediaFile['extension'],
): Promise<ContentMediaUploadTicket> {
  const { data: path, error: reserveError } = await supabase.rpc('reserve_content_media', {
    target_workspace_id: workspaceId,
    target_content_id: contentId,
    file_extension: extension,
  });

  if (reserveError || !path) {
    throw new ContentMediaStorageError('Unable to reserve content media.', reserveError);
  }

  return { bucket: CONTENT_MEDIA_BUCKET, path };
}

/**
 * Atomically mark a reservation available, but only when Storage's catalogue
 * contains the exact object. The SQL function owns both the existence check
 * and transition, avoiding a check-then-update race in application code.
 */
export async function confirmContentMediaUpload(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  contentId: string,
  path: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('confirm_content_media', {
    target_workspace_id: workspaceId,
    target_content_id: contentId,
    target_storage_key: path,
  });

  if (error) {
    throw new ContentMediaStorageError('Unable to confirm content media.', error);
  }

  return data;
}

/**
 * Remove bytes through the Storage API, then clear the database reference.
 * This order is non-negotiable: deleting storage.objects with SQL leaves the
 * bytes orphaned, while clearing content first loses the only durable key.
 */
/** Short-lived member preview; publish attempts will mint their own URL. */
export const CONTENT_MEDIA_READ_TTL_S = 15 * 60;

export async function createContentMediaReadUrl(
  supabase: SupabaseClient<Database>,
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CONTENT_MEDIA_BUCKET)
    .createSignedUrl(path, CONTENT_MEDIA_READ_TTL_S);

  if (error || !data) {
    throw new ContentMediaStorageError('Unable to create content media URL.', error);
  }

  return data.signedUrl;
}

export async function removeContentMedia(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  contentId: string,
  path: string,
): Promise<boolean> {
  const { error: removeError } = await supabase.storage.from(CONTENT_MEDIA_BUCKET).remove([path]);

  if (removeError) {
    throw new ContentMediaStorageError('Unable to remove content media.', removeError);
  }

  const { data, error: releaseError } = await supabase.rpc('release_content_media', {
    target_workspace_id: workspaceId,
    target_content_id: contentId,
    expected_storage_key: path,
  });

  if (releaseError) {
    throw new ContentMediaStorageError('Unable to release content media.', releaseError);
  }

  return data;
}
