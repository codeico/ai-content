-- Make caption provenance and history immutable after insert.
--
-- Phase 7B shipped with UPDATE open to any workspace member, because the only
-- intended update is the status flip in selectCaptionAsActive. Probed against
-- the linked database: a member using the anon key directly (bypassing the app)
-- could rewrite model_name, prompt_version, created_by, the caption body, and
-- even version -- letting them forge which model wrote a caption, edit an
-- "active" caption after it was chosen, or renumber history into a collision.
--
-- RLS decides WHICH rows a member may touch; it cannot express WHICH COLUMNS.
-- A trigger can, and it applies to every client including direct PostgREST.
--
-- status is the one column an update may change (draft <-> active <-> archived),
-- plus updated_at which the existing set_updated_at trigger maintains.
--
-- Editing caption text is a real product need (MASTER_PRODUCT_SPEC section 8
-- lists it for Owner) but it is a separate feature: it must create a new
-- version rather than silently rewrite a chosen one. Until that exists,
-- rewriting is refused rather than half-allowed.

create or replace function public.captions_reject_immutable_changes()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.content_id is distinct from old.content_id
    or new.workspace_id is distinct from old.workspace_id
    or new.version is distinct from old.version
    or new.body is distinct from old.body
    or new.model_name is distinct from old.model_name
    or new.prompt_version is distinct from old.prompt_version
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception
      'captions: only status may change after insert'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.captions_reject_immutable_changes() is
  'Caption provenance and history are write-once; only status may change.';

drop trigger if exists captions_immutable_columns on public.captions;

create trigger captions_immutable_columns
  before update on public.captions
  for each row
  execute function public.captions_reject_immutable_changes();
