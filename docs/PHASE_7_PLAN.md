# Phase 7 — Job System Foundation: Implementation Plan

Design settled after independent review by Nathan (authorization and isolation)
and Marcus (concurrency and execution). Their findings changed the design
rather than hardening it; both reviews are recorded in
`docs/PHASE_7_SECURITY_REVIEW.md` and inline below.

Nothing here is implemented yet. This document is the plan the owner asked for
before implementation begins.

## The reframing

`jobs` is **an execution surface, not user data.**

The shape I was about to write — a normal table with member-level RLS policies
and a service-role worker — is wrong. A direct insert lets a client choose which
handler runs. A direct update lets a client forge `completed`, or clear a lock
and cause double execution. Everything a user may do to a job is therefore a
**verb**, not a write.

A second consequence, worth a comment in the migration itself: **`jobs` is the
first table whose queries must deliberately NOT be workspace-scoped.** A worker
claims across all tenants. Every other query in this repository is explicitly
workspace-scoped, so without a note someone will "fix" this later and break the
worker.

## Schema

Ten columns, not the twenty in `DATABASE_SCHEMA` §22. Each omission is a column
nothing can currently write.

| Column         | Type          | Why                                        |
| -------------- | ------------- | ------------------------------------------ |
| `id`           | uuid PK       |                                            |
| `workspace_id` | uuid not null | tenant, cascade-restricted (see below)     |
| `type`         | text not null | which handler runs                         |
| `status`       | text not null | `pending`/`running`/`completed`/`failed`   |
| `payload`      | jsonb         | handler input                              |
| `result`       | jsonb         | handler output                             |
| `attempt_count`| int not null  | retry accounting                           |
| `max_attempts` | int not null  | terminal-failure boundary                  |
| `scheduled_for`| timestamptz   | when it becomes claimable; retry backoff   |
| `locked_at`    | timestamptz   | lease start                                |
| `locked_by`    | text          | fencing token — see claiming               |
| `dedup_key`    | text          | enqueue idempotency                        |
| `last_error_code` | text       | closed enum, not free text                 |
| `created_at` / `updated_at` | timestamptz |                              |

Deliberately **not** modelled, each with the reason:

- `priority` — nothing produces a non-default priority; ordering is
  `scheduled_for` until something needs otherwise.
- `entity_type` / `entity_id` — Nathan: a polymorphic pair cannot carry the
  composite-FK protection `captions` has
  (`foreign key (content_id, workspace_id) references content(id, workspace_id)`,
  which makes a cross-workspace attachment a database error rather than a policy
  question). Per-type FK columns arrive with the phase that needs them.
- `last_error_message` — Nathan, HIGH: handlers will talk to Meta and to an AI
  router, and provider errors routinely echo request context. Free text written
  by a handler is a realistic path for a token or signed URL to reach a database
  column and then a UI. The UI renders a closed `last_error_code` enum.
- `started_at` / `completed_at` — `locked_at` and `updated_at` already carry
  this; two more timestamps nothing reads is speculation.

### Status: four values

Marcus, agreeing with my instinct: `pending`, `running`, `completed`, `failed`.

`queued` is a distinction with no transition. `retrying` is `pending` with a
future `scheduled_for`. `cancelled` is genuinely coming but nothing can produce
it yet — and it arrives as an additive CHECK widening, the precedent already set
by `media_status` in §14 (three of six values shipped, each future value a new
migration rather than a rewrite).

## Claiming

One statement. No read-then-write race.

```sql
update jobs set
  status = 'running',
  locked_at = now(),
  locked_by = $worker,
  attempt_count = attempt_count + 1
where id = (
  select id from jobs
  where scheduled_for <= now()
    and (
      status = 'pending'
      or (status = 'running' and locked_at < now() - lease_for(type))
    )
  order by scheduled_for
  for update skip locked
  limit 1
)
returning *;
```

**One predicate, not two code paths.** Marcus was explicit: stale reclaim is
part of the claim condition, not a separate repair pass. That satisfies the
owner's constraint that recovery be bounded and deterministic with no
always-running timer.

**Lease per job type, not a global constant.** `lease_for(type)` — a media
download and a caption generation have nothing in common in duration.

