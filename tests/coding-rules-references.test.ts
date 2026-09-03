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

describe('the citation check works in both directions', () => {
  /**
   * The forward direction was already covered: a rule must not cite a test
   * that has been deleted. This is the reverse, which is the one that
   * actually slipped - a rule can state a requirement while nothing points at
   * the gate enforcing it, so a reader cannot tell whether it is enforced or
   * merely aspirational.
   *
   * Same one-directional gap that let the README call the PWA "planned" after
   * it shipped, and that left the captions deferral reasoning unprotected.
   */
  const RULES_WITH_GATES = [
    { section: 'A passing test is not a working test', gate: 'tests/gate-strength.test.ts' },
    { section: 'Docs drift in two directions', gate: 'tests/readme-accuracy.test.ts' },
    { section: 'RLS decides rows, never columns', gate: 'tests/update-policy-guards.test.ts' },
    {
      section: 'Query-string input is external input',
      gate: 'tests/query-interpolation-gate.test.ts',
    },
  ];

  it.each(RULES_WITH_GATES)('$section names $gate', ({ section, gate }) => {
    const start = RULES.indexOf(section);
    expect(start, `section "${section}" should exist`).toBeGreaterThan(-1);

    // Look within the section, not the whole file: a citation elsewhere does
    // not tell this rule's reader where its enforcement lives.
    const body = RULES.slice(start, start + 2600);
    expect(body).toContain(gate);
  });

  it.each(RULES_WITH_GATES)('$gate exists on disk', ({ gate }) => {
    expect(existsSync(join(ROOT, gate))).toBe(true);
  });
});
