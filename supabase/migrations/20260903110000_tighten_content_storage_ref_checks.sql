-- Phase 6 — follow-up: close the gaps QA found in the source/media checks.
--
-- 20260903100000_add_content_source_media.sql is already applied to the
-- linked project, so it is not edited; every fix lands here as an additive
-- constraint or a comment refresh. No column is added, renamed or dropped, no
-- row changes shape, and nothing here touches RLS.
--
-- Why now rather than in the storage phase: no code path can write
-- storage_provider/storage_key yet (the repository deliberately omits them
-- from every patch type), so the table is guaranteed clean today and each
-- ADD CONSTRAINT validates trivially. Once a writer exists, a constraint of
-- this kind would need a backfill audit first. Cheapest possible moment.

alter table public.content
  -- (a) The storage pair may be both-null or both-set, but "set" must mean a
  -- real value. Without this, ('', '') satisfies content_storage_ref_paired
  -- and media_status='available' with storage_key='' satisfies
  -- content_available_requires_storage, so 'available' was reachable with
  -- no object behind it. Same rule external_id already has.
  add constraint content_storage_provider_not_blank
    check (storage_provider is null or btrim(storage_provider) <> ''),
  add constraint content_storage_key_not_blank
    check (storage_key is null or btrim(storage_key) <> ''),

  -- (b) external_only means "we hold no bytes", so it cannot coexist with a
  -- storage reference. Together with content_available_requires_storage the
  -- mapping is now total and explicit:
  --   pair null  ->  media_status in ('external_only', 'missing')
  --   pair set   ->  media_status in ('available', 'missing')
  -- 'missing' is allowed on either side on purpose: a gone object may keep
  -- its last-known reference for diagnosis, or have been cleared.
  -- A future state such as "key reserved, upload in flight" is a new status
  -- value, not an exception to this rule, and would arrive with its own
  -- migration.
  add constraint content_external_only_holds_no_storage
    check (media_status <> 'external_only' or storage_key is null),

  -- (c) Length ceilings mirroring the Zod schema so the database refuses what
  -- the Server Action refuses. The numbers MUST track
  -- CONTENT_SOURCE_URL_MAX_LENGTH and CONTENT_EXTERNAL_ID_MAX_LENGTH in
  -- packages/shared/src/content/content.ts; changing either side alone is a
  -- bug. char_length, not octet_length: Zod's .max counts UTF-16 code units,
  -- and characters are the closer of the two SQL measures.
  add constraint content_source_url_max_length
    check (source_url is null or char_length(source_url) <= 2048),
  add constraint content_external_id_max_length
    check (external_id is null or char_length(external_id) <= 200);

-- Comments restated so the catalogue describes the constraints that now hold.
comment on column public.content.storage_provider is
  'Object storage provider for a stored copy. Null until a storage phase writes it; never blank; set iff storage_key is set.';
comment on column public.content.storage_key is
  'Object key within storage_provider. Null until a storage phase writes it; never blank; set iff storage_provider is set.';
comment on column public.content.media_status is
  'Media lifecycle, independent of status. external_only = no stored copy (storage pair must be null); available = bytes at (storage_provider, storage_key) (pair must be set); missing = a reference existed and the object is gone (pair may be kept or cleared).';
