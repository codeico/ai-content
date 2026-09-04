import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  JOB_DEFAULT_MAX_ATTEMPTS,
  JOB_ERROR_CODES,
  JOB_RETRY_BASE_SECONDS,
  JOB_STATUSES,
  JOB_TYPES,
} from '../packages/shared/src/jobs/job.ts';

const ROOT = process.cwd();
const MIGRATION = readFileSync(
  join(ROOT, 'supabase/migrations/20260904100000_create_jobs.sql'),
  'utf8',
);
const TYPES = readFileSync(join(ROOT, 'packages/database/src/types/database.ts'), 'utf8');
const WORKER = readFileSync(join(ROOT, 'apps/web/src/server/jobs/worker.ts'), 'utf8');
const HANDLER = readFileSync(join(ROOT, 'apps/web/src/server/jobs/handler.ts'), 'utf8');

/**
 * The jobs migration and the application must agree on the things that are
 * written in both places. Each of these has drifted silently in other
 * codebases; here the drift is a failing test.
 */
describe('jobs: shared constants mirror the migration', () => {
  it('JOB_STATUSES equals the status CHECK, in order', () => {
    const m = /status text not null default 'pending'\s+check \(status in \(([^)]+)\)\)/.exec(
      MIGRATION,
    );
    expect(m).not.toBeNull();

    const inCheck = (m as RegExpExecArray)[1]!.replace(/'/g, '').split(', ');
    expect(inCheck).toEqual([...JOB_STATUSES]);
  });

  it('the default status is the first status', () => {
    expect(MIGRATION).toMatch(/status text not null default 'pending'/);
    expect(JOB_STATUSES[0]).toBe('pending');
  });

  it('JOB_DEFAULT_MAX_ATTEMPTS equals the column default', () => {
    expect(MIGRATION).toMatch(
      new RegExp(`max_attempts integer not null default ${JOB_DEFAULT_MAX_ATTEMPTS}\\b`),
    );
  });

  it('JOB_RETRY_BASE_SECONDS equals the backoff base in fail_job', () => {
    expect(MIGRATION).toMatch(
      new RegExp(
        `interval '${JOB_RETRY_BASE_SECONDS} seconds' \\* power\\(2, job.attempt_count - 1\\)`,
      ),
    );
  });

  it('every JOB_TYPE has a lease in job_lease_for', () => {
    for (const type of JOB_TYPES) {
      expect(MIGRATION).toMatch(new RegExp(`when '${type}' then interval`));
    }
  });

  it('cancel_job writes the cancelled error code that JOB_ERROR_CODES declares', () => {
    expect(JOB_ERROR_CODES).toContain('cancelled');
    expect(MIGRATION).toMatch(/last_error_code = case when status = 'pending' then 'cancelled'/);
  });
});

describe('jobs: the table has no free-text error column', () => {
  it('the migration never creates last_error_message', () => {
    // The whole point of the closed error-code enum. A column named this is
    // where a Meta token or signed URL would eventually land.
    expect(MIGRATION).not.toMatch(/^\s+last_error_message\s+text/m);
  });

  it('the Database type has no last_error_message on jobs', () => {
    const jobsBlock = TYPES.slice(
      TYPES.indexOf('      jobs: {'),
      TYPES.indexOf('      profiles: {'),
    );
    expect(jobsBlock.length).toBeGreaterThan(100);
    expect(jobsBlock).not.toContain('last_error_message');
    expect(jobsBlock).toContain('last_error_code');
  });

  it('the worker only ever sends error_code, typed to the closed enum', () => {
    expect(WORKER).toMatch(/error_code: outcome\.code satisfies JobErrorCode/);
    // Comments may explain why there is no message column; code may not send one.
    const codeOnly = WORKER.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/error_message/);
  });
});

