import { describe, expect, it } from 'vitest';

import { parseContentCursor } from '@ai-content/shared/content';

import { listContentForWorkspace } from '../apps/web/src/server/repositories/content-repository.ts';
import { createMockClient, MockQueryBuilder } from './helpers/mock-supabase.ts';

/**
 * The pagination cursor arrives in the query string, so it is attacker input.
 * It is interpolated into a PostgREST `or(...)` filter, which is the one place
 * in this codebase where user text becomes part of a query expression rather
 * than a bound parameter — so it gets its own tests.
 *
 * What must hold no matter what the cursor contains: the workspace predicate
 * survives, and nothing in the cursor can widen the result beyond the caller's
 * workspace. RLS is the backstop; this pins the layer above it.
 */
const WS = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_WS = '11111111-1111-4111-8111-111111111111';

/** Shapes an attacker would try in a URL. */
const HOSTILE = [
  { created_at: '2026-01-01T00:00:00Z', id: 'abc,workspace_id.eq.' + OTHER_WS },
  { created_at: '2026-01-01T00:00:00Z),or(workspace_id.eq.' + OTHER_WS, id: 'abc' },
  { created_at: '*', id: '*' },
  { created_at: '2026-01-01T00:00:00Z', id: 'abc)' },
  { created_at: '', id: '' },
];

function eqCalls(b: MockQueryBuilder) {
  return b.calls.filter((c) => c.method === 'eq').map((c) => c.args);
}

describe('a hostile cursor cannot escape the workspace', () => {
  it.each(HOSTILE)('keeps the workspace predicate with cursor %j', async (cursor) => {
    const b = new MockQueryBuilder({ data: [], error: null });
    const { client } = createMockClient({ content: b });

    await listContentForWorkspace(client, WS, { cursor });

    // The workspace filter is a separate .eq() call, not part of the cursor
    // expression, so no cursor content can remove or widen it.
    expect(eqCalls(b)).toContainEqual(['workspace_id', WS]);
    expect(eqCalls(b)).not.toContainEqual(['workspace_id', OTHER_WS]);
  });

  it('never names another workspace id in the eq predicates', async () => {
    const b = new MockQueryBuilder({ data: [], error: null });
    const { client } = createMockClient({ content: b });

    await listContentForWorkspace(client, WS, {
      cursor: { created_at: '2026-01-01T00:00:00Z', id: `x,workspace_id.eq.${OTHER_WS}` },
    });

    const scoped = eqCalls(b).filter(([column]) => column === 'workspace_id');
    expect(scoped).toEqual([['workspace_id', WS]]);
  });

  it('still applies exactly one workspace predicate regardless of cursor', async () => {
    const b = new MockQueryBuilder({ data: [], error: null });
    const { client } = createMockClient({ content: b });

    await listContentForWorkspace(client, WS, {
      cursor: { created_at: '2026-01-01T00:00:00Z', id: 'abc' },
    });

    expect(eqCalls(b).filter(([c]) => c === 'workspace_id')).toHaveLength(1);
  });
});

describe('the page size cannot be inflated by a caller', () => {
  it('uses the default page size when no limit is given', async () => {
    const b = new MockQueryBuilder({ data: [], error: null });
    const { client } = createMockClient({ content: b });

    await listContentForWorkspace(client, WS);

    const limit = b.calls.find((c) => c.method === 'limit')?.args[0] as number;
    expect(limit).toBeLessThanOrEqual(26);
  });
});

describe('parseContentCursor rejects anything that is not a real cursor', () => {
  it('accepts a well-formed pair', () => {
    const parsed = parseContentCursor(
      '2026-01-01T00:07:00+00:00',
      '715f7ec8-a9bf-4ca0-bf1c-f9862c7ec879',
    );
    expect(parsed).toEqual({
      created_at: '2026-01-01T00:07:00+00:00',
      id: '715f7ec8-a9bf-4ca0-bf1c-f9862c7ec879',
    });
  });

  it.each([
    ['injection in the id', '2026-01-01T00:00:00Z', `abc,workspace_id.eq.${OTHER_WS}`],
    ['injection in the timestamp', `2026-01-01T00:00:00Z),or(workspace_id.eq.${OTHER_WS}`, 'abc'],
    ['wildcards', '*', '*'],
    ['empty strings', '', ''],
    ['a plain typo', 'not-a-date', 'not-a-uuid'],
    ['missing values', undefined, undefined],
    ['arrays from repeated params', ['a', 'b'], ['c', 'd']],
    ['a valid date but non-uuid id', '2026-01-01T00:00:00Z', '12345'],
  ])('rejects %s', (_label, createdAt, id) => {
    expect(parseContentCursor(createdAt, id)).toBeNull();
  });

  it('falling back to null means "first page", not "error"', () => {
    // The page passes this straight to listContentForWorkspace, where null is
    // simply no cursor. A broken bookmark shows the newest content instead of
    // breaking the whole workspace page — which is what it did before.
    expect(parseContentCursor('garbage', 'garbage')).toBeNull();
  });
});
