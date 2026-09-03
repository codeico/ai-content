import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CAPTION_BODY_MAX_LENGTH,
  CAPTION_STATUSES,
} from '../packages/shared/src/content/caption.ts';

/**
 * Structural pins on the Phase 7B captions migration. Read the SQL, drop
 * comment lines, assert the invariants that must hold regardless of wording.
 * Live behaviour (RLS, the partial index, the composite FK) is verified against
 * Supabase in a rolled-back probe; this file guards the text from drifting.
 */
const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'supabase', 'migrations');

const migration = readdirSync(MIGRATIONS_DIR).find((name) => name.endsWith('_create_captions.sql'));
const sql = migration ? readFileSync(join(MIGRATIONS_DIR, migration), 'utf8').toLowerCase() : '';
const code = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

const MEMBER_CLAUSE = /workspace_id in \(select public\.workspace_ids_for_current_user\(\)\)/g;

describe('captions migration', () => {
  it('exists, is timestamped, and sorts after the workspace profiles migration', () => {
    expect(migration).toMatch(/^\d{14}_/);
    expect(migration! > '20260903120000_').toBe(true);
  });

  it('creates exactly one table, owned by content, cascading on delete', () => {
    expect(code.match(/create table/g)).toHaveLength(1);
    expect(code).toContain('create table public.captions');
    expect(code).toMatch(
      /content_id uuid not null references public\.content \(id\) on delete cascade/,
    );
    expect(code).toMatch(
      /workspace_id uuid not null references public\.workspaces \(id\) on delete cascade/,
    );
  });

  it('pins workspace_id to the content row with a composite foreign key', () => {
    // A denormalised workspace_id must be provably consistent with the parent;
    // the composite FK does that declaratively and cannot be bypassed.
    expect(code).toMatch(
      /foreign key \(content_id, workspace_id\)\s+references public\.content \(id, workspace_id\)/,
    );
    expect(code).toMatch(
      /alter table public\.content\s+add constraint \S+ unique \(id, workspace_id\)/,
    );
  });

  it('makes versions unique per content and strictly positive', () => {
    expect(code).toMatch(/unique \(content_id, version\)/);
    expect(code).toMatch(/check \(version >= 1\)/);
  });

  it('allows at most one active caption per content via a partial unique index', () => {
    expect(code).toMatch(
      /create unique index \S+\s+on public\.captions \(content_id\)\s+where status = 'active'/,
    );
  });

  it('restricts status to the shared enum', () => {
    const match = code.match(/check \(status in \(([^)]+)\)\)/);
    expect(match, 'status CHECK present').not.toBeNull();
    const dbStatuses = match![1]!.split(',').map((s) => s.trim().replace(/'/g, ''));
    expect(dbStatuses.sort()).toEqual([...CAPTION_STATUSES].sort());
  });

  it('refuses a blank body and caps its length to the shared constant', () => {
    expect(code).toMatch(/check \(btrim\(body\) <> ''\)/);
    expect(code).toMatch(
      new RegExp(`check \\(char_length\\(body\\) <= ${CAPTION_BODY_MAX_LENGTH}\\)`),
    );
  });

  it('requires provenance on every row without naming a vendor', () => {
    expect(code).toMatch(/model_name text not null/);
    expect(code).toMatch(/prompt_version text not null/);
    // Deliberately absent: a provider label would leak the endpoint or be vacuous.
    expect(code).not.toContain('model_provider');
    expect(code).not.toMatch(/openai|anthropic|openrouter/);
  });

  it('keeps the author nullable so a caption outlives its author', () => {
    expect(code).toMatch(/created_by uuid references auth\.users \(id\) on delete set null/);
    expect(code).not.toMatch(/created_by uuid not null/);
  });

  it('enables RLS with the same member-scoped read, insert, and update as content', () => {
    expect(code).toContain('alter table public.captions enable row level security');

    const forSelect = code.match(/for select[\s\S]*?using \(([\s\S]*?)\);/g) ?? [];
    const forInsert = code.match(/for insert[\s\S]*?with check \(([\s\S]*?)\);/g) ?? [];
    const forUpdate = code.match(/for update[\s\S]*?with check \(([\s\S]*?)\);/g) ?? [];

    expect(forSelect).toHaveLength(1);
    expect(forInsert).toHaveLength(1);
    expect(forUpdate).toHaveLength(1);

    for (const policy of [...forSelect, ...forInsert, ...forUpdate]) {
      expect(policy).toMatch(MEMBER_CLAUSE);
      // Captions follow content, not the profile: no owner-only clause.
      expect(policy).not.toContain('owner_id');
    }
  });

  it('grants no client delete: earlier versions are never removed', () => {
    expect(code).not.toMatch(/for delete/);
  });

  it('touches nothing else', () => {
    // Exactly one ALTER (the composite-FK target on content) and no drops.
    expect(code.match(/alter table/g)).toHaveLength(2); // add constraint + enable RLS
    expect(code).not.toMatch(/drop /);
    expect(code).not.toMatch(/alter table public\.workspace/);
  });
});
