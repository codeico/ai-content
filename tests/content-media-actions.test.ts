import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createServerClient: vi.fn(),
  getWorkspaceForUser: vi.fn(),
  getContentInWorkspace: vi.fn(),
  createContentMediaUploadTicket: vi.fn(),
  confirmContentMediaUpload: vi.fn(),
  removeContentMedia: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/cache', () => ({ refresh: mocks.refresh }));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: mocks.createServerClient,
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));
vi.mock('@/server/repositories/workspace-repository', () => ({
  getWorkspaceForUser: mocks.getWorkspaceForUser,
}));
vi.mock('@/server/repositories/content-repository', () => ({
  getContentInWorkspace: mocks.getContentInWorkspace,
}));
vi.mock('@/server/storage/content-media', () => ({
  ContentMediaStorageError: class ContentMediaStorageError extends Error {},
  createContentMediaUploadTicket: mocks.createContentMediaUploadTicket,
  confirmContentMediaUpload: mocks.confirmContentMediaUpload,
  removeContentMedia: mocks.removeContentMedia,
}));

import {
  confirmContentMedia,
  removeContentMediaUpload,
  requestContentMediaUpload,
} from '../apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/media-actions.ts';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const CONTENT_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const PATH = `${WORKSPACE_ID}/${CONTENT_ID}/object.mp4`;
const USER = { id: 'user-1' };
const WORKSPACE = { id: WORKSPACE_ID, owner_id: USER.id, name: 'W', role: 'owner' };
const CONTENT = {
  id: CONTENT_ID,
  workspace_id: WORKSPACE_ID,
  media_status: 'external_only',
  storage_key: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUser.mockResolvedValue(USER);
  mocks.createServerClient.mockResolvedValue({ marker: 'client' });
  mocks.getWorkspaceForUser.mockResolvedValue(WORKSPACE);
  mocks.getContentInWorkspace.mockResolvedValue(CONTENT);
  mocks.createContentMediaUploadTicket.mockResolvedValue({
    bucket: 'content-media',
    path: PATH,
    token: 'upload-token',
  });
  mocks.confirmContentMediaUpload.mockResolvedValue(true);
});

describe('requestContentMediaUpload', () => {
  it('validates metadata and returns a signed ticket only after membership and content checks', async () => {
    await expect(
      requestContentMediaUpload(WORKSPACE_ID, CONTENT_ID, {
        name: 'clip.mp4',
        type: 'video/mp4',
        size: 1_000,
      }),
    ).resolves.toEqual({ bucket: 'content-media', path: PATH, token: 'upload-token' });

    expect(mocks.getWorkspaceForUser).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      USER.id,
    );
    expect(mocks.getContentInWorkspace).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      CONTENT_ID,
    );
    expect(mocks.createContentMediaUploadTicket).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      CONTENT_ID,
      'mp4',
    );
  });

  it('rejects invalid metadata before constructing a database client', async () => {
    await expect(
      requestContentMediaUpload(WORKSPACE_ID, CONTENT_ID, {
        name: 'payload.html',
        type: 'text/html',
        size: 12,
      }),
    ).resolves.toEqual({ error: 'Choose an MP4 or MOV video.' });
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.createContentMediaUploadTicket).not.toHaveBeenCalled();
  });

  it('does not mint a ticket for a non-member', async () => {
    mocks.getWorkspaceForUser.mockResolvedValue(null);
    await expect(
      requestContentMediaUpload(WORKSPACE_ID, CONTENT_ID, {
        name: 'clip.mp4',
        type: 'video/mp4',
        size: 1_000,
      }),
    ).resolves.toEqual({ error: 'You do not have access to this content.' });
    expect(mocks.getContentInWorkspace).not.toHaveBeenCalled();
    expect(mocks.createContentMediaUploadTicket).not.toHaveBeenCalled();
  });

  it('does not mint a ticket for content outside the bound workspace', async () => {
    mocks.getContentInWorkspace.mockResolvedValue(null);
    await expect(
      requestContentMediaUpload(WORKSPACE_ID, CONTENT_ID, {
        name: 'clip.mp4',
        type: 'video/mp4',
        size: 1_000,
      }),
    ).resolves.toEqual({ error: 'You do not have access to this content.' });
    expect(mocks.createContentMediaUploadTicket).not.toHaveBeenCalled();
  });
});

describe('confirmContentMedia', () => {
  it('confirms the exact ticket path after repeating membership and content checks', async () => {
    await expect(confirmContentMedia(WORKSPACE_ID, CONTENT_ID, PATH)).resolves.toEqual({
      ok: true,
    });
    expect(mocks.confirmContentMediaUpload).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      CONTENT_ID,
      PATH,
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('rejects a path outside the bound workspace/content without touching storage', async () => {
    await expect(
      confirmContentMedia(WORKSPACE_ID, CONTENT_ID, `${WORKSPACE_ID}/other/object.mp4`),
    ).resolves.toEqual({ error: 'You do not have access to this content.' });
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.confirmContentMediaUpload).not.toHaveBeenCalled();
  });

  it('reports an object that Storage has not committed yet', async () => {
    mocks.confirmContentMediaUpload.mockResolvedValue(false);
    await expect(confirmContentMedia(WORKSPACE_ID, CONTENT_ID, PATH)).resolves.toEqual({
      error: 'Upload is not available yet. Try again.',
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe('removeContentMediaUpload', () => {
  it('derives the key from the authorised row, removes it and refreshes', async () => {
    mocks.getContentInWorkspace.mockResolvedValue({ ...CONTENT, storage_key: PATH });
    mocks.removeContentMedia.mockResolvedValue(true);

    await expect(removeContentMediaUpload(WORKSPACE_ID, CONTENT_ID)).resolves.toEqual({ ok: true });
    expect(mocks.removeContentMedia).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      CONTENT_ID,
      PATH,
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('returns no access for a non-member before reading content', async () => {
    mocks.getWorkspaceForUser.mockResolvedValue(null);

    await expect(removeContentMediaUpload(WORKSPACE_ID, CONTENT_ID)).resolves.toEqual({
      error: 'You do not have access to this content.',
    });
    expect(mocks.getContentInWorkspace).not.toHaveBeenCalled();
    expect(mocks.removeContentMedia).not.toHaveBeenCalled();
  });

  it('returns a stable error when the row has no storage key', async () => {
    await expect(removeContentMediaUpload(WORKSPACE_ID, CONTENT_ID)).resolves.toEqual({
      error: 'No stored video to remove.',
    });
    expect(mocks.removeContentMedia).not.toHaveBeenCalled();
  });
});
