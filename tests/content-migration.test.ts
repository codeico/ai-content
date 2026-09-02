import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONTENT_STATUSES } from '../packages/shared/src/content/content.ts';

/** Structural pins on the content migration; live behavior is verified separately. */
const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'supabase', 'migrations');

const migration = readdirSync(MIGRATIONS_DIR).find((name) => name.includes('create_content'));
const sql = migration ? readFileSync(join(MIGRATIONS_DIR, migration), 'utf8').toLowerCase() : '';
const code = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

describe('content migration', () => {
  it('exists with a sortable timestamped name after the workspace migrations', () => {
    expect(migration).toMatch(/^\d{14}_/);
    expect(migration! > '20260901140000_').toBe(true);
  });

  it('enforces the critical invariants in PostgreSQL', () => {
    expect(code).toMatch(/workspace_id uuid not null references public\.workspaces/);
    expect(code).toContain('on delete cascade');
    expect(code).toMatch(/title text not null/);
    expect(code).toContain("check (btrim(title) <> '')");
  });

  it('constrains status to exactly the shared status list, defaulting to draft', () => {
    const check = code.match(
      /status text not null default 'draft' check \(status in \(([^)]+)\)\)/,
    );
    expect(check).not.toBeNull();
    const dbStatuses = (check?.[1] ?? '').split(',').map((s) => s.trim().replace(/'/g, ''));
    expect(dbStatuses.sort()).toEqual([...CONTENT_STATUSES].sort());
  });

  it('reuses set_updated_at and indexes the list query', () => {
    expect(code).toContain('execute function public.set_updated_at()');
    expect(code).not.toContain('create function');
    expect(code).toMatch(/create index \S+\s+on public\.content \(workspace_id, created_at desc/);
  });

  it('enables RLS with member-scoped policies for every command via the Phase 2 helper', () => {
    expect(code).toContain('alter table public.content enable row level security');
    for (const cmd of ['for select', 'for insert', 'for update', 'for delete']) {
      expect(code).toContain(cmd);
    }
    // Every policy must route through the security definer helper, never
    // query workspace_members directly (recursion), and never be open.
    expect(code.match(/workspace_ids_for_current_user\(\)/g)?.length).toBe(5);
    expect(code).not.toContain('from public.workspace_members');
    expect(code).not.toMatch(/using \(true\)|with check \(true\)/);
    // Update must re-check the target workspace so rows cannot be moved out.
    expect(code).toMatch(/for update[\s\S]*using \([\s\S]*with check \(/);
  });

  it('does not model future-phase columns or tables', () => {
    for (const forbidden of [
      'tiktok',
      'instagram',
      'source_url',
      'platform',
      'media_',
      'transcript',
      'published',
      'scheduled',
      'content_sources',
      'social_accounts',
    ]) {
      expect(code).not.toContain(forbidden);
    }
    expect(code.match(/create table/g)?.length).toBe(1);
  });
});
