import { describe, expect, it } from 'vitest';

import * as repository from '../apps/web/src/server/repositories/workspace-profile-repository.ts';
import {
  getProfileForWorkspace,
  upsertProfileAsOwner,
  WorkspaceProfileRepositoryError,
} from '../apps/web/src/server/repositories/workspace-profile-repository.ts';
import { createMockClient, MockQueryBuilder } from './helpers/mock-supabase.ts';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const PATCH = {
  niche: 'home cooking',
  description: null,
  target_audience: 'students',
  tone: null,
  writing_style: null,
  content_goals: null,
  restrictions: 'no alcohol',
};

const ROW = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  workspace_id: WORKSPACE_ID,
  ...PATCH,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('getProfileForWorkspace', () => {
  it('scopes the read by workspace id and returns the row', async () => {
    const builder = new MockQueryBuilder({ data: ROW, error: null });
    const { client, from } = createMockClient({ workspace_profiles: builder });

    const result = await getProfileForWorkspace(client, WORKSPACE_ID);

    expect(from).toHaveBeenCalledWith('workspace_profiles');
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['workspace_id', WORKSPACE_ID] });
    expect(builder.calls).toContainEqual({ method: 'maybeSingle', args: [] });
    expect(result).toEqual(ROW);
  });

  it('returns null when the workspace has no profile yet', async () => {
    const { client } = createMockClient({
      workspace_profiles: new MockQueryBuilder({ data: null, error: null }),
    });

    expect(await getProfileForWorkspace(client, WORKSPACE_ID)).toBeNull();
  });

  it('wraps driver errors without leaking them', async () => {
    const { client } = createMockClient({
      workspace_profiles: new MockQueryBuilder({ data: null, error: { message: 'boom' } }),
    });

    await expect(getProfileForWorkspace(client, WORKSPACE_ID)).rejects.toBeInstanceOf(
      WorkspaceProfileRepositoryError,
    );
  });
});

describe('upsertProfileAsOwner', () => {
  it('checks ownership on workspaces before writing, then upserts keyed on workspace_id', async () => {
    const workspaces = new MockQueryBuilder({ data: { id: WORKSPACE_ID }, error: null });
    const profiles = new MockQueryBuilder({ data: ROW, error: null });
    const { client, from } = createMockClient({ workspaces, workspace_profiles: profiles });

    const result = await upsertProfileAsOwner(client, WORKSPACE_ID, OWNER_ID, PATCH);

    expect(from.mock.calls.map((c) => c[0])).toEqual(['workspaces', 'workspace_profiles']);
    expect(workspaces.calls).toContainEqual({ method: 'eq', args: ['id', WORKSPACE_ID] });
    expect(workspaces.calls).toContainEqual({ method: 'eq', args: ['owner_id', OWNER_ID] });

    const upsert = profiles.calls.find((c) => c.method === 'upsert');
    expect(upsert?.args).toEqual([
      { ...PATCH, workspace_id: WORKSPACE_ID },
      { onConflict: 'workspace_id' },
    ]);
    expect(result).toEqual(ROW);
  });

  it('returns null and never touches workspace_profiles when the actor is not the owner', async () => {
    const workspaces = new MockQueryBuilder({ data: null, error: null });
    const profiles = new MockQueryBuilder({ data: ROW, error: null });
    const { client, from } = createMockClient({ workspaces, workspace_profiles: profiles });

    const result = await upsertProfileAsOwner(client, WORKSPACE_ID, OWNER_ID, PATCH);

    expect(result).toBeNull();
    expect(from.mock.calls.map((c) => c[0])).toEqual(['workspaces']);
    expect(profiles.calls).toEqual([]);
  });

  it('pins workspace_id to the verified argument even if the patch smuggles one', async () => {
    const workspaces = new MockQueryBuilder({ data: { id: WORKSPACE_ID }, error: null });
    const profiles = new MockQueryBuilder({ data: ROW, error: null });
    const { client } = createMockClient({ workspaces, workspace_profiles: profiles });

    // The type forbids this; the cast simulates a caller that bypassed Zod.
    const tampered = { ...PATCH, workspace_id: OTHER_WORKSPACE_ID, id: 'evil' } as typeof PATCH;

    await upsertProfileAsOwner(client, WORKSPACE_ID, OWNER_ID, tampered);

    const payload = profiles.calls.find((c) => c.method === 'upsert')?.args[0] as Record<
      string,
      unknown
    >;
    expect(payload.workspace_id).toBe(WORKSPACE_ID);
    expect(payload.workspace_id).not.toBe(OTHER_WORKSPACE_ID);
  });

  it('wraps a CHECK violation on write as a repository error', async () => {
    const workspaces = new MockQueryBuilder({ data: { id: WORKSPACE_ID }, error: null });
    const profiles = new MockQueryBuilder({
      data: null,
      error: { code: '23514', message: 'violates check constraint' },
    });
    const { client } = createMockClient({ workspaces, workspace_profiles: profiles });

    await expect(
      upsertProfileAsOwner(client, WORKSPACE_ID, OWNER_ID, PATCH),
    ).rejects.toBeInstanceOf(WorkspaceProfileRepositoryError);
  });

  it('wraps an error on the ownership lookup and does not proceed to write', async () => {
    const workspaces = new MockQueryBuilder({ data: null, error: { message: 'down' } });
    const profiles = new MockQueryBuilder({ data: ROW, error: null });
    const { client } = createMockClient({ workspaces, workspace_profiles: profiles });

    await expect(
      upsertProfileAsOwner(client, WORKSPACE_ID, OWNER_ID, PATCH),
    ).rejects.toBeInstanceOf(WorkspaceProfileRepositoryError);
    expect(profiles.calls).toEqual([]);
  });
});

describe('workspace profile repository surface', () => {
  it('exposes no function that can reach a profile without a workspace id', () => {
    const fns = Object.entries(repository).filter(
      ([, value]) => typeof value === 'function' && value !== WorkspaceProfileRepositoryError,
    );
    expect(fns.length).toBeGreaterThan(0);
    for (const [name, fn] of fns) {
      expect(fn.length, name).toBeGreaterThanOrEqual(2);
    }
  });
});
