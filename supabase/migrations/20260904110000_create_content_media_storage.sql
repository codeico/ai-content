-- Phase 8 — object-storage foundation.
--
-- This migration makes one honest media transition possible:
--
--   external_only/missing (no key) -> temporary (reserved key)
--   temporary + object exists      -> available
--
-- There is deliberately no upload UI in this migration and no delete/replace
-- policy yet. Those cross Storage + Postgres and need an explicit orphan
-- strategy. This is the smallest durable boundary they can build on.
--
-- Provider decision: Supabase Storage, private bucket. The app already uses
-- Supabase and its caller JWT/RLS model; adding R2 now would add a second
-- credential and policy system before it provides product value. Private does
-- not block future Instagram publishing: a server-created signed download URL
-- is publicly fetchable without auth for its TTL. The database stores provider
-- + key as identity, never the signed URL.

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------

-- Upsert the configuration because a bucket may have been created manually in
-- the Dashboard before this migration reaches a project. The migration makes
-- that bucket private and applies the limits rather than trusting dashboard
-- drift. 50 MiB is the Free-plan ceiling and is enough to prove the direct
-- upload path; raising it later is a bucket configuration change, not a schema
-- rewrite.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'content-media',
  'content-media',
  false,
  52428800,
  array['video/mp4', 'video/quicktime']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Media state
-- ---------------------------------------------------------------------------

-- The old inline CHECK is named by PostgreSQL from table + column. Widen it by
-- exactly one state — and one state that code below can genuinely produce.
-- PROCESSING and DELETED still have no producer, so they remain deferred.
alter table public.content
  drop constraint content_media_status_check,
  add constraint content_media_status_check
    check (media_status in ('external_only', 'temporary', 'available', 'missing'));

-- Storage state is a system assertion. RLS chooses rows, not columns: the old
-- table-level grant let a custom authenticated client write storage_key and
-- claim `available` without any object. Replace broad INSERT/UPDATE with the
-- exact columns the current user-facing repositories write.
revoke insert, update on public.content from anon, authenticated, service_role;

grant insert (
  workspace_id,
  title,
  status,
  description,
  source_type,
  source_url,
  external_id
) on public.content to authenticated;

grant update (
  title,
  status,
  description,
  source_type,
  source_url,
  external_id
) on public.content to authenticated;

-- media_status, storage_provider and storage_key are excluded from both grants
-- on purpose. No client role can write them; only the SECURITY DEFINER verbs
-- below (reserve / confirm / release) can, and each of them proves something
-- about the Storage catalogue before it does.

-- ---------------------------------------------------------------------------
-- Reserve an object key
-- ---------------------------------------------------------------------------

