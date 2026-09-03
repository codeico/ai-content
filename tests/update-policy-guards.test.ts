import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The recurring defect in this schema, found five times: RLS decides which
 * ROWS a caller may touch, never which COLUMNS. An UPDATE policy whose
 * WITH CHECK validates the NEW value answers the right question for access and
 * the wrong one for identity — so a member could move content between
 * workspaces, rewrite caption provenance, or relocate a workspace profile,
 * none of which the application can express.
 *
 * Rather than testing each table again, this asserts the rule: any table with
 * an UPDATE policy must also have a BEFORE UPDATE trigger guarding its
 * columns. A sixth table added without one fails here.
 */
const MIGRATIONS = join(process.cwd(), 'supabase/migrations');

function allSql(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n');
}

/** Tables carrying at least one `for update` policy. */
function tablesWithUpdatePolicy(sql: string): Set<string> {
  const tables = new Set<string>();

  for (const match of sql.matchAll(
    /create policy[^;]*?on public\.(\w+)[^;]*?for update[^;]*;/gis,
  )) {
    tables.add(match[1]!);
  }

  return tables;
}

/** Tables carrying a BEFORE UPDATE row trigger. */
function tablesWithUpdateTrigger(sql: string): Set<string> {
  const tables = new Set<string>();

  for (const match of sql.matchAll(/create trigger[^;]*?before update on public\.(\w+)[^;]*;/gis)) {
    tables.add(match[1]!);
  }

  return tables;
}

/**
 * Tables whose UPDATE policy pins identity in the predicate itself, so a
 * column guard would be redundant. `profiles` uses `auth.uid() = id` on both
 * sides: the row's identity IS the caller, so it cannot be repointed.
 */
const IDENTITY_PINNED_BY_POLICY = new Set(['profiles']);

describe('every updatable table guards its columns', () => {
  it('has no table with an UPDATE policy but no column guard', () => {
    const sql = allSql();
    const policies = tablesWithUpdatePolicy(sql);
    const triggers = tablesWithUpdateTrigger(sql);

    expect(policies.size).toBeGreaterThan(0);

    const unguarded = [...policies]
      .filter((t) => !triggers.has(t) && !IDENTITY_PINNED_BY_POLICY.has(t))
      .sort();

    // A new entry means a table can have a column rewritten that the
    // application never writes. Add a BEFORE UPDATE trigger, or justify an
    // exemption above with the predicate that makes it safe.
    expect(unguarded).toEqual([]);
  });

  it('guards the four tables that needed triggers, by their known names', () => {
    const sql = allSql();
    const triggers = tablesWithUpdateTrigger(sql);

    // Named explicitly: matching only "before update on public.<table>" would
    // still pass if the trigger were renamed or disabled, since that clause
    // survives. Verified by mutation — renaming the trigger must fail here.
    const EXPECTED: Record<string, string> = {
      captions: 'captions_immutable_columns',
      content: 'content_immutable_identity',
      workspaces: 'workspaces_immutable_identity',
      workspace_profiles: 'workspace_profiles_immutable_identity',
    };

    for (const [table, triggerName] of Object.entries(EXPECTED)) {
      expect(triggers, `${table} needs a BEFORE UPDATE guard`).toContain(table);
      expect(sql, `${table} guard must be named ${triggerName}`).toContain(
        `create trigger ${triggerName}`,
      );
    }
  });

  it('names its exemption rather than skipping silently', () => {
    // profiles is exempt because its policy pins identity to the caller.
    const sql = allSql();
    expect(sql).toMatch(/using \(auth\.uid\(\) = id\)/);
    expect(sql).toMatch(/with check \(auth\.uid\(\) = id\)/);
  });
});
