import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The auth forms must not become an account-enumeration oracle. Both
 * properties below are one well-meaning "clearer error message" away from
 * breaking, and nothing in the type system or linter would object.
 *
 * Verified against the live auth server before these were written: a
 * registered address with the wrong password and an address with no account
 * both return "Invalid email or password.", and signing up with an
 * already-registered address returns the same "check your email" notice as a
 * fresh signup.
 */
const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    auth: {
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
  }),
}));

import { signIn, signUp } from '../apps/web/src/app/(auth)/actions.ts';

const SOURCE = readFileSync(join(process.cwd(), 'apps/web/src/app/(auth)/actions.ts'), 'utf8');

function credentials(email: string, password = 'a-valid-password-123'): FormData {
  const fd = new FormData();
  fd.set('email', email);
  fd.set('password', password);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sign in cannot be used to enumerate accounts', () => {
  /** The two failures a provider distinguishes and a user must not. */
  const PROVIDER_ERRORS = [
    { message: 'Invalid login credentials' },
    { message: 'User not found' },
    { message: 'Email not confirmed' },
  ];

  it.each(PROVIDER_ERRORS)('returns one message regardless of why (%j)', async (error) => {
    mocks.signInWithPassword.mockResolvedValue({ error });

    const state = await signIn({}, credentials('someone@example.test'));

    expect(state.error).toBe('Invalid email or password.');
  });

  it('never forwards the provider message to the user', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { message: 'User not found for email someone@example.test' },
    });

    const state = await signIn({}, credentials('someone@example.test'));

    expect(state.error).not.toMatch(/not found/i);
    expect(state.error).not.toContain('someone@example.test');
  });

  it('does not branch on the provider error before answering', () => {
    // A future "if (error.message.includes(...))" would reintroduce the oracle.
    const signInBody = SOURCE.slice(
      SOURCE.indexOf('export async function signIn'),
      SOURCE.indexOf('export async function signOut'),
    );

    expect(signInBody).not.toMatch(/error\.(message|code|status)/);
  });
});

describe('sign up cannot confirm whether an address is registered', () => {
  it('reports the same notice for a new address and a taken one', async () => {
    // Supabase obfuscates a duplicate signup as a user with no session, which
    // is the same shape as "awaiting email confirmation".
    mocks.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null });

    const taken = await signUp({}, credentials('already@example.test'));
    const fresh = await signUp({}, credentials('brand-new@example.test'));

    expect(taken.notice).toBe(fresh.notice);
    expect(taken.error).toBeUndefined();
  });

  it('keeps the failure message generic', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'User already registered' },
    });

    const state = await signUp({}, credentials('already@example.test'));

    expect(state.error).toBe('Unable to create account. Please check your details and try again.');
    expect(state.error).not.toMatch(/already/i);
  });

  it('does not branch on the provider error before answering', () => {
    const signUpBody = SOURCE.slice(
      SOURCE.indexOf('export async function signUp'),
      SOURCE.indexOf('export async function signIn'),
    );

    expect(signUpBody).not.toMatch(/error\.(message|code|status)/);
  });

  it('does not redirect into the app without a session', async () => {
    // Redirecting on a sessionless signup would bounce off the auth gate and
    // land the user back at /login with no explanation.
    mocks.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null });

    const state = await signUp({}, credentials('new@example.test'));

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(state.notice).toMatch(/confirm your account/i);
  });
});

describe('credentials never reach an error path', () => {
  it('no password appears in any returned state', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });

    const state = await signIn({}, credentials('someone@example.test', 'hunter2-secret'));

    expect(JSON.stringify(state)).not.toContain('hunter2-secret');
  });
});
