-- content.description — what the video is actually about.
--
-- The caption prompt could only see title, source_type and source_url, while
-- its system prompt forbids inventing facts about the video
-- (apps/web/src/server/ai/caption-prompt.ts). Every caption was therefore
-- structurally generic: the model knew nothing about the content, only the
-- user did. Nothing outside the application can supply this — a URL fetch
-- would be scraping we cannot verify — so it is typed by the person who has
-- the video.
--
-- Nullable with no default: content exists before it is described, exactly
-- like workspace_profiles fields, so no backfill is ever needed and an
-- undescribed item stays honest rather than carrying invented text.
--
-- 2000 is a bound, not a product rule: long enough for a real summary,
-- short enough that the prompt stays small and one row cannot dominate a
-- request. Mirrors CONTENT_DESCRIPTION_MAX_LENGTH in
-- packages/shared/src/content/content.ts, pinned by a test.
--
-- Deliberately NOT added here: transcript (needs media processing), creator
-- handle, thumbnail, rights. Those arrive with the phases that can fill them.

alter table public.content
  add column if not exists description text;

alter table public.content
  drop constraint if exists content_description_length_check;

alter table public.content
  add constraint content_description_length_check
  check (description is null or char_length(description) between 1 and 2000);

comment on column public.content.description is
  'Author-written summary of the content, used as caption prompt input. Null until described.';
