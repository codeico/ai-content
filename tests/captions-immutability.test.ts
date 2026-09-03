import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Caption provenance and history are write-once. RLS decides which ROWS a
 * member may touch; it cannot express which COLUMNS, so a member using the
 * anon key directly could rewrite model_name, prompt_version, created_by, the
 * body, and even version -- forging which model wrote a caption, editing an
 * already-chosen one, or renumbering history into a collision. Probed against
 * the linked database before the fix (all ALLOWED) and after (all 42501).
 *
 * Pinned structurally because nothing in the application would fail if the
 * trigger were dropped: the app only ever updates status.
 */
const MIGRATIONS = join(process.cwd(), 'supabase/migrations');

function immutabilityMigration(): string {
  const file = readdirSync(MIGRATIONS).find((f) => f.includes('captions_immutable_columns'));
  expect(file, 'the captions immutability migration must exist').toBeDefined();
  return readFileSync(join(MIGRATIONS, file!), 'utf8');
}

/** Every column that must not change after insert. */
const FROZEN = [
  'id',
  'content_id',
  'workspace_id',
  'version',
  'body',
  'model_name',
  'prompt_version',
  'created_by',
  'created_at',
];

describe('caption columns are immutable after insert', () => {
  it.each(FROZEN)('guards %s', (column) => {
    expect(immutabilityMigration()).toMatch(
      new RegExp(`new\\.${column} is distinct from old\\.${column}`),
    );
  });

  it('leaves status writable, since selecting a caption is the one real update', () => {
    const sql = immutabilityMigration();
    expect(sql).not.toMatch(/new\.status is distinct from old\.status/);
  });

  it('refuses with 42501 rather than a generic error', () => {
    expect(immutabilityMigration()).toContain("errcode = '42501'");
  });

  it('fires BEFORE UPDATE FOR EACH ROW, so no client can bypass it', () => {
    const sql = immutabilityMigration().toLowerCase();
    expect(sql).toContain('before update on public.captions');
    expect(sql).toContain('for each row');
  });

  it('the repository still only ever updates status', () => {
    const repo = readFileSync(
      join(process.cwd(), 'apps/web/src/server/repositories/caption-repository.ts'),
      'utf8',
    );
    const updates = [...repo.matchAll(/\.update\(\{([^}]*)\}\)/g)].map((m) => m[1]!.trim());

    expect(updates.length).toBeGreaterThan(0);
    for (const payload of updates) {
      expect(payload).toMatch(/^status:/);
    }
  });
});
