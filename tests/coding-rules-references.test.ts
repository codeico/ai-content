import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * CODING_RULES.md now records two rules that came out of real defects, and
 * each names the test that enforces it. A rule pointing at a test that no
 * longer exists is folklore: it reads as enforced when nothing enforces it.
 *
 * This checks the references resolve, and that the rules themselves are still
 * present — so deleting a guard test cannot quietly orphan its rule.
 */
const ROOT = process.cwd();
const RULES = readFileSync(join(ROOT, 'docs/CODING_RULES.md'), 'utf8');

/** Every `tests/...test.ts` path the rules cite. */
function citedTests(): string[] {
  return [...RULES.matchAll(/`(tests\/[\w.-]+\.test\.ts)`/g)].map((m) => m[1]!);
}

describe('CODING_RULES cites tests that exist', () => {
  it('cites at least the two guards added for recurring defects', () => {
    const cited = citedTests();

    expect(cited).toContain('tests/update-policy-guards.test.ts');
    expect(cited).toContain('tests/query-interpolation-gate.test.ts');
  });

  it.each(citedTests())('%s exists', (path) => {
    expect(existsSync(join(ROOT, path)), `${path} is cited by CODING_RULES.md`).toBe(true);
  });

  it('records that RLS cannot express column permissions', () => {
    // The single most repeated defect in this schema; five instances.
    expect(RULES).toMatch(/RLS decides rows, never columns/i);
    expect(RULES).toMatch(/BEFORE UPDATE.{0,80}trigger/is);
  });

  it('records that query-string input is external input', () => {
    expect(RULES).toMatch(/Query-string input is external input/i);
    expect(RULES).toMatch(/searchParams/);
  });

  it('names the profiles exemption so it is not mistaken for an oversight', () => {
    expect(RULES).toMatch(/auth\.uid\(\) = id/);
  });

  it('distinguishes an application bound from a database bound', () => {
    // The correction I had to make to my own version cap.
    expect(RULES).toMatch(/application-level bound is not a database bound/i);
    expect(RULES).toMatch(/CAPTION_MAX_VERSIONS/);
  });
});
