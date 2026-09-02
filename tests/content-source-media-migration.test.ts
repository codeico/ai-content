import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONTENT_SOURCE_TYPES, MEDIA_STATUSES } from '../packages/shared/src/content/content.ts';

/**
 * Structural pins on the Phase 6 migration. Same technique as
 * content-migration.test.ts: read the SQL, drop comment lines, assert the
 * invariants that must hold regardless of how the file is worded. Live
 * behaviour (constraints actually firing) is verified against Supabase.
 */
const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'supabase', 'migrations');

// Exact file, not a substring: a follow-up migration such as
// `..._add_content_source_media_trim_checks.sql` must not be picked up here and
// then fail the column/default pins that only the original file satisfies.
const migration = readdirSync(MIGRATIONS_DIR).find((name) =>
  name.endsWith('_add_content_source_media.sql'),
);
const sql = migration ? readFileSync(join(MIGRATIONS_DIR, migration), 'utf8').toLowerCase() : '';
const code = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

function checkList(column: string): string[] {
  const match = code.match(new RegExp(`check \\(${column} in \\(([^)]+)\\)\\)`));
  expect(match, `CHECK list for ${column}`).not.toBeNull();
  return (match?.[1] ?? '').split(',').map((s) => s.trim().replace(/'/g, ''));
}

describe('content source & media migration', () => {
  it('exists, is timestamped, and sorts after the Phase 3 content migration', () => {
    expect(migration).toMatch(/^\d{14}_/);
    expect(migration! > '20260902100000_').toBe(true);
  });

  it('is additive: alters public.content and creates nothing', () => {
    expect(code).toContain('alter table public.content');
    expect(code).not.toContain('create table');
    expect(code).not.toContain('drop ');
    expect(code).not.toContain('create function');
    expect(code).not.toContain('create trigger');
  });

  it('leaves RLS to the four inherited Phase 3 policies', () => {
    // Columns on the same row need no new policy; adding one here would be a
    // sign the model drifted to a separate table without the parent noticing.
    expect(code).not.toContain('create policy');
    expect(code).not.toContain('alter policy');
    expect(code).not.toContain('row level security');
  });

  it('constrains source_type to exactly the shared list, defaulting to other', () => {
    expect(code).toMatch(/source_type text not null default 'other'/);
    expect(checkList('source_type').sort()).toEqual([...CONTENT_SOURCE_TYPES].sort());
  });

  it('constrains media_status to exactly the shared list, defaulting to external_only', () => {
    expect(code).toMatch(/media_status text not null default 'external_only'/);
    expect(checkList('media_status').sort()).toEqual([...MEDIA_STATUSES].sort());
  });

  it('refuses non-http(s) links at the database as well as in Zod', () => {
    expect(code).toMatch(/source_url is null or source_url ~ '\^https\?:\/\/'/);
  });

  it('keeps the storage reference an all-or-nothing pair', () => {
    expect(code).toMatch(/\(storage_provider is null\) = \(storage_key is null\)/);
  });

  it('makes available unreachable without a stored object', () => {
    expect(code).toMatch(/media_status <> 'available' or storage_key is not null/);
  });

  it('does not model fields nothing can populate yet', () => {
    for (const premature of [
      'mime_type',
      'size_bytes',
      'filename',
      'duration',
      'width',
      'height',
      'checksum',
      'thumbnail',
      'creator_',
      'transcript',
      'rights_',
      'bucket',
      'storage.objects',
    ]) {
      expect(code, premature).not.toContain(premature);
    }
  });

  it('adds no index: the list query is unchanged', () => {
    expect(code).not.toContain('create index');
  });
});
