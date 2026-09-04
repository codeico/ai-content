-- Minimal Supabase shim for running this repository's migrations against a
-- plain local PostgreSQL. This is NOT Supabase and does not pretend to be:
-- it provides exactly what the migrations reference and nothing more.
--
-- What the migrations use (measured by grep, not assumed):
--   role   authenticated        (grant/revoke targets, policy roles)
--   table  auth.users           (FK target for created_by / owner_id)
--   func   auth.uid()           (RLS predicate)
--
-- auth.uid() here reads a session setting, so a test can impersonate a user by
-- running `set local request.jwt.claim.sub = '<uuid>'` inside a transaction —
-- the same mechanism Supabase's PostgREST uses.

-- Roles are cluster-wide, so a database reset does not remove them.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
  -- PostgREST connects as authenticator and switches into the role named by
  -- the verified JWT. It must be a MEMBER of each role it may switch into;
  -- Supabase grants anon/authenticated/service_role. NOINHERIT is what makes
  -- the switch explicit: authenticator has no privileges of its own until it
  -- SET ROLEs, exactly as on Supabase.
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'authenticator';
    grant anon to authenticator;
    grant authenticated to authenticator;
    grant service_role to authenticator;
  end if;
end
$$;

create schema if not exists auth;
create schema if not exists storage;

-- Minimal Storage catalogue. The real Supabase Storage service owns and writes
-- these tables; the local shim needs only the columns our migrations, RLS
-- policies, and confirmation proof touch. It is deliberately not a fake
-- Storage HTTP service.
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id) on delete cascade,
  name text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon, service_role;
grant select, insert, update, delete on storage.objects to authenticated, anon, service_role;
grant select on storage.buckets to authenticated, anon, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  -- handle_new_user() reads this; Supabase stores signup metadata here.
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Supabase exposes these to the API roles; policies referencing
-- workspace_ids_for_current_user() need authenticated to reach public schema.
grant usage on schema public to authenticated, anon, service_role;
grant usage on schema auth to authenticated, anon, service_role;

-- Supabase's default: API roles can read/write public tables, RLS then
-- filters rows. Without this, "no policy = zero rows" cannot be distinguished
-- from "no grant = permission denied", and that distinction matters for the
-- jobs table review.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, anon, service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, anon, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, anon, service_role;
