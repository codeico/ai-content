-- Phase 6 — Content source & media foundation.
--
-- Extends public.content so a content item can say where it came from and
-- whether a stored copy of its media exists. Columns, not a new table: the
-- long-term schema (docs/DATABASE_SCHEMA.md §11) keeps provenance and media
-- state on the content row itself, and columns inherit the four Phase 3 RLS
-- policies unchanged, so no new policy or workspace-consistency trigger is
-- needed. Everything here is additive and nullable-or-defaulted, so existing
-- rows need no backfill.
--
-- Deliberately NOT added (nothing can populate them until media is actually
-- fetched or uploaded, which is a later phase): mime type, size, filename,
-- duration, dimensions, checksum, thumbnail, creator fields, transcript,
-- rights. Each is a future `add column`, never a rewrite.

alter table public.content
  -- Neutral provenance. 'other' is the default so the column can be NOT NULL
  -- without inventing a source for existing rows. No platform integration is
  -- implied by any value; this is a label the owner sets.
  add column source_type text not null default 'other'
    check (source_type in ('tiktok', 'instagram', 'youtube', 'upload', 'url', 'other')),

  -- Original link, when there is one. Scheme is enforced here as defence in
  -- depth behind the Zod http(s) check, so a javascript: or data: URL can
  -- never be stored even by a path that bypasses the Server Action.
  add column source_url text
    check (source_url is null or source_url ~ '^https?://'),

  -- Platform-side identifier when known. Pure string, nothing parses it yet.
  add column external_id text
    check (external_id is null or btrim(external_id) <> ''),

  -- Object identity is the (provider, key) pair, never a public URL
  -- (docs/TECHNICAL_ARCHITECTURE.md §34). No provider is wired in this phase,
  -- so both stay null; the pair must be set together or not at all.
  add column storage_provider text,
  add column storage_key text,
  add constraint content_storage_ref_paired
    check ((storage_provider is null) = (storage_key is null)),

  -- Media lifecycle, separate from the content workflow `status`
  -- (docs/DATABASE_SCHEMA.md §14). Only three states are honest today:
  --   external_only  we know a source, we hold no bytes (the default)
  --   available      bytes exist at (storage_provider, storage_key)
  --   missing        a reference existed but the object is gone
  -- 'available' is unreachable until a storage phase sets storage_key, and
  -- the constraint below makes that explicit rather than trusting callers.
  add column media_status text not null default 'external_only'
    check (media_status in ('external_only', 'available', 'missing')),
  add constraint content_available_requires_storage
    check (media_status <> 'available' or storage_key is not null);

comment on column public.content.source_type is
  'Where this content came from. A neutral label; no integration is implied.';
comment on column public.content.source_url is
  'Original link when known. http(s) only.';
comment on column public.content.external_id is
  'Identifier on the source platform when known. Opaque string.';
comment on column public.content.storage_provider is
  'Object storage provider for a stored copy; null until a storage phase writes it.';
comment on column public.content.storage_key is
  'Object key within storage_provider; null until a storage phase writes it.';
comment on column public.content.media_status is
  'Media lifecycle: external_only, available, missing. Independent of status.';

-- No new index: the list query is unchanged and still served by
-- content_workspace_id_created_at_idx. Filtering by source_type is not a
-- feature of this phase; an index for it would be speculative.