-- The caller supplies only an allow-listed extension. The database creates the
-- opaque object id, so a browser cannot choose another content's key, overwrite
-- an old object, or create arbitrary paths. A temporary reservation is
-- idempotent: asking again returns the same key, allowing a failed signed-URL
-- request or interrupted upload to retry without leaking another reservation.
create or replace function public.reserve_content_media(
  target_workspace_id uuid,
  target_content_id uuid,
  file_extension text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_storage_key text;
begin
  if target_workspace_id is null or target_content_id is null then
    raise exception 'workspace and content are required'
      using errcode = '22023';
  end if;

  file_extension := lower(ltrim(btrim(file_extension), '.'));

  if file_extension not in ('mp4', 'mov') then
    raise exception 'unsupported media extension'
      using errcode = '22023';
  end if;

  if target_workspace_id not in (
    select public.workspace_ids_for_current_user()
  ) then
    raise exception 'not a member of workspace %', target_workspace_id
      using errcode = '42501';
  end if;

  -- Retry an interrupted reservation instead of allocating an orphan key.
  select c.storage_key
  into generated_storage_key
  from public.content c
  where c.id = target_content_id
    and c.workspace_id = target_workspace_id
    and c.storage_provider = 'supabase'
    and c.media_status = 'temporary'
    and c.storage_key is not null;

  if generated_storage_key is not null then
    -- Retrying the same file type is safe; switching type would hand a MOV to
    -- an MP4 reservation (or vice versa), lying to Storage's MIME boundary.
    if generated_storage_key not like ('%.' || file_extension) then
      raise exception 'content has a different media type reserved'
        using errcode = 'P0001';
    end if;

    return generated_storage_key;
  end if;

  generated_storage_key :=
    target_workspace_id::text || '/' ||
    target_content_id::text || '/' ||
    gen_random_uuid()::text || '.' || file_extension;

  update public.content
  set
    storage_provider = 'supabase',
    storage_key = generated_storage_key,
    media_status = 'temporary'
  where id = target_content_id
    and workspace_id = target_workspace_id
    and storage_key is null;

  if not found then
    -- Missing content, a mismatched workspace, and an item that already owns
    -- media intentionally have one shape. Replacing media needs cleanup and is
    -- not smuggled into this first-upload verb.
    raise exception 'content cannot reserve media'
      using errcode = 'P0001';
  end if;

  return generated_storage_key;
end;
$$;

comment on function public.reserve_content_media(uuid, uuid, text) is
  'Reserves one opaque content-media object key for a workspace member. Idempotent while temporary; never replaces existing media.';

-- ---------------------------------------------------------------------------
-- Object access
-- ---------------------------------------------------------------------------

-- The real Supabase catalogue already enables this, but make the migration's
-- policies non-inert by construction and keep the local proof honest.
alter table storage.objects enable row level security;

-- INSERT is the only write clients get. It is not just a workspace-prefix
-- check: the exact object name must already be reserved on a content row in
-- that workspace. No row reservation = no object upload. No UPDATE means no
-- upsert/overwrite; a new object always gets a new immutable key.
create policy "Members can upload content media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'content-media'
    and exists (
      select 1
      from public.content c
      where c.storage_key = name
        and c.storage_provider = 'supabase'
        and c.media_status = 'temporary'
        and c.workspace_id in (select public.workspace_ids_for_current_user())
    )
  );

-- SELECT lets a member inspect the uploaded object and lets their server-side
-- request create signed read URLs. The bucket remains private; this policy is
-- not a public download policy and listing still only reveals rows that match a
-- content record in one of the caller's workspaces.
create policy "Members can read content media"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'content-media'
    and exists (
      select 1
      from public.content c
      where split_part(name, '/', 1) = c.workspace_id::text
        and split_part(name, '/', 2) = c.id::text
        and c.storage_key = name
        and c.storage_provider = 'supabase'
        and c.workspace_id in (select public.workspace_ids_for_current_user())
    )
  );

-- DELETE is allowed for the same exact object, not for arbitrary objects under
-- a workspace prefix. The Storage API must be used — deleting storage.objects
-- directly would orphan the bytes. After remove() succeeds, release_content_media
-- clears the database reference.
create policy "Members can delete content media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'content-media'
    and exists (
      select 1
      from public.content c
      where c.storage_key = name
        and c.storage_provider = 'supabase'
        and c.workspace_id in (select public.workspace_ids_for_current_user())
    )
  );

-- ---------------------------------------------------------------------------
-- Confirm bytes exist before claiming AVAILABLE
-- ---------------------------------------------------------------------------

create or replace function public.confirm_content_media(
  target_workspace_id uuid,
  target_content_id uuid,
  target_storage_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated boolean;
begin
  if target_workspace_id is null or target_content_id is null or target_storage_key is null then
    return false;
  end if;

  if target_workspace_id not in (
    select public.workspace_ids_for_current_user()
  ) then
    raise exception 'not a member of workspace %', target_workspace_id
      using errcode = '42501';
  end if;

  -- Reject a caller-chosen path before touching either table. The exact key is
  -- checked against the content row too; the prefix check is defence in depth
  -- and makes the tenant boundary visible in this security-definer body.
  if split_part(target_storage_key, '/', 1) <> target_workspace_id::text
    or split_part(target_storage_key, '/', 2) <> target_content_id::text then
    return false;
  end if;

  -- A lost HTTP response must be safe to retry after the first call already
  -- committed. Return true when the exact object is already confirmed.
  if exists (
    select 1
    from public.content c
    where c.id = target_content_id
      and c.workspace_id = target_workspace_id
      and c.storage_provider = 'supabase'
      and c.storage_key = target_storage_key
      and c.media_status = 'available'
      and exists (
        select 1
        from storage.objects o
        where o.bucket_id = 'content-media'
          and o.name = target_storage_key
      )
  ) then
    return true;
  end if;

  update public.content c
  set media_status = 'available'
  where c.id = target_content_id
    and c.workspace_id = target_workspace_id
    and c.storage_provider = 'supabase'
    and c.storage_key = target_storage_key
    and c.media_status = 'temporary'
    and exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'content-media'
        and o.name = target_storage_key
    );

  get diagnostics updated = row_count;
  return updated;
