import { AIError, type AIChatRequest, type AIProvider } from '@ai-content/ai';
import { CAPTION_MAX_VERSIONS } from '@ai-content/shared/content/caption';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Action-level gate for generateCaption / selectCaption. Pins the order of the
 * checks: session → membership → content → provider config → prompt → chat →
 * insert → refresh, and that every failure short-circuits BEFORE the next
 * step. The real repositories run against the recording mock client so the
 * action's actual queries are observed; only the model is faked.
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
  generateCaptionWith,
  selectCaption,
} from '../apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/caption-actions.ts';
import { createMockClient, MockQueryBuilder } from './helpers/mock-supabase.ts';

const { refresh, redirect } = mocks;

const WS = '550e8400-e29b-41d4-a716-446655440000';
const CONTENT_ID = '6f9619ff-8b86-4d11-842d-00c04fc964ff';
const CAPTION_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const USER = { id: 'user-1' };
const FORM = new FormData();

const CONTENT_ROW = {
  id: CONTENT_ID,
  workspace_id: WS,
  title: 'Five-minute garlic noodles',
  status: 'draft',
  source_type: 'manual',
  source_url: 'https://example.com/noodles',
  external_id: null,
  media_status: 'none',
  storage_provider: null,
  storage_key: null,
  created_at: '',
  updated_at: '',
};

const PROFILE_ROW = {
  id: 'p-1',
  workspace_id: WS,
  niche: 'home cooking',
  description: null,
  target_audience: 'busy parents',
  tone: 'warm',
  writing_style: null,
  content_goals: null,
  restrictions: 'no diet claims',
  created_at: '',
  updated_at: '',
};

const SAVED = {
  id: CAPTION_ID,
  content_id: CONTENT_ID,
  workspace_id: WS,
  version: 1,
  body: 'Garlic noodles in five minutes.',
  status: 'draft',
  model_name: 'router-reported-model',
  prompt_version: 'caption-v2',
  created_by: USER.id,
  created_at: '',
  updated_at: '',
};

class FakeProvider implements AIProvider {
  public requests: AIChatRequest[] = [];
  constructor(private readonly reply: () => Promise<{ text: string; model: string }>) {}
  async chat(request: AIChatRequest) {
    this.requests.push(request);
    return this.reply();
  }
}

function okProvider(text = 'Garlic noodles in five minutes.') {
  return new FakeProvider(async () => ({ text, model: 'router-reported-model' }));
}

/** Membership + content + profile + caption builders, all success. */
function happyClient(
  overrides: Partial<Record<string, MockQueryBuilder | MockQueryBuilder[]>> = {},
) {
  return createMockClient({
    workspace_members: new MockQueryBuilder({ data: { role: 'member' }, error: null }),
    workspaces: new MockQueryBuilder({ data: { id: WS, owner_id: 'someone' }, error: null }),
    content: new MockQueryBuilder({ data: CONTENT_ROW, error: null }),
    workspace_profiles: new MockQueryBuilder({ data: PROFILE_ROW, error: null }),
    captions: [
      new MockQueryBuilder({ data: null, error: null, count: 2 }),
      new MockQueryBuilder({ data: { version: 2 }, error: null }),
      new MockQueryBuilder({ data: { ...SAVED, version: 3 }, error: null }),
    ],
    ...overrides,
  });
}

/**
 * No caption row was written. Asserting on the builders the mock handed out
 * rather than on `from('captions')` never being called, because generation now
 * legitimately reads the table (the version-cap count) before deciding.
 */
