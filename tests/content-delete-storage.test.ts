import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createServerClient: vi.fn(),
  getWorkspaceForUser: vi.fn(),
  getContentInWorkspace: vi.fn(),
  deleteContentInWorkspace: vi.fn(),
  removeContentMedia: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  refresh: vi.fn(),
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
  ContentRepositoryError: class ContentRepositoryError extends Error {},
  getContentInWorkspace: mocks.getContentInWorkspace,
  deleteContentInWorkspace: mocks.deleteContentInWorkspace,
}));
vi.mock('@/server/storage/content-media', () => ({
  ContentMediaStorageError: class ContentMediaStorageError extends Error {},
  removeContentMedia: mocks.removeContentMedia,
}));

import { deleteContent } from '../apps/web/src/app/app/workspaces/[workspaceId]/content-actions.ts';
import { ContentMediaStorageError } from '../apps/web/src/server/storage/content-media.ts';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const CONTENT_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const PATH = `${WORKSPACE_ID}/${CONTENT_ID}/object.mp4`;
const USER = { id: 'user-1' };
const WORKSPACE = { id: WORKSPACE_ID, owner_id: USER.id, name: 'W', role: 'owner' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUser.mockResolvedValue(USER);
  mocks.createServerClient.mockResolvedValue({ marker: 'client' });
  mocks.getWorkspaceForUser.mockResolvedValue(WORKSPACE);
  mocks.getContentInWorkspace.mockResolvedValue({
    id: CONTENT_ID,
    workspace_id: WORKSPACE_ID,
    storage_key: PATH,
    storage_provider: 'supabase',
    media_status: 'available',
  });
  mocks.removeContentMedia.mockResolvedValue(true);
  mocks.deleteContentInWorkspace.mockResolvedValue(true);
});

describe('deleteContent with stored media', () => {
  it('removes and releases the object before deleting the content row', async () => {
    const order: string[] = [];
    mocks.removeContentMedia.mockImplementation(async () => {
      order.push('remove-media');
      return true;
    });
    mocks.deleteContentInWorkspace.mockImplementation(async () => {
      order.push('delete-content');
      return true;
    });

    await expect(deleteContent(WORKSPACE_ID, CONTENT_ID)).rejects.toThrow(
      'NEXT_REDIRECT:/app/workspaces/550e8400-e29b-41d4-a716-446655440000',
    );
    expect(order).toEqual(['remove-media', 'delete-content']);
    expect(mocks.removeContentMedia).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      CONTENT_ID,
      PATH,
    );
  });

  it('never deletes the content row when media cleanup fails', async () => {
    mocks.removeContentMedia.mockRejectedValue(
      new ContentMediaStorageError('storage failed', new Error('network')),
    );

    await expect(deleteContent(WORKSPACE_ID, CONTENT_ID)).rejects.toThrow(
      `NEXT_REDIRECT:/app/workspaces/${WORKSPACE_ID}/content/${CONTENT_ID}`,
    );
    expect(mocks.deleteContentInWorkspace).not.toHaveBeenCalled();
  });

  it('deletes directly when the content has no stored media', async () => {
    mocks.getContentInWorkspace.mockResolvedValue({
      id: CONTENT_ID,
      workspace_id: WORKSPACE_ID,
      storage_key: null,
      storage_provider: null,
      media_status: 'external_only',
    });

    await expect(deleteContent(WORKSPACE_ID, CONTENT_ID)).rejects.toThrow(
      `NEXT_REDIRECT:/app/workspaces/${WORKSPACE_ID}`,
    );
    expect(mocks.removeContentMedia).not.toHaveBeenCalled();
    expect(mocks.deleteContentInWorkspace).toHaveBeenCalledTimes(1);
  });

  it('does not inspect content or storage for a non-member', async () => {
    mocks.getWorkspaceForUser.mockResolvedValue(null);

    await expect(deleteContent(WORKSPACE_ID, CONTENT_ID)).rejects.toThrow(
      `NEXT_REDIRECT:/app/workspaces/${WORKSPACE_ID}/content/${CONTENT_ID}`,
    );
    expect(mocks.getContentInWorkspace).not.toHaveBeenCalled();
    expect(mocks.removeContentMedia).not.toHaveBeenCalled();
    expect(mocks.deleteContentInWorkspace).not.toHaveBeenCalled();
  });
});
