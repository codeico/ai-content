import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Content } from '../apps/web/src/server/repositories/content-repository.ts';

/**
 * Action-level gate for updateContentSource. Zod deliberately accepts
 * `available` (a row already available must keep an editable link), so the
 * refusal of a *transition into* available lives only in the Server Action.
 * The repository and Zod are covered elsewhere; this file pins the ordering
 * of the action's own checks: session → Zod → membership → transition →
 * write.
 *
 * What is mocked and why:
 *  - next/navigation: the real redirect() throws a control-flow error so no
 *    code after it runs. The mock throws too; a no-op would let `user.id`
 *    on null mask the redirect with a TypeError.
 *  - next/cache: refresh() needs a request scope that does not exist here.
 *  - @/lib/supabase/server: needs next/headers cookies() and env; the
 *    session is the input under test, not the plumbing that produces it.
 *  - workspace-repository.getWorkspaceForUser: membership is an input here;
 *    its own query scoping is pinned in workspace-repository.test.ts.
 *  - content-repository: the real module runs against the recording mock
 *    client via vi.spyOn, so the action's calls are observed, not replaced,
 *    except where a test needs to force a specific existing row.
 */
// vitest.config.ts has no `@/` alias (tests import by relative path) and the
// root tsconfig has none either, so the test never imports `@/...` itself.
// The action's four `@/` specifiers are bound here: content-repository to the
// real module (so vi.spyOn observes the action's calls), the other two to
// hoisted mocks the tests drive directly.
const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createServerClient: vi.fn(),
  getWorkspaceForUser: vi.fn(),
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

import { updateContentSource } from '../apps/web/src/app/app/workspaces/[workspaceId]/content-actions.ts';
import * as contentRepository from '../apps/web/src/server/repositories/content-repository.ts';
import { createMockClient, MockQueryBuilder } from './helpers/mock-supabase.ts';

const { refresh, redirect } = mocks;

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const CONTENT_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const USER = { id: 'user-1' };
const WORKSPACE = { id: WORKSPACE_ID, name: 'W', owner_id: USER.id, role: 'owner' };

