import { describe, expect, it } from 'vitest';

import {
  CaptionRepositoryError,
  countCaptionsForContent,
  insertNextCaptionVersion,
  isUniqueViolation,
  listCaptionsForContent,
  selectCaptionAsActive,
} from '../apps/web/src/server/repositories/caption-repository.ts';
import { createMockClient, MockQueryBuilder } from './helpers/mock-supabase.ts';

/**
 * The repository is the visible scoping step; RLS is the backstop. These tests
 * assert on the recorded filters — every query must carry BOTH workspace_id and
 * content_id — because that is the authorization behaviour, not the return
 * value. Live RLS behaviour is verified against Supabase separately.
 */
const WS = '550e8400-e29b-41d4-a716-446655440000';
const CONTENT = '6f9619ff-8b86-d011-b42d-00c04fc964ff';
const CAPTION = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const USER = 'user-1';

const ROW = {
  id: CAPTION,
  content_id: CONTENT,
  workspace_id: WS,
  version: 3,
  body: 'A caption.',
  status: 'draft',
  model_name: 'some-model',
  prompt_version: 'caption-v1',
  created_by: USER,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function eqFilters(builder: MockQueryBuilder): Record<string, unknown> {
  return Object.fromEntries(
    builder.calls.filter((c) => c.method === 'eq').map((c) => [c.args[0], c.args[1]]),
  );
}

describe('listCaptionsForContent', () => {
  it('scopes by workspace AND content, newest version first', async () => {
    const captions = new MockQueryBuilder({ data: [ROW], error: null });
    const { client } = createMockClient({ captions });

    const result = await listCaptionsForContent(client, WS, CONTENT);

    expect(result).toEqual([ROW]);
    expect(eqFilters(captions)).toEqual({ workspace_id: WS, content_id: CONTENT });
    expect(captions.calls.find((c) => c.method === 'order')?.args).toEqual([
      'version',
      { ascending: false },
    ]);
  });

  it('wraps driver errors without leaking them', async () => {
    const captions = new MockQueryBuilder({ data: null, error: { code: '42P01', message: 'x' } });
    const { client } = createMockClient({ captions });

    await expect(listCaptionsForContent(client, WS, CONTENT)).rejects.toBeInstanceOf(
      CaptionRepositoryError,
    );
  });
});

describe('countCaptionsForContent', () => {
  it('counts with a head query scoped to workspace AND content', async () => {
    const captions = new MockQueryBuilder({ data: null, error: null, count: 7 });
    const { client } = createMockClient({ captions });

    expect(await countCaptionsForContent(client, WS, CONTENT)).toBe(7);
    expect(eqFilters(captions)).toEqual({ workspace_id: WS, content_id: CONTENT });
    expect(captions.calls.find((c) => c.method === 'select')?.args[1]).toEqual({
      count: 'exact',
      head: true,
    });
  });

  it('treats a null count as zero rather than throwing', async () => {
    const captions = new MockQueryBuilder({ data: null, error: null });
    const { client } = createMockClient({ captions });

    expect(await countCaptionsForContent(client, WS, CONTENT)).toBe(0);
  });

  it('wraps driver errors', async () => {
    const captions = new MockQueryBuilder({ data: null, error: { code: 'x', message: 'x' } });
    const { client } = createMockClient({ captions });

    await expect(countCaptionsForContent(client, WS, CONTENT)).rejects.toBeInstanceOf(
      CaptionRepositoryError,
    );
  });
});

describe('insertNextCaptionVersion', () => {
  const NEW = { body: 'Fresh.', model_name: 'm', prompt_version: 'caption-v1', created_by: USER };

  it('reads the latest version scoped to the content, then inserts MAX+1', async () => {
    const latest = new MockQueryBuilder({ data: { version: 3 }, error: null });
    const insert = new MockQueryBuilder({ data: { ...ROW, version: 4 }, error: null });
    const { client } = createMockClient({ captions: [latest, insert] });

    const saved = await insertNextCaptionVersion(client, WS, CONTENT, NEW);

    expect(saved.version).toBe(4);
    expect(eqFilters(latest)).toEqual({ workspace_id: WS, content_id: CONTENT });
    expect(latest.calls.find((c) => c.method === 'limit')?.args).toEqual([1]);

    const payload = insert.calls.find((c) => c.method === 'insert')?.args[0];
    expect(payload).toEqual({ ...NEW, workspace_id: WS, content_id: CONTENT, version: 4 });
  });

  it('starts at version 1 when the content has no captions yet', async () => {
    const latest = new MockQueryBuilder({ data: null, error: null });
    const insert = new MockQueryBuilder({ data: { ...ROW, version: 1 }, error: null });
    const { client } = createMockClient({ captions: [latest, insert] });

    await insertNextCaptionVersion(client, WS, CONTENT, NEW);

    const payload = insert.calls.find((c) => c.method === 'insert')?.args[0] as { version: number };
    expect(payload.version).toBe(1);
  });

  it('pins workspace_id and content_id to the verified arguments even if the payload smuggles them', async () => {
    const latest = new MockQueryBuilder({ data: null, error: null });
    const insert = new MockQueryBuilder({ data: ROW, error: null });
    const { client } = createMockClient({ captions: [latest, insert] });

    const smuggled = { ...NEW, workspace_id: 'other-ws', content_id: 'other-content' } as never;
    await insertNextCaptionVersion(client, WS, CONTENT, smuggled);

    const payload = insert.calls.find((c) => c.method === 'insert')?.args[0] as Record<
      string,
      unknown
    >;
    expect(payload.workspace_id).toBe(WS);
    expect(payload.content_id).toBe(CONTENT);
  });

  it('surfaces a unique violation as a repository error the caller can detect', async () => {
    const latest = new MockQueryBuilder({ data: { version: 1 }, error: null });
    const insert = new MockQueryBuilder({ data: null, error: { code: '23505', message: 'dup' } });
    const { client } = createMockClient({ captions: [latest, insert] });

    let caught: unknown;
    try {
      await insertNextCaptionVersion(client, WS, CONTENT, NEW);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(CaptionRepositoryError);
    expect(isUniqueViolation((caught as CaptionRepositoryError).cause)).toBe(true);
  });

  it('does not insert when the version lookup fails', async () => {
    const latest = new MockQueryBuilder({ data: null, error: { code: 'x', message: 'x' } });
    const insert = new MockQueryBuilder({ data: ROW, error: null });
    const { client } = createMockClient({ captions: [latest, insert] });

    await expect(insertNextCaptionVersion(client, WS, CONTENT, NEW)).rejects.toBeInstanceOf(
      CaptionRepositoryError,
    );
    expect(insert.calls).toEqual([]);
  });
});

describe('selectCaptionAsActive', () => {
  it('verifies the target, archives the previous active, then activates the target', async () => {
    const verify = new MockQueryBuilder({ data: { id: CAPTION, status: 'draft' }, error: null });
    const archive = new MockQueryBuilder({ data: null, error: null });
    const activate = new MockQueryBuilder({ data: { ...ROW, status: 'active' }, error: null });
    const { client } = createMockClient({ captions: [verify, archive, activate] });

    const result = await selectCaptionAsActive(client, WS, CONTENT, CAPTION);

    expect(result?.status).toBe('active');

    // Archive: scoped to content, only the current active, and NOT the target.
    expect(archive.calls.find((c) => c.method === 'update')?.args[0]).toEqual({
      status: 'archived',
    });
    expect(eqFilters(archive)).toEqual({ workspace_id: WS, content_id: CONTENT, status: 'active' });
    expect(archive.calls.find((c) => c.method === 'neq')?.args).toEqual(['id', CAPTION]);

    // Activate: scoped to workspace, content, and the caption id.
    expect(activate.calls.find((c) => c.method === 'update')?.args[0]).toEqual({
      status: 'active',
    });
    expect(eqFilters(activate)).toEqual({ workspace_id: WS, content_id: CONTENT, id: CAPTION });
  });

  it('returns null when the target is not in this workspace/content, without archiving', async () => {
    const verify = new MockQueryBuilder({ data: null, error: null });
    const archive = new MockQueryBuilder({ data: null, error: null });
    const { client } = createMockClient({ captions: [verify, archive] });

    expect(await selectCaptionAsActive(client, WS, CONTENT, CAPTION)).toBeNull();

    // A stale page or a tampered id must not strip the content's active
    // caption on its way to "not found".
    expect(archive.calls).toEqual([]);
  });

  it('stops before activating if archiving fails', async () => {
    const verify = new MockQueryBuilder({ data: { id: CAPTION, status: 'draft' }, error: null });
    const archive = new MockQueryBuilder({ data: null, error: { code: 'x', message: 'x' } });
    const activate = new MockQueryBuilder({ data: ROW, error: null });
    const { client } = createMockClient({ captions: [verify, archive, activate] });

    await expect(selectCaptionAsActive(client, WS, CONTENT, CAPTION)).rejects.toBeInstanceOf(
      CaptionRepositoryError,
    );
    expect(activate.calls).toEqual([]);
  });
});

describe('isUniqueViolation', () => {
  it('recognises Postgres 23505 and nothing else', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ code: '23514' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
  });
});
