import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const FILE = join(
  process.cwd(),
  'supabase/migrations/20260904120000_fence_content_media_release.sql',
);
const sql = existsSync(FILE) ? readFileSync(FILE, 'utf8').toLowerCase() : '';
const code = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ');

describe('content media release generation fencing', () => {
  it('ships as a new migration', () => {
    expect(existsSync(FILE)).toBe(true);
  });

  it('removes the unfenced two-argument function', () => {
    expect(code).toContain(
      'revoke execute on function public.release_content_media(uuid, uuid) from public, anon, authenticated, service_role',
    );
    expect(code).toContain('drop function public.release_content_media(uuid, uuid)');
  });

  it('requires and compares the expected object key', () => {
    expect(code).toMatch(
      /create function public\.release_content_media\( target_workspace_id uuid, target_content_id uuid, expected_storage_key text \)/,
    );
    expect(code).toContain('c.storage_key = expected_storage_key');
    expect(code).toContain('o.name = expected_storage_key');
  });

  it('keeps the three-argument function authenticated-only', () => {
    expect(code).toContain(
      'revoke execute on function public.release_content_media(uuid, uuid, text) from public, anon, service_role',
    );
    expect(code).toContain(
      'grant execute on function public.release_content_media(uuid, uuid, text) to authenticated',
    );
  });
});
