import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Gates that read source text must not rely on a bare existence check.
 *
 * Four gates this session passed review and then survived a mutation, all the
 * same way: they asserted a string appeared somewhere in a file rather than
 * that a behaviour held. Where a file holds several actions, several catch
 * blocks, or several redirects, deleting one leaves the others matching and
 * the gate never fires.
 *
 * This checks the rule is written down and that the gates which had the
 * defect now count or iterate instead of matching once. It cannot judge every
 * assertion - that is what the mutation runs are for - but it stops the four
 * known-weak ones from quietly reverting.
 */
const RULES = readFileSync(join(process.cwd(), 'docs/CODING_RULES.md'), 'utf8');
const TESTS_DIR = join(process.cwd(), 'tests');

function testSource(file: string): string {
  return readFileSync(join(TESTS_DIR, file), 'utf8');
}

describe('the lesson is written down', () => {
  it('records that an existence assertion is not a gate', () => {
    expect(RULES).toMatch(/A passing test is not a working test/);
    // Prettier reflows prose, so allow the phrase to break across lines.
    expect(RULES).toMatch(/existence\s+assertion is not a gate/);
  });

  it('says a surviving mutation means the test is wrong', () => {
    // The tempting reading is "the mutation was harmless". It is not.
    expect(RULES).toMatch(/mutation that survives means the test is\s+wrong/);
  });
});

describe('the four repaired gates stayed repaired', () => {
  it('the caption button gate asserts the branch, not the prop name', () => {
    const code = testSource('empty-states.test.ts');
    // Only the assertions, not the prose: an earlier version of this check
    // matched a label that also appears in a comment.
    const assertions = code.match(/expect\([^)]*\)\.toMatch\([^;]*\);/g)?.join('\n') ?? '';

    // The branch is the load-bearing assertion: it pins which label goes with
    // which state. Either label alone can be satisfied by a renamed prop.
    expect(assertions).toMatch(/hasCaptions \\\? 'Write another' : 'Write a caption'/);
  });

  it('the rethrow gate counts rather than matches', () => {
    const code = testSource('network-failure-ux.test.ts');

    expect(code).toMatch(/const catches =/);
    expect(code).toMatch(/toBe\(catches\)/);
  });

  it('the redirect gate checks every action body', () => {
    const code = testSource('expired-session.test.ts');

    expect(code).toMatch(/export async function/);
    expect(code).toMatch(/for \(const body of bodies\)/);
  });

  it('the ordering gate measures inside a function, not a whole file', () => {
    const code = testSource('expired-session.test.ts');

    // Comparing indexOf across a file lets an import satisfy the check.
    expect(code).toMatch(/actionBodies/);
  });
});

describe('no gate file is empty of assertions', () => {
  it.each(readdirSync(TESTS_DIR).filter((f) => f.endsWith('.test.ts')))(
    '%s asserts something',
    (file) => {
      const code = testSource(file);

      expect(code).toMatch(/expect\(/);
    },
  );
});
