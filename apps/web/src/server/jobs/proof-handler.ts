import { proofJobPayloadSchema } from '@ai-content/shared/jobs';

import type { JobHandler, JobOutcome } from './handler.ts';

/**
 * The proof handler. This is NOT a placeholder and NOT a fake worker: it is
 * the one job type Phase 7 ships, and it exists to prove the execution
 * lifecycle with real, deterministic behaviour.
 *
 * What it proves, and how a test observes it:
 *
 *   mode 'ok'         → completed, result echoes the input. Proves the
 *                       happy path persists a result.
 *   mode 'fail'       → failed, retryable. Proves fail_job() reschedules
 *                       with backoff until max_attempts, then goes terminal.
 *   mode 'fail_final' → failed, NOT retryable. Proves a non-retryable
 *                       failure is terminal on attempt 1 (attempt_count
 *                       stays 1).
 *   mode 'fail_until' → fails while attempt_count < n, then succeeds.
 *                       Proves the retry path RECOVERS, not merely exhausts.
 *
 * What it deliberately does not do: no network, no filesystem, no model, no
 * Instagram, no other table. Anything that pretended to download or publish
 * would be a fake integration, which the phase boundary forbids.
 *
 * Determinism matters here. The same payload at the same attempt_count always
 * yields the same outcome, so a test asserting on the resulting rows is
 * asserting on the job system, not on luck.
 */
export const proofHandler: JobHandler<'proof'> = {
  type: 'proof',

  async run(job, signal): Promise<JobOutcome> {
    // Cooperative cancel, checked before doing anything.
    if (signal.cancelled) {
      return { kind: 'failed', code: 'cancelled', retryable: false };
    }

    const parsed = proofJobPayloadSchema.safeParse(job.payload);

    if (!parsed.success) {
      // A malformed payload will never become well-formed by retrying.
      return { kind: 'failed', code: 'bad_payload', retryable: false };
    }

    const payload = parsed.data;

    switch (payload.mode) {
      case 'ok':
        return {
          kind: 'completed',
          result: {
            mode: 'ok',
            echo: payload.echo ?? null,
            // attempt_count is already incremented at claim time, so this
            // records which attempt actually succeeded — 1 unless a prior
            // attempt was lost to a lease expiry.
            attempt: job.attempt_count,
          },
        };

      case 'fail':
        return { kind: 'failed', code: 'proof_failed', retryable: true };

      case 'fail_final':
        return { kind: 'failed', code: 'proof_failed', retryable: false };

      case 'fail_until':
        if (job.attempt_count < payload.attempt) {
          return { kind: 'failed', code: 'proof_failed', retryable: true };
        }

        return {
          kind: 'completed',
          result: { mode: 'fail_until', succeededOnAttempt: job.attempt_count },
        };
    }
  },
};
