import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Structural checks on the workspaces migration.
 *
 * These cannot prove the SQL runs — that needs a live database, covered
 * separately by live Supabase verification — but they do catch a security
 * property being deleted or weakened, which is the failure mode that would
 * otherwise reach production silently.
 */
const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'supabase', 'migrations');

const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql'));

const workspacesMigration = migrationFiles.find((name) => name.includes('create_workspaces'));
const fixMigration = migrationFiles.find((name) => name.includes('fix_workspaces_owner_select'));

const rawSql = workspacesMigration
  ? readFileSync(join(MIGRATIONS_DIR, workspacesMigration), 'utf8')
  : '';

const sql = rawSql.toLowerCase();

/** Comment lines stripped so prose mentioning a keyword cannot inflate a count. */
const code = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

describe('workspaces migration', () => {
  it('exists with a sortable timestamped name', () => {
    expect(workspacesMigration).toBeDefined();
    // Supabase applies migrations in filename order, so the prefix must sort.
    expect(workspacesMigration).toMatch(/^\d{14}_/);
  });

  it('ties workspace ownership to profiles and restricts deletion', () => {
    expect(code).toContain('references public.profiles (id) on delete restrict');
  });

  it('cascades workspace_members from both its workspace and its user', () => {
    // Two distinct "on delete cascade" foreign keys are expected: workspace_id
    // and user_id. A count check (rather than substring presence) catches a
    // regression where one of the two was accidentally changed to restrict.
    const cascadeCount = (code.match(/on delete cascade/g) ?? []).length;
    expect(cascadeCount).toBeGreaterThanOrEqual(2);
  });

  it('enforces one membership row per workspace per user', () => {
    expect(code).toContain(
      'constraint workspace_members_unique_membership unique (workspace_id, user_id)',
    );
  });

  it('constrains role to exactly the two Phase 2 roles', () => {
    // docs/PHASE_2_PROMPT.md §9: no admin/editor/viewer without a documented
    // requirement. A check constraint is the enforcement layer TypeScript
    // validation alone cannot provide (docs/CODING_RULES.md §15).
    expect(code).toContain("check (role in ('owner', 'member'))");
  });

  it('enables row level security on both tables', () => {
    expect(code).toContain('alter table public.workspaces enable row level security');
    expect(code).toContain('alter table public.workspace_members enable row level security');
  });

  it('does not grant unrestricted authenticated access', () => {
    // The exact anti-pattern docs/PHASE_2_PROMPT.md §12 names.
    expect(code).not.toContain('auth.uid() is not null');
    expect(code).not.toContain('using (true)');
  });

  it('scopes every workspaces policy to ownership or membership', () => {
    const policyBlocks = sql.split(/create policy/i).slice(1);
    const workspacesPolicies = policyBlocks.filter((block) =>
      /^\s*"[^"]*"\s*\n\s*on public\.workspaces\b/i.test(block),
    );

    expect(workspacesPolicies.length).toBeGreaterThanOrEqual(4);

    for (const policy of workspacesPolicies) {
      const scoped =
        policy.includes('workspace_ids_for_current_user') || policy.includes('owner_id =');
      expect(scoped).toBe(true);
    }
  });

  it('creates the owner-membership trigger as security definer with a pinned search_path', () => {
    // Same reasoning as the Phase 1 profiles migration: an unpinned
    // search_path on a security definer function is a privilege-escalation
    // path, and this function inserts into workspace_members on behalf of
    // whichever role performed the insert on workspaces.
    const definerCount = (code.match(/security definer/g) ?? []).length;
    const pinnedCount = (code.match(/set search_path = ''/g) ?? []).length;

    expect(definerCount).toBeGreaterThan(0);
    expect(pinnedCount).toBe(definerCount);
  });

  it('makes owner membership creation idempotent', () => {
    // Guards against a retried workspace insert producing a duplicate
    // membership row (would otherwise violate the unique constraint).
    expect(code).toContain('on conflict (workspace_id, user_id) do nothing');
  });

  it('does not grant a client-writable policy on workspace_members', () => {
    // docs/PHASE_2_PROMPT.md §13: no member management UI, no arbitrary
    // membership insertion from the client this phase. The only insert path
    // must be the security definer trigger, which bypasses RLS as its owner.
    const policyBlocks = sql.split(/create policy/i).slice(1);
    const memberPolicies = policyBlocks.filter((block) =>
      /^\s*"[^"]*"\s*\n\s*on public\.workspace_members\b/i.test(block),
    );

    for (const policy of memberPolicies) {
      expect(policy).not.toMatch(/for insert/i);
      expect(policy).not.toMatch(/for update/i);
      expect(policy).not.toMatch(/for delete/i);
    }
  });

  it('owner select fix is additive: policy reads owner_id directly and keeps the membership clause', () => {
    // Regression pin for the live-verified bug: INSERT ... RETURNING checks the
    // SELECT policy before the AFTER INSERT trigger's workspace_members row is
    // visible, so owner reads must not depend on membership alone.
    expect(fixMigration).toBeDefined();
    const fixSql = readFileSync(join(MIGRATIONS_DIR, fixMigration ?? ''), 'utf8').toLowerCase();
    expect(fixSql).toContain('alter policy "members can read their workspaces"');
    expect(fixSql).toContain('owner_id = (select auth.uid())');
    expect(fixSql).toContain('workspace_ids_for_current_user()');
    expect(fixSql).not.toMatch(/drop policy|drop table|using \(true\)/);
  });

  it('does not create future-phase tables', () => {
    for (const table of ['contents', 'content_sources', 'social_accounts', 'jobs', 'schedules']) {
      expect(code).not.toContain(`create table public.${table}`);
    }
  });

  it('does not modify the Phase 1 profiles migration', () => {
    const profilesMigration = migrationFiles.find((name) => name.includes('profiles'));
    expect(profilesMigration).toBeDefined();
    // A structural smoke check: the earlier migration must still define the
    // same table it always did. Full content stability is git's job; this
    // guards against a Phase 2 change accidentally landing in the wrong file.
    if (profilesMigration) {
      const profilesSql = readFileSync(
        join(MIGRATIONS_DIR, profilesMigration),
        'utf8',
      ).toLowerCase();
      expect(profilesSql).toContain('create table public.profiles');
    }
  });
});
