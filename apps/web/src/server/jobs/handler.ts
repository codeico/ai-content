import type { JobErrorCode, JobType } from '@ai-content/shared/jobs';
import type { Tables } from '@ai-content/database/client';

/**
 * The contract every job handler implements.
 *
 * A handler receives a claimed row and returns an outcome. It does NOT touch
 * the jobs table: the worker loop translates the outcome into complete_job()
 * or fail_job(), both of which are fenced on the worker's lease token. That
 * split is deliberate — a handler cannot forge its own terminal state, and it
 * cannot accidentally write a result for a job it no longer holds.
 *
 * Two rules from docs/PHASE_7_PLAN.md that this type makes hard to break:
 *
 *   1. A handler must be safe to run twice. The lease picks a winner when a
 *      worker dies, but Postgres cannot tell dead from slow, so a frozen
 *      worker can resume after its lease expires and run the same job again.
 *      Fencing makes the loser's WRITES harmless; it cannot make the loser's
 *      SIDE EFFECTS harmless. A handler with an external effect must record it
 *      in its own table and check before repeating. (No handler today has an
 *      external effect. The rule is stated now, while it is free.)
 *
 *   2. Scope comes from the row, never from the payload. `job.workspace_id` is
 *      the tenant. A payload that also carries a workspace_id is not trusted —
 *      a handler that reads scope from payload has built a cross-tenant write
 *      primitive.
 */
export type Job = Tables<'jobs'>;

export type JobOutcome =
  | { kind: 'completed'; result?: unknown }
  | { kind: 'failed'; code: JobErrorCode; retryable: boolean };

export interface JobHandler<T extends JobType = JobType> {
  readonly type: T;

  /**
   * Execute one claimed job. Throwing is allowed and is treated as
   * `{ kind: 'failed', code: 'handler_error', retryable: true }` — but a
   * handler that can classify its failure should return a `failed` outcome
   * with a specific code instead, because 'handler_error' tells a reader
   * nothing.
   *
   * The handler must not import a Supabase client or any repository that
   * writes jobs. It may read and write OTHER tables through whatever client
   * the phase that introduces it provides — with `job.workspace_id` as the
   * scope, always.
   */
  run(job: Job, signal: JobSignal): Promise<JobOutcome>;
}

/**
 * Cooperative cancellation and time budget. A running job is never mutated
 * out from under a worker; instead the handler checks `signal.cancelled` at
 * safe points and returns `{ kind: 'failed', code: 'cancelled' }` when set.
 *
 * `deadline` is when the worker invocation must stop. A handler doing
 * anything longer than trivial checks it and returns a retryable failure
 * rather than being killed mid-write.
 */
export interface JobSignal {
  readonly cancelled: boolean;
  readonly deadline: number;
}
