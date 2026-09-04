import type { JobErrorCode } from '@ai-content/shared/jobs';
import type { Database } from '@ai-content/database/client';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Job, JobOutcome, JobSignal } from './handler.ts';
import { handlerFor } from './registry.ts';

/**
 * The worker loop: claim → execute → complete/fail, repeated until the time
 * budget is spent or nothing is due.
 *
 * This runs inside a serverless invocation, which changes WHEN it runs but
 * not HOW (Marcus, docs/PHASE_7_PLAN.md):
 *
 *   - There is no long-lived process. Each invocation claims a batch, works
 *     until `deadline`, and exits. Scheduling the invocation is the trigger
 *     endpoint's concern, not this loop's.
 *   - `workerToken` is invocation-scoped, which is what makes it a usable
 *     fencing token. Two overlapping invocations hold different tokens, so
 *     a job reclaimed by one cannot be completed by the other.
 *   - The lease (job_lease_for in the migration) must exceed the function's
 *     maxDuration. If it does not, a job still genuinely running becomes
 *     reclaimable while alive. That relationship is asserted by a test, not
 *     trusted.
 *
 * The client passed in must be able to EXECUTE claim_job / complete_job /
 * fail_job. Which role that is — and how the worker authenticates as it — is a
 * transport decision made in worker-client.ts, not here. This loop is
 * indifferent to it, which is why it can be tested against a stub.
 */
type WorkerClient = SupabaseClient<Database>;

export interface WorkerRunOptions {
  /** Unique per invocation. Never reuse across invocations. */
  readonly workerToken: string;
  /** Epoch ms after which no new job is claimed. */
  readonly deadline: number;
  /** Upper bound on jobs per invocation regardless of time. */
  readonly maxJobs?: number;
  /** Test seam. Defaults to Date.now. */
  readonly now?: () => number;
}

export interface WorkerRunReport {
  readonly claimed: number;
  readonly completed: number;
  readonly failed: number;
  /** Jobs whose terminal write affected zero rows: the lease was lost. */
  readonly fenced: number;
  /** Why the loop stopped. */
  readonly stoppedBecause: 'no_work' | 'deadline' | 'max_jobs';
}

export class WorkerError extends Error {
  constructor(
    message: string,
    public override readonly cause: unknown,
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

/**
 * Wall-clock headroom kept back so a claim made near the deadline still has
 * time to reach its terminal write. A claim with less than this remaining is
 * not made; the job stays pending for the next invocation.
 */
const CLAIM_HEADROOM_MS = 2_000;

export async function runWorker(
  client: WorkerClient,
  options: WorkerRunOptions,
): Promise<WorkerRunReport> {
  const now = options.now ?? Date.now;
  const maxJobs = options.maxJobs ?? Number.POSITIVE_INFINITY;

  let claimed = 0;
  let completed = 0;
  let failed = 0;
  let fenced = 0;

  for (;;) {
    if (claimed >= maxJobs) {
      return { claimed, completed, failed, fenced, stoppedBecause: 'max_jobs' };
    }

    if (now() + CLAIM_HEADROOM_MS >= options.deadline) {
      return { claimed, completed, failed, fenced, stoppedBecause: 'deadline' };
    }

    const job = await claim(client, options.workerToken);

    if (job === null) {
      return { claimed, completed, failed, fenced, stoppedBecause: 'no_work' };
    }

    claimed += 1;

    const outcome = await execute(job, {
      cancelled: job.cancel_requested,
      deadline: options.deadline,
    });

    const wrote = await settle(client, job, options.workerToken, outcome);

    if (!wrote) {
      // complete_job / fail_job returned false or null: the lease was lost to
      // a reclaim, or the row is gone. Nothing was written, by design.
      fenced += 1;
      continue;
    }

    if (outcome.kind === 'completed') {
      completed += 1;
    } else {
      failed += 1;
    }
  }
}

async function claim(client: WorkerClient, workerToken: string): Promise<Job | null> {
  const { data, error } = await client.rpc('claim_job', { worker_token: workerToken });

  if (error) {
    throw new WorkerError('claim_job failed', error);
  }

  // A composite-returning function yields a row whose columns are all null
  // when the UPDATE matched nothing. Postgres has no "no row" for a scalar
  // RETURNS <table>; id being null is the reliable "nothing claimed" signal.
  if (data === null || typeof data !== 'object' || data.id === null) {
    return null;
  }

  return data as Job;
}

async function execute(job: Job, signal: JobSignal): Promise<JobOutcome> {
  const handler = handlerFor(job.type);

  if (handler === undefined) {
    return { kind: 'failed', code: 'unknown_type', retryable: false };
  }

  try {
    return await handler.run(job, signal);
  } catch (cause) {
    // Unclassified throw. Logged server-side with the real error; the row
    // gets only the closed code. That asymmetry is the whole point of not
    // having a last_error_message column.
    console.error(`[jobs] handler for '${job.type}' threw on job ${job.id}`, cause);
    return { kind: 'failed', code: 'handler_error', retryable: true };
  }
}

/** Returns whether a row was actually written (false = fenced out). */
async function settle(
  client: WorkerClient,
  job: Job,
  workerToken: string,
  outcome: JobOutcome,
): Promise<boolean> {
  if (outcome.kind === 'completed') {
    const { data, error } = await client.rpc('complete_job', {
      job_id: job.id,
      worker_token: workerToken,
      job_result: toJson(outcome.result),
    });

    if (error) {
      throw new WorkerError('complete_job failed', error);
    }

    return data === true;
  }

  const { data, error } = await client.rpc('fail_job', {
    job_id: job.id,
    worker_token: workerToken,
    error_code: outcome.code satisfies JobErrorCode,
    retryable: outcome.retryable,
  });

  if (error) {
    throw new WorkerError('fail_job failed', error);
  }

  // fail_job returns the next status, or null when the lease was lost.
  return data !== null;
}

/**
 * Handlers return `unknown`; the column is jsonb. Anything JSON cannot
 * represent (undefined, functions, BigInt) is dropped rather than thrown, so a
 * handler cannot poison its own completion by returning an odd shape.
 */
function toJson(value: unknown): Database['public']['Tables']['jobs']['Row']['result'] {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Database['public']['Tables']['jobs']['Row']['result'];
}
