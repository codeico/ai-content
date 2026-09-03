-- Pin content and workspace ownership to their original row.
--
-- Both tables have UPDATE policies whose WITH CHECK validates the NEW value,
-- which is the right question for access but the wrong one for identity:
--
--   content.workspace_id  — the check passes if the new workspace is one the
--     caller belongs to, so a member of both A and B can MOVE a content row
--     from A to B. Its captions follow via the composite FK
--     (content_id, workspace_id), so a whole thread of work changes hands.
--     The application never does this: updateContentInWorkspace's patch type
--     is { title, status, description } and cannot express it. The ability
--     exists only for a client talking to PostgREST directly.
--
--   workspaces.owner_id — the check requires the new owner to be the caller,
--     so this is self-limiting today (an owner can only "give" it to
--     themselves). Frozen anyway: ownership transfer is a real feature that
--     needs its own deliberate path, not an UPDATE that happens to be allowed.
--
-- Same shape as 20260903150000 for captions: RLS decides which ROWS may be
-- touched, a trigger decides which COLUMNS, and the trigger binds every
-- client including direct PostgREST.

create or replace function public.content_reject_workspace_move()
returns trigger
language plpgsql
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'content: workspace_id cannot change after insert'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id then
    raise exception 'content: id cannot change after insert'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.content_reject_workspace_move() is
  'Content belongs to the workspace it was created in; moving it is not a supported operation.';

drop trigger if exists content_immutable_identity on public.content;

create trigger content_immutable_identity
  before update on public.content
  for each row
  execute function public.content_reject_workspace_move();

create or replace function public.workspaces_reject_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'workspaces: owner_id cannot change; ownership transfer is not implemented'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id then
    raise exception 'workspaces: id cannot change after insert'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.workspaces_reject_owner_change() is
  'Ownership transfer needs a deliberate feature; until then owner_id is write-once.';

drop trigger if exists workspaces_immutable_identity on public.workspaces;

create trigger workspaces_immutable_identity
  before update on public.workspaces
  for each row
  execute function public.workspaces_reject_owner_change();