function expectNoCaptionInsert(from: ReturnType<typeof vi.fn>) {
  const inserted = from.mock.results
    .map((r: { value: unknown }) => r.value as MockQueryBuilder)
    .filter((b) => b?.calls?.some((c) => c.method === 'insert'));

  expect(inserted).toEqual([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUser.mockResolvedValue(USER);
});

describe('generateCaption', () => {
  it('redirects to /login with no session before touching the database or the model', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);
    const provider = okProvider();
    const factory = vi.fn(() => ({ provider, model: 'm' }));

    await expect(generateCaptionWith(factory, WS, CONTENT_ID)).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );

    expect(redirect).toHaveBeenCalledWith('/login');
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });

  it('refuses a non-member before resolving the provider, so outsiders learn nothing about AI config', async () => {
    const { client, from } = createMockClient({
      workspace_members: new MockQueryBuilder({ data: null, error: null }),
    });
    mocks.createServerClient.mockResolvedValue(client);
    const factory = vi.fn(() => {
      throw new AIError('not_configured', 'missing');
    });

    const state = await generateCaptionWith(factory, WS, CONTENT_ID);

    expect(state).toEqual({ error: 'You do not have access to this workspace.' });
    expect(factory).not.toHaveBeenCalled();
    expectNoCaptionInsert(from);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('returns Content not found when the content is outside the workspace, without calling the model', async () => {
    const { client } = happyClient({ content: new MockQueryBuilder({ data: null, error: null }) });
    mocks.createServerClient.mockResolvedValue(client);
    const provider = okProvider();

    const state = await generateCaptionWith(() => ({ provider, model: 'm' }), WS, CONTENT_ID);

    expect(state).toEqual({ error: 'Content not found.' });
    expect(provider.requests).toEqual([]);
  });

  it('surfaces not_configured as a distinct state and inserts nothing', async () => {
    const { client, from } = happyClient();
    mocks.createServerClient.mockResolvedValue(client);

    const state = await generateCaptionWith(
      () => {
        throw new AIError(
          'not_configured',
          'AI Router is not configured: missing AI_ROUTER_MODEL.',
        );
      },
      WS,
      CONTENT_ID,
    );

    expect(state.notConfigured).toBe(true);
    expect(state.error).toBe('AI is not configured for this deployment.');
    expectNoCaptionInsert(from);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('builds the prompt from the content row and the workspace profile, then persists the next version', async () => {
    const { client, from } = happyClient();
    mocks.createServerClient.mockResolvedValue(client);
    const provider = okProvider();

    const state = await generateCaptionWith(
      () => ({ provider, model: 'the-model' }),
      WS,
      CONTENT_ID,
    );

    expect(state).toEqual({});
    expect(provider.requests).toHaveLength(1);
    const req = provider.requests[0]!;
    expect(req.model).toBe('the-model');
    expect(req.maxOutputTokens).toBeLessThanOrEqual(400);
    const system = req.messages.find((m) => m.role === 'system')!.content;
    const userMsg = req.messages.find((m) => m.role === 'user')!.content;
    expect(system).toContain('home cooking');
    expect(system).toContain('busy parents');
    expect(system).toContain('no diet claims');
    expect(userMsg).toContain('Five-minute garlic noodles');
    expect(userMsg).toContain('https://example.com/noodles');

    // Persisted through the repository, scoped to the verified ids.
    const captionCalls = from.mock.calls.filter((c: unknown[]) => c[0] === 'captions');
    expect(captionCalls).toHaveLength(3);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('records the model the router reported, not the one requested', async () => {
    const insert = new MockQueryBuilder({ data: SAVED, error: null });
    const { client } = happyClient({
      captions: [
        new MockQueryBuilder({ data: null, error: null, count: 0 }),
        new MockQueryBuilder({ data: null, error: null }),
        insert,
      ],
    });
    mocks.createServerClient.mockResolvedValue(client);

    await generateCaptionWith(
      () => ({ provider: okProvider(), model: 'requested' }),
      WS,
      CONTENT_ID,
    );

    const payload = insert.calls.find((c) => c.method === 'insert')?.args[0] as Record<
      string,
      unknown
    >;
    expect(payload.model_name).toBe('router-reported-model');
    expect(payload.prompt_version).toBe('caption-v2');
    expect(payload.created_by).toBe(USER.id);
    expect(payload.version).toBe(1);
  });

  it('still generates with an empty profile (no profile row)', async () => {
    const { client } = happyClient({
      workspace_profiles: new MockQueryBuilder({ data: null, error: null }),
    });
    mocks.createServerClient.mockResolvedValue(client);
    const provider = okProvider();

    const state = await generateCaptionWith(() => ({ provider, model: 'm' }), WS, CONTENT_ID);

    expect(state).toEqual({});
    expect(provider.requests).toHaveLength(1);
  });

  it.each([
    ['timeout', 'The AI Router took too long. Try again.'],
    ['rate_limited', 'The AI Router is busy. Wait a moment and try again.'],
    [
      'authentication',
      'The AI Router rejected the credentials. Check the deployment configuration.',
    ],
    ['network', 'Could not reach the AI Router. Try again.'],
    ['malformed_response', 'The AI Router returned something unexpected. Try again.'],
    ['upstream_error', 'The AI Router could not complete the request. Try again.'],
  ] as const)('maps AIError %s to a user message and inserts nothing', async (code, message) => {
    const { client, from } = happyClient();
    mocks.createServerClient.mockResolvedValue(client);
    const provider = new FakeProvider(async () => {
      throw new AIError(code, 'raw transport detail that must not surface');
    });

    const state = await generateCaptionWith(() => ({ provider, model: 'm' }), WS, CONTENT_ID);

    expect(state).toEqual({ error: message });
    expectNoCaptionInsert(from);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refuses to generate past the version cap, without calling the model', async () => {
    const { client } = happyClient({
      captions: [new MockQueryBuilder({ data: null, error: null, count: CAPTION_MAX_VERSIONS })],
    });
    mocks.createServerClient.mockResolvedValue(client);
    const provider = okProvider();

    const state = await generateCaptionWith(() => ({ provider, model: 'm' }), WS, CONTENT_ID);

    // The cap must bite BEFORE the paid call: the disabled button is only a UI
    // courtesy and a direct Server Action POST ignores it.
    expect(provider.requests).toEqual([]);
    expect(state.error).toMatch(new RegExp(`${CAPTION_MAX_VERSIONS} caption versions`));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('still generates one below the cap', async () => {
    const { client } = happyClient({
      captions: [
        new MockQueryBuilder({ data: null, error: null, count: CAPTION_MAX_VERSIONS - 1 }),
        new MockQueryBuilder({ data: { version: CAPTION_MAX_VERSIONS - 1 }, error: null }),
        new MockQueryBuilder({ data: SAVED, error: null }),
      ],
    });
    mocks.createServerClient.mockResolvedValue(client);
    const provider = okProvider();

    const state = await generateCaptionWith(() => ({ provider, model: 'm' }), WS, CONTENT_ID);

    expect(state).toEqual({});
    expect(provider.requests).toHaveLength(1);
  });

  it('rejects an empty model reply instead of saving a blank caption', async () => {
    const { client, from } = happyClient();
    mocks.createServerClient.mockResolvedValue(client);

    const state = await generateCaptionWith(
      () => ({ provider: okProvider('   \n'), model: 'm' }),
      WS,
      CONTENT_ID,
    );

    expect(state.error).toMatch(/empty caption/);
    expectNoCaptionInsert(from);
  });

  it('retries the insert exactly once on a version race', async () => {
    const dup = { code: '23505', message: 'duplicate key' };
    const { client } = happyClient({
      captions: [
        new MockQueryBuilder({ data: null, error: null, count: 1 }),
        new MockQueryBuilder({ data: { version: 1 }, error: null }),
        new MockQueryBuilder({ data: null, error: dup }),
        new MockQueryBuilder({ data: { version: 2 }, error: null }),
        new MockQueryBuilder({ data: { ...SAVED, version: 3 }, error: null }),
      ],
    });
    mocks.createServerClient.mockResolvedValue(client);

    const state = await generateCaptionWith(
      () => ({ provider: okProvider(), model: 'm' }),
      WS,
      CONTENT_ID,
    );

    expect(state).toEqual({});
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('reports a save failure distinctly from a model failure', async () => {
    const { client } = happyClient({
      captions: [
        new MockQueryBuilder({ data: null, error: null, count: 0 }),
        new MockQueryBuilder({ data: null, error: null }),
        new MockQueryBuilder({ data: null, error: { code: '42501', message: 'rls' } }),
      ],
    });
    mocks.createServerClient.mockResolvedValue(client);

    const state = await generateCaptionWith(
      () => ({ provider: okProvider(), model: 'm' }),
      WS,
      CONTENT_ID,
    );

    expect(state.error).toMatch(/could not be saved/);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('selectCaption', () => {
  it('refuses a non-member before touching captions', async () => {
    const { client, from } = createMockClient({
      workspace_members: new MockQueryBuilder({ data: null, error: null }),
    });
    mocks.createServerClient.mockResolvedValue(client);

    const state = await selectCaption(WS, CONTENT_ID, CAPTION_ID, {}, FORM);

    expect(state).toEqual({ error: 'You do not have access to this workspace.' });
    expectNoCaptionInsert(from);
  });

  it('archives then activates through the repository and refreshes', async () => {
    const verify = new MockQueryBuilder({ data: { id: CAPTION_ID, status: 'draft' }, error: null });
    const archive = new MockQueryBuilder({ data: null, error: null });
    const activate = new MockQueryBuilder({ data: { ...SAVED, status: 'active' }, error: null });
    const { client } = happyClient({ captions: [verify, archive, activate] });
    mocks.createServerClient.mockResolvedValue(client);

    const state = await selectCaption(WS, CONTENT_ID, CAPTION_ID, {}, FORM);

    expect(state).toEqual({});
    expect(activate.calls.filter((c) => c.method === 'eq').map((c) => c.args)).toEqual([
      ['workspace_id', WS],
      ['content_id', CONTENT_ID],
      ['id', CAPTION_ID],
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('returns Caption not found when the id is outside the content', async () => {
    const { client } = happyClient({
      captions: [new MockQueryBuilder({ data: null, error: null })],
    });
    mocks.createServerClient.mockResolvedValue(client);

    const state = await selectCaption(WS, CONTENT_ID, CAPTION_ID, {}, FORM);

    expect(state).toEqual({ error: 'Caption not found.' });
    expect(refresh).not.toHaveBeenCalled();
  });
});
