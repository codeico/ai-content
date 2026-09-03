import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * RLS policies must keep a real predicate.
 *
 * Mutation testing found three security gates that passed while their
 * protection was removed: `auth.uid() = id` on profiles replaced with `true`
 * (any signed-in user could read any profile), the workspaces owner clause
 * loosened with `or true`, and the workspace_profiles membership check
 * bypassed the same way. Every existing assertion only proved a policy
 * EXISTED, never that it still restricted anything.
 *
 * This reads the migrations and rejects any policy whose USING or WITH CHECK
 * expression can evaluate to true for everyone.
 */
const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
}

function sqlOf(file: string): string {
  return readFileSync(join(MIGRATIONS_DIR, file), 'utf8').toLowerCase();
}

/** Every create-policy statement across every migration. */
function policies(): { file: string; name: string; body: string }[] {
  const out: { file: string; name: string; body: string }[] = [];

  for (const file of migrationFiles()) {
    const sql = sqlOf(file);
    const re = /create policy "([^"]+)"([\s\S]*?);/g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(sql)) !== null) {
      out.push({ file, name: m[1]!, body: m[2]! });
    }
  }

  return out;
}

describe('no policy grants access to everyone', () => {
  it('finds the policies to check', () => {
    // A parser that silently matches nothing would make every test below
    // vacuously pass.
    expect(policies().length).toBeGreaterThan(8);
  });

  it.each(policies())('$name in $file has a real predicate', ({ body }) => {
    // `using (true)` and `with check (true)` grant the table to every
    // authenticated caller, which is the whole protection removed.
    expect(body).not.toMatch(/using\s*\(\s*true\s*\)/);
    expect(body).not.toMatch(/with check\s*\(\s*true\s*\)/);
  });

  it.each(policies())('$name in $file cannot be short-circuited', ({ body }) => {
    // `or true` keeps the original clause visible while defeating it, so a
    // gate that only looks for the clause still passes.
    expect(body).not.toMatch(/\bor\s+true\b/);
    expect(body).not.toMatch(/\btrue\s+or\b/);
  });
});

describe('the tables that scope by workspace still do', () => {
  const WORKSPACE_SCOPED = ['captions', 'content', 'workspace_profiles'];

  it.each(WORKSPACE_SCOPED)('%s policies call the membership helper', (table) => {
    const relevant = policies().filter((p) =>
      new RegExp(`on\\s+public\\.${table}\\b`).test(p.body),
    );

    expect(relevant.length).toBeGreaterThan(0);

    for (const policy of relevant) {
      // The helper is what turns "a signed-in user" into "a member of this
      // workspace". Without it the policy is decoration.
      expect(policy.body).toMatch(/workspace_ids_for_current_user\(\)|owner_id/);
    }
  });
});

describe('profiles stay pinned to their owner', () => {
  it('every profiles policy tests auth.uid() against the row id', () => {
    const relevant = policies().filter((p) => /on\s+public\.profiles\b/.test(p.body));

    expect(relevant.length).toBeGreaterThan(0);

    for (const policy of relevant) {
      // This is the one table with no workspace: the only correct predicate
      // is "this row is mine".
      expect(policy.body).toMatch(/auth\.uid\(\)\s*=\s*id/);
    }
  });
});

describe('row level security is enabled wherever a policy exists', () => {
  it.each([...new Set(policies().map((p) => p.file))])('%s enables RLS', (file) => {
    // Policies on a table without RLS enabled are silently inert.
    expect(sqlOf(file)).toMatch(/enable row level security/);
  });
});
