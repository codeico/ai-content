-- Pin workspace_profiles to its workspace.
--
-- Last of the five UPDATE-policy tables to get a column guard. The policy's
-- WITH CHECK validates the NEW workspace_id belongs to the caller, so an owner
-- of two workspaces could move a profile row between them — swapping the brief
-- that conditions caption generation for both. Lower impact than the content
-- move fixed in 20260903170000 (nothing cascades, and it is owner-only), but
-- the same defect, and the Phase 7A security audit raised exactly this
-- question. There is no product operation that moves a profile.
--
-- The UNIQUE(workspace_id) constraint means the move would also have to find
-- an unprofiled workspace, which narrows it without closing it.

create or replace function public.workspace_profiles_reject_move()
returns trigger
language plpgsql
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_profiles: workspace_id cannot change after insert'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id then
    raise exception 'workspace_profiles: id cannot change after insert'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.workspace_profiles_reject_move() is
  'A profile belongs to the workspace it was created for; moving it is not a supported operation.';

drop trigger if exists workspace_profiles_immutable_identity on public.workspace_profiles;

create trigger workspace_profiles_immutable_identity
  before update on public.workspace_profiles
  for each row
  execute function public.workspace_profiles_reject_move();
