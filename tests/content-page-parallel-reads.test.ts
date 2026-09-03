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
const PAGE = readFileSync(
  join(process.cwd(), 'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/page.tsx'),
  'utf8',
);

/** The page body, excluding the comment block that explains the design. */
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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
