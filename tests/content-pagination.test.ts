import {
  CONTENT_PAGE_SIZE,
  countContentByStatus,
  listContentForWorkspace,
} from '../apps/web/src/server/repositories/content-repository.ts';
import { describe, expect, it } from 'vitest';

import { createMockClient, MockQueryBuilder } from './helpers/mock-supabase.ts';

/**
 * The content list was unbounded: every workspace page loaded every row the
 * workspace had ever held. These pin the keyset pagination that replaced it.
 *
 * Keyset, not offset, for two reasons that matter at the data layer: an offset
 * re-scans every skipped row, and it can skip or repeat items when a row is
 * inserted while the user is paging. A cursor on the sort key cannot.
 */
const WS = '550e8400-e29b-41d4-a716-446655440000';

function row(n: number) {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    workspace_id: WS,
    title: `Item ${n}`,
    status: 'draft',
    description: null,
    source_type: 'manual',
    source_url: null,
    external_id: null,
    storage_provider: null,
    storage_key: null,
    media_status: 'external_only',
    created_at: `2026-01-01T00:00:${String(n).padStart(2, '0')}Z`,
    updated_at: '',
  };
}

function ofLength(n: number) {
  return Array.from({ length: n }, (_, i) => row(i + 1));
}

function calls(b: MockQueryBuilder, method: string) {
  return b.calls.filter((c) => c.method === method);
}

describe('listContentForWorkspace paging', () => {
  it('asks for one row more than the page size, to detect a next page', () => {
    const b = new MockQueryBuilder({ data: [], error: null });
    const { client } = createMockClient({ content: b });

    return listContentForWorkspace(client, WS).then(() => {
      expect(calls(b, 'limit')[0]?.args).toEqual([CONTENT_PAGE_SIZE + 1]);
    });
  });

  it('returns exactly the page size and a cursor when more rows exist', async () => {
    const b = new MockQueryBuilder({ data: ofLength(CONTENT_PAGE_SIZE + 1), error: null });
    const { client } = createMockClient({ content: b });

    const page = await listContentForWorkspace(client, WS);

    // The probe row is never shown to the caller.
    expect(page.items).toHaveLength(CONTENT_PAGE_SIZE);
    const last = page.items.at(-1)!;
    expect(page.nextCursor).toEqual({ created_at: last.created_at, id: last.id });
  });

  it('returns no cursor when the page is not full', async () => {
    const b = new MockQueryBuilder({ data: ofLength(3), error: null });
    const { client } = createMockClient({ content: b });

    const page = await listContentForWorkspace(client, WS);

    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });

  it('returns no cursor when the page is exactly full and nothing follows', async () => {
    const b = new MockQueryBuilder({ data: ofLength(CONTENT_PAGE_SIZE), error: null });
    const { client } = createMockClient({ content: b });

    const page = await listContentForWorkspace(client, WS);

    expect(page.items).toHaveLength(CONTENT_PAGE_SIZE);
    expect(page.nextCursor).toBeNull();
  });

  it('filters strictly after the cursor, breaking ties on id', async () => {
    const b = new MockQueryBuilder({ data: [], error: null });
    const { client } = createMockClient({ content: b });

    await listContentForWorkspace(client, WS, {
      cursor: { created_at: '2026-01-01T00:00:05Z', id: 'abc' },
    });

    const or = calls(b, 'or')[0]?.args[0] as string;
    // Older by timestamp, OR same timestamp and a lower id: a total order, so
    // two rows created in the same millisecond can neither loop nor vanish.
    expect(or).toContain('created_at.lt.2026-01-01T00:00:05Z');
    expect(or).toContain('and(created_at.eq.2026-01-01T00:00:05Z,id.lt.abc)');
  });

  it('applies no cursor filter on the first page', async () => {
    const b = new MockQueryBuilder({ data: [], error: null });
    const { client } = createMockClient({ content: b });

    await listContentForWorkspace(client, WS);

    expect(calls(b, 'or')).toEqual([]);
  });

  it('still scopes every page by workspace', async () => {
    const b = new MockQueryBuilder({ data: [], error: null });
    const { client } = createMockClient({ content: b });

    await listContentForWorkspace(client, WS, {
      cursor: { created_at: '2026-01-01T00:00:05Z', id: 'abc' },
    });

    expect(calls(b, 'eq')).toContainEqual({ method: 'eq', args: ['workspace_id', WS] });
  });
});

describe('countContentByStatus', () => {
  it('counts the whole workspace, not the page in hand', async () => {
    const b = new MockQueryBuilder({
      data: [{ status: 'draft' }, { status: 'draft' }, { status: 'ready' }],
      error: null,
    });
    const { client } = createMockClient({ content: b });

    const counts = await countContentByStatus(client, WS);

    expect(counts).toEqual({ total: 3, draft: 2, ready: 1, archived: 0 });
    expect(calls(b, 'eq')).toContainEqual({ method: 'eq', args: ['workspace_id', WS] });
    // Only the status column travels, so a large workspace stays cheap.
    expect(calls(b, 'select')[0]?.args[0]).toBe('status');
  });
});
