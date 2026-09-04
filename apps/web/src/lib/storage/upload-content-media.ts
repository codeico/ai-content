import type { Database } from '@ai-content/database/client';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ContentMediaUploadTicket } from '@/server/storage/content-media';

export class ContentMediaUploadError extends Error {
  constructor(public override readonly cause: unknown) {
    super('Unable to upload content media.');
    this.name = 'ContentMediaUploadError';
  }
}

/**
 * Browser-side byte transfer. The file goes directly to Supabase Storage;
 * Next.js only issued the signed token and never receives the payload.
 */
export async function uploadContentMediaFile(
  supabase: SupabaseClient<Database>,
  ticket: ContentMediaUploadTicket,
  file: Blob,
): Promise<void> {
  const { error } = await supabase.storage.from(ticket.bucket).upload(ticket.path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new ContentMediaUploadError(error);
  }
}

interface ContentMediaUploadOperations {
  requestTicket: (input: {
    name: string;
    type: string;
    size: number;
  }) => Promise<ContentMediaUploadTicket | { error: string }>;
  upload: (ticket: ContentMediaUploadTicket, file: Blob) => Promise<void>;
  confirm: (path: string) => Promise<{ ok: true } | { error: string }>;
}

/**
 * One ordered browser transaction: metadata authorisation, direct byte
 * transfer, server confirmation. Dependencies are explicit so the ordering
 * and failure boundaries are testable without pretending a mock is Storage.
 */
export async function performContentMediaUpload(
  file: Blob & { name: string },
  operations: ContentMediaUploadOperations,
): Promise<{ ok: true } | { error: string }> {
  let ticket: ContentMediaUploadTicket | { error: string };

  try {
    ticket = await operations.requestTicket({
      name: file.name,
      type: file.type,
      size: file.size,
    });
  } catch {
    return { error: 'Unable to prepare the upload. Try again.' };
  }

  if ('error' in ticket) {
    return ticket;
  }

  try {
    await operations.upload(ticket, file);
  } catch {
    // A network error may mean Storage committed the object but its response was
    // lost. Confirming the exact reserved path is safe and idempotent; if the
    // object is absent the server returns an error and the normal retry remains.
    try {
      const recovered = await operations.confirm(ticket.path);
      if ('ok' in recovered) return recovered;
    } catch {
      // Preserve the upload failure below; confirmation is best-effort recovery.
    }

    return { error: 'Upload failed. Check your connection and try again.' };
  }

  try {
    return await operations.confirm(ticket.path);
  } catch {
    return { error: 'Upload finished but confirmation failed. Try again.' };
  }
}
