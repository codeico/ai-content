import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * A page left open outlives its session. The user comes back, presses Save,
 * and the cookie is gone.
 *
 * Verified in the browser by deleting the auth cookie on a loaded workspace
 * page and then submitting a rename: the app redirected cleanly to /login, no
 * error boundary, no 500, the rename was not applied, and the login page
 * leaked neither the workspace name nor the text that had been typed. Signing
 * back in showed the original name intact.
 *
 * No defect found. What is pinned is the ordering that produces it: every
 * action re-checks auth on the server BEFORE it validates input or touches
 * the database, so an expired session can never be a partial write.
 */
const ACTION_FILES = [
  // updateWorkspaceProfile lives in workspace-actions.ts, not a profile file.
  'apps/web/src/app/app/workspace-actions.ts',
  'apps/web/src/app/app/workspaces/[workspaceId]/content-actions.ts',
  'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/caption-actions.ts',
];

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('every action re-checks the session on the server', () => {
  it.each(ACTION_FILES)('%s reads the authenticated user', (path) => {
    // The client cannot be trusted to have redirected; the cookie may have
    // expired between render and submit.
    expect(source(path)).toMatch(/getAuthenticatedUser\(\)/);
  });

  it.each(ACTION_FILES)('%s sends an expired session to /login', (path) => {
    // Counted per action, not matched once per file: these files hold several
    // actions, so one that quietly stops redirecting hides behind its
    // neighbours in an existence check.
    const code = source(path);
    const starts = [...code.matchAll(/export async function \w+\(/g)].map((m) => m.index!);
    const bodies = starts
      .map((start, i) => code.slice(start, starts[i + 1] ?? code.length))
      .filter((b) => b.includes('getAuthenticatedUser()'));

    expect(bodies.length).toBeGreaterThan(0);

    for (const body of bodies) {
      expect(body).toMatch(/redirect\('\/login'\)/);
    }
  });
});

describe('the auth check comes before any work', () => {
  /** Split a file into its exported action bodies, ignoring imports. */
  function actionBodies(code: string): string[] {
    const starts = [...code.matchAll(/export async function \w+\(/g)].map((m) => m.index!);

    return starts.map((start, i) => code.slice(start, starts[i + 1] ?? code.length));
  }

  it.each(ACTION_FILES)('%s checks auth before validating or writing', (path) => {
    const bodies = actionBodies(source(path)).filter((b) => b.includes('getAuthenticatedUser()'));

    expect(bodies.length).toBeGreaterThan(0);

    for (const body of bodies) {
      const auth = body.indexOf('getAuthenticatedUser()');
      const work = [
        body.indexOf('createServerClient()'),
        body.indexOf('safeParse'),
        body.indexOf('validateWorkspaceName'),
      ].filter((i) => i > -1);

      if (work.length === 0) continue;
      // An expired session must not reach a database call, even one that RLS
      // would reject anyway - a redirect is the honest answer.
      expect(auth).toBeLessThan(Math.min(...work));
    }
  });
});

describe('the app layout gates the whole area', () => {
  const LAYOUT = source('apps/web/src/app/app/layout.tsx');

  it('redirects an unauthenticated visitor before rendering', () => {
    expect(LAYOUT).toMatch(/if \(!user\)/);
    expect(LAYOUT).toMatch(/redirect\('\/login'\)/);
  });

  it('is never cached, so a stale session cannot be served', () => {
    expect(LAYOUT).toMatch(/force-dynamic/);
  });
});
