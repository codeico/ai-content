import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { JOB_TYPES } from '../packages/shared/src/jobs/job.ts';

const ROOT = process.cwd();
const MIGRATION = readFileSync(
  join(ROOT, 'supabase/migrations/20260904100000_create_jobs.sql'),
  'utf8',
);
const ROUTE = readFileSync(join(ROOT, 'apps/web/src/app/api/jobs/run/route.ts'), 'utf8');

/**
 * The lease must exceed the worker function's wall-clock limit. If it does
 * not, a job that is genuinely still running becomes reclaimable while alive,
 * and the second worker runs it concurrently with the first. Fencing keeps
 * the loser's WRITES harmless, but the loser's side effects have already
 * happened — so this relationship is a correctness property, not a tuning
 * knob, and a comment saying "must exceed" is not evidence.
 */
function parseInterval(text: string): number {
  const m = /^(\d+)\s+(second|minute|hour)s?$/.exec(text.trim());
  if (m === null) throw new Error(`unparseable interval: ${text}`);
  const n = Number(m[1]);
  return { second: n, minute: n * 60, hour: n * 3600 }[m[2] as 'second' | 'minute' | 'hour'];
}

function leaseSecondsFor(type: string): number {
  const m = new RegExp(`when '${type}' then interval '([^']+)'`).exec(MIGRATION);
  if (m === null) throw new Error(`no lease clause for ${type}`);
  return parseInterval(m[1] as string);
}

function defaultLeaseSeconds(): number {
  const m = /else interval '([^']+)'/.exec(MIGRATION);
  if (m === null) throw new Error('no default lease');
  return parseInterval(m[1] as string);
}

function routeMaxDuration(): number {
  const m = /export const maxDuration = (\d+);/.exec(ROUTE);
  if (m === null) throw new Error('route does not export maxDuration');
  return Number(m[1]);
}

describe('job lease exceeds the worker function lifetime', () => {
  it('the route sets maxDuration explicitly rather than inheriting a default', () => {
    expect(ROUTE).toMatch(/export const maxDuration = \d+;/);
  });

  it.each([...JOB_TYPES])("%s's lease is longer than maxDuration", (type) => {
    expect(leaseSecondsFor(type)).toBeGreaterThan(routeMaxDuration());
  });

  it('the fallback lease for unknown types is longer than maxDuration', () => {
    expect(defaultLeaseSeconds()).toBeGreaterThan(routeMaxDuration());
  });

  it('the loop is handed a deadline shorter than maxDuration', () => {
    // So the last job's terminal write lands before the platform kills the
    // function. The margin must be positive and the arithmetic must subtract.
    expect(ROUTE).toMatch(/const SHUTDOWN_MARGIN_S = \d+;/);
    expect(ROUTE).toMatch(/\(maxDuration - SHUTDOWN_MARGIN_S\) \* 1_000/);
    const margin = Number(/const SHUTDOWN_MARGIN_S = (\d+);/.exec(ROUTE)?.[1]);
    expect(margin).toBeGreaterThan(0);
    expect(margin).toBeLessThan(routeMaxDuration());
  });
});

describe('the trigger is the one non-RLS surface and is shaped accordingly', () => {
  it('exports POST only — no GET that does work', () => {
    expect(ROUTE).toMatch(/export async function POST\(/);
    expect(ROUTE).not.toMatch(/export async function GET\(/);
    expect(ROUTE).not.toMatch(/export async function (PUT|PATCH|DELETE)\(/);
  });

  it('authenticates before touching the worker client', () => {
    const authAt = ROUTE.indexOf('authenticateTrigger(');
    const clientAt = ROUTE.indexOf('createWorkerClient()');
    expect(authAt).toBeGreaterThan(-1);
    expect(clientAt).toBeGreaterThan(authAt);
  });

  it('mints a fresh worker token per invocation', () => {
    expect(ROUTE).toMatch(/workerToken: randomUUID\(\)/);
  });

  it('never constructs the service-role client', () => {
    expect(ROUTE).not.toMatch(/createSupabaseAdminClient|client\/admin/);
  });

  it('an unconfigured worker transport is 503, not a silent no-op', () => {
    expect(ROUTE).toMatch(/WorkerClientNotConfiguredError/);
    expect(ROUTE).toMatch(/status: 503/);
  });

  it('is force-dynamic so it can never be statically cached', () => {
    expect(ROUTE).toMatch(/export const dynamic = 'force-dynamic';/);
  });
});
