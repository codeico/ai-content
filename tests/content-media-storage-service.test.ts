import { describe, expect, it, vi } from 'vitest';

import {
  confirmContentMediaUpload,
  createContentMediaReadUrl,
  createContentMediaUploadTicket,
  removeContentMedia,
} from '../apps/web/src/server/storage/content-media.ts';
import type { Database } from '../packages/database/src/types/database.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const CONTENT_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const PATH = `${WORKSPACE_ID}/${CONTENT_ID}/object.mp4`;

describe('createContentMediaUploadTicket', () => {
  it('reserves an exact path without minting a long-lived upload capability', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: PATH, error: null });
    const from = vi.fn();
    const client = { rpc, storage: { from } } as unknown as SupabaseClient<Database>;

    const ticket = await createContentMediaUploadTicket(client, WORKSPACE_ID, CONTENT_ID, 'mp4');

    expect(rpc).toHaveBeenCalledWith('reserve_content_media', {
      target_workspace_id: WORKSPACE_ID,
      target_content_id: CONTENT_ID,
      file_extension: 'mp4',
    });
    expect(from).not.toHaveBeenCalled();
    expect(ticket).toEqual({ bucket: 'content-media', path: PATH });
    expect(ticket).not.toHaveProperty('token');
  });
});

describe('confirmContentMediaUpload', () => {
  it('asks the narrow RPC to verify the exact reserved object', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const client = { rpc } as unknown as SupabaseClient<Database>;

    await expect(confirmContentMediaUpload(client, WORKSPACE_ID, CONTENT_ID, PATH)).resolves.toBe(
      true,
    );
    expect(rpc).toHaveBeenCalledWith('confirm_content_media', {
      target_workspace_id: WORKSPACE_ID,
      target_content_id: CONTENT_ID,
      target_storage_key: PATH,
    });
  });

  it('returns false when the object does not exist yet', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    } as unknown as SupabaseClient<Database>;

    await expect(confirmContentMediaUpload(client, WORKSPACE_ID, CONTENT_ID, PATH)).resolves.toBe(
      false,
    );
  });
});

describe('createContentMediaReadUrl', () => {
  it('creates a 15-minute URL for the exact private object', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example/signed' },
      error: null,
    });
    const from = vi.fn().mockReturnValue({ createSignedUrl });
    const client = { storage: { from } } as unknown as SupabaseClient<Database>;

    await expect(createContentMediaReadUrl(client, PATH)).resolves.toBe(
      'https://storage.example/signed',
    );
    expect(from).toHaveBeenCalledWith('content-media');
    expect(createSignedUrl).toHaveBeenCalledWith(PATH, 900);
  });
});

describe('removeContentMedia', () => {
  it('removes bytes first, then releases the database reference', async () => {
    const events: string[] = [];
    const remove = vi.fn(async () => {
      events.push('remove');
      return { data: [{ name: PATH }], error: null };
    });
    const from = vi.fn().mockReturnValue({ remove });
    const rpc = vi.fn(async () => {
      events.push('release');
      return { data: true, error: null };
    });
    const client = { rpc, storage: { from } } as unknown as SupabaseClient<Database>;

    await expect(removeContentMedia(client, WORKSPACE_ID, CONTENT_ID, PATH)).resolves.toBe(true);
    expect(events).toEqual(['remove', 'release']);
    expect(remove).toHaveBeenCalledWith([PATH]);
    expect(rpc).toHaveBeenCalledWith('release_content_media', {
      target_workspace_id: WORKSPACE_ID,
      target_content_id: CONTENT_ID,
      expected_storage_key: PATH,
    });
  });

  it('does not clear the database reference when Storage remove fails', async () => {
    const rpc = vi.fn();
    const client = {
      rpc,
      storage: {
        from: vi.fn().mockReturnValue({
          remove: vi.fn().mockResolvedValue({ data: null, error: { message: 'failed' } }),
        }),
      },
    } as unknown as SupabaseClient<Database>;

    await expect(removeContentMedia(client, WORKSPACE_ID, CONTENT_ID, PATH)).rejects.toThrow(
      'Unable to remove content media.',
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});
