-- Phase 7 — Job system foundation.
--
-- Durable background execution. Postgres is the source of truth; any queue
-- added later is transport, never the record (docs/TECHNICAL_ARCHITECTURE.md
-- §23).
--
-- READ THIS BEFORE "FIXING" ANYTHING HERE:
--
--   jobs is the FIRST table in this repository whose queries deliberately are
--   NOT workspace-scoped. A worker claims across every tenant. Every other
--   repository query filters by workspace_id and should keep doing so; this
--   one cannot, and that is not an oversight.
--
--   jobs is an EXECUTION SURFACE, not user data. There is no user INSERT or
--   UPDATE policy on purpose. A direct insert would let a client choose which
--   handler runs. A direct update would let a client forge 'completed', or
--   clear a lock and cause double execution. Everything a user may do to a job
--   is a verb (a security definer function), never a write.
--
-- Design decisions and why:
--
--   Ten columns, not the twenty in DATABASE_SCHEMA §22. Every omission is a
--   column nothing can currently write:
--
--     priority          — nothing produces a non-default value; ordering is
--                         scheduled_for until something needs otherwise.
--     entity_type/id    — a polymorphic pair cannot carry the composite-FK
--                         protection captions has (foreign key
--                         (content_id, workspace_id) → content(id,
--                         workspace_id), which makes a cross-workspace
--                         attachment a database error rather than a policy
--                         question). Per-type FK columns arrive with the phase
--                         that needs them.
--     last_error_message — handlers will eventually talk to Meta and to an AI
--                         router, and provider errors routinely echo request
--                         context. Free text written by a handler is a
--                         realistic path for a token or signed URL to reach a
--                         database column and then a UI. The UI renders the
--                         closed last_error_code enum instead.
--     started_at/completed_at — locked_at and updated_at already carry this.
--
--   Four status values, not §24's seven. 'queued' is a distinction with no
--   transition. 'retrying' is 'pending' with a future scheduled_for.
--   'cancelled' is genuinely coming but nothing can produce it yet; it arrives
--   as an additive check widening, the precedent set by media_status in §14.
--
--   locked_by is a FENCING TOKEN, not a label. Postgres cannot distinguish a
--   dead worker from a slow one, so a lease expiring does NOT prove the first
--   worker stopped — a frozen function can resume after its lease ends. The
--   lease therefore does not prevent double execution; it picks a winner, and
--   fencing makes the loser harmless: reclaim rewrites locked_by, and every
--   terminal write carries "where locked_by = $token", so a resumed zombie
--   updates zero rows.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),

  -- No cascade. Cascade is right for stored rows and wrong for in-flight
  -- execution: a running PUBLISH_POST would keep acting for a deleted tenant
  -- because the worker holds the job in memory after the row is gone.
  -- Deletion is two-phase (see cancel_workspace_jobs below), and restrict
  -- makes forgetting that a database error rather than a silent leak.
  workspace_id uuid not null references public.workspaces (id) on delete restrict,

  type text not null,

  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),

  payload jsonb not null default '{}'::jsonb,
  result jsonb,

  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),

  -- When this becomes claimable. Retry backoff is a future scheduled_for,
  -- which is why 'retrying' is not a status.
  scheduled_for timestamptz not null default now(),

  locked_at timestamptz,
  locked_by text,

  -- Enqueue idempotency. Null means "no dedup wanted".
  dedup_key text,

  -- Closed enum, mapped by the application. Never raw provider text.
  last_error_code text,

  -- Cooperative cancellation. A running job is never mutated out from under a
  -- live worker; the handler observes this and stops.
  cancel_requested boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint jobs_type_not_blank check (btrim(type) <> ''),

  -- A lock is both columns or neither. Half a lock is a bug that would make
  -- the fencing check meaningless.
  constraint jobs_lock_is_whole
    check ((locked_at is null) = (locked_by is null)),

  -- Only a running job holds a lock.
  constraint jobs_lock_requires_running
    check (status = 'running' or locked_at is null)
);

-- The claim query's index: it scans claimable work in scheduled_for order.
create index if not exists jobs_claimable_idx
  on public.jobs (scheduled_for, id)
  where status in ('pending', 'running');

