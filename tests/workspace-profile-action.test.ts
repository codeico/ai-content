import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Action-level gate for updateWorkspaceProfile. Pins the order of the
 * action's checks: session → Zod → ownership (via repository) → write →
 * refresh. Zod and the repository are pinned elsewhere; here the real
 * repository runs against the recording mock client so the action's actual
 * calls are observed, not replaced.
 *
 * Mocks: next/navigation (redirect throws like the real one), next/cache
 * (refresh needs a request scope), @/lib/supabase/server (the session is the
 * input under test). Everything else is real.
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

import { updateWorkspaceProfile } from '../apps/web/src/app/app/workspace-actions.ts';
import { createMockClient, MockQueryBuilder } from './helpers/mock-supabase.ts';

const { refresh, redirect } = mocks;

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER = { id: 'user-1' };

const SAVED_ROW = {
  id: 'p-1',
  workspace_id: WORKSPACE_ID,
  niche: 'home cooking',
  description: null,
  target_audience: null,
  tone: null,
  writing_style: null,
  content_goals: null,
  restrictions: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function clientWith(ownerLookup: unknown, profileResult = { data: SAVED_ROW, error: null }) {
  const workspaces = new MockQueryBuilder({ data: ownerLookup, error: null });
  const profiles = new MockQueryBuilder(profileResult);
  const { client, from } = createMockClient({ workspaces, workspace_profiles: profiles });
  mocks.createServerClient.mockResolvedValue(client);
  return { workspaces, profiles, from };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedUser.mockResolvedValue(USER);
});

describe('updateWorkspaceProfile', () => {
  it('redirects to /login when there is no session, before creating a client', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    await expect(updateWorkspaceProfile(WORKSPACE_ID, {}, form({ niche: 'x' }))).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );

    expect(redirect).toHaveBeenCalledWith('/login');
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it('returns field errors for an over-long niche without touching the database', async () => {
    const result = await updateWorkspaceProfile(WORKSPACE_ID, {}, form({ niche: 'n'.repeat(101) }));

    expect(result.fieldErrors?.niche).toMatch(/at most 100 characters/);
    expect(result.error).toBeUndefined();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refuses a non-owner with the generic no-access message and never writes', async () => {
    const { profiles, from } = clientWith(null);

    const result = await updateWorkspaceProfile(WORKSPACE_ID, {}, form({ niche: 'x' }));

    expect(result).toEqual({ error: 'You do not have access to this workspace.' });
    expect(from.mock.calls.map((c) => c[0])).toEqual(['workspaces']);
    expect(profiles.calls).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('checks ownership with the actor id from the session, not from the form', async () => {
    const { workspaces } = clientWith({ id: WORKSPACE_ID });

    await updateWorkspaceProfile(WORKSPACE_ID, {}, form({ niche: 'x', owner_id: 'evil' }));

    expect(workspaces.calls).toContainEqual({ method: 'eq', args: ['owner_id', USER.id] });
    expect(workspaces.calls).not.toContainEqual({ method: 'eq', args: ['owner_id', 'evil'] });
  });

  it('writes the seven validated fields with the bound workspace id and reports saved', async () => {
    const { profiles } = clientWith({ id: WORKSPACE_ID });

    const result = await updateWorkspaceProfile(
      WORKSPACE_ID,
      {},
      form({
        niche: '  home cooking ',
        description: '',
        target_audience: 'students',
        restrictions: '   ',
        workspace_id: '11111111-1111-4111-8111-111111111111',
        id: 'evil',
      }),
    );

    expect(result).toEqual({ saved: true });
    const upsert = profiles.calls.find((c) => c.method === 'upsert');
    expect(upsert?.args[0]).toEqual({
      niche: 'home cooking',
      description: null,
      target_audience: 'students',
      tone: null,
      writing_style: null,
      content_goals: null,
      restrictions: null,
      workspace_id: WORKSPACE_ID,
    });
    expect(upsert?.args[1]).toEqual({ onConflict: 'workspace_id' });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('accepts an all-blank submission as clearing the profile', async () => {
    const { profiles } = clientWith({ id: WORKSPACE_ID });

    const result = await updateWorkspaceProfile(WORKSPACE_ID, {}, form({}));

    expect(result).toEqual({ saved: true });
    const payload = profiles.calls.find((c) => c.method === 'upsert')?.args[0] as Record<
      string,
      unknown
    >;
    expect(Object.values(payload).filter((v) => v !== null)).toEqual([WORKSPACE_ID]);
  });

  it('turns a repository failure into a generic message without leaking the code', async () => {
    clientWith({ id: WORKSPACE_ID }, {
      data: SAVED_ROW,
      error: {
        code: '23514',
        message: 'violates check constraint "workspace_profiles_niche_shape"',
      },
    } as never);

    const result = await updateWorkspaceProfile(WORKSPACE_ID, {}, form({ niche: 'x' }));

    expect(result).toEqual({ error: 'Unable to save the profile. Please try again.' });
    expect(JSON.stringify(result)).not.toContain('23514');
    expect(JSON.stringify(result)).not.toContain('constraint');
    expect(refresh).not.toHaveBeenCalled();
  });
});
