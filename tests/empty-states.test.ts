import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Empty states, measured at 320px on real empty records rather than reasoned
 * about. No defect found in this pass: an empty profile keeps its six
 * textareas at 68px with Save visible, and a content row with no captions
 * shows its explanation, offers "Write a caption", and lists nothing.
 *
 * What is pinned here is the wording and the branching, because both are easy
 * to break while the layout still looks fine.
 */
const CONTENT_PAGE = readFileSync(
  join(process.cwd(), 'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/page.tsx'),
  'utf8',
);
const WORKSPACE_PAGE = readFileSync(
  join(process.cwd(), 'apps/web/src/app/app/workspaces/[workspaceId]/page.tsx'),
  'utf8',
);
const GENERATE_BUTTON = readFileSync(
  join(
    process.cwd(),
    'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/generate-caption-button.tsx',
  ),
  'utf8',
);

describe('a content row with no captions explains itself', () => {
  it('renders no empty version list', () => {
    // An empty <ol> announces "list, 0 items" to a screen reader.
    expect(CONTENT_PAGE).toMatch(/captions\.length > 0 \?/);
  });

  it('labels the first caption differently from a repeat', () => {
    // "Write another" on content with nothing written is a lie. Assert the
    // two labels and the branch between them, not just that a prop exists -
    // a mutation that renamed the prop slipped past the weaker check.
    expect(GENERATE_BUTTON).toMatch(/'Write another'/);
    expect(GENERATE_BUTTON).toMatch(/'Write a caption'/);
    expect(GENERATE_BUTTON).toMatch(/hasCaptions \? 'Write another' : 'Write a caption'/);
  });

  it('says what a caption will be written from', () => {
    expect(CONTENT_PAGE).toMatch(/Written from what this content is about/);
  });
});

describe('a workspace with no content explains itself', () => {
  it('shows an empty state instead of a bare heading', () => {
    expect(WORKSPACE_PAGE).toMatch(/<EmptyState/);
    expect(WORKSPACE_PAGE).toMatch(/Nothing here yet/);
  });

  it('counts from the database, not from the page', () => {
    // counts.total stays right when the list is paginated or empty.
    expect(WORKSPACE_PAGE).toMatch(/countContentByStatus/);
    // And the zero case must actually choose the empty state: replacing the
    // condition with `false` left this matching while the list rendered an
    // empty <ul> instead.
    // Two separate zero-checks: the header meta line and the list itself.
    // Mutating one left the other matching, so require both.
    const zeroChecks = WORKSPACE_PAGE.match(/counts\.total === 0/g) ?? [];
    expect(zeroChecks).toHaveLength(2);
    expect(WORKSPACE_PAGE).toMatch(/counts\.total === 0 \? \(\s*<EmptyState/);
    expect(WORKSPACE_PAGE).toMatch(/counts\.total === 0 \? \(?\s*'No content yet'/);
  });
});

describe('destructive confirmations stay honest when counts are zero', () => {
  it('builds the workspace warning from parts rather than a fixed sentence', () => {
    const button = readFileSync(
      join(
        process.cwd(),
        'apps/web/src/app/app/workspaces/[workspaceId]/delete-workspace-button.tsx',
      ),
      'utf8',
    );

    // Verified at 320px on an empty workspace: the prompt read only
    // "Delete X? This cannot be undone." with no content or profile clause.
    expect(button).toMatch(/contentCount > 0/);
    expect(button).toMatch(/hasProfile/);
  });

  it('only mentions captions when there are some', () => {
    const button = readFileSync(
      join(
        process.cwd(),
        'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/delete-content-button.tsx',
      ),
      'utf8',
    );

    // Branches on captionCount === 0 rather than > 0; either reads fine, the
    // point is that the sentence is conditional and not fixed.
    expect(button).toMatch(/captionCount === 0/);
    expect(button).toMatch(/This also deletes/);
  });
});