end;
$$;

comment on function public.confirm_content_media(uuid, uuid, text) is
  'Marks reserved content media available only after the exact object exists in the private content-media bucket.';

-- Called only after Storage API remove() succeeds (including an idempotent
-- "already absent" response). It refuses to clear a reference while the
-- catalogue still contains the object, so the application cannot orphan bytes
-- by reversing the order.
create or replace function public.release_content_media(
  target_workspace_id uuid,
  target_content_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated boolean;
begin
  if target_workspace_id is null or target_content_id is null then
    return false;
  end if;

  if target_workspace_id not in (
    select public.workspace_ids_for_current_user()
  ) then
    raise exception 'not a member of workspace %', target_workspace_id
      using errcode = '42501';
  end if;

  update public.content c
  set
    storage_provider = null,
    storage_key = null,
    media_status = 'external_only'
  where c.id = target_content_id
    and c.workspace_id = target_workspace_id
    and c.storage_provider = 'supabase'
    and c.storage_key is not null
    and not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'content-media'
        and o.name = c.storage_key
    );

  get diagnostics updated = row_count;

  if updated then
    return true;
  end if;

  -- Idempotent retry after the first release committed but its response was
  -- lost. A genuinely missing/not-visible content row remains false.
  return exists (
    select 1
    from public.content c
    where c.id = target_content_id
      and c.workspace_id = target_workspace_id
      and c.storage_key is null
      and c.media_status = 'external_only'
  );
end;
$$;

comment on function public.release_content_media(uuid, uuid) is
  'Clears a content media reference only after its private Storage object is absent; idempotent after release.';

-- Prevent the existing content/workspace cascade paths from deleting the
-- Postgres reference first and leaving untracked bytes in Storage. The
-- application must remove via Storage API, release the reference, then delete
-- the content/workspace. No exception is made for service_role: background
-- code must respect the same ordering.
create or replace function public.content_reject_stored_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.storage_key is not null then
    raise exception 'content: stored media must be removed before content deletion'
      using errcode = '23503';
  end if;

  return old;
end;
$$;

comment on function public.content_reject_stored_delete() is
  'Prevents content/workspace deletion from orphaning Storage bytes; remove then release first.';

create trigger content_storage_before_delete
  before delete on public.content
  for each row
  execute function public.content_reject_stored_delete();

-- Supabase grants EXECUTE on new functions to API roles by default. PUBLIC is
-- not enough: explicit role grants may still remain. Remove every route except
-- the signed-in caller; all three functions enforce workspace membership inside.
revoke execute on function public.reserve_content_media(uuid, uuid, text) from public, anon, service_role;
revoke execute on function public.confirm_content_media(uuid, uuid, text) from public, anon, service_role;
revoke execute on function public.release_content_media(uuid, uuid) from public, anon, service_role;
grant execute on function public.reserve_content_media(uuid, uuid, text) to authenticated;
grant execute on function public.confirm_content_media(uuid, uuid, text) to authenticated;
grant execute on function public.release_content_media(uuid, uuid) to authenticated;

comment on column public.content.media_status is
  'Media lifecycle: external_only, temporary (reserved key, upload not yet confirmed), available (object exists), missing. Independent of content status.';
comment on column public.content.storage_provider is
  'Object storage provider for a stored copy. Phase 8 produces supabase; never blank; set iff storage_key is set.';
comment on column public.content.storage_key is
  'Opaque provider-relative object key, generated by reserve_content_media; never a public or signed URL.';
