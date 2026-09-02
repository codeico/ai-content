-- Phase 2 — Workspace foundation.
--
-- Creates workspaces and workspace_members, the security boundary every future
-- domain table hangs off (docs/DATABASE_SCHEMA.md: "Workspace adalah security
-- boundary utama"). No other domain tables are created here.
--
-- Deviates from docs/DATABASE_SCHEMA.md §6 in three ways, per the explicit,
-- more specific instructions in docs/PHASE_2_PROMPT.md:
--   - no slug: §21 forbids adding one without a real human-readable-URL
--     requirement, and §17's own route example is /app/workspaces/[workspaceId]
--     (UUID-keyed), so there is no such requirement yet.
--   - no niche/timezone/description: §6 lists exactly these as forbidden
--     premature columns; they belong to a future content/workspace-settings
--     phase.
--   - owner column is named owner_id, not created_by: §7 says this schema must
--     support "future ownership transfer if required". A column literally
--     named created_by is an audit fact that must never change; overloading it
--     to also mean "current owner" once transfer exists would be misleading.
--     owner_id is named for what it's actually used for today (the RLS/
--     authorization owner check).

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- restrict, not cascade: deleting a profile that still owns a workspace
  -- must fail loudly rather than silently destroying the workspace (and, once
  -- membership exists beyond the owner, every other member's access to it).
  -- The caller must delete or transfer the workspace first. This does not
  -- change today's behaviour (Phase 1 added no account-deletion flow) — it
  -- fixes the invariant before anything depends on the wrong one.
  owner_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Defense in depth against a whitespace-only name reaching the database
  -- through something other than the Zod-validated Server Action.
  constraint workspaces_name_not_blank check (btrim(name) <> '')
);

comment on table public.workspaces is
  'An independent content operation owned by one profile. Security boundary for all future workspace-scoped tables.';

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row
  -- Reuses the Phase 1 trigger function (packages/database migration
  -- 20260901000000) — it was written generic for exactly this reuse.
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------------

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Phase 2 has exactly two roles. Do not add admin/editor/viewer/etc. here —
  -- see docs/PHASE_2_PROMPT.md §9.
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  -- A profile cannot hold two membership rows for the same workspace.
  constraint workspace_members_unique_membership unique (workspace_id, user_id)
);

comment on table public.workspace_members is
  'Explicit workspace access grants. Phase 2 only ever inserts an owner row via trigger; no invitation or role-management flow exists yet.';

create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- Owner membership on workspace creation
-- ---------------------------------------------------------------------------

-- Same shape as Phase 1's handle_new_user: a security definer trigger, not
-- client-side sequencing, so a workspace can never exist without its owner's
-- membership row and a retried insert can never produce a duplicate.
create function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row
  execute function public.handle_new_workspace();

-- ---------------------------------------------------------------------------
-- RLS recursion safety
-- ---------------------------------------------------------------------------

-- The naive design is unsafe: a workspaces SELECT policy that queries
-- workspace_members, paired with a workspace_members SELECT policy that
-- queries workspaces, is a 42P17 infinite-recursion error (confirmed against
-- Supabase's current documented guidance for this exact shape).
--
-- Fix: a narrow security definer function reads workspace_members as its
-- owner (which has bypassrls on Supabase), so evaluating it never re-triggers
-- workspace_members' own RLS policy. It takes no parameters and is hardcoded
-- to (select auth.uid()) — it cannot be asked for anyone else's membership,
-- so it is not a general-purpose privileged helper.
create function public.workspace_ids_for_current_user()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select workspace_id
  from public.workspace_members
  where user_id = (select auth.uid())
$$;

revoke execute on function public.workspace_ids_for_current_user() from public;
grant execute on function public.workspace_ids_for_current_user() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — workspaces
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;

create policy "Members can read their workspaces"
  on public.workspaces
  for select
  to authenticated
  using (id in (select public.workspace_ids_for_current_user()));

-- Insert is allowed for any authenticated user (anyone may create a
-- workspace), but with check pins owner_id to the caller — the same shape as
-- Phase 1's "insert own profile" policy. A Server Action must still never
-- trust a client-supplied owner_id; this is the database-level backstop.
create policy "Authenticated users can create a workspace they own"
  on public.workspaces
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- Owner-only, and deliberately does not consult workspace_members at all: it
-- checks a column on the row being written, so it carries no recursion risk.
create policy "Owner can update their workspace"
  on public.workspaces
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owner can delete their workspace"
  on public.workspaces
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS — workspace_members
-- ---------------------------------------------------------------------------

alter table public.workspace_members enable row level security;

create policy "Members can read membership rows for their workspaces"
  on public.workspace_members
  for select
  to authenticated
  using (workspace_id in (select public.workspace_ids_for_current_user()));

-- No insert/update/delete policy for workspace_members. Per §13, client-side
-- membership insertion is explicitly out of scope for Phase 2 — the only
-- write path is the security definer trigger above, which bypasses RLS as the
-- function owner. With RLS enabled and no policy for these commands, the
-- default is deny: an authenticated user cannot insert, update, or delete a
-- membership row directly through the API. Deletion still happens via the
-- workspace_id cascade when a workspace is deleted (a referential action, not
-- a client DML statement, so it is unaffected by the missing DELETE policy).
