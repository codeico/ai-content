import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * A row's identity — which workspace owns it, who owns the workspace — is not
 * something an UPDATE should be able to change, but the RLS policies allowed
 * it. Their WITH CHECK validates the NEW value, which is the right question
 * for access and the wrong one for identity:
 *
 *   content.workspace_id: the check passes when the new workspace is one the
 *   caller belongs to, so a member of both A and B could MOVE content from A
 *   to B, and its captions follow via the composite FK.
 *
 * The application cannot express either change (updateContentInWorkspace's
 * patch is { title, status, description }), so only a direct PostgREST client
 * could do it. Frozen by trigger, the same shape as captions.
 */
const ROOT = process.cwd();

function migration(fragment: string): string {
  const dir = join(ROOT, 'supabase/migrations');
  const file = readdirSync(dir).find((f) => f.includes(fragment));
  expect(file, `migration containing "${fragment}" must exist`).toBeDefined();
  return readFileSync(join(dir, file!), 'utf8');
}

describe('row identity is frozen after insert', () => {
  const sql = () => migration('freeze_row_identity');

  it('refuses to move content between workspaces', () => {
    expect(sql()).toMatch(/new\.workspace_id is distinct from old\.workspace_id/);
  });

  it('refuses to change workspace ownership', () => {
    expect(sql()).toMatch(/new\.owner_id is distinct from old\.owner_id/);
  });

  it('freezes both primary keys', () => {
    const matches = sql().match(/new\.id is distinct from old\.id/g) ?? [];
    expect(matches).toHaveLength(2);
  });

  it('fires BEFORE UPDATE FOR EACH ROW on both tables, so no client bypasses it', () => {
    const lower = sql().toLowerCase();
    expect(lower).toContain('before update on public.content');
    expect(lower).toContain('before update on public.workspaces');
    expect((lower.match(/for each row/g) ?? []).length).toBe(2);
  });

  it('refuses with 42501 rather than a generic error', () => {
    expect((sql().match(/errcode = '42501'/g) ?? []).length).toBe(4);
  });
});

describe('the application never needed these columns writable', () => {
  it('the content update patch cannot express a workspace move', () => {
    const repo = readFileSync(
      join(ROOT, 'apps/web/src/server/repositories/content-repository.ts'),
      'utf8',
    );
    const patch = repo.match(/patch: \{[^}]*\}/)?.[0] ?? '';

    expect(patch).toContain('title');
    expect(patch).not.toContain('workspace_id');
  });

  it('no repository writes workspace_id or owner_id in an update payload', () => {
    const dir = join(ROOT, 'apps/web/src/server/repositories');

    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const text = readFileSync(join(dir, file), 'utf8');

      for (const match of text.matchAll(/\.update\(\{([^}]*)\}\)/g)) {
        expect(match[1], `${file} update payload`).not.toContain('workspace_id');
        expect(match[1], `${file} update payload`).not.toContain('owner_id');
      }
    }
  });
});
