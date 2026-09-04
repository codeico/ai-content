-- Fence media release to the exact reservation generation being removed.
--
-- The original two-argument function could clear a newer reservation B if a
-- stale remove request for A resumed after B had been reserved but before B's
-- object reached Storage. Requiring the expected key makes that stale request
-- a no-op.

revoke execute on function public.release_content_media(uuid, uuid)
  from public, anon, authenticated, service_role;
drop function public.release_content_media(uuid, uuid);

create function public.release_content_media(
  target_workspace_id uuid,
  target_content_id uuid,
  expected_storage_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated boolean;
begin
  if target_workspace_id is null
    or target_content_id is null
    or expected_storage_key is null
    or btrim(expected_storage_key) = '' then
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
    and c.storage_key = expected_storage_key
    and not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'content-media'
        and o.name = expected_storage_key
    );

  get diagnostics updated = row_count;

  if updated then
    return true;
  end if;

  -- Idempotent retry after this exact release committed. A different current
  -- key is a newer generation and must never be cleared by the stale caller.
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

comment on function public.release_content_media(uuid, uuid, text) is
  'Clears only the expected content-media generation after its Storage object is absent; stale releases cannot clear newer reservations.';

revoke execute on function public.release_content_media(uuid, uuid, text)
  from public, anon, service_role;
grant execute on function public.release_content_media(uuid, uuid, text)
  to authenticated;
