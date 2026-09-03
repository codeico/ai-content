import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The cross-workspace Content tab, as specified in design review.
 *
 * Each rule here was a correction, not a preference, so the reasoning is
 * recorded with it: a single recency stream with no filter UI silts up into a
 * junk drawer, two right-hand elements squeeze an already-truncating title at
 * 375px, and two glyphs of the same visual mass are indistinguishable at 24px.
 */
const PAGE = readFileSync(join(process.cwd(), 'apps/web/src/app/app/content/page.tsx'), 'utf8');
const REPO = readFileSync(
  join(process.cwd(), 'apps/web/src/server/repositories/content-repository.ts'),
  'utf8',
);
const ICONS = readFileSync(join(process.cwd(), 'apps/web/src/components/nav-icons.tsx'), 'utf8');

/** Just the cross-workspace query, so sibling queries cannot satisfy these. */
const LIST_ALL = REPO.slice(
  REPO.indexOf('export async function listAllContentForUser'),
  REPO.indexOf('export async function countContentByStatus'),
);

describe('the stream cannot silt up', () => {
  it('sorts by recency of work, not of creation', () => {
    // created_at freezes the order the moment a row exists; a caption written
    // today on month-old content would sink out of view.
    expect(LIST_ALL).toMatch(/\.order\('updated_at', \{ ascending: false \}\)/);
    expect(LIST_ALL).not.toMatch(/\.order\('created_at'/);
  });

  it('excludes archived content', () => {
    // There is no filter UI on this screen, so archived rows would be
    // permanent noise.
    expect(LIST_ALL).toMatch(/\.neq\('status', 'archived'\)/);
  });

  it('stays bounded', () => {
    expect(LIST_ALL).toMatch(/\.limit\(limit\)/);
  });
});

describe('a row survives a 375px screen', () => {
  it('puts the workspace name on a second line, not in a right-hand chip', () => {
    // StatusMark already owns the right edge; a chip beside it squeezes the
    // title further on a screen where it already truncates.
    expect(PAGE).toMatch(/\{item\.workspace_name\}/);
    expect(PAGE).toMatch(/text-\[13px\] text-ink-faint/);
  });

  it('separates the second line with the same mark PageHeader meta uses', () => {
    expect(PAGE).toMatch(/<span aria-hidden> \/ <\/span>/);
  });

  it('truncates both lines', () => {
    const truncations = PAGE.match(/truncate/g) ?? [];

    expect(truncations.length).toBeGreaterThanOrEqual(2);
  });

  it('does not group by workspace', () => {
    // Grouping rebuilds the workspaces list with extra scrolling and destroys
    // the single recency stream that justifies the tab.
    expect(PAGE).not.toMatch(/sticky top-0/);
  });
});

describe('the empty state describes this screen', () => {
  it('does not reuse the workspace wording', () => {
    expect(PAGE).toMatch(/Nothing in progress/);
    expect(PAGE).toMatch(/shows up here/);
    expect(PAGE).not.toMatch(/Everything starts as a draft/);
  });
});

describe('the tab glyphs are distinguishable at 24px', () => {
  it('uses a layers silhouette for workspaces, not a four-square grid', () => {
    const workspaces = ICONS.slice(
      ICONS.indexOf('export function WorkspacesIcon'),
      ICONS.indexOf('export function ContentIcon'),
    );

    // Four rounded squares and a portrait document are the same mass.
    expect(workspaces).not.toMatch(/<rect[\s\S]*<rect[\s\S]*<rect[\s\S]*<rect/);
    expect(workspaces).toMatch(/<path/);
  });

  it('keeps the document to two inner lines', () => {
    const content = ICONS.slice(
      ICONS.indexOf('export function ContentIcon'),
      ICONS.indexOf('export function AccountIcon'),
    );
    const inner = content.match(/M8 \d+h\d+/g) ?? [];

    // Three lines smudge once the active fill is applied.
    expect(inner).toHaveLength(2);
  });

  it('marks the active tab with fill AND colour, not colour alone', () => {
    const nav = readFileSync(join(process.cwd(), 'apps/web/src/components/app-nav.tsx'), 'utf8');

    // Count the usages, not the constant: replacing every fillOpacity with a
    // literal 0 left the declaration in place and the assertion passing, while
    // the active state degraded to colour alone - which fails for a
    // colour-blind user, the exact thing the second signal exists for.
    const filled = ICONS.match(/fillOpacity=\{active \? FILL_OPACITY : 0\}/g) ?? [];
    const glyphs = ICONS.match(/^export function \w+Icon\(/gm) ?? [];

    expect(glyphs.length).toBeGreaterThan(0);
    expect(filled).toHaveLength(glyphs.length);
    expect(nav).toMatch(/isActive \? 'text-accent' : 'text-ink-faint'/);
  });

  it('adds no third mark for one state', () => {
    const nav = readFileSync(join(process.cwd(), 'apps/web/src/components/app-nav.tsx'), 'utf8');

    // A pill background would be the only filled surface in an app built from
    // hairlines and type; an indicator rule makes three marks for one state.
    expect(nav).not.toMatch(/border-t-2|rounded-full bg-accent/);
  });
});
