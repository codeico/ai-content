import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The content page issues its four reads concurrently instead of chaining
 * them. Measured against the remote database, each round trip costs ~120ms
 * regardless of the query, so the chain spent ~380ms enforcing an ordering
 * that RLS already enforces: every table's SELECT policy gates on
 * workspace_ids_for_current_user(), so a non-member gets zero rows from each
 * query independently. Application-code time fell from ~1038ms to ~600ms.
 *
 * The risk of the change is not performance, it is authorisation: overlapping
 * reads must not become reads that happen WITHOUT an authorisation check. The
 * checks still run before anything renders, and this file holds that line.
 */
function pageSource(path: string): string {
  // Comments stripped: these assertions are about code, and the comments in
  // these files quote the very patterns being forbidden.
  return readFileSync(join(process.cwd(), path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const CONTENT_PAGE = 'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/page.tsx';
const WORKSPACE_PAGE = 'apps/web/src/app/app/workspaces/[workspaceId]/page.tsx';
const PROFILE_PAGE = 'apps/web/src/app/app/workspaces/[workspaceId]/profile/page.tsx';

/** Every page that reads more than one row set, and so must overlap them. */
const MULTI_READ_PAGES = [CONTENT_PAGE, WORKSPACE_PAGE, PROFILE_PAGE];

const CODE = pageSource(CONTENT_PAGE);

describe('the reads overlap', () => {
  it('issues them in one Promise.all rather than a chain', () => {
    expect(CODE).toMatch(/await Promise\.all\(\[/);
  });

  it('covers all four reads', () => {
    const parallelBlock = CODE.slice(
      CODE.indexOf('await Promise.all(['),
      CODE.indexOf(']);', CODE.indexOf('await Promise.all([')),
    );

    expect(parallelBlock).toContain('getWorkspaceForUser');
    expect(parallelBlock).toContain('getContentInWorkspace');
    expect(parallelBlock).toContain('listCaptionsForContent');
    expect(parallelBlock).toContain('getProfileForWorkspace');
  });

  it('has no sequential repository await left outside it', () => {
    // A single stray `await getX(...)` reintroduces a full round trip.
    // getAuthenticatedUser is excluded on purpose: it must resolve before any
    // query runs, so it is the one read that is legitimately sequential.
    const strays = [...CODE.matchAll(/await (get|list)[A-Za-z]+\(/g)]
      .map((m) => m[0])
      .filter((call) => !call.includes('getAuthenticatedUser'));

    expect(strays).toEqual([]);
  });
});

describe('authorisation still decides before anything renders', () => {
  it('checks the workspace and returns notFound when it is not visible', () => {
    expect(CODE).toMatch(/if \(!workspace\)\s*\{\s*notFound\(\);/);
  });

  it('checks the content and returns notFound when it is not visible', () => {
    expect(CODE).toMatch(/if \(!content\)\s*\{\s*notFound\(\);/);
  });

  it('runs both checks before the page uses captions or the profile', () => {
    const workspaceCheck = CODE.search(/if \(!workspace\)/);
    const contentCheck = CODE.search(/if \(!content\)/);
    const firstRender = CODE.indexOf('profileIsEmpty');

    expect(workspaceCheck).toBeGreaterThan(-1);
    expect(contentCheck).toBeGreaterThan(workspaceCheck);
    expect(firstRender).toBeGreaterThan(contentCheck);
  });

  it('still redirects an unauthenticated caller before touching the database', () => {
    const authCheck = CODE.search(/if \(!user\)/);
    const firstQuery = CODE.indexOf('await Promise.all([');

    expect(authCheck).toBeGreaterThan(-1);
    expect(authCheck).toBeLessThan(firstQuery);
  });

  it('validates both ids before querying with them', () => {
    // A malformed uuid reaching Postgres raises 22P02 and a 500.
    const idChecks = CODE.search(/workspaceIdResult|contentIdResult/);
    const firstQuery = CODE.indexOf('await Promise.all([');

    expect(idChecks).toBeGreaterThan(-1);
    expect(idChecks).toBeLessThan(firstQuery);
  });
});

describe('every parallel read is scoped by the workspace id', () => {
  it('passes the verified workspace id to each one', () => {
    const parallelBlock = CODE.slice(
      CODE.indexOf('await Promise.all(['),
      CODE.indexOf(']);', CODE.indexOf('await Promise.all([')),
    );
    const calls = parallelBlock.split('\n').filter((l) => /\b(get|list)[A-Za-z]+\(/.test(l));

    expect(calls.length).toBe(4);
    // Reading a caption list scoped only by content id would cross workspaces.
    for (const call of calls) {
      expect(call).toMatch(/workspaceIdResult\.data|workspace\.id/);
    }
  });
});

describe('every multi-read page overlaps its reads', () => {
  // The content page defect was not unique to it: the workspace and profile
  // pages chained the membership check ahead of reads that RLS already gates,
  // paying a round trip each to enforce nothing extra. This rule is stated
  // once so a fourth page cannot quietly reintroduce it.
  it.each(MULTI_READ_PAGES)('%s issues its reads together', (path) => {
    const code = pageSource(path);

    expect(code).toMatch(/await Promise\.all\(\[/);
  });

  it.each(MULTI_READ_PAGES)('%s has no stray sequential repository read', (path) => {
    const code = pageSource(path);
    // getAuthenticatedUser is excluded: it must resolve before any query runs.
    const strays = [...code.matchAll(/await (get|list|count)[A-Za-z]+\(/g)]
      .map((m) => m[0])
      .filter((call) => !call.includes('getAuthenticatedUser'));

    expect(strays).toEqual([]);
  });

  it.each(MULTI_READ_PAGES)('%s still decides visibility before rendering', (path) => {
    const code = pageSource(path);
    const check = code.search(/if \(!workspace\)/);
    const parallel = code.indexOf('await Promise.all([');

    expect(check).toBeGreaterThan(-1);
    // The check reads a resolved value, so it must come after the reads start
    // and before anything renders.
    expect(check).toBeGreaterThan(parallel);
    expect(code.slice(check)).toMatch(/notFound\(\)/);
  });

  it.each(MULTI_READ_PAGES)('%s validates the workspace id before querying', (path) => {
    const code = pageSource(path);
    const validation = code.search(/idResult|workspaceIdResult/);
    const parallel = code.indexOf('await Promise.all([');

    expect(validation).toBeGreaterThan(-1);
    expect(validation).toBeLessThan(parallel);
  });
});