create index if not exists jobs_workspace_id_created_at_idx
  on public.jobs (workspace_id, created_at desc, id desc);

-- Enqueue dedup over ACTIVE statuses only: a completed job must not block
-- running the same work again later.
create unique index if not exists jobs_dedup_active_idx
  on public.jobs (workspace_id, dedup_key)
  where dedup_key is not null and status in ('pending', 'running');

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row
  execute function public.set_updated_at();

-- Lease per job type, not a global constant: a media download and a caption
-- generation have nothing in common in duration. The lease must exceed the
-- worker function's wall-clock limit, or a still-running job becomes
-- reclaimable while it is genuinely alive.
create or replace function public.job_lease_for(job_type text)
returns interval
language sql
immutable
as $$
  select case job_type
    when 'proof' then interval '1 minute'
    else interval '5 minutes'
  end;
$$;

comment on function public.job_lease_for(text) is
  'How long a claim on this job type stays valid. Must exceed the worker''s maxDuration.';

-- Claim one job. ONE statement, no read-then-write race.
--
-- Stale reclaim is part of the claim predicate, not a separate repair pass:
-- that is what makes recovery bounded and deterministic with no
-- always-running timer. A crashed worker's job simply becomes claimable again
-- once its lease expires.
--
-- skip locked is what makes concurrent workers safe: a row another
-- transaction is claiming is skipped rather than waited on, so N workers
-- claim N different jobs instead of serialising on the same one.
create or replace function public.claim_job(worker_token text)
returns public.jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed public.jobs;
begin
  if worker_token is null or btrim(worker_token) = '' then
    raise exception 'worker_token is required';
  end if;

  update public.jobs as j
  set
    status = 'running',
    locked_at = now(),
    locked_by = worker_token,
    attempt_count = j.attempt_count + 1
  where j.id = (
    select candidate.id
    from public.jobs as candidate
    where candidate.scheduled_for <= now()
      and candidate.cancel_requested = false
      and (
        candidate.status = 'pending'
        or (
          candidate.status = 'running'
          and candidate.locked_at < now() - public.job_lease_for(candidate.type)
        )
      )
    order by candidate.scheduled_for, candidate.id
    for update skip locked
    limit 1
  )
  returning j.* into claimed;

  return claimed;
end;
$$;

comment on function public.claim_job(text) is
  'Atomically claim the next due job. Reclaims expired leases via the same predicate; returns null when nothing is due.';

