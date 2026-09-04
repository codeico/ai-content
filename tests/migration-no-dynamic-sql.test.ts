import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * No function body in the schema may execute dynamic SQL.
 *
 * Why this is a security gate and not a style rule: PostgREST connects as
 * `authenticator` and SET ROLEs into anon/authenticated/service_role — and,
 * after Phase 7, job_worker. SET ROLE checks membership against the SESSION
 * user (authenticator), not the current role. So SQL that PostgREST is
 * running as `anon` could, in principle, `SET ROLE service_role` and gain
 * bypassrls. Proven against Postgres 17: supabase/local/probe-authenticator.sql.
 *
 * The wall that stops this is that an attacker never gets to run SET ROLE:
 * PostgREST only executes SQL it constructs, and the only way to smuggle a
 * SET ROLE into a request is a function body that already exists in the
 * schema. A function body that builds SQL from a string and EXECUTEs it is
 * how that wall gets a door. This test keeps the wall solid.
 *
 * Trigger definitions (`execute function public.x()`) are the DDL syntax for
 * attaching a trigger, not PL/pgSQL dynamic SQL. They are excluded by shape.
 */
const MIGRATIONS = join(process.cwd(), 'supabase/migrations');
const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();

/** Strip -- comments so a comment mentioning EXECUTE does not trip the gate. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/** `execute` as a PL/pgSQL statement, not as `execute function ...` DDL. */
const DYNAMIC_EXECUTE = /\bexecute\s+(?!function\b|on\b)/i;
/** `format(` inside a function body is only ever there to build SQL. */
const FORMAT_CALL = /\bformat\s*\(/i;
/** Role switching inside a body — must never appear, even literally. */
const SET_ROLE = /\bset\s+(local\s+)?role\b/i;

describe('no migration function body executes dynamic SQL', () => {
  it('there are migrations to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s has no PL/pgSQL EXECUTE of a string', (file) => {
    const sql = stripComments(readFileSync(join(MIGRATIONS, file), 'utf8'));
    const hits = sql
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => DYNAMIC_EXECUTE.test(line) && !/revoke|grant/i.test(line));
    expect(hits, `dynamic EXECUTE in ${file}: ${JSON.stringify(hits)}`).toEqual([]);
  });

  it.each(files)('%s does not build SQL with format()', (file) => {
    const sql = stripComments(readFileSync(join(MIGRATIONS, file), 'utf8'));
    expect(FORMAT_CALL.test(sql), `format( in ${file}`).toBe(false);
  });

  it.each(files)('%s never switches role inside a body', (file) => {
    const sql = stripComments(readFileSync(join(MIGRATIONS, file), 'utf8'));
    expect(SET_ROLE.test(sql), `SET ROLE in ${file}`).toBe(false);
  });
});

describe('the gate itself distinguishes DDL from dynamic SQL', () => {
  it('trigger attachment is not flagged', () => {
    expect(DYNAMIC_EXECUTE.test('  execute function public.set_updated_at();')).toBe(false);
  });

  it('grant/revoke execute is not flagged', () => {
    expect(DYNAMIC_EXECUTE.test('revoke execute on function public.f() from public;')).toBe(false);
    expect(DYNAMIC_EXECUTE.test('grant execute on function public.f() to authenticated;')).toBe(
      false,
    );
  });

  it('a PL/pgSQL EXECUTE of a string IS flagged', () => {
    expect(DYNAMIC_EXECUTE.test("  execute 'set role ' || quote_ident(target);")).toBe(true);
    expect(DYNAMIC_EXECUTE.test('  execute stmt;')).toBe(true);
    expect(DYNAMIC_EXECUTE.test('  execute format(%s)')).toBe(true);
  });

  it('a comment mentioning EXECUTE is not flagged', () => {
    expect(DYNAMIC_EXECUTE.test(stripComments("-- never execute 'raw sql' here"))).toBe(false);
  });
});
