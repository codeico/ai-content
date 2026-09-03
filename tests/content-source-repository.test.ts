import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as repository from '../apps/web/src/server/repositories/content-repository.ts';
import {
  ContentRepositoryError,
  updateContentSourceInWorkspace,
} from '../apps/web/src/server/repositories/content-repository.ts';
import { createMockClient, MockQueryBuilder } from './helpers/mock-supabase.ts';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const CONTENT_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const PATCH = {
  source_type: 'tiktok',
  source_url: 'https://www.tiktok.com/@a/video/1',
  external_id: '1',
  media_status: 'external_only',
} as const;

const ROW = {
  id: CONTENT_ID,
  workspace_id: WORKSPACE_ID,
  title: 'Hello',
  status: 'draft',
  ...PATCH,
  storage_provider: null,
  storage_key: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const WORKSPACE_SCOPE = { method: 'eq', args: ['workspace_id', WORKSPACE_ID] };
const CONTENT_SCOPE = { method: 'eq', args: ['id', CONTENT_ID] };

describe('updateContentSourceInWorkspace', () => {
  it('scopes the update by both workspace and content id and returns the row', async () => {
    const builder = new MockQueryBuilder({ data: ROW, error: null });
    const { client, from } = createMockClient({ content: builder });

    const result = await updateContentSourceInWorkspace(client, WORKSPACE_ID, CONTENT_ID, PATCH);

    expect(from).toHaveBeenCalledWith('content');
    expect(builder.calls).toContainEqual(WORKSPACE_SCOPE);
    expect(builder.calls).toContainEqual(CONTENT_SCOPE);
    expect(builder.calls).toContainEqual({ method: 'maybeSingle', args: [] });
    expect(result).toEqual(ROW);
  });

  it('writes exactly the validated patch: no ids, no storage fields', async () => {
    const builder = new MockQueryBuilder({ data: ROW, error: null });
    const { client } = createMockClient({ content: builder });

    await updateContentSourceInWorkspace(client, WORKSPACE_ID, CONTENT_ID, PATCH);

    const update = builder.calls.find((c) => c.method === 'update');
    expect(update?.args).toEqual([PATCH]);
    const keys = Object.keys(update?.args[0] as object);
    for (const forbidden of [
      'id',
      'workspace_id',
      'storage_provider',
      'storage_key',
      'title',
      'status',
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('never lets a smuggled workspace_id or id reach the payload', async () => {
    const builder = new MockQueryBuilder({ data: ROW, error: null });
    const { client } = createMockClient({ content: builder });

    // The type forbids this; the cast simulates a caller that bypassed Zod.
    const tampered = {
      ...PATCH,
      workspace_id: OTHER_WORKSPACE_ID,
      id: 'evil',
      storage_key: 'evil',
    } as unknown as typeof PATCH;

    await updateContentSourceInWorkspace(client, WORKSPACE_ID, CONTENT_ID, tampered);

    // The predicate still comes from the verified argument, not the payload...
    expect(builder.calls).toContainEqual(WORKSPACE_SCOPE);
    expect(builder.calls).not.toContainEqual({
      method: 'eq',
      args: ['workspace_id', OTHER_WORKSPACE_ID],
    });
  });

  it('returns null when nothing matched (wrong workspace or missing content)', async () => {
    const { client } = createMockClient({
      content: new MockQueryBuilder({ data: null, error: null }),
    });

    const result = await updateContentSourceInWorkspace(client, WORKSPACE_ID, CONTENT_ID, PATCH);

    expect(result).toBeNull();
  });

  it('wraps driver errors, including a CHECK violation, without leaking them', async () => {
    const { client } = createMockClient({
      content: new MockQueryBuilder({
        data: null,
        error: { code: '23514', message: 'violates check constraint' },
      }),
    });

    await expect(
      updateContentSourceInWorkspace(client, WORKSPACE_ID, CONTENT_ID, PATCH),
    ).rejects.toBeInstanceOf(ContentRepositoryError);
  });

  it('touches only the content table', async () => {
    const builder = new MockQueryBuilder({ data: ROW, error: null });
    const { client, from } = createMockClient({ content: builder });

    await updateContentSourceInWorkspace(client, WORKSPACE_ID, CONTENT_ID, PATCH);

    expect(from.mock.calls.map((c) => c[0])).toEqual(['content']);
  });
});

describe('content repository surface', () => {
  it('exposes no function that can reach content without a workspace id', () => {
    /**
     * listAllContentForUser is the one deliberate exception: the Content tab
     * is explicitly cross-workspace, and RLS restricts the rows to workspaces
     * the caller belongs to via workspace_ids_for_current_user(). A
     * client-supplied workspace filter there would narrow the result, not
     * secure it.
     *
     * It is named rather than pattern-matched so adding a second unscoped
     * function is a decision someone has to make in this file.
     */
    const CROSS_WORKSPACE_BY_DESIGN = new Set(['listAllContentForUser']);

    const fns = Object.entries(repository).flatMap(([name, value]) =>
      typeof value === 'function' && value !== ContentRepositoryError
        ? [[name, value] as [string, (...args: unknown[]) => unknown]]
        : [],
    );
    expect(fns.length).toBeGreaterThan(0);
    for (const [name, fn] of fns) {
      if (CROSS_WORKSPACE_BY_DESIGN.has(name)) continue;
      // (supabase, workspaceId, ...) is the minimum signature.
      expect(fn.length, name).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps the cross-workspace read relying on RLS, not on a client filter', () => {
    const source = readFileSync(
      join(process.cwd(), 'apps/web/src/server/repositories/content-repository.ts'),
      'utf8',
    );
    const body = source.slice(
      source.indexOf('export async function listAllContentForUser'),
      source.indexOf('export async function countContentByStatus'),
    );

    expect(body).toContain('.limit(');
    // A workspace_id predicate here would mean the caller chooses the scope.
    expect(body).not.toMatch(/\.eq\('workspace_id'/);
  });
});