describe('jobs: Database type mirrors the migration columns', () => {
  const columns = [
    'id',
    'workspace_id',
    'type',
    'status',
    'payload',
    'result',
    'attempt_count',
    'max_attempts',
    'scheduled_for',
    'locked_at',
    'locked_by',
    'dedup_key',
    'last_error_code',
    'cancel_requested',
    'created_at',
    'updated_at',
  ];

  const tableDef = MIGRATION.slice(
    MIGRATION.indexOf('create table if not exists public.jobs ('),
    MIGRATION.indexOf('create index if not exists jobs_claimable_idx'),
  );
  // Exactly the lines inside a `Row: { ... }` block: ten-space indent, `name: type;`.
  // Anything looser also matches `Insert:`, `Relationships:` and the table key.
  const rowBlock = (tableKey: string): string => {
    const start = TYPES.indexOf(`      ${tableKey}: {`);
    const rowStart = TYPES.indexOf('        Row: {', start);
    return TYPES.slice(rowStart, TYPES.indexOf('        };', rowStart));
  };
  const columnLines = (block: string): string[] =>
    [...block.matchAll(/^ {10}(\w+):/gm)].map((m) => m[1] as string);
  const rowType = rowBlock('jobs');

  it.each(columns)('%s exists in both the migration and the Row type', (col) => {
    expect(tableDef).toMatch(new RegExp(`^\\s+${col}\\s`, 'm'));
    expect(columnLines(rowType)).toContain(col);
  });

  it('the Row type declares exactly the migration columns, no more', () => {
    expect(columnLines(rowType).sort()).toEqual([...columns].sort());
  });

  it('the view type omits payload, result and locked_by', () => {
    const viewRow = rowBlock('workspace_jobs');
    expect(viewRow.length).toBeGreaterThan(50);
    for (const internal of ['payload', 'result', 'locked_by', 'locked_at']) {
      expect(columnLines(viewRow)).not.toContain(internal);
    }
  });

  it('the view in the migration selects the same columns the view type declares', () => {
    const viewSql = MIGRATION.slice(
      MIGRATION.indexOf('create or replace view public.workspace_jobs'),
      MIGRATION.indexOf('comment on view public.workspace_jobs'),
    );
    const selected = [...viewSql.matchAll(/^\s+j\.(\w+),?$/gm)].map((m) => m[1]).sort();
    expect(columnLines(rowBlock('workspace_jobs')).sort()).toEqual(selected);
  });
});

describe('jobs: the execution surface has no user write path', () => {
  it('the migration creates no INSERT or UPDATE policy on jobs', () => {
    const policies = [
      ...MIGRATION.matchAll(/create policy "[^"]+"\s+on public\.jobs\s+for (\w+)/g),
    ].map((m) => m[1]);
    expect(policies).toEqual(['select']);
  });

  it('worker verbs are granted only to job_worker', () => {
    for (const fn of ['claim_job', 'complete_job', 'fail_job']) {
      const grants = [
        ...MIGRATION.matchAll(
          new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to (\\w+)`, 'g'),
        ),
      ].map((m) => m[1]);
      expect(grants, fn).toEqual(['job_worker']);
    }
  });

  it('every revoke names the roles Supabase actually grants by default, not just public', () => {
    // "revoke ... from public" alone removes nothing on Supabase; this was
    // verified against a real Postgres. Any revoke that stops at public is a
    // regression to the defect.
    const revokes = [...MIGRATION.matchAll(/revoke execute on function [^;]+ from ([^;]+);/g)].map(
      (m) => m[1],
    );
    expect(revokes.length).toBeGreaterThan(0);
    for (const roles of revokes) {
      expect(roles, roles).toContain('authenticated');
      expect(roles, roles).toContain('anon');
      expect(roles, roles).toContain('service_role');
    }
  });

  it('job_worker gets no table privileges', () => {
    expect(MIGRATION).not.toMatch(/grant [^;]*on (table )?public\.jobs[^;]* to job_worker/);
    expect(MIGRATION).not.toMatch(/grant [^;]*on public\.workspace_jobs[^;]* to job_worker/);
  });

  it('workspace FK is restrict, not cascade', () => {
    expect(MIGRATION).toMatch(
      /workspace_id uuid not null references public\.workspaces \(id\) on delete restrict/,
    );
  });

  it('the handler contract forbids reading scope from the payload', () => {
    // A rule stated in the type's doc comment; the test pins the statement so
    // the rule cannot be quietly deleted when the comment is next edited.
    expect(HANDLER).toMatch(/Scope comes from the row, never from the payload/);
    expect(HANDLER).toMatch(/safe to run twice/);
  });
});

describe('jobs: worker never imports a service-role client', () => {
  it('worker.ts, registry.ts, handler.ts and proof-handler.ts do not import admin.ts', () => {
    for (const file of ['worker.ts', 'registry.ts', 'handler.ts', 'proof-handler.ts']) {
      const src = readFileSync(join(ROOT, 'apps/web/src/server/jobs', file), 'utf8');
      expect(src, file).not.toMatch(/createSupabaseAdminClient|client\/admin/);
    }
  });
});
