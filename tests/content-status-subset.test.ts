import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCHEMA = readFileSync(join(ROOT, 'docs/DATABASE_SCHEMA.md'), 'utf8');

const migrations = (): string =>
  readdirSync(join(ROOT, 'supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(ROOT, 'supabase/migrations', f), 'utf8'))
    .join('\n');

/**
 * DATABASE_SCHEMA section 12 specifies fifteen content states; the shipped
 * column has three. Every other deviation in this schema is annotated -
 * section 14 for media_status, section 17 for the caption deferrals - and this
 * one was not, so a reader could not tell a deliberate subset from an
 * oversight.
 *
 * CODING_RULES 60.1: where a doc explains why something is absent, gate the
 * explanation. Deleting it turns a settled decision back into an open one.
 */
describe('the content status subset stays explained', () => {
  const note = (): string => {
    const start = SCHEMA.indexOf('# 12. Content Status State Machine');
    return SCHEMA.slice(start, SCHEMA.indexOf('# 13. Content Rights Status'));
  };

  it('section 12 says which states are live', () => {
    expect(note()).toMatch(/Implemented subset/);

    for (const state of ['draft', 'ready', 'archived']) {
      expect(note()).toContain(state);
    }
  });

  it('the three named states are the ones the migration actually allows', () => {
    // The note is worthless if it drifts from the constraint it describes.
    expect(migrations()).toMatch(/status in \('draft', 'ready', 'archived'\)/);
  });

  it('names a blocking phase for the states that are absent', () => {
    // Not just "not implemented" - which phase makes each reachable.
    expect(note()).toMatch(/job system/);
    expect(note()).toMatch(/scheduler/);
    expect(note()).toMatch(/publisher/);
  });

  it('records that publishing is not a content state', () => {
    // Settled 2026-09-03. The decision must not decay back into ambiguity,
    // and it must keep naming where publishing state actually lives.
    expect(note()).toMatch(/Settled/);

    for (const owner of ['scheduled_posts', 'publish_attempts', 'published_posts']) {
      expect(note()).toContain(owner);
    }
  });

  it('keeps the forcing case, not just the conclusion', () => {
    // A conclusion without its reason gets re-litigated. The reason is that
    // one item can be published more than once. Prettier wraps the doc, so
    // match across a line break and its blockquote marker.
    //
    // Assert the phrase that MARKS it as the reason, not just the fact:
    // an earlier version passed while the "forcing case" framing was deleted,
    // leaving the sentence present but no longer identified as the argument.
    const flat = note().replace(/\n>\s*/g, ' ');
    expect(flat).toMatch(/forcing case/i);
    expect(flat).toMatch(/published more than once/);
  });

  it('points at the documents that carry the reasoning', () => {
    expect(note()).toMatch(/STATE_MACHINES/);
    expect(existsSync(join(ROOT, 'docs/STATE_MACHINES.md'))).toBe(true);
    expect(existsSync(join(ROOT, 'docs/PRODUCT_ALIGNMENT.md'))).toBe(true);
  });

  it('does not claim a state the column cannot hold', () => {
    const live = /status in \('([^)]+)\)/.exec(migrations());
    expect(live).not.toBeNull();

    const captured = live?.[1];
    expect(captured, 'the status check constraint should exist').toBeDefined();

    const allowed = (captured as string).replace(/'/g, '').split(', ');
    expect(allowed).toEqual(['draft', 'ready', 'archived']);
  });
});
