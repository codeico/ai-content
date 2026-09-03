import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Nothing may push the page wider than the viewport.
 *
 * Found by sweeping every screen at 375px after eight UI commits that had each
 * only been checked in isolation: the workspace list scrolled sideways by
 * 51px (document 426px against a 375px viewport). A long content title made
 * the <section> grow past its grid track, because a grid item defaults to
 * min-width:auto and cannot shrink below its intrinsic content width. The
 * cell's -mx-2 then added the last 8px.
 *
 * The fix is min-w-0 on the grid child. This is the standard flex/grid trap:
 * `truncate` on the text does nothing while an ancestor is free to widen.
 */
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

/** Screens whose list sits in a grid track and can therefore be widened. */
const GRID_LIST_SCREENS = [
  'apps/web/src/app/app/page.tsx',
  'apps/web/src/app/app/workspaces/[workspaceId]/page.tsx',
];

describe('a long title cannot widen the page', () => {
  it.each(GRID_LIST_SCREENS)('%s lets its list column shrink', (path) => {
    const code = source(path);
    const section = code.match(
      /<section aria-labelledby="(content|workspaces)-heading"[^>]*>/,
    )?.[0];

    expect(section, 'the list section should exist').toBeDefined();
    // Without this the section keeps its intrinsic width and the whole
    // document scrolls sideways, however aggressively the text truncates.
    expect(section).toMatch(/min-w-0/);
  });

  it.each(GRID_LIST_SCREENS)('%s still truncates the title itself', (path) => {
    expect(source(path)).toMatch(/truncate/);
  });
});

describe('the negative margin on a cell stays inside its parent', () => {
  it.each(GRID_LIST_SCREENS)('%s pairs -mx-2 with a shrinkable ancestor', (path) => {
    const code = source(path);

    if (!/className="cell -mx-2/.test(code)) return;
    // -mx-2 is what turns a parent that is already 1px too wide into a
    // visibly broken page, so it may only be used where the parent can shrink.
    expect(code).toMatch(/min-w-0/);
  });
});

describe('an inline link is still big enough to tap', () => {
  const CONTENT_PAGE = source(
    'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/page.tsx',
  );

  it('pads the profile link into the line leading', () => {
    // Measured at 320px: the link was 18px tall, well under the 44px minimum.
    // It sits mid-sentence, so it cannot simply be made taller without
    // breaking the paragraph - padding plus a matching negative margin grows
    // the touch area while leaving the text where it sits. After: 45px tall,
    // paragraph unchanged at 42px.
    const link = CONTENT_PAGE.match(/<Link[^>]*profile`\}[\s\S]{0,400}?className="([^"]+)"/)?.[1];

    expect(link, 'the profile hint link should exist').toBeDefined();
    expect(link).toMatch(/py-3/);
    expect(link).toMatch(/-my-3/);
    expect(link).toMatch(/inline-block/);
  });
});
