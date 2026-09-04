import { describe, expect, it, vi } from 'vitest';

import {
  performContentMediaUpload,
  uploadContentMediaFile,
} from '../apps/web/src/lib/storage/upload-content-media.ts';
import type { Database } from '../packages/database/src/types/database.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const PATH = 'workspace/content/object.mp4';
const TICKET = { bucket: 'content-media' as const, path: PATH, token: 'signed-token' };

describe('uploadContentMediaFile', () => {
  it('uploads bytes directly to the exact signed bucket/path without upsert', async () => {
    const uploadToSignedUrl = vi.fn().mockResolvedValue({
      data: { path: PATH, fullPath: `content-media/${PATH}` },
      error: null,
    });
    const from = vi.fn().mockReturnValue({ uploadToSignedUrl });
    const client = { storage: { from } } as unknown as SupabaseClient<Database>;
    const file = new Blob(['video-bytes'], { type: 'video/mp4' });

    await expect(uploadContentMediaFile(client, TICKET, file)).resolves.toBeUndefined();

    expect(from).toHaveBeenCalledWith('content-media');
    expect(uploadToSignedUrl).toHaveBeenCalledWith(PATH, 'signed-token', file, {
      contentType: 'video/mp4',
      upsert: false,
    });
  });

  it('rejects when Storage refuses the upload', async () => {
    const uploadToSignedUrl = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Asset Already Exists' },
    });
    const client = {
      storage: { from: vi.fn().mockReturnValue({ uploadToSignedUrl }) },
    } as unknown as SupabaseClient<Database>;

    await expect(
      uploadContentMediaFile(client, TICKET, new Blob(['x'], { type: 'video/mp4' })),
    ).rejects.toThrow('Unable to upload content media.');
  });
});

describe('performContentMediaUpload', () => {
  const file = Object.assign(new Blob(['video'], { type: 'video/mp4' }), {
    name: 'clip.mp4',
  });

  it('requests a ticket, uploads bytes, then confirms the same path in order', async () => {
    const events: string[] = [];
    const requestTicket = vi.fn(async () => {
      events.push('ticket');
      return TICKET;
    });
    const upload = vi.fn(async () => {
      events.push('upload');
    });
    const confirm = vi.fn(async () => {
      events.push('confirm');
      return { ok: true as const };
    });

    await expect(
      performContentMediaUpload(file, { requestTicket, upload, confirm }),
    ).resolves.toEqual({ ok: true });

    expect(events).toEqual(['ticket', 'upload', 'confirm']);
    expect(requestTicket).toHaveBeenCalledWith({
      name: 'clip.mp4',
      type: 'video/mp4',
      size: file.size,
    });
    expect(upload).toHaveBeenCalledWith(TICKET, file);
    expect(confirm).toHaveBeenCalledWith(PATH);
  });

  it('does not upload or confirm when ticket creation fails', async () => {
    const upload = vi.fn();
    const confirm = vi.fn();
    const result = await performContentMediaUpload(file, {
      requestTicket: vi.fn().mockResolvedValue({ error: 'No access.' }),
      upload,
      confirm,
    });
    expect(result).toEqual({ error: 'No access.' });
    expect(upload).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not confirm when the byte upload fails', async () => {
    const confirm = vi.fn();
    await expect(
      performContentMediaUpload(file, {
        requestTicket: vi.fn().mockResolvedValue(TICKET),
        upload: vi.fn().mockRejectedValue(new Error('network failed')),
        confirm,
      }),
    ).resolves.toEqual({ error: 'Upload failed. Check your connection and try again.' });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('turns a rejected ticket request into a retryable message', async () => {
    await expect(
      performContentMediaUpload(file, {
        requestTicket: vi.fn().mockRejectedValue(new Error('network failed')),
        upload: vi.fn(),
        confirm: vi.fn(),
      }),
    ).resolves.toEqual({ error: 'Unable to prepare the upload. Try again.' });
  });

  it('turns a rejected confirmation into a retryable message', async () => {
    await expect(
      performContentMediaUpload(file, {
        requestTicket: vi.fn().mockResolvedValue(TICKET),
        upload: vi.fn().mockResolvedValue(undefined),
        confirm: vi.fn().mockRejectedValue(new Error('network failed')),
      }),
    ).resolves.toEqual({ error: 'Upload finished but confirmation failed. Try again.' });
  });
});
