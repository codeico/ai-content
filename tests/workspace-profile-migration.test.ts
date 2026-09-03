import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PROFILE_LONG_MAX_LENGTH,
  PROFILE_SHORT_MAX_LENGTH,
  WORKSPACE_PROFILE_FIELDS,
} from '../packages/shared/src/workspace/profile.ts';

/**
 * Structural pins on the Phase 7A migration. Read the SQL, drop comment
 * lines, assert the invariants that must hold regardless of wording. Live
 * behaviour (RLS and CHECKs actually firing) is verified against Supabase.
 */
const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'supabase', 'migrations');

const migration = readdirSync(MIGRATIONS_DIR).find((name) =>
  name.endsWith('_create_workspace_profiles.sql'),
);
const sql = migration ? readFileSync(join(MIGRATIONS_DIR, migration), 'utf8').toLowerCase() : '';
const code = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

const OWNER_CLAUSE =
  /workspace_id in \(\s*select id from public\.workspaces where owner_id = \(select auth\.uid\(\)\)\s*\)/g;

describe('workspace profiles migration', () => {
  it('exists, is timestamped, and sorts after the Phase 6 follow-up', () => {
    expect(migration).toMatch(/^\d{14}_/);
    expect(migration! > '20260903110000_').toBe(true);
  });

  it('creates exactly one table, 1:1 with workspaces, cascading on delete', () => {
    expect(code.match(/create table/g)).toHaveLength(1);
    expect(code).toContain('create table public.workspace_profiles');
    expect(code).toMatch(
      /workspace_id uuid not null unique references public\.workspaces \(id\) on delete cascade/,
    );
    expect(code).not.toContain('alter table public.workspaces');
    expect(code).not.toContain('drop ');
  });

  it('declares every shared profile field as nullable text and nothing else editable', () => {
    for (const field of WORKSPACE_PROFILE_FIELDS) {
      expect(code, field).toMatch(new RegExp(`^\\s*${field} text,`, 'm'));
      expect(code, field).not.toMatch(new RegExp(`${field} text not null`));
    }
    // No AI-output columns sneak in with the profile.
    for (const forbidden of [
      'caption',
      'score',
      'analysis',
      'model',
      'prompt',
      'ai_instructions',
    ]) {
      expect(code).not.toMatch(new RegExp(`^\\s*${forbidden}\\w* `, 'm'));
    }
  });

  it('caps every field with a non-blank + length CHECK matching the shared constants', () => {
    for (const field of WORKSPACE_PROFILE_FIELDS) {
      const max = field === 'niche' ? PROFILE_SHORT_MAX_LENGTH : PROFILE_LONG_MAX_LENGTH;
      const check = new RegExp(
        `check \\(${field} is null or \\(btrim\\(${field}\\) <> '' and char_length\\(${field}\\) <= ${max}\\)\\)`,
      );
      expect(code, field).toMatch(check);
    }
  });

  it('reuses set_updated_at rather than defining a new function', () => {
    expect(code).toContain('execute function public.set_updated_at()');
    expect(code).not.toContain('create function');
    expect(code).not.toContain('create or replace function');
  });

  it('enables RLS with member read and owner-only insert/update, and no delete policy', () => {
    expect(code).toContain('alter table public.workspace_profiles enable row level security');

    const policies = code.match(/create policy[\s\S]*?;/g) ?? [];
    expect(policies).toHaveLength(3);

    const forSelect = policies.filter((p) => p.includes('for select'));
    const forInsert = policies.filter((p) => p.includes('for insert'));
    const forUpdate = policies.filter((p) => p.includes('for update'));
    const forDelete = policies.filter((p) => p.includes('for delete'));
    expect(forSelect).toHaveLength(1);
    expect(forInsert).toHaveLength(1);
    expect(forUpdate).toHaveLength(1);
    expect(forDelete).toHaveLength(0);
    expect(policies.some((p) => p.includes('for all'))).toBe(false);

    // Every policy is scoped to authenticated, never public/anon.
    for (const policy of policies) {
      expect(policy).toContain('to authenticated');
      expect(policy).not.toContain('to public');
      expect(policy).not.toContain('to anon');
    }

    expect(forSelect[0]).toContain('workspace_ids_for_current_user()');
    // Direct owner clause mirrors 20260901140000 so INSERT … RETURNING never
    // depends on the owner's membership row.
    expect(forSelect[0]?.match(OWNER_CLAUSE)).toHaveLength(1);

    expect(forInsert[0]).toContain('with check');
    expect(forInsert[0]?.match(OWNER_CLAUSE)).toHaveLength(1);

    expect(forUpdate[0]).toContain('using');
    expect(forUpdate[0]).toContain('with check');
    expect(forUpdate[0]?.match(OWNER_CLAUSE)).toHaveLength(2);
  });

  it('does not touch existing tables or policies', () => {
    expect(code).not.toContain('alter policy');
    expect(code).not.toContain('drop policy');
    expect(code).not.toContain('on public.workspaces');
    expect(code).not.toContain('on public.content');
    expect(code).not.toContain('on public.workspace_members');
  });
});
