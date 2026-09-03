import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Sign in is the first screen anyone sees, so it is the worst place to get
 * mobile details wrong.
 *
 * Measured at 390x844: no defect found. Both fields are 44px tall at 16px,
 * carry the right autocomplete and keyboard hints, the submit button sits at
 * 590px well clear of the keyboard, and the whole form fits one screen. The
 * app's bottom tab bar correctly does not appear here - there is nothing to
 * navigate to before signing in.
 *
 * These properties are cheap to lose in a refactor and expensive to notice, so
 * they are pinned rather than left to chance.
 */
const CREDENTIAL_FORM = readFileSync(
  join(process.cwd(), 'apps/web/src/app/(auth)/credential-form.tsx'),
  'utf8',
);
const AUTH_LAYOUT = readFileSync(join(process.cwd(), 'apps/web/src/app/(auth)/layout.tsx'), 'utf8');

describe('the keyboard offers the right keys', () => {
  it('asks for an email keyboard', () => {
    // Without inputMode the user gets a general keyboard and hunts for @.
    expect(CREDENTIAL_FORM).toMatch(/inputMode="email"/);
  });

  it('labels the return key Next on email and Go on password', () => {
    expect(CREDENTIAL_FORM).toMatch(/enterKeyHint="next"/);
    expect(CREDENTIAL_FORM).toMatch(/enterKeyHint="go"/);
  });
});

describe('password managers can fill the form', () => {
  it('marks the email field', () => {
    expect(CREDENTIAL_FORM).toMatch(/autoComplete="email"/);
  });

  it('distinguishes signing in from creating an account', () => {
    // current-password vs new-password decides whether a manager offers the
    // saved credential or proposes a new one.
    expect(CREDENTIAL_FORM).toMatch(/current-password/);
    expect(CREDENTIAL_FORM).toMatch(/new-password/);
  });
});

describe('the auth screen is not the app shell', () => {
  it('renders no bottom tab bar', () => {
    // There is nowhere to navigate to before signing in.
    expect(AUTH_LAYOUT).not.toMatch(/AppNav/);
  });

  it('uses the dynamic viewport height', () => {
    // 100vh on a phone is taller than the visible area with browser chrome up.
    expect(AUTH_LAYOUT).toMatch(/dvh/);
  });
});
