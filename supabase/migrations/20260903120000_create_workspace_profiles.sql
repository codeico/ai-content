-- Phase 7A — Workspace AI profile.
--
-- Creates public.workspace_profiles: the workspace's editorial identity (what
-- it is about, who it speaks to, how it should sound, what it must avoid).
-- docs/MASTER_PRODUCT_SPEC.md §9.1 puts these between "choose name" and any
-- AI step, and §17 requires them to be stored configuration, never hardcoded
-- prompt text. docs/DATABASE_SCHEMA.md §4 places niche/description on
-- workspaces and §9 places the rest in content_profiles (UNIQUE workspace_id).
--
-- Implemented as ONE 1:1 child table instead of columns on workspaces:
--   * workspaces stays the small identity row that lists and RLS touch on
--     every request; the profile is read only by the workspace page and,
--     later, by AI prompt building.
--   * A workspace without a profile row is a legitimate state ("not set up
--     yet"), so no backfill is needed and the create-workspace flow is
--     unchanged. Adding `niche NOT NULL` to workspaces would have required
--     both.
--
-- Nothing reads this table for generation yet. No AI, captions, or analysis
-- columns/tables are created here.

create table public.workspace_profiles (
  id uuid primary key default gen_random_uuid(),
  -- One profile per workspace; deleting the workspace removes it.
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  niche text,
  description text,
  target_audience text,
  tone text,
  writing_style text,
  content_goals text,
  restrictions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Present values are trimmed and non-blank; "not set" is null, never ''.
  -- Length caps mirror PROFILE_SHORT_MAX_LENGTH (100) and
  -- PROFILE_LONG_MAX_LENGTH (1000) in packages/shared/src/workspace/profile.ts;
  -- change them together.
  constraint workspace_profiles_niche_shape
    check (niche is null or (btrim(niche) <> '' and char_length(niche) <= 100)),
  constraint workspace_profiles_description_shape
    check (description is null or (btrim(description) <> '' and char_length(description) <= 1000)),
  constraint workspace_profiles_target_audience_shape
    check (target_audience is null or (btrim(target_audience) <> '' and char_length(target_audience) <= 1000)),
  constraint workspace_profiles_tone_shape
    check (tone is null or (btrim(tone) <> '' and char_length(tone) <= 1000)),
  constraint workspace_profiles_writing_style_shape
    check (writing_style is null or (btrim(writing_style) <> '' and char_length(writing_style) <= 1000)),
  constraint workspace_profiles_content_goals_shape
    check (content_goals is null or (btrim(content_goals) <> '' and char_length(content_goals) <= 1000)),
  constraint workspace_profiles_restrictions_shape
    check (restrictions is null or (btrim(restrictions) <> '' and char_length(restrictions) <= 1000))
);

comment on table public.workspace_profiles is
  'Editorial identity of a workspace, one row per workspace. Owner-written, member-readable. Consumed by AI prompt building in a later phase; nothing reads it for generation yet.';
comment on column public.workspace_profiles.niche is
  'Short label for what the workspace is about, e.g. "home cooking for students".';
comment on column public.workspace_profiles.restrictions is
  'Topics, words, or claims the workspace must avoid. Free text.';

create trigger workspace_profiles_set_updated_at
  before update on public.workspace_profiles
  for each row
  execute function public.set_updated_at();

-- The unique constraint on workspace_id already provides the index every
-- query in this phase uses (lookup by workspace) and covers the FK cascade.

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Read follows membership (any member sees the profile: it explains what the
-- workspace is for). Writes follow ownership, the same rule as renaming the
-- workspace itself (Phase 2 "Owner can update their workspace"). Ownership is
-- checked by looking up the parent row's owner_id; that subquery runs under
-- the workspaces SELECT policy, which already grants the owner read access
-- directly on owner_id (20260901140000), so it carries no recursion risk and
-- no dependency on workspace_members.

alter table public.workspace_profiles enable row level security;

-- Read follows membership (any member sees the profile: it explains what the
-- workspace is for). The direct owner clause mirrors 20260901140000: the
-- owner is always a member by trigger, but `upsert().select()` is INSERT …
-- RETURNING and must not depend on that trigger having run.
create policy "Members can read profiles of their workspaces"
  on public.workspace_profiles
  for select
  to authenticated
  using (
    workspace_id in (select public.workspace_ids_for_current_user())
    or workspace_id in (
      select id from public.workspaces where owner_id = (select auth.uid())
    )
  );

-- with check pins the new row to a workspace the caller owns, so a member (or
-- anyone guessing ids) cannot attach a profile to someone else's workspace.
create policy "Owner can create the profile of their workspace"
  on public.workspace_profiles
  for insert
  to authenticated
  with check (
    workspace_id in (
      select id from public.workspaces where owner_id = (select auth.uid())
    )
  );

-- using and with check both test ownership so an update can neither touch a
-- profile the caller does not own nor move one into another workspace.
create policy "Owner can update the profile of their workspace"
  on public.workspace_profiles
  for update
  to authenticated
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = (select auth.uid())
    )
  )
  with check (
    workspace_id in (
      select id from public.workspaces where owner_id = (select auth.uid())
    )
  );

-- No client DELETE policy: the profile disappears with its workspace via the
-- cascade, and "clear the profile" is an update that sets fields to null.
-- With RLS enabled and no policy, delete is denied by default.
