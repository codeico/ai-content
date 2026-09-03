import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * There is no middleware in this application: every page under /app enforces
 * authentication itself. That is a per-file invariant, so a new page can lose
 * it silently just by not being written carefully — no type error, no lint
 * error, and the page still renders for a logged-in developer.
 *
 * This gate walks the real route tree and fails when a protected route stops
 * gating itself. It reads the router's own directory layout rather than a
 * hardcoded list, so a route added tomorrow is covered without editing this
 * file.
 */
const APP_DIR = join(import.meta.dirname, '..', 'apps', 'web', 'src', 'app');

interface RouteFile {
  /** Path relative to the app directory, e.g. /app/workspaces/[workspaceId]/page.tsx */
  route: string;
  text: string;
}

function collectRouteFiles(dir: string, prefix = ''): RouteFile[] {
  const found: RouteFile[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      found.push(...collectRouteFiles(full, `${prefix}/${entry.name}`));
    } else if (entry.name === 'page.tsx' || entry.name === 'layout.tsx') {
      found.push({ route: `${prefix}/${entry.name}`, text: readFileSync(full, 'utf8') });
    }
  }

  return found;
}

const routeFiles = collectRouteFiles(APP_DIR);

/**
 * Route groups such as `(auth)` are organisational and do not appear in the
 * URL. Everything the signed-in product lives under is `/app`.
 */
const protectedRoutes = routeFiles.filter((file) => file.route.startsWith('/app/'));

describe('authenticated route gate', () => {
  it('found the route tree', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
    expect(protectedRoutes.length).toBeGreaterThan(0);
  });

  it('covers every page currently under /app', () => {
    // Fails loudly if the app directory moves, rather than silently checking
    // an empty list and reporting success.
    const routes = protectedRoutes.map((file) => file.route).sort();
    expect(routes).toContain('/app/layout.tsx');
    expect(routes).toContain('/app/page.tsx');
  });

  it('resolves the session on every protected route', () => {
    for (const { route, text } of protectedRoutes) {
      expect(text, `${route} never calls getAuthenticatedUser`).toContain('getAuthenticatedUser');
    }
  });

  it('sends an anonymous visitor to /login on every protected route', () => {
    for (const { route, text } of protectedRoutes) {
      expect(text, `${route} does not redirect to /login`).toMatch(/redirect\(['"]\/login['"]\)/);
    }
  });

  it('never renders a protected route for a null session', () => {
    for (const { route, text } of protectedRoutes) {
      // The redirect must be guarded by the falsy-user branch, not merely
      // present somewhere in the file.
      expect(text, `${route} does not guard on a missing user`).toMatch(
        /if \(!user\)[\s\S]{0,80}redirect\(['"]\/login['"]\)/,
      );
    }
  });

  it('keeps the public routes public', () => {
    const publicPages = routeFiles.filter(
      (file) => file.route.includes('/login/') || file.route.includes('/signup/'),
    );

    expect(publicPages.length).toBeGreaterThan(0);

    for (const { route, text } of publicPages) {
      expect(text, `${route} redirects an anonymous visitor away from sign-in`).not.toMatch(
        /redirect\(['"]\/login['"]\)/,
      );
    }
  });
});
