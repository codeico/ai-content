import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Destructive confirmations must name what is actually destroyed.
 *
 * Content delete cascades to captions and said only "This cannot be undone" —
 * a user with twenty versions, one of them selected, got no warning that all
 * of it goes. Workspace delete said "All of its content goes with it", which
 * omitted captions and the AI profile.
 *
 * These pin the warnings to the cascade rules in the migrations, so a new
 * cascade cannot be added while the confirmation keeps describing the old one.
 */
const ROOT = process.cwd();

function source(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function allMigrations(): string {
  const dir = join(ROOT, 'supabase/migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
}

const CONTENT_BUTTON =
  'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/delete-content-button.tsx';
const WORKSPACE_BUTTON =
  'apps/web/src/app/app/workspaces/[workspaceId]/delete-workspace-button.tsx';

describe('the database really does cascade', () => {
  it('captions cascade from content', () => {
    expect(allMigrations()).toMatch(
      /content_id uuid not null references public\.content \(id\) on delete cascade/,
    );
  });

  it('content and profiles cascade from the workspace', () => {
    const sql = allMigrations();
    expect(sql).toMatch(/workspace_id uuid not null[\s\S]{0,80}on delete cascade/);
  });
});

describe('confirmations name what is destroyed', () => {
  it('content delete warns about the captions it takes', () => {
    const text = source(CONTENT_BUTTON);
    expect(text).toMatch(/captionCount/);
    expect(text).toMatch(/caption\$\{captionCount === 1 \? '' : 's'\}/);
    // Still honest when there is nothing extra to lose.
    expect(text).toContain('captionCount === 0');
  });

  it('workspace delete warns about content, captions and the profile', () => {
    const text = source(WORKSPACE_BUTTON);
    expect(text).toMatch(/contentCount/);
    expect(text).toMatch(/every caption written for/);
    expect(text).toMatch(/the AI profile/);
  });

  it('agrees in number for a single content item', () => {
    // "every caption written for them" reads wrong after "1 content item".
    const text = source(WORKSPACE_BUTTON);
    expect(text).toMatch(/plural \? 'them' : 'it'/);
    expect(text).toMatch(/contentCount !== 1/);
  });

  it('both still say the action is irreversible', () => {
    expect(source(CONTENT_BUTTON)).toContain('This cannot be undone.');
    expect(source(WORKSPACE_BUTTON)).toContain('This cannot be undone.');
  });

  it('the counts come from real data, not a guess', () => {
    const page = source(
      'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/page.tsx',
    );
    expect(page).toContain('captionCount={captions.length}');

    const workspacePage = source('apps/web/src/app/app/workspaces/[workspaceId]/page.tsx');
    // counts.total is the database count, not the paginated page length.
    expect(workspacePage).toContain('contentCount={counts.total}');
    expect(workspacePage).toContain('hasProfile={profile !== null}');
  });
});
