import { describe, expect, it } from 'vitest';

import {
  ContentRepositoryError,
  createContentInWorkspace,
  deleteContentInWorkspace,
  getContentInWorkspace,
  listContentForWorkspace,
  updateContentInWorkspace,
} from '../apps/web/src/server/repositories/content-repository.ts';
import { createMockClient, MockQueryBuilder } from './helpers/mock-supabase.ts';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const CONTENT_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const ROW = {
  id: CONTENT_ID,
  workspace_id: WORKSPACE_ID,
  title: 'Hello',
  status: 'draft',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const WORKSPACE_SCOPE = { method: 'eq', args: ['workspace_id', WORKSPACE_ID] };
const CONTENT_SCOPE = { method: 'eq', args: ['id', CONTENT_ID] };

describe('listContentForWorkspace', () => {
  it('scopes to the workspace with deterministic ordering', async () => {
    const builder = new MockQueryBuilder({ data: [ROW], error: null });
    const { client, from } = createMockClient({ content: builder });

    const result = await listContentForWorkspace(client, WORKSPACE_ID);

    expect(from).toHaveBeenCalledWith('content');
    expect(builder.calls).toContainEqual(WORKSPACE_SCOPE);
    expect(builder.calls.filter((c) => c.method === 'order')).toEqual([
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'order', args: ['id', { ascending: false }] },
    ]);
    expect(result).toEqual([ROW]);
  });

  it('wraps driver errors', async () => {
    const { client } = createMockClient({
      content: new MockQueryBuilder({ data: null, error: { message: 'boom' } }),
    });
    await expect(listContentForWorkspace(client, WORKSPACE_ID)).rejects.toBeInstanceOf(
      ContentRepositoryError,
    );
  });
});

describe('getContentInWorkspace', () => {
  it('filters by both workspace and content id', async () => {
    const builder = new MockQueryBuilder({ data: ROW, error: null });
    const { client } = createMockClient({ content: builder });

    const result = await getContentInWorkspace(client, WORKSPACE_ID, CONTENT_ID);

    expect(builder.calls).toContainEqual(WORKSPACE_SCOPE);
    expect(builder.calls).toContainEqual(CONTENT_SCOPE);
    expect(result).toEqual(ROW);
  });

  it('returns null when nothing matches (wrong workspace or missing)', async () => {
    const { client } = createMockClient({
      content: new MockQueryBuilder({ data: null, error: null }),
    });
    expect(await getContentInWorkspace(client, WORKSPACE_ID, CONTENT_ID)).toBeNull();
  });
});

describe('createContentInWorkspace', () => {
  it('inserts with the workspace id and title only (status defaults in the database)', async () => {
    const builder = new MockQueryBuilder({ data: ROW, error: null });
    const { client } = createMockClient({ content: builder });

    const result = await createContentInWorkspace(client, WORKSPACE_ID, 'Hello');

    expect(builder.calls).toContainEqual({
      method: 'insert',
      args: [{ workspace_id: WORKSPACE_ID, title: 'Hello' }],
    });
    expect(result).toEqual(ROW);
  });

  it('wraps driver errors', async () => {
    const { client } = createMockClient({
      content: new MockQueryBuilder({ data: null, error: { message: 'rls' } }),
    });
    await expect(createContentInWorkspace(client, WORKSPACE_ID, 'x')).rejects.toBeInstanceOf(
      ContentRepositoryError,
    );
  });
});

describe('updateContentInWorkspace', () => {
  it('updates only title/status, scoped to workspace and content id', async () => {
    const patch = { title: 'New', status: 'ready' as const, description: null };
    const builder = new MockQueryBuilder({ data: { ...ROW, ...patch }, error: null });
    const { client } = createMockClient({ content: builder });

    const result = await updateContentInWorkspace(client, WORKSPACE_ID, CONTENT_ID, patch);

    const update = builder.calls.find((c) => c.method === 'update');
    expect(update?.args).toEqual([patch]);
    // workspace_id must never be part of the update payload (no cross-workspace moves).
    expect(Object.keys(update?.args[0] as object)).not.toContain('workspace_id');
    expect(builder.calls).toContainEqual(WORKSPACE_SCOPE);
    expect(builder.calls).toContainEqual(CONTENT_SCOPE);
    expect(result?.status).toBe('ready');
  });

  it('returns null when no row matched', async () => {
    const { client } = createMockClient({
      content: new MockQueryBuilder({ data: null, error: null }),
    });
    expect(
      await updateContentInWorkspace(client, WORKSPACE_ID, CONTENT_ID, {
        title: 'x',
        description: null,
        status: 'draft',
      }),
    ).toBeNull();
  });
});

describe('deleteContentInWorkspace', () => {
  it('deletes scoped to workspace and content id and reports success', async () => {
    const builder = new MockQueryBuilder({ data: { id: CONTENT_ID }, error: null });
    const { client } = createMockClient({ content: builder });

    expect(await deleteContentInWorkspace(client, WORKSPACE_ID, CONTENT_ID)).toBe(true);
    expect(builder.calls).toContainEqual({ method: 'delete', args: [] });
    expect(builder.calls).toContainEqual(WORKSPACE_SCOPE);
    expect(builder.calls).toContainEqual(CONTENT_SCOPE);
  });

  it('reports false when nothing was deleted', async () => {
    const { client } = createMockClient({
      content: new MockQueryBuilder({ data: null, error: null }),
    });
    expect(await deleteContentInWorkspace(client, WORKSPACE_ID, CONTENT_ID)).toBe(false);
  });
});
