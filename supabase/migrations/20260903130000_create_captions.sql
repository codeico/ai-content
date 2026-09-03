-- Phase 7B — Captions.
--
-- Versioned AI caption drafts for one content item (docs/DATABASE_SCHEMA.md
-- §17). Regenerating never overwrites: each generate inserts the next version;
-- selecting one marks it active and archives the previous active.
--
-- Access follows CONTENT, not the workspace profile: any member may generate
-- and select captions, exactly as any member may edit content
-- (20260902100000). The profile is owner-only because it is the account's
-- identity; a caption is a piece of work on a content row. Do not "fix" this
-- to owner-only later.
--
-- Decisions taken here and why:
--
--   workspace_id is a denormalised copy of content.workspace_id so the RLS
--   predicate is a direct column check identical to content's. Consistency is
--   enforced declaratively by a composite FK (content_id, workspace_id) →
--   content (id, workspace_id): a caption cannot claim a workspace its content
--   is not in, and a direct insert cannot bypass it the way it could a trigger.
--   That needs a UNIQUE(id, workspace_id) on content — redundant with the PK,
--   harmless, and cheap.
--
--   version is assigned by the application (MAX+1 inside the repository), not
--   a trigger, matching this codebase's rule that logic is explicit in
--   repositories and the database is the backstop. UNIQUE(content_id, version)
--   turns a concurrent double-generate into a 23505 the action can handle.
--
--   "exactly one active per content" is a partial unique index. Selecting a
--   caption is therefore two statements (archive the old active, activate the
--   new) and the repository must order them so the index never sees two.
--
--   model_provider from §17 is omitted on purpose. The AI layer is vendor-
--   neutral and only knows a base URL; a provider "name" would either leak the
--   endpoint host into data rows or be a vacuous constant. model_name (echoed
--   by the API response) plus prompt_version carry the reproducibility that
--   CODING_RULES §25 asks for. hashtags / call_to_action / generated_by are
--   also deferred: nothing consumes structured output yet.

alter table public.content
  add constraint content_id_workspace_id_unique unique (id, workspace_id);

create table public.captions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version integer not null,
  body text not null,
  status text not null default 'draft',
  model_name text not null,
  prompt_version text not null,
  -- Nullable: a caption outlives the account that generated it (the row is
  -- the workspace's, not the user's), so deleting the user clears the pointer.
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint captions_content_workspace_consistent
    foreign key (content_id, workspace_id)
    references public.content (id, workspace_id)
    on delete cascade,

  constraint captions_content_version_unique unique (content_id, version),
  constraint captions_version_positive check (version >= 1),
  constraint captions_status_check check (status in ('draft', 'active', 'archived')),
  -- A caption with nothing in it is a failed generation, not a version.
  constraint captions_body_not_blank check (btrim(body) <> ''),
  -- Bounded so a runaway model response cannot bloat the row; Instagram's own
  -- limit is 2200 characters, so 4000 leaves room for the model to overshoot
  -- and the UI to show it rather than silently truncating.
  constraint captions_body_max_length check (char_length(body) <= 4000),
  constraint captions_model_name_not_blank check (btrim(model_name) <> ''),
  constraint captions_prompt_version_not_blank check (btrim(prompt_version) <> '')
);

comment on table public.captions is
  'Versioned AI caption drafts per content row. Regenerate inserts the next version; select flips active. Member-writable like content.';
comment on column public.captions.model_name is
  'Model id as reported by the router for this generation. Provider-neutral: no vendor is recorded.';
comment on column public.captions.prompt_version is
  'Identifier of the prompt template that produced this body (apps/web/src/server/ai/caption-prompt.ts).';

-- At most one active caption per content row.
create unique index captions_one_active_per_content
  on public.captions (content_id)
  where status = 'active';

-- The list every content page renders: newest version first.
create index captions_content_version_idx
  on public.captions (content_id, version desc);

create trigger captions_set_updated_at
  before update on public.captions
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — identical shape to public.content (20260902100000).
-- ---------------------------------------------------------------------------

alter table public.captions enable row level security;

create policy "Members can read captions in their workspaces"
  on public.captions
  for select
  to authenticated
  using (workspace_id in (select public.workspace_ids_for_current_user()));

-- with check pins the new row to a workspace the caller belongs to; the
-- composite FK then pins it to a content row in that same workspace.
create policy "Members can create captions in their workspaces"
  on public.captions
  for insert
  to authenticated
  with check (workspace_id in (select public.workspace_ids_for_current_user()));

create policy "Members can update captions in their workspaces"
  on public.captions
  for update
  to authenticated
  using (workspace_id in (select public.workspace_ids_for_current_user()))
  with check (workspace_id in (select public.workspace_ids_for_current_user()));

-- No client DELETE policy: §17 says regenerate must never remove earlier
-- versions, and "remove" is expressed as status = 'archived'. Rows leave only
-- with their content via the cascade.
