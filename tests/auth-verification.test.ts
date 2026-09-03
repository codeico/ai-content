import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * `supabase.auth.getSession()` reads the session straight from the cookie
 * WITHOUT verifying it against the Auth server, so a forged cookie satisfies
 * it. `getUser()` revalidates the token. Using the wrong one turns every
 * authorization check in the product into a formality, and nothing in the type
 * system or the linter distinguishes them — both return a plausible user.
 *
 * apps/web/src/lib/supabase/server.ts documents this choice in a comment.
 * These tests make it an enforced invariant instead of an intention.
 */
const WEB_SRC = join(import.meta.dirname, '..', 'apps', 'web', 'src');

function collectSources(dir: string): { path: string; text: string }[] {
  const found: { path: string; text: string }[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      found.push(...collectSources(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      found.push({ path: full, text: readFileSync(full, 'utf8') });
    }
  }

  return found;
}

/** Comments legitimately mention getSession to explain why it is not used. */
function stripComments(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
    })
    .join('\n');
}

const sources = collectSources(WEB_SRC).map(({ path, text }) => ({
  path,
  code: stripComments(text),
}));

describe('authentication reads a verified user, never a trusted cookie', () => {
  it('found application sources', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it('never calls auth.getSession() for authorization', () => {
    for (const { path, code } of sources) {
      expect(code, `${path} calls auth.getSession()`).not.toMatch(/auth\s*\.\s*getSession\s*\(/);
    }
  });

  it('resolves the current user through getUser()', () => {
    const serverModule = sources.find((source) => source.path.endsWith('lib/supabase/server.ts'));

    expect(serverModule, 'apps/web/src/lib/supabase/server.ts').toBeDefined();
    expect(serverModule!.code).toMatch(/auth\s*\.\s*getUser\s*\(/);
  });

  it('fails closed when Supabase is unconfigured rather than assuming a user', () => {
    const serverModule = sources.find((source) => source.path.endsWith('lib/supabase/server.ts'));

    // No configuration must yield no user, so protected routes redirect
    // instead of rendering with an undefined session.
    expect(serverModule!.code).toMatch(/isRuntimeEnvConfigured\(\)[\s\S]{0,60}return null/);
  });

  it('treats an auth error as "no user" instead of propagating it', () => {
    const serverModule = sources.find((source) => source.path.endsWith('lib/supabase/server.ts'));

    expect(serverModule!.code).toMatch(/if \(error\)[\s\S]{0,40}return null/);
  });

  it('keeps the service role key out of every request-scoped client', () => {
    for (const { path, code } of sources) {
      // Only the admin factory in packages/database may name it; nothing in
      // the web app should reach for the RLS-bypassing key.
      expect(code, `${path} references the service role key`).not.toMatch(
        /SUPABASE_SERVICE_ROLE_KEY/,
      );
    }
  });
});