### The part I was wrong about

I asked whether stale-lease reclaim opens a double-execution window. Marcus's
answer: **yes, it does, and no design removes it.** Postgres cannot distinguish
a dead worker from a slow one. A frozen function can resume after its lease
expires.

So the lease does not prevent double execution — **it picks a winner, and
fencing makes the loser harmless.** Reclaim rewrites `locked_by`, and every
terminal write carries `where locked_by = $token`. A resumed zombie writing its
result finds the token changed and its update affects zero rows.

This also gives the workspace-deletion answer: a completing worker whose job row
is gone writes nothing, for the same reason.

## Idempotency — two mechanisms, not one

Marcus, correcting a conflation in my question:

**Enqueue dedup** lives in `jobs`: a partial unique index on `dedup_key` over
active statuses only, so a completed job does not block re-running the same work
later.

**External-effect idempotency** does not live in `jobs` at all. It belongs to
`publish_attempts`, which §19–21 already models correctly — including an
`UNKNOWN` status for the case where the request left but the response never
arrived.

The rule to state now, while it is still free: **a handler must be safe to run
twice, and records its own effects in its own table.**

## Authorization

Per Nathan. The worker gets no table grants at all.

- A `job_worker` role with `EXECUTE` on three `SECURITY DEFINER` functions:
  claim, complete, fail.
- No user-facing `INSERT` or `UPDATE` policy. Enqueue and cancel are definer
  functions.
- Cancelling a `running` job sets `cancel_requested` — cooperative, never
  mutating state under a live worker.
- No `SELECT` grant on the raw table. A `security_invoker` view exposes only
  what a tenant needs; `payload`, `result`, `locked_by` stay out of it.
- Workspace deletion is two-phase rather than plain cascade: cascade is right
  for stored rows, wrong for in-flight execution.

## Execution

Marcus: serverless changes **when** a claim runs, not **how**.

- Batch per invocation with a time budget.
- `locked_by` is invocation-scoped, which is what makes it a usable fencing
  token.
- **The lease must exceed the function's `maxDuration`.** Currently
  `maxDuration` is not configured anywhere in this repository — verified — so
  this phase sets it explicitly rather than inheriting a default.
- The trigger endpoint is the first surface in this codebase not governed by
  RLS. It needs its own authentication, and it is the obvious attack surface.

## Proving it

Marcus's pushback, accepted: the roadmap's acceptance criteria — claim safely,
prevent duplicate execution, recover stale jobs — **cannot be honestly verified
without concurrent claims against real Postgres.** Unit tests with a mocked
client would prove only that the mock behaves as written.

So that test is a stated deliverable, not an optional extra:

1. N concurrent claims against one pending job — exactly one wins.
2. A claim whose lease expires, reclaimed by a second worker — the first
   worker's completion writes zero rows.
3. Cross-workspace: a tenant cannot see or cancel another tenant's job.
4. Retry: a failing handler reschedules with backoff until `max_attempts`, then
   terminal.

**This writes real rows.** The repository's `DATABASE_URL` habit points at a
live database, so the test must create and clean up its own workspace, and the
cleanup must be verified rather than assumed.

### The proof handler

One deterministic internal job type. No external call, no fake download, no
pretend AI. It exists to exercise claim → execute → complete/fail → persist, and
nothing else.

## Out of scope — explicit

TikTok scraping, video downloading, FFmpeg, object storage, R2, AI caption
generation via a real provider, Instagram OAuth, Instagram publishing,
scheduling, push notifications, analytics, and every job type in §23 other than
the proof handler.

No placeholder workers that pretend to process content.

## Files expected to change

- `supabase/migrations/<ts>_create_jobs.sql` — table, index, definer functions,
  role, view
- `apps/web/src/server/repositories/job-repository.ts`
- `apps/web/src/server/jobs/` — handler registry and the proof handler
- an authenticated trigger endpoint
- `docs/STATE_MACHINES.md` — job lifecycle section
- `docs/DATABASE_SCHEMA.md` §22–25 — implemented-subset notes

## Open

Whether the trigger endpoint is a Vercel cron or an external scheduler. It does
not change the schema, so it does not block the migration.
