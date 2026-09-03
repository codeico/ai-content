import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Captions follow CONTENT access, not the owner-only workspace profile: any
 * member may generate and select. The migration says so in a comment so nobody
 * "fixes" it later; this pins the application side of the same decision, since
 * a stray ownership check in the page or the action would silently take the
 * feature away from members.
 */
const ROOT = process.cwd();
const PAGE = join(
  ROOT,
  'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/page.tsx',
);
const ACTIONS = join(
  ROOT,
  'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/caption-actions.ts',
);
const MIGRATION = join(ROOT, 'supabase/migrations/20260903130000_create_captions.sql');

describe('captions are member-accessible, not owner-only', () => {
  it('the action gates on membership, never on ownership', () => {
    const source = readFileSync(ACTIONS, 'utf8');

    expect(source).toContain('getWorkspaceForUser');
    // getWorkspaceAsOwner is the owner-only helper used by profile writes.
    expect(source).not.toContain('getWorkspaceAsOwner');
    expect(source).not.toMatch(/owner_id\s*===/);
  });

  it('the page does not hide the caption controls from members', () => {
    const source = readFileSync(PAGE, 'utf8');
    const section = source.slice(
      source.indexOf('captions-heading'),
      source.indexOf('stages-heading'),
    );

    // The only ownership branch in the caption section is link wording.
    const ownerChecks = section.match(/owner_id\s*===\s*user\.id/g) ?? [];
    expect(ownerChecks).toHaveLength(1);
    expect(section).toContain('See the profile');
    expect(section).toContain('Fill it in');

    // The generate control itself is unconditional.
    expect(section).toContain('<GenerateCaptionButton');
    const buttonLine = section.slice(section.indexOf('<GenerateCaptionButton'));
    expect(buttonLine.slice(0, 200)).not.toContain('owner_id');
  });

  it('the migration records the decision so it is not "fixed" later', () => {
    const sql = readFileSync(MIGRATION, 'utf8').toLowerCase();

    expect(sql).toContain('member');
    expect(sql).toMatch(/follows? content/);
  });
});
