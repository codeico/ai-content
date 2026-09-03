import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Almost every query in this codebase passes user values as arguments
 * (.eq('id', value)), where the driver parameterises them. Exactly one place
 * builds a filter by string interpolation: the pagination cursor's `.or(...)`.
 *
 * That one place already cost an availability bug — a malformed timestamp
 * reached Postgres, raised 22007, and broke the whole workspace page. It is
 * safe now because parseContentCursor validates the shape first. This gate
 * exists so a SECOND interpolated filter cannot appear without someone
 * deciding to, since the next one might not be validated.
 */
const ROOTS = ['apps/web/src', 'packages'];

/** PostgREST methods whose argument is a filter EXPRESSION, not a value. */
const EXPRESSION_METHODS = ['or', 'not.or', 'filter'];

function sourceFiles(dir: string): string[] {
  const full = join(process.cwd(), dir);
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((entry) => {
      if (entry === 'node_modules' || entry === '.next' || entry === 'dist') return [];
      const p = join(d, entry);
      if (statSync(p).isDirectory()) return walk(p);
      return /\.tsx?$/.test(entry) ? [p] : [];
    });
  return walk(full);
}

/** Lines calling an expression method with a template literal that interpolates. */
function interpolatedFilters(): string[] {
  const hits: string[] = [];

  for (const root of ROOTS) {
    for (const file of sourceFiles(root)) {
      const text = readFileSync(file, 'utf8');
      for (const method of EXPRESSION_METHODS) {
        // .or(`...${...}...`) on one line or wrapped onto the next.
        const pattern = new RegExp(`\\.${method}\\(\\s*\`[^\`]*\\$\\{`, 's');
        if (pattern.test(text)) {
          hits.push(`${file.replace(process.cwd() + '/', '')}:${method}`);
        }
      }
    }
  }

  return hits.sort();
}

describe('interpolated query filters stay accounted for', () => {
  it('has exactly the one known interpolated filter', () => {
    // If this fails with a NEW entry: that code builds a query expression from
    // a string. Validate the input to a fixed shape before it gets there, the
    // way parseContentCursor does, then add it here deliberately.
    expect(interpolatedFilters()).toEqual([
      'apps/web/src/server/repositories/content-repository.ts:or',
    ]);
  });

  it('the known one is fed by a validated cursor, not raw query input', () => {
    const page = readFileSync(
      join(process.cwd(), 'apps/web/src/app/app/workspaces/[workspaceId]/page.tsx'),
      'utf8',
    );

    // The page must not hand searchParams straight to the repository.
    expect(page).toContain('parseContentCursor(search.after, search.afterId)');
    expect(page).not.toMatch(/cursor\s*=\s*\{\s*created_at:\s*search\./);
  });
});