-- Terminal writes are FENCED. "where locked_by = worker_token" is the whole
-- point: a worker whose lease expired and whose job was reclaimed by someone
-- else updates zero rows and returns false. Same mechanism protects a job
-- whose workspace was deleted mid-flight — the row is gone, so the write is a
-- no-op rather than an action taken for a dead tenant.
create or replace function public.complete_job(
  job_id uuid,
  worker_token text,
  job_result jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated integer;
begin
  update public.jobs
  set
    status = 'completed',
    result = job_result,
    locked_at = null,
    locked_by = null,
    last_error_code = null
  where id = job_id
    and status = 'running'
    and locked_by = worker_token;

  get diagnostics updated = row_count;
  return updated = 1;
end;
$$;

comment on function public.complete_job(uuid, text, jsonb) is
  'Mark a claimed job completed. Returns false when the caller no longer holds the lease (fencing).';

-- Failure is retry-or-terminal, decided by attempt_count against
-- max_attempts. attempt_count was already incremented at claim time, so a job
-- that has burned its attempts fails terminally here rather than being
-- rescheduled forever.
--
-- Backoff is exponential in the scheduled_for, which is why 'retrying' is not
-- a status: a job awaiting retry is simply pending with a future time.
create or replace function public.fail_job(
  job_id uuid,
  worker_token text,
  error_code text,
  retryable boolean default true
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job public.jobs;
  next_status text;
begin
  select * into job
  from public.jobs
  where id = job_id
    and status = 'running'
    and locked_by = worker_token
  for update;

  if not found then
    -- Lease lost, job reclaimed, or workspace deleted. Write nothing.
    return null;
  end if;

  if retryable and job.attempt_count < job.max_attempts then
    next_status := 'pending';

    update public.jobs
    set
      status = 'pending',
      locked_at = null,
      locked_by = null,
      last_error_code = error_code,
      scheduled_for = now() + (interval '30 seconds' * power(2, job.attempt_count - 1))
    where id = job_id;
  else
    next_status := 'failed';

    update public.jobs
    set
      status = 'failed',
      locked_at = null,
      locked_by = null,
      last_error_code = error_code
    where id = job_id;
  end if;

  return next_status;
end;
$$;

comment on function public.fail_job(uuid, text, text, boolean) is
  'Record a failure: reschedules with backoff while attempts remain, otherwise terminal. Returns null when the caller lost the lease.';

-- Enqueue is a verb, not an insert. The caller proves workspace membership
-- through the same helper every other policy uses; it cannot enqueue into a
-- workspace it does not belong to, and it cannot set status, locks or
-- attempt counts.
create or replace function public.enqueue_job(
  target_workspace_id uuid,
  job_type text,
  job_payload jsonb default '{}'::jsonb,
  job_dedup_key text default null,
  run_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  if target_workspace_id is null then
    raise exception 'target_workspace_id is required';
  end if;

  if target_workspace_id not in (
    select public.workspace_ids_for_current_user()
  ) then
    raise exception 'not a member of workspace %', target_workspace_id
      using errcode = '42501';
  end if;

  insert into public.jobs (workspace_id, type, payload, dedup_key, scheduled_for)
  values (
    target_workspace_id,
    job_type,
    coalesce(job_payload, '{}'::jsonb),
    job_dedup_key,
    coalesce(run_at, now())
  )
  returning id into new_id;

  return new_id;
end;
$$;

comment on function public.enqueue_job(uuid, text, jsonb, text, timestamptz) is
  'Create a job in a workspace the caller belongs to. The only user-facing write path.';

-- Cancellation is cooperative for running jobs: setting a flag the handler
-- observes, never mutating state under a live worker. A pending job can be
-- failed outright because nothing holds it.
create or replace function public.cancel_job(job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated integer;
begin
  update public.jobs
  set
    cancel_requested = true,
    status = case when status = 'pending' then 'failed' else status end,
    last_error_code = case when status = 'pending' then 'cancelled' else last_error_code end
  where id = job_id
    and status in ('pending', 'running')
    and workspace_id in (select public.workspace_ids_for_current_user());

  get diagnostics updated = row_count;
  return updated = 1;
end;
$$;

comment on function public.cancel_job(uuid) is
  'Request cancellation of a job in the caller''s workspace. Running jobs stop cooperatively.';

-- Workspace deletion is two-phase. Deleting a workspace with live jobs is
-- blocked by the restrict FK; the caller cancels first, and only jobs that
-- are no longer running can be removed. That prevents the case cascade would
-- have allowed: a worker still executing PUBLISH_POST for a tenant that no
-- longer exists.
create or replace function public.cancel_workspace_jobs(target_workspace_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer;
begin
  if target_workspace_id not in (
    select public.workspace_ids_for_current_user()
  ) then
    raise exception 'not a member of workspace %', target_workspace_id
      using errcode = '42501';
  end if;

  update public.jobs
  set
    cancel_requested = true,
    status = case when status = 'pending' then 'failed' else status end,
    last_error_code = case when status = 'pending' then 'cancelled' else last_error_code end
  where workspace_id = target_workspace_id
    and status in ('pending', 'running');

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.jobs enable row level security;

-- No policies for INSERT or UPDATE. That is deliberate and is the core of the
-- design: enqueue and cancel are the security definer functions above. A
-- policy here would let a client choose which handler runs, or forge a
-- terminal status.
--
-- No SELECT policy on the raw table either: payload, result, locked_by and
-- last_error_code are execution internals, not tenant-readable data. Tenants
-- read the view below.
--
-- With RLS enabled and no policies, every ordinary role sees zero rows. The
-- definer functions and the table owner are unaffected.

-- What a tenant may actually see: progress, not internals.
create or replace view public.workspace_jobs
with (security_invoker = true)
as
  select
    j.id,
    j.workspace_id,
    j.type,
    j.status,
    j.attempt_count,
    j.max_attempts,
    j.scheduled_for,
    j.cancel_requested,
    j.last_error_code,
    j.created_at,
    j.updated_at
  from public.jobs as j
  where j.workspace_id in (select public.workspace_ids_for_current_user());

comment on view public.workspace_jobs is
  'Tenant-facing job progress. Deliberately omits payload, result and locked_by: execution internals are not tenant data.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- READ THIS. Supabase grants EXECUTE on every new function in public to
-- anon, authenticated and service_role through ALTER DEFAULT PRIVILEGES. Those
-- are explicit per-role grants, so "revoke ... from public" removes NOTHING:
-- the role-level grant stays and any tenant can call the function. This was
-- verified against a real Postgres with Supabase's default privileges
-- replicated — after a public-only revoke, pg_proc.proacl still read
-- {authenticated=X, anon=X, service_role=X} and an authenticated session
-- successfully claimed a job.
--
-- Every revoke below therefore names the roles Supabase actually granted.

-- The raw table is not directly selectable by tenants: payload, result and
-- locked_by are execution internals. Column access goes through the view.
-- (The default-privilege grant on the table itself must also be undone, or
-- security_invoker on the view is moot — the caller could just read the table.)
revoke all on public.jobs from public, anon, authenticated;
grant select on public.workspace_jobs to authenticated;

-- security_invoker means the view runs as the caller, so the table's RLS
-- applies. RLS alone is not enough here though: without a table-level SELECT
-- grant the caller gets "permission denied" before RLS is even consulted.
-- The view needs the grant; the policy then narrows it to the caller's
-- workspaces. Verified: with the grant revoked, reading the view fails with
-- "permission denied for table jobs".
grant select (
  id, workspace_id, type, status, attempt_count, max_attempts,
  scheduled_for, cancel_requested, last_error_code, created_at, updated_at
) on public.jobs to authenticated;

create policy "Members can read jobs in their workspaces"
  on public.jobs
  for select
  to authenticated
  using (workspace_id in (select public.workspace_ids_for_current_user()));

-- Tenant verbs: enqueue and cancel, nothing else.
revoke execute on function public.enqueue_job(uuid, text, jsonb, text, timestamptz) from public, anon, authenticated, service_role;
revoke execute on function public.cancel_job(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.cancel_workspace_jobs(uuid) from public, anon, authenticated, service_role;
grant execute on function public.enqueue_job(uuid, text, jsonb, text, timestamptz) to authenticated;
grant execute on function public.cancel_job(uuid) to authenticated;
grant execute on function public.cancel_workspace_jobs(uuid) to authenticated;

-- Worker verbs. A tenant must never claim, complete or fail a job — that is
-- exactly how a client would forge a terminal status or steal a lease.
--
-- The worker is a dedicated role with EXECUTE on these three functions and no
-- table privileges at all. It cannot read jobs, cannot write jobs; it can only
-- call the three verbs the design permits. This is deliberately NOT
-- service_role: service_role has bypassrls and full table access, and using
-- it for the worker would remove the RLS backstop precisely where handler code
-- gets the least review.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'job_worker') then
    create role job_worker nologin;
  end if;
end
$$;

grant usage on schema public to job_worker;

revoke execute on function public.claim_job(text) from public, anon, authenticated, service_role;
revoke execute on function public.complete_job(uuid, text, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.fail_job(uuid, text, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.claim_job(text) to job_worker;
grant execute on function public.complete_job(uuid, text, jsonb) to job_worker;
grant execute on function public.fail_job(uuid, text, text, boolean) to job_worker;

-- job_lease_for is called inside claim_job (security definer), so the worker
-- role does not need it directly. Tenants do not need it at all.
revoke execute on function public.job_lease_for(text) from public, anon, authenticated, service_role;

comment on table public.jobs is
  'Durable background jobs. Execution surface, not user data: no user insert/update policy, and worker verbs are security definer functions granted only to job_worker.';
