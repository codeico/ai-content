/**
 * Job domain primitives. Same split as ../content/caption.ts: constants the
 * migration mirrors in CHECK constraints live here so a test can assert they
 * agree, and the closed enums that the UI is allowed to render.
 *
 * What a job IS in this codebase (docs/PHASE_7_PLAN.md): an execution
 * surface, not user data. Nothing here describes a row a user may write; every
 * write goes through a security definer verb in the database. These types
 * describe what comes back.
 */
import { z } from 'zod';

/**
 * Lifecycle of one job. Must match the CHECK in
 * supabase/migrations/20260904100000_create_jobs.sql.
 *
 *   pending   — claimable once scheduled_for has passed. A job awaiting retry
 *               is pending with a future scheduled_for; "retrying" is not a
 *               status because it has no transition of its own.
 *   running   — claimed; locked_at/locked_by hold the lease.
 *   completed — terminal success.
 *   failed    — terminal failure, or cancelled while pending.
 *
 * 'cancelled' is deliberately absent: nothing can produce it yet. It arrives
 * as an additive CHECK widening when something can.
 */
export const JOB_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * Job types the application knows how to execute. A type not in this list has
 * no handler, and enqueueing it would create a row that can only ever fail.
 *
 * ONE type today, and it is not pretend work. 'proof' exercises the full
 * lifecycle — claim, execute deterministically, complete or fail, persist —
 * without touching a network, a file, a model or Instagram. It exists so the
 * job system is proven by real execution rather than by CRUD on the table.
 *
 * The future types from DATABASE_SCHEMA §23 (DISCOVER_CONTENT, ACQUIRE_MEDIA,
 * GENERATE_CAPTION, PUBLISH_POST, ...) are NOT listed. Each arrives with the
 * phase that can actually execute it. Listing them now would let a row be
 * enqueued for a handler that does not exist.
 */
export const JOB_TYPES = ['proof'] as const;

export type JobType = (typeof JOB_TYPES)[number];

export const jobTypeSchema = z.enum(JOB_TYPES);

/**
 * Closed set of error codes a handler may record. This is the ONLY error
 * information that reaches the jobs table and therefore the UI.
 *
 * Why closed: handlers will eventually talk to Meta and to an AI router, and
 * provider error bodies routinely echo request context — a token, a signed
 * URL, an API key. Free text written by a handler is a realistic path for a
 * secret to land in a database column and then a screen. So there is no
 * last_error_message column at all; a handler maps whatever it saw onto one of
 * these, and the raw detail goes to server logs where it belongs.
 *
 * Adding a code is an application change here plus (optionally) a UI label.
 * It never requires a migration; the column is plain text with the closed set
 * enforced by this schema at the write site.
 */
export const JOB_ERROR_CODES = [
  /** The handler threw for a reason it did not classify. Retryable. */
  'handler_error',
  /** Payload did not validate against the handler's schema. Not retryable. */
  'bad_payload',
  /** A job was enqueued for a type with no registered handler. Not retryable. */
  'unknown_type',
  /** The handler saw cancel_requested and stopped. Not retryable. */
  'cancelled',
  /** The proof handler's deterministic failure path. Retryable. */
  'proof_failed',
] as const;

export type JobErrorCode = (typeof JOB_ERROR_CODES)[number];

export const jobErrorCodeSchema = z.enum(JOB_ERROR_CODES);

/**
 * Payload for the proof handler. Deterministic by construction: the same
 * input always produces the same outcome, which is what makes it usable as
 * evidence that the lifecycle works.
 *
 *   ok           — complete with a result echoing the input
 *   fail         — fail with 'proof_failed', retryable
 *   fail_final   — fail with 'proof_failed', NOT retryable (proves the
 *                  non-retryable path reaches terminal on attempt 1)
 *   fail_until   — fail while attempt_count < n, then succeed (proves the
 *                  retry path recovers rather than only exhausting)
 */
export const proofJobPayloadSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('ok'), echo: z.string().max(200).optional() }),
  z.object({ mode: z.literal('fail') }),
  z.object({ mode: z.literal('fail_final') }),
  z.object({ mode: z.literal('fail_until'), attempt: z.number().int().min(1).max(10) }),
]);

export type ProofJobPayload = z.infer<typeof proofJobPayloadSchema>;

/**
 * Backoff the database applies between retries. Mirrors fail_job() in the
 * migration: 30s × 2^(attempt−1). Exposed so a test can assert the two agree
 * rather than trusting a comment.
 */
export const JOB_RETRY_BASE_SECONDS = 30;

/**
 * Default ceiling on attempts. Mirrors the column default in the migration.
 */
export const JOB_DEFAULT_MAX_ATTEMPTS = 3;
