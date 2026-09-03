import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Owner-scoped RLS policies resolve `select id from public.workspaces where
 * owner_id = auth.uid()` on every row access. Postgres does not index a
 * foreign key automatically, so without this index the lookup is a sequential
 * scan — harmless at two rows, quietly quadratic as workspaces grow.
 *
 * Pinned because nothing in the application would fail if the index were
 * dropped; only latency would change, and only later.
 */
const MIGRATIONS = join(process.cwd(), 'supabase/migrations');

function migrationSql(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n');
}

describe('owner-scoped RLS has index support', () => {
  it('indexes workspaces.owner_id', () => {
    expect(migrationSql()).toMatch(
      /create index if not exists workspaces_owner_id_idx on public\.workspaces \(owner_id\)/i,
    );
  });

  it('indexes workspace_members.user_id, the other side of the membership lookup', () => {
    // workspace_ids_for_current_user() filters by user_id.
    expect(migrationSql()).toMatch(/workspace_members_user_id_idx/i);
  });

  it('adds the index in its own additive migration, touching no policy', () => {
    const file = readdirSync(MIGRATIONS).find((f) => f.includes('index_workspaces_owner_id'))!;
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8').toLowerCase();

    expect(sql).toContain('create index');
    // An index migration that alters policies or drops anything is a mistake.
    expect(sql).not.toContain('drop ');
    expect(sql).not.toContain('alter policy');
    expect(sql).not.toContain('create policy');
  });
});
