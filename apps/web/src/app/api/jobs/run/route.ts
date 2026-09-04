import { randomUUID } from 'node:crypto';

import { loadFutureProviderEnv } from '@ai-content/shared/env';

import { authenticateTrigger } from '@/server/jobs/trigger-auth';
import { createWorkerClient, WorkerClientNotConfiguredError } from '@/server/jobs/worker-client';
import { runWorker, WorkerError } from '@/server/jobs/worker';

/**
 * The job worker trigger. A scheduler POSTs here; one invocation claims and
 * runs jobs until its time budget is spent, then reports what it did.
 *
 * This is the first surface in the codebase that RLS does not govern — it runs
 * cross-tenant by design. Everything about it follows from that:
 *
 *   - Bearer-secret auth, constant-time, one failure shape (trigger-auth.ts).
 *   - No GET. A GET that does work is a CSRF and a prefetch hazard.
 *   - `maxDuration` is set explicitly rather than inherited. The job lease
 *     (job_lease_for in the migration) must exceed it, or a job still running
 *     becomes reclaimable while it is alive. tests/jobs-lease.test.ts asserts
 *     the relationship; it is not trusted.
 *   - The time budget handed to the loop is maxDuration minus a margin, so
 *     the terminal write of the last job lands before the platform kills the
 *     function.
 *   - `workerToken` is a fresh UUID per invocation. It is the fencing token;
 *     two overlapping invocations must never share one.
 *
 * Not yet decided: how the client authenticates as job_worker. Until it is,
 * createWorkerClient throws and this returns 503 with a stable code. A worker
 * that cannot prove which role it runs as must not run.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Seconds. Vercel Hobby caps at 60 without Fluid Compute; Pro at 300. */
export const maxDuration = 60;

/**
 * Seconds kept back from maxDuration so the last job's terminal write is
 * durable before the platform kills the function.
 */
const SHUTDOWN_MARGIN_S = 5;

const MAX_JOBS_PER_INVOCATION = 50;

export async function POST(request: Request): Promise<Response> {
  const { JOB_WORKER_TRIGGER_SECRET: secret } = loadFutureProviderEnv();
  const auth = authenticateTrigger(request.headers.get('authorization'), secret);

  if (!auth.ok) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let client;

  try {
    client = createWorkerClient();
  } catch (cause) {
    if (cause instanceof WorkerClientNotConfiguredError) {
      return Response.json({ error: 'worker_not_configured' }, { status: 503 });
    }

    throw cause;
  }

  const startedAt = Date.now();
  const deadline = startedAt + (maxDuration - SHUTDOWN_MARGIN_S) * 1_000;

  try {
    const report = await runWorker(client, {
      workerToken: randomUUID(),
      deadline,
      maxJobs: MAX_JOBS_PER_INVOCATION,
    });

    return Response.json({ ...report, durationMs: Date.now() - startedAt });
  } catch (cause) {
    if (cause instanceof WorkerError) {
      // The verb itself failed — a database error, not a handler error.
      // Handler errors never reach here; the loop maps them to fail_job.
      console.error('[jobs] worker verb failed', cause.cause);
      return Response.json({ error: 'worker_verb_failed' }, { status: 500 });
    }

    throw cause;
  }
}
