import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Structural checks on the profiles migration.
 *
 * These cannot prove the SQL runs — that needs a live database — but they do
 * catch a security property being deleted or weakened, which is the failure mode
 * that would otherwise reach production silently.
 */
const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'supabase', 'migrations');

const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql'));

const profilesMigration = migrationFiles.find((name) => name.includes('profiles'));

const sql = profilesMigration
  ? readFileSync(join(MIGRATIONS_DIR, profilesMigration), 'utf8').toLowerCase()
  : '';

describe('profiles migration', () => {
  it('exists with a sortable timestamped name', () => {
    expect(profilesMigration).toBeDefined();
    // Supabase applies migrations in filename order, so the prefix must sort.
    expect(profilesMigration).toMatch(/^\d{14}_/);
  });

  it('ties profiles.id to auth.users and cascades deletes', () => {
    expect(sql).toContain('references auth.users');
    expect(sql).toContain('on delete cascade');
  });

  it('enables row level security', () => {
    // Without this line the ownership policies below are never evaluated.
    expect(sql).toContain('alter table public.profiles enable row level security');
  });

  it('scopes every policy to the owner', () => {
    const policyCount = (sql.match(/create policy/g) ?? []).length;
    const ownershipChecks = (sql.match(/auth\.uid\(\) = id/g) ?? []).length;

    expect(policyCount).toBeGreaterThanOrEqual(3);
    // Every policy carries an ownership predicate; none is a blanket grant.
    expect(ownershipChecks).toBeGreaterThanOrEqual(policyCount);
  });

  it('does not contain a blanket authenticated-user policy', () => {
    // `auth.uid() is not null` would let any signed-in user read every profile.
    expect(sql).not.toContain('auth.uid() is not null');
    expect(sql).not.toContain('using (true)');
  });

  it('creates profiles from a trigger rather than client code', () => {
    expect(sql).toContain('after insert on auth.users');
    expect(sql).toContain('execute function public.handle_new_user()');
  });

  it('makes profile creation idempotent', () => {
    // Guards against a duplicate auth.users insert producing a second profile.
    expect(sql).toContain('on conflict (id) do nothing');
  });

  it('pins search_path on every security definer function', () => {
    // Comment lines are stripped first: prose mentioning "security definer"
    // would otherwise inflate the count and make this assertion meaningless.
    const code = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    const definerCount = (code.match(/security definer/g) ?? []).length;
    const pinnedCount = (code.match(/set search_path = ''/g) ?? []).length;

    expect(definerCount).toBeGreaterThan(0);
    // An unpinned search_path on a definer function is a privilege-escalation path.
    expect(pinnedCount).toBe(definerCount);
  });

  it('does not create future-phase tables', () => {
    for (const table of ['workspaces', 'contents', 'jobs', 'social_accounts']) {
      expect(sql).not.toContain(`create table public.${table}`);
    }
  });
});