const DRAFT_ROW: Content = {
  id: CONTENT_ID,
  workspace_id: WORKSPACE_ID,
  title: 'Hello',
  status: 'draft',
  source_type: 'tiktok',
  source_url: 'https://www.tiktok.com/@a/video/1',
  external_id: '1',
  storage_provider: null,
  storage_key: null,
  media_status: 'external_only',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const AVAILABLE_ROW: Content = {
  ...DRAFT_ROW,
  storage_provider: 'r2',
  storage_key: 'ws/1/obj',
  media_status: 'available',
};

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields = {
    source_type: 'tiktok',
    source_url: 'https://www.tiktok.com/@a/video/2',
    external_id: '2',
    media_status: 'external_only',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

const mockedUser = mocks.getAuthenticatedUser;
const mockedClient = mocks.createServerClient;
const mockedMembership = mocks.getWorkspaceForUser;

/** Signed in, member, `content` table answers every query with `row`. */
function arrange(row: Content | null) {
  const builder = new MockQueryBuilder({ data: row, error: null });
  const { client, from } = createMockClient({ content: builder });
  mockedUser.mockResolvedValue(USER);
  mockedClient.mockResolvedValue(client);
  mockedMembership.mockResolvedValue(WORKSPACE);
  return { builder, from };
}

function tableWrites(builder: MockQueryBuilder): string[] {
  return builder.calls
    .map((c) => c.method)
    .filter((m) => m === 'update' || m === 'insert' || m === 'delete');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('updateContentSource: media_status transition gate', () => {
  it('refuses draft → available with a media_status field error and never writes', async () => {
    const { builder } = arrange(DRAFT_ROW);
    const write = vi.spyOn(contentRepository, 'updateContentSourceInWorkspace');

    const state = await updateContentSource(
      WORKSPACE_ID,
      CONTENT_ID,
      {},
      form({ media_status: 'available' }),
    );

    expect(state.error).toBeUndefined();
    expect(state.fieldErrors).toEqual({
      media_status: 'Available is set by the system, not by hand.',
    });
    expect(write).not.toHaveBeenCalled();
    expect(tableWrites(builder)).toEqual([]);
    // The existing row was read, and read within the workspace.
    expect(builder.calls).toContainEqual({ method: 'select', args: expect.any(Array) });
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['workspace_id', WORKSPACE_ID] });
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['id', CONTENT_ID] });
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each(['external_only', 'missing'] as const)(
    'refuses %s → available: only the current value matters, not the workflow status',
    async (current) => {
      const { builder } = arrange({ ...DRAFT_ROW, status: 'ready', media_status: current });

      const state = await updateContentSource(
        WORKSPACE_ID,
        CONTENT_ID,
        {},
        form({ media_status: 'available' }),
      );

      expect(state.fieldErrors?.media_status).toBeDefined();
      expect(tableWrites(builder)).toEqual([]);
    },
  );

  it('allows available → available (link edit) and reaches the repository write', async () => {
    const { builder } = arrange(AVAILABLE_ROW);
    const write = vi.spyOn(contentRepository, 'updateContentSourceInWorkspace');

    const state = await updateContentSource(
      WORKSPACE_ID,
      CONTENT_ID,
      {},
      form({ media_status: 'available', source_url: 'https://www.tiktok.com/@a/video/9' }),
    );

    expect(state).toEqual({});
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(expect.anything(), WORKSPACE_ID, CONTENT_ID, {
      source_type: 'tiktok',
      source_url: 'https://www.tiktok.com/@a/video/9',
      external_id: '2',
      media_status: 'available',
    });
    expect(tableWrites(builder)).toEqual(['update']);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not read the existing row when the requested status is not available', async () => {
    const { builder } = arrange(DRAFT_ROW);
    const read = vi.spyOn(contentRepository, 'getContentInWorkspace');

    const state = await updateContentSource(WORKSPACE_ID, CONTENT_ID, {}, form());

    expect(state).toEqual({});
    expect(read).not.toHaveBeenCalled();
    expect(tableWrites(builder)).toEqual(['update']);
  });

  it('allows available → missing (a stored object can be reported gone)', async () => {
    const { builder } = arrange(AVAILABLE_ROW);

    const state = await updateContentSource(
      WORKSPACE_ID,
      CONTENT_ID,
      {},
      form({ media_status: 'missing' }),
    );

    expect(state).toEqual({});
    expect(tableWrites(builder)).toEqual(['update']);
  });
});

describe('updateContentSource: access gates run before any repository call', () => {
  it('unauthenticated → redirect("/login") before Zod, membership, or any query', async () => {
    mockedUser.mockResolvedValue(null);
    const client = vi.fn();
    mockedClient.mockImplementation(client);

    await expect(
      updateContentSource(WORKSPACE_ID, CONTENT_ID, {}, form({ media_status: 'available' })),
    ).rejects.toThrow('NEXT_REDIRECT:/login');

    expect(redirect).toHaveBeenCalledWith('/login');
    expect(client).not.toHaveBeenCalled();
    expect(mockedMembership).not.toHaveBeenCalled();
  });

  it('non-member → NO_ACCESS error, no read, no write', async () => {
    const { builder, from } = arrange(DRAFT_ROW);
    mockedMembership.mockResolvedValue(null);

    const state = await updateContentSource(
      WORKSPACE_ID,
      CONTENT_ID,
      {},
      form({ media_status: 'available' }),
    );

    expect(state).toEqual({ error: 'You do not have access to this workspace.' });
    expect(mockedMembership).toHaveBeenCalledWith(expect.anything(), WORKSPACE_ID, USER.id);
    expect(from).not.toHaveBeenCalled();
    expect(builder.calls).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('not found on the transition read → "Content not found." and no write', async () => {
    const { builder } = arrange(null);

    const state = await updateContentSource(
      WORKSPACE_ID,
      CONTENT_ID,
      {},
      form({ media_status: 'available' }),
    );

    expect(state).toEqual({ error: 'Content not found.' });
    expect(tableWrites(builder)).toEqual([]);
  });

  it('not found on the write (row vanished or wrong workspace) → "Content not found."', async () => {
    arrange(null);

    const state = await updateContentSource(WORKSPACE_ID, CONTENT_ID, {}, form());

    expect(state).toEqual({ error: 'Content not found.' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown media_status', { media_status: 'processing' }],
    ['non-http link', { source_url: 'javascript:alert(1)' }],
    ['unknown source_type', { source_type: 'facebook' }],
  ])(
    'invalid payload (%s) returns field errors and never reaches the repository',
    async (_, bad) => {
      const { builder, from } = arrange(DRAFT_ROW);

      const state = await updateContentSource(WORKSPACE_ID, CONTENT_ID, {}, form(bad));

      expect(state.error).toBeUndefined();
      expect(state.fieldErrors).toBeDefined();
      expect(Object.keys(state.fieldErrors ?? {})).toEqual(Object.keys(bad));
      // Validation runs before the client is even created.
      expect(mockedClient).not.toHaveBeenCalled();
      expect(mockedMembership).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
      expect(builder.calls).toEqual([]);
    },
  );

  it('a repository failure is reported generically, not thrown to the client', async () => {
    mockedUser.mockResolvedValue(USER);
    mockedMembership.mockResolvedValue(WORKSPACE);
    const { client } = createMockClient({
      content: new MockQueryBuilder({
        data: null,
        error: { code: '23514', message: 'violates check constraint' },
      }),
    });
    mockedClient.mockResolvedValue(client);

    const state = await updateContentSource(WORKSPACE_ID, CONTENT_ID, {}, form());

    expect(state).toEqual({ error: 'Unable to save the source. Please try again.' });
    expect(state.error).not.toContain('23514');
    expect(refresh).not.toHaveBeenCalled();
  });
});
