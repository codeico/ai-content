import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../packages/database/src/types/database.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createWorkspaceForUser,
  deleteWorkspaceAsOwner,
  getWorkspaceForUser,
  listWorkspacesForUser,
  renameWorkspaceAsOwner,
  WorkspaceRepositoryError,
} from '../apps/web/src/server/repositories/workspace-repository.ts';

/**
 * A recording, chainable stand-in for a PostgREST query builder.
 *
 * Real `@supabase/supabase-js` query builders are thenable: `await
 * supabase.from(...).select(...).eq(...)` works without an explicit
 * `.then()` call because the final chained object itself resolves to
 * `{ data, error }`. This mock reproduces that shape and records every
 * method call so tests can assert *which filters were applied* — the actual
 * authorization behavior — not just the final return value.
 */
class MockQueryBuilder implements PromiseLike<{ data: unknown; error: unknown }> {
  public readonly calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: { data: unknown; error: unknown }) {}

  private record(method: string, args: unknown[]): this {
    this.calls.push({ method, args });
    return this;
  }

  select(...args: unknown[]): this {
    return this.record('select', args);
  }

  eq(...args: unknown[]): this {
    return this.record('eq', args);
  }

  in(...args: unknown[]): this {
    return this.record('in', args);
  }

  order(...args: unknown[]): this {
    return this.record('order', args);
  }

  insert(...args: unknown[]): this {
    return this.record('insert', args);
  }

  update(...args: unknown[]): this {
    return this.record('update', args);
  }

  delete(...args: unknown[]): this {
    return this.record('delete', args);
  }

  maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    this.record('maybeSingle', []);
    return Promise.resolve(this.result);
  }

  single(): Promise<{ data: unknown; error: unknown }> {
    this.record('single', []);
    return Promise.resolve(this.result);
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

/** Builds a mock Supabase client that returns one builder per table name. */
function createMockClient(builders: Record<string, MockQueryBuilder>): {
  client: SupabaseClient<Database>;
  from: ReturnType<typeof vi.fn>;
} {
  const from = vi.fn((table: string) => {
    const builder = builders[table];
    if (!builder) {
      throw new Error(`Test did not configure a builder for table "${table}"`);
    }
    return builder;
  });

  return { client: { from } as unknown as SupabaseClient<Database>, from };
}

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const OWNER_ID = 'owner-user-id';
const OTHER_USER_ID = 'other-user-id';

describe('listWorkspacesForUser', () => {
  it('scopes the membership query to the given user', async () => {
    const membersBuilder = new MockQueryBuilder({
      data: [{ workspace_id: WORKSPACE_ID, role: 'owner' }],
      error: null,
    });
    const workspacesBuilder = new MockQueryBuilder({
      data: [{ id: WORKSPACE_ID, name: 'Coding', created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    });
    const { client } = createMockClient({
      workspace_members: membersBuilder,
      workspaces: workspacesBuilder,
    });

    const result = await listWorkspacesForUser(client, OWNER_ID);

    // The authorization boundary: only this user's own membership rows are
    // queried. If this ever changed to an unfiltered select, any user could
    // enumerate every workspace on the platform.
    expect(membersBuilder.calls).toContainEqual({ method: 'eq', args: ['user_id', OWNER_ID] });
    expect(result).toEqual([
      {
        workspace: { id: WORKSPACE_ID, name: 'Coding', created_at: '2026-01-01T00:00:00Z' },
        role: 'owner',
      },
    ]);
  });

  it('returns an empty list without querying workspaces when there are no memberships', async () => {
    const membersBuilder = new MockQueryBuilder({ data: [], error: null });
    const { client, from } = createMockClient({ workspace_members: membersBuilder });

    const result = await listWorkspacesForUser(client, OWNER_ID);

    expect(result).toEqual([]);
    // Only one table was ever touched — the empty-membership short circuit
    // means no `workspaces` query, and therefore no call to `.from('workspaces')`.
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('throws a WorkspaceRepositoryError when the membership query fails', async () => {
    const membersBuilder = new MockQueryBuilder({ data: null, error: { message: 'db down' } });
    const { client } = createMockClient({ workspace_members: membersBuilder });

    await expect(listWorkspacesForUser(client, OWNER_ID)).rejects.toBeInstanceOf(
      WorkspaceRepositoryError,
    );
  });
});

describe('getWorkspaceForUser', () => {
  it('returns null without querying the workspace when the user has no membership row', async () => {
    const membersBuilder = new MockQueryBuilder({ data: null, error: null });
    const { client, from } = createMockClient({ workspace_members: membersBuilder });

    const result = await getWorkspaceForUser(client, WORKSPACE_ID, OTHER_USER_ID);

    expect(result).toBeNull();
    // A non-member gets exactly the same "not found" result a nonexistent
    // workspace id would — no second query even happens to distinguish them.
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('returns the workspace merged with the caller role for a member', async () => {
    const membersBuilder = new MockQueryBuilder({ data: { role: 'member' }, error: null });
    const workspacesBuilder = new MockQueryBuilder({
      data: {
        id: WORKSPACE_ID,
        name: 'Coding',
        owner_id: OWNER_ID,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    });
    const { client } = createMockClient({
      workspace_members: membersBuilder,
      workspaces: workspacesBuilder,
    });

    const result = await getWorkspaceForUser(client, WORKSPACE_ID, OTHER_USER_ID);

    expect(result).toEqual({
      id: WORKSPACE_ID,
      name: 'Coding',
      owner_id: OWNER_ID,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      role: 'member',
    });
  });
});

describe('createWorkspaceForUser', () => {
  it('pins owner_id to the given user, never to unrelated input', async () => {
    const workspacesBuilder = new MockQueryBuilder({
      data: {
        id: WORKSPACE_ID,
        name: 'Coding',
        owner_id: OWNER_ID,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    });
    const { client } = createMockClient({ workspaces: workspacesBuilder });

    await createWorkspaceForUser(client, OWNER_ID, 'Coding');

    expect(workspacesBuilder.calls).toContainEqual({
      method: 'insert',
      args: [{ name: 'Coding', owner_id: OWNER_ID }],
    });
  });

  it('throws a WorkspaceRepositoryError when the insert fails', async () => {
    const workspacesBuilder = new MockQueryBuilder({
      data: null,
      error: { message: 'constraint violation' },
    });
    const { client } = createMockClient({ workspaces: workspacesBuilder });

    await expect(createWorkspaceForUser(client, OWNER_ID, 'Coding')).rejects.toBeInstanceOf(
      WorkspaceRepositoryError,
    );
  });
});

describe('renameWorkspaceAsOwner', () => {
  it('filters the update by both workspace id and owner id', async () => {
    const workspacesBuilder = new MockQueryBuilder({
      data: {
        id: WORKSPACE_ID,
        name: 'Renamed',
        owner_id: OWNER_ID,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      },
      error: null,
    });
    const { client } = createMockClient({ workspaces: workspacesBuilder });

    const result = await renameWorkspaceAsOwner(client, WORKSPACE_ID, OWNER_ID, 'Renamed');

    // This IS the authorization check the module doc comment describes:
    // the update statement itself can only ever touch a row that matches
    // both predicates, so a non-owner's update affects zero rows regardless
    // of what RLS does.
    expect(workspacesBuilder.calls).toContainEqual({ method: 'eq', args: ['id', WORKSPACE_ID] });
    expect(workspacesBuilder.calls).toContainEqual({
      method: 'eq',
      args: ['owner_id', OWNER_ID],
    });
    expect(result?.name).toBe('Renamed');
  });

  it('returns null when the actor does not own the workspace', async () => {
    // Simulates what a real update-with-mismatched-filter returns: zero rows
    // affected, so PostgREST's maybeSingle() resolves to a null row, not an
    // error. A non-owner's rename request must be indistinguishable from
    // this at the repository boundary.
    const workspacesBuilder = new MockQueryBuilder({ data: null, error: null });
    const { client } = createMockClient({ workspaces: workspacesBuilder });

    const result = await renameWorkspaceAsOwner(client, WORKSPACE_ID, OTHER_USER_ID, 'Renamed');

    expect(result).toBeNull();
  });
});

describe('deleteWorkspaceAsOwner', () => {
  it('filters the delete by both workspace id and owner id', async () => {
    const workspacesBuilder = new MockQueryBuilder({ data: { id: WORKSPACE_ID }, error: null });
    const { client } = createMockClient({ workspaces: workspacesBuilder });

    const result = await deleteWorkspaceAsOwner(client, WORKSPACE_ID, OWNER_ID);

    expect(workspacesBuilder.calls).toContainEqual({ method: 'eq', args: ['id', WORKSPACE_ID] });
    expect(workspacesBuilder.calls).toContainEqual({
      method: 'eq',
      args: ['owner_id', OWNER_ID],
    });
    expect(result).toBe(true);
  });

  it('returns false without deleting anything when the actor does not own the workspace', async () => {
    const workspacesBuilder = new MockQueryBuilder({ data: null, error: null });
    const { client } = createMockClient({ workspaces: workspacesBuilder });

    const result = await deleteWorkspaceAsOwner(client, WORKSPACE_ID, OTHER_USER_ID);

    expect(result).toBe(false);
  });
});
