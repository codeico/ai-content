import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MEDIA_STATUSES } from '../packages/shared/src/content/content.ts';

const MIGRATIONS = join(process.cwd(), 'supabase/migrations');
const name = readdirSync(MIGRATIONS).find((file) =>
  file.endsWith('_create_content_media_storage.sql'),
);
const sql = name ? readFileSync(join(MIGRATIONS, name), 'utf8').toLowerCase() : '';
const code = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ');

function policyBody(policyName: string): string {
  const start = code.indexOf(`create policy "${policyName.toLowerCase()}"`);
  if (start < 0) return '';
  const end = code.indexOf(';', start);
  return code.slice(start, end + 1);
}

describe('content media storage migration', () => {
  it('exists as a new migration rather than rewriting an applied one', () => {
    expect(name).toBeDefined();
    expect(existsSync(join(MIGRATIONS, name ?? 'missing'))).toBe(true);
  });

  it('creates one private bucket with a finite size and MIME allow-list', () => {
    expect(code).toMatch(/insert into storage\.buckets/);
    expect(code).toMatch(/'content-media'/);
    expect(code).toMatch(/false/); // private: public URLs never expose the library
    expect(code).toMatch(/52428800/); // 50 MiB — current Supabase free-tier ceiling
    for (const mime of ['video/mp4', 'video/quicktime']) {
      expect(code).toContain(`'${mime}'`);
    }
    expect(code).not.toMatch(/image\/(jpeg|png|webp)/);
  });

  it('allows authenticated INSERT only to the exact key reserved on a real content row', () => {
    const policy = policyBody('Members can upload content media');
    expect(policy).toContain('on storage.objects');
    expect(policy).toMatch(/for insert to authenticated/);
    expect(policy).toMatch(/bucket_id\s*=\s*'content-media'/);
    expect(policy).toContain('c.storage_key = name');
    expect(policy).toContain("c.storage_provider = 'supabase'");
    expect(policy).toContain("c.media_status = 'temporary'");
    expect(policy).toContain('public.workspace_ids_for_current_user()');
    expect(policy).toMatch(/from public\.content c/);
  });

  it('reserves one immutable object key before any upload is authorized', () => {
    expect(code).toMatch(/create or replace function public\.reserve_content_media\(/);
    expect(code).toMatch(/returns text/);
    expect(code).toMatch(/security definer/);
    expect(code).toMatch(/set search_path = ''/);
    expect(code).toContain('public.workspace_ids_for_current_user()');
    expect(code).toMatch(/storage_provider\s*=\s*'supabase'/);
    expect(code).toMatch(/file_extension not in \('mp4', 'mov'\)/);
    expect(code).not.toMatch(/file_extension not in \([^)]*'jpg'/);
    expect(code).toContain('gen_random_uuid()::text');
    expect(code).toMatch(/storage_key\s*=\s*generated_storage_key/);
    expect(code).toMatch(/media_status\s*=\s*'temporary'/);
    expect(code).toMatch(/and storage_key is null/);
  });

  it('widens media_status to exactly the live shared states', () => {
    const list = /check \(media_status in \(([^)]+)\)\)/.exec(code)?.[1];
    expect(list).toBeDefined();
    expect(
      (list ?? '')
        .split(',')
        .map((value) => value.trim().replaceAll("'", ''))
        .sort(),
    ).toEqual([...MEDIA_STATUSES].sort());
    expect(code).not.toMatch(/'processing'|'deleted'/);
  });

  it('grants reserve only to authenticated callers', () => {
    expect(code).toMatch(
      /revoke execute on function public\.reserve_content_media\(uuid, uuid, text\) from public, anon, service_role/,
    );
    expect(code).toMatch(
      /grant execute on function public\.reserve_content_media\(uuid, uuid, text\) to authenticated/,
    );
  });

  it('allows authenticated SELECT under the same workspace/content boundary', () => {
    const policy = policyBody('Members can read content media');
    expect(policy).toContain('on storage.objects');
    expect(policy).toMatch(/for select to authenticated/);
    expect(policy).toMatch(/bucket_id\s*=\s*'content-media'/);
    expect(policy).toContain("split_part(name, '/', 1) = c.workspace_id::text");
    expect(policy).toContain("split_part(name, '/', 2) = c.id::text");
    expect(policy).toContain('public.workspace_ids_for_current_user()');
  });

  it('does not grant direct UPDATE, public-read, or upsert policy', () => {
    expect(code).not.toMatch(/on storage\.objects for update/);
    expect(code).not.toMatch(/to anon/);
    expect(code).not.toMatch(/public\s*=\s*true/);
    expect(code).not.toContain('upsert');
  });

  it('allows DELETE only for the exact media key of content in a caller workspace', () => {
    const policy = policyBody('Members can delete content media');
    expect(policy).toContain('on storage.objects');
    expect(policy).toMatch(/for delete to authenticated/);
    expect(policy).toMatch(/bucket_id\s*=\s*'content-media'/);
    expect(policy).toContain('c.storage_key = name');
    expect(policy).toContain('public.workspace_ids_for_current_user()');
  });

  it('clears storage identity only after the object is absent', () => {
    expect(code).toMatch(/create or replace function public\.release_content_media\(/);
    expect(code).toMatch(/returns boolean/);
    expect(code).toContain('not exists ( select 1 from storage.objects o');
    expect(code).toMatch(/storage_provider\s*=\s*null/);
    expect(code).toMatch(/storage_key\s*=\s*null/);
    expect(code).toMatch(/media_status\s*=\s*'external_only'/);
  });

  it('blocks deletion of a content row while it still references an object', () => {
    expect(code).toMatch(/create or replace function public\.content_reject_stored_delete\(\)/);
    expect(code).toMatch(/if old\.storage_key is not null then/);
    expect(code).toMatch(/create trigger content_storage_before_delete/);
    expect(code).toMatch(/before delete on public\.content/);
  });

  it('removes storage assertions from authenticated table writes', () => {
    expect(code).toContain(
      'revoke insert, update on public.content from anon, authenticated, service_role',
    );

    const insertGrant = /grant insert \(([^)]+)\) on public\.content to authenticated/.exec(
      code,
    )?.[1];
    const updateGrant = /grant update \(([^)]+)\) on public\.content to authenticated/.exec(
      code,
    )?.[1];
    expect(insertGrant).toBeDefined();
    expect(updateGrant).toBeDefined();

    // No client role may write any storage column, media_status included.
    // The only writers are the three SECURITY DEFINER verbs, each of which
    // proves something about the Storage catalogue first.
    for (const grant of [insertGrant, updateGrant]) {
      expect(grant).not.toMatch(/storage_provider|storage_key|media_status/);
    }
  });

  it('confirms a stored object through one narrow security-definer verb', () => {
    expect(code).toMatch(/create or replace function public\.confirm_content_media\(/);
    expect(code).toMatch(/returns boolean/);
    expect(code).toMatch(/security definer/);
    expect(code).toMatch(/set search_path = ''/);
    expect(code).toContain('public.workspace_ids_for_current_user()');
    expect(code).toContain('from storage.objects o');
    expect(code).toMatch(/o\.bucket_id\s*=\s*'content-media'/);
    expect(code).toMatch(/o\.name\s*=\s*target_storage_key/);
    expect(code).toContain("split_part(target_storage_key, '/', 1) <> target_workspace_id::text");
    expect(code).toContain("split_part(target_storage_key, '/', 2) <> target_content_id::text");
    expect(code).toMatch(/storage_provider\s*=\s*'supabase'/);
    expect(code).toMatch(/storage_key\s*=\s*target_storage_key/);
    expect(code).toMatch(/media_status\s*=\s*'available'/);
    expect(code).toMatch(/and storage_key is null/); // replacing needs cleanup, so it is a later verb
  });

  it('grants storage verbs only to authenticated callers', () => {
    expect(code).toMatch(
      /revoke execute on function public\.confirm_content_media\(uuid, uuid, text\) from public, anon, service_role/,
    );
    expect(code).toMatch(
      /grant execute on function public\.confirm_content_media\(uuid, uuid, text\) to authenticated/,
    );
    expect(code).toMatch(
      /revoke execute on function public\.release_content_media\(uuid, uuid\) from public, anon, service_role/,
    );
    expect(code).toMatch(
      /grant execute on function public\.release_content_media\(uuid, uuid\) to authenticated/,
    );
  });
});
