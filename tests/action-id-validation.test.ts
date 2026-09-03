import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route ids reaching a Server Action are attacker-controlled: `.bind` puts them
 * in an encrypted action reference, but a direct POST can carry anything. The
 * pages validate ids with Zod before querying; the actions did not, so a
 * malformed id reached Postgres and raised 22P02 (verified against the linked
 * database), surfacing as an unhandled 500 rather than a clean refusal.
 *
 * No information leaked either way — but an uncaught path is one nobody
 * reasoned about, and 500s hide real failures in logs.
 */
const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createServerClient: vi.fn(),
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

import {
  updateWorkspace,
  updateWorkspaceProfile,
} from '../apps/web/src/app/app/workspace-actions.ts';
import {
  generateCaption,
  selectCaption,
} from '../apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/caption-actions.ts';
import { updateContent } from '../apps/web/src/app/app/workspaces/[workspaceId]/content-actions.ts';
import { createMockClient, MockQueryBuilder } from './helpers/mock-supabase.ts';

const USER = { id: 'user-1' };
const GOOD_WS = '550e8400-e29b-41d4-a716-446655440000';
const GOOD_CONTENT = '6f9619ff-8b86-4d11-842d-00c04fc964ff';

/** Shapes a real POST could carry in place of a bound uuid. */
const MALFORMED = ["' OR 1=1--", 'not-a-uuid', '', '../../etc/passwd', '00000000'];

function form(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** A client that fails the test if any query is attempted. */
function forbiddenClient() {
  return createMockClient(
    new Proxy(
      {},
      {
        get() {
          throw new Error('Action queried the database with an unvalidated id');
        },
        has: () => true,
      },
    ) as Record<string, MockQueryBuilder>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUser.mockResolvedValue(USER);
  mocks.createServerClient.mockResolvedValue(forbiddenClient().client);
});

describe.each(MALFORMED)('a malformed id (%j) is refused before any query', (bad) => {
  it('updateWorkspace', async () => {
    const state = await updateWorkspace(bad, {}, form({ name: 'x' }));
    expect(state.error).toBeDefined();
  });

  it('updateWorkspaceProfile', async () => {
    const state = await updateWorkspaceProfile(bad, {}, form({ niche: 'x' }));
    expect(state.error).toBeDefined();
  });

  it('updateContent (workspace id)', async () => {
    const state = await updateContent(bad, GOOD_CONTENT, {}, form({ title: 'x', status: 'draft' }));
    expect(state.error).toBeDefined();
  });

  it('updateContent (content id)', async () => {
    const state = await updateContent(GOOD_WS, bad, {}, form({ title: 'x', status: 'draft' }));
    expect(state.error).toBeDefined();
  });

  it('generateCaption', async () => {
    const state = await generateCaption(bad, GOOD_CONTENT, {}, form());
    expect(state.error).toBeDefined();
  });

  it('selectCaption (caption id)', async () => {
    const state = await selectCaption(GOOD_WS, GOOD_CONTENT, bad, {}, form());
    expect(state.error).toBeDefined();
  });
});

describe('the refusal is indistinguishable from not-found', () => {
  it('gives the same message for a malformed id and a well-formed unknown id', async () => {
    const malformed = await generateCaption('not-a-uuid', GOOD_CONTENT, {}, form());

    // Well-formed but no membership row: the normal not-found path.
    mocks.createServerClient.mockResolvedValue(
      createMockClient({
        workspace_members: new MockQueryBuilder({ data: null, error: null }),
      }).client,
    );
    const unknown = await generateCaption(GOOD_WS, GOOD_CONTENT, {}, form());

    // A caller learns nothing from the difference in id shape.
    expect(malformed.error).toBe(unknown.error);
  });

  it('does not echo the rejected value back to the caller', async () => {
    const state = await generateCaption("' OR 1=1--", GOOD_CONTENT, {}, form());
    expect(state.error).not.toContain('OR 1=1');
  });
});
