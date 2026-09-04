import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createServerClient: vi.fn(),
  getWorkspaceForUser: vi.fn(),
  countStoredMediaForWorkspace: vi.fn(),
  deleteWorkspaceAsOwner: vi.fn(),
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
vi.mock('@/server/repositories/content-repository', () => ({
  countStoredMediaForWorkspace: mocks.countStoredMediaForWorkspace,
}));
vi.mock('@/server/repositories/workspace-repository', () => ({
  WorkspaceRepositoryError: class WorkspaceRepositoryError extends Error {},
  createWorkspaceForUser: vi.fn(),
  renameWorkspaceAsOwner: vi.fn(),
  getWorkspaceForUser: mocks.getWorkspaceForUser,
  deleteWorkspaceAsOwner: mocks.deleteWorkspaceAsOwner,
}));
vi.mock('@/server/repositories/workspace-profile-repository', () => ({
  WorkspaceProfileRepositoryError: class WorkspaceProfileRepositoryError extends Error {},
  upsertProfileAsOwner: vi.fn(),
}));

import { deleteWorkspace } from '../apps/web/src/app/app/workspace-actions.ts';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER = { id: 'user-1' };
const WORKSPACE = { id: WORKSPACE_ID, owner_id: USER.id, role: 'owner' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUser.mockResolvedValue(USER);
  mocks.createServerClient.mockResolvedValue({ marker: 'client' });
  mocks.getWorkspaceForUser.mockResolvedValue(WORKSPACE);
  mocks.countStoredMediaForWorkspace.mockResolvedValue(0);
  mocks.deleteWorkspaceAsOwner.mockResolvedValue(true);
});

describe('deleteWorkspace stored-media guard', () => {
  it('refuses before DELETE when any child content still owns media', async () => {
    mocks.countStoredMediaForWorkspace.mockResolvedValue(1);

    await expect(deleteWorkspace(WORKSPACE_ID)).rejects.toThrow(
      `NEXT_REDIRECT:/app/workspaces/${WORKSPACE_ID}`,
    );
    expect(mocks.deleteWorkspaceAsOwner).not.toHaveBeenCalled();
  });

  it('deletes an owned workspace once no stored media remains', async () => {
    await expect(deleteWorkspace(WORKSPACE_ID)).rejects.toThrow('NEXT_REDIRECT:/app');
    expect(mocks.deleteWorkspaceAsOwner).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      USER.id,
    );
  });

  it('refuses non-owners before counting media', async () => {
    mocks.getWorkspaceForUser.mockResolvedValue({ ...WORKSPACE, role: 'member' });

    await expect(deleteWorkspace(WORKSPACE_ID)).rejects.toThrow(
      `NEXT_REDIRECT:/app/workspaces/${WORKSPACE_ID}`,
    );
    expect(mocks.countStoredMediaForWorkspace).not.toHaveBeenCalled();
    expect(mocks.deleteWorkspaceAsOwner).not.toHaveBeenCalled();
  });
});
