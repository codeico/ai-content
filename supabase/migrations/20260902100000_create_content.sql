-- Phase 3 — Content domain foundation.
--
-- Creates public.content: an internal product entity that belongs to exactly
-- one workspace. Metadata only — no source, media, AI, or publishing columns
-- (docs/PHASE_3_PROMPT.md §7, §25). docs/DATABASE_SCHEMA.md §11 lists many
-- such columns (platform, source_url, media_status, transcript, ...) and §12
-- lists pipeline states (DISCOVERED, ANALYZING, PUBLISHED, ...); both belong
-- to later phases and are deliberately not modelled here.

create table public.content (
  id uuid primary key default gen_random_uuid(),
  -- cascade: deleting a workspace removes its content (docs/PHASE_3_PROMPT.md
  -- §11). The reverse direction is impossible by construction — a content
  -- row has no way to delete its workspace.
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  -- Smallest useful lifecycle (docs/PHASE_3_PROMPT.md §8). Do not add
  -- automation states (processing, scheduled, published, ...) here.
  status text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Defense in depth against a whitespace-only title reaching the database
  -- through something other than the Zod-validated Server Action.
  constraint content_title_not_blank check (btrim(title) <> '')
);

comment on table public.content is
  'A workspace-scoped content item. Metadata only in Phase 3; sources, media, analysis, captions, and publishing attach in later phases.';

create trigger content_set_updated_at
  before update on public.content
  for each row
  execute function public.set_updated_at();

-- Serves the one query this phase runs: list a workspace's content ordered
-- created_at desc, id desc (id as the stable tiebreaker). Also covers the
-- foreign key lookup on workspace deletion.
create index content_workspace_id_created_at_idx
  on public.content (workspace_id, created_at desc, id desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Access is by workspace membership, not ownership (docs/PHASE_3_PROMPT.md
-- §12). Every policy goes through the Phase 2 security definer helper so no
-- policy here reads workspace_members directly (no recursion risk, §14).

alter table public.content enable row level security;

create policy "Members can read content in their workspaces"
  on public.content
  for select
  to authenticated
  using (workspace_id in (select public.workspace_ids_for_current_user()));

create policy "Members can create content in their workspaces"
  on public.content
  for insert
  to authenticated
  with check (workspace_id in (select public.workspace_ids_for_current_user()));

-- with check repeats the membership test so an update cannot move a row into
-- a workspace the caller is not a member of (docs/PHASE_3_PROMPT.md §19).
create policy "Members can update content in their workspaces"
  on public.content
  for update
  to authenticated
  using (workspace_id in (select public.workspace_ids_for_current_user()))
  with check (workspace_id in (select public.workspace_ids_for_current_user()));

create policy "Members can delete content in their workspaces"
  on public.content
  for delete
  to authenticated
  using (workspace_id in (select public.workspace_ids_for_current_user()));
