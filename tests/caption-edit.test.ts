import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Editing a caption appends a NEW version; it never rewrites the one the user
 * started from. The database enforces that (20260903150000 makes body
 * write-once), so these pin the application side: that the action reads the
 * source caption, authors the new row as a human rather than a model, carries
 * the prompt version forward, and refuses the cheap mistakes — no-op saves,
 * blank bodies, cap overruns, foreign ids.
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

import { CAPTION_MAX_VERSIONS } from '@ai-content/shared/content/caption';

import { editCaption } from '../apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/caption-actions.ts';
import { HUMAN_EDIT_MODEL_NAME } from '../apps/web/src/server/repositories/caption-repository.ts';
import { createMockClient, MockQueryBuilder } from './helpers/mock-supabase.ts';

const { refresh } = mocks;

const WS = '550e8400-e29b-41d4-a716-446655440000';
const CONTENT_ID = '6f9619ff-8b86-4d11-842d-00c04fc964ff';
const CAPTION_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const USER = { id: 'user-1' };

const SOURCE = {
  id: CAPTION_ID,
  content_id: CONTENT_ID,
  workspace_id: WS,
  version: 2,
  body: 'The original text.',
  status: 'active',
  model_name: 'router-model-x',
  prompt_version: 'caption-v2',
  created_by: 'someone-else',
  created_at: '',
  updated_at: '',
};

function form(body: string): FormData {
  const fd = new FormData();
  fd.set('body', body);
  return fd;
}

/** member -> source caption -> count -> latest version -> insert */
function editClient(over: Partial<Record<string, MockQueryBuilder | MockQueryBuilder[]>> = {}) {
  return createMockClient({
    workspace_members: new MockQueryBuilder({ data: { role: 'member' }, error: null }),
    workspaces: new MockQueryBuilder({ data: { id: WS, owner_id: 'x' }, error: null }),
    captions: [
      new MockQueryBuilder({ data: SOURCE, error: null }),
      new MockQueryBuilder({ data: null, error: null, count: 2 }),
      new MockQueryBuilder({ data: { version: 2 }, error: null }),
      new MockQueryBuilder({ data: { ...SOURCE, version: 3 }, error: null }),
    ],
    ...over,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUser.mockResolvedValue(USER);
});

describe('editCaption appends rather than rewrites', () => {
  it('inserts the next version authored by the human, carrying the prompt version forward', async () => {
    const insert = new MockQueryBuilder({ data: { ...SOURCE, version: 3 }, error: null });
    const { client } = editClient({
      captions: [
        new MockQueryBuilder({ data: SOURCE, error: null }),
        new MockQueryBuilder({ data: null, error: null, count: 2 }),
        new MockQueryBuilder({ data: { version: 2 }, error: null }),
        insert,
      ],
    });
    mocks.createServerClient.mockResolvedValue(client);

    const state = await editCaption(WS, CONTENT_ID, CAPTION_ID, {}, form('A better caption.'));

    expect(state).toEqual({});

    const payload = insert.calls.find((c) => c.method === 'insert')?.args[0] as Record<
      string,
      unknown
    >;
    expect(payload.body).toBe('A better caption.');
    expect(payload.version).toBe(3);
    // Authored by the person, not the model that wrote the source.
    expect(payload.model_name).toBe(HUMAN_EDIT_MODEL_NAME);
    expect(payload.model_name).not.toBe('router-model-x');
    expect(payload.created_by).toBe(USER.id);
    // The prompt the text descends from stays traceable.
    expect(payload.prompt_version).toBe('caption-v2');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('never issues an update against the source caption', async () => {
    const { client, from } = editClient();
    mocks.createServerClient.mockResolvedValue(client);

    await editCaption(WS, CONTENT_ID, CAPTION_ID, {}, form('Changed.'));

    const updated = from.mock.results
      .map((r: { value: unknown }) => r.value as MockQueryBuilder)
      .filter((b) => b?.calls?.some((c) => c.method === 'update'));

    expect(updated).toEqual([]);
  });
});

describe('editCaption refuses the cheap mistakes', () => {
  it('does nothing when the text is unchanged, rather than spending a version', async () => {
    const { client, from } = editClient();
    mocks.createServerClient.mockResolvedValue(client);

    const state = await editCaption(WS, CONTENT_ID, CAPTION_ID, {}, form(SOURCE.body));

    expect(state).toEqual({});
    const inserted = from.mock.results
      .map((r: { value: unknown }) => r.value as MockQueryBuilder)
      .filter((b) => b?.calls?.some((c) => c.method === 'insert'));
    expect(inserted).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('rejects a blank body', async () => {
    const { client } = editClient();
    mocks.createServerClient.mockResolvedValue(client);

    const state = await editCaption(WS, CONTENT_ID, CAPTION_ID, {}, form('   \n  '));

    expect(state.error).toBeDefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refuses a non-member before reading the caption', async () => {
    const { client, from } = createMockClient({
      workspace_members: new MockQueryBuilder({ data: null, error: null }),
    });
    mocks.createServerClient.mockResolvedValue(client);

    const state = await editCaption(WS, CONTENT_ID, CAPTION_ID, {}, form('Anything.'));

    expect(state).toEqual({ error: 'You do not have access to this workspace.' });
    expect(from).not.toHaveBeenCalledWith('captions');
  });

  it('returns not found for a caption outside this content', async () => {
    const { client } = editClient({
      captions: [new MockQueryBuilder({ data: null, error: null })],
    });
    mocks.createServerClient.mockResolvedValue(client);

    const state = await editCaption(WS, CONTENT_ID, CAPTION_ID, {}, form('Anything.'));

    expect(state).toEqual({ error: 'Caption not found.' });
  });

  it('applies the version cap to edits too', async () => {
    const { client } = editClient({
      captions: [
        new MockQueryBuilder({ data: SOURCE, error: null }),
        new MockQueryBuilder({ data: null, error: null, count: CAPTION_MAX_VERSIONS }),
      ],
    });
    mocks.createServerClient.mockResolvedValue(client);

    const state = await editCaption(WS, CONTENT_ID, CAPTION_ID, {}, form('One more.'));

    expect(state.error).toMatch(new RegExp(`${CAPTION_MAX_VERSIONS} caption versions`));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('rejects a malformed caption id before any query', async () => {
    const { client, from } = editClient();
    mocks.createServerClient.mockResolvedValue(client);

    const state = await editCaption(WS, CONTENT_ID, 'not-a-uuid', {}, form('Anything.'));

    expect(state.error).toBeDefined();
    expect(from).not.toHaveBeenCalled();
  });

  it('redirects to /login without a session', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    await expect(editCaption(WS, CONTENT_ID, CAPTION_ID, {}, form('Anything.'))).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );
  });
});
