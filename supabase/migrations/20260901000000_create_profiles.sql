-- Phase 1 — Authentication foundation.
--
-- Creates the application-level identity record that extends auth.users, the
-- trigger that keeps it in sync with signups, and ownership-based RLS.
--
-- Columns follow docs/DATABASE_SCHEMA.md §5. No other tables are created here;
-- workspaces and the content domain belong to later phases.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  -- Shares the primary key with auth.users rather than carrying a separate FK
  -- column, so a profile cannot exist for a non-existent user and a user cannot
  -- hold two profiles. On delete cascade keeps the two tables consistent.
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application-level user identity. Extends auth.users; never stores credentials.';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

-- Reusable across future tables that carry updated_at, so the trigger body is
-- written once. Marked search_path-safe: an empty search_path prevents a
-- malicious schema earlier in the path from shadowing anything referenced here.
create function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile creation
-- ---------------------------------------------------------------------------

-- Profiles are created by the database, not the client. The application never
-- has to insert one, so a profile cannot be missed because a request failed,
-- the user closed the tab, or the user never visited a particular page.
--
-- security definer is required: the inserting role during signup is not the new
-- user, so the insert has to run as the function owner. search_path is pinned
-- for the same reason as above.
--
-- on conflict do nothing makes the trigger idempotent: a retried or duplicated
-- auth.users insert cannot produce a second profile or raise.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Supabase stores signup metadata in raw_user_meta_data. Absent for a plain
    -- email/password signup, which is fine: display_name is nullable.
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Ownership is the only rule: auth.uid() = id. There is deliberately no policy
-- granting broad authenticated read, so one user cannot enumerate others.
--
-- Policies are per-command rather than `for all` so the insert path stays
-- explicit and a future policy change to one command cannot silently widen
-- the others.

create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- The trigger above is the normal creation path and bypasses RLS as a security
-- definer function. This policy exists only so a user can recreate their own
-- row, and with check pins the id to the caller: it cannot be used to forge a
-- profile belonging to somebody else.
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- No delete policy: profile removal follows the auth.users cascade rather than
-- being a user-initiated operation.
