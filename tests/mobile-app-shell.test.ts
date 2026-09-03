import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The app reads as a mobile app: each screen names itself in a contextual top
 * bar, child screens offer Back to their PARENT (not to history, which the
 * browser already does and which would strand a user who arrived by link),
 * and rows that open a screen look like rows that open a screen.
 *
 * Desktop is the same layout widened, not a second design — so these rules are
 * asserted once, over every screen.
 */
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const APP_DIR = 'apps/web/src/app/app';

/** Screens pushed onto a parent: they must have a back target. */
const CHILD_SCREENS = [
  `${APP_DIR}/workspaces/[workspaceId]/page.tsx`,
  `${APP_DIR}/workspaces/[workspaceId]/profile/page.tsx`,
  `${APP_DIR}/workspaces/[workspaceId]/content/[contentId]/page.tsx`,
];

/** Root tabs: nowhere up to go, so no Back. */
const ROOT_SCREENS = [`${APP_DIR}/page.tsx`, `${APP_DIR}/account/page.tsx`];

describe('every child screen has a contextual bar with Back', () => {
  it.each(CHILD_SCREENS)('%s renders an AppBar', (path) => {
    expect(source(path)).toMatch(/<AppBar/);
  });

  it.each(CHILD_SCREENS)('%s points Back at a route, not history', (path) => {
    const code = source(path);

    expect(code).toMatch(/backHref=/);
    // router.back() would send a user who opened the link directly somewhere
    // they have never been; the browser already provides history.
    expect(code).not.toMatch(/router\.back\(\)/);
  });

  it.each(CHILD_SCREENS)('%s names the Back target for screen readers', (path) => {
    expect(source(path)).toMatch(/backLabel=/);
  });
});

describe('root tabs have no Back', () => {
  it.each(ROOT_SCREENS)('%s does not offer one', (path) => {
    expect(source(path)).not.toMatch(/backHref=/);
  });
});

describe('a screen has exactly one h1', () => {
  it.each(CHILD_SCREENS)('%s lets the AppBar own the title', (path) => {
    const code = source(path);

    // The AppBar renders the h1; a PageHeader on the same screen must not
    // render a second one, or the page announces its title twice.
    if (/<PageHeader/.test(code)) {
      expect(code).toMatch(/hideTitle/);
    }
  });
});

describe('the app shell does not stack two bars on a phone', () => {
  const LAYOUT = source(`${APP_DIR}/layout.tsx`);

  it('hides the wordmark header on small screens', () => {
    // The AppBar already names the screen there; two sticky bars ate 114px of
    // a 844px viewport and said the same thing twice.
    expect(LAYOUT).toMatch(/hidden[^"]*md:block/);
  });

  it('keeps the bottom tab bar for phones only', () => {
    expect(source('apps/web/src/components/app-nav.tsx')).toMatch(/md:hidden/);
  });

  it('still reserves room so the tab bar never covers content', () => {
    expect(LAYOUT).toMatch(/pb-24/);
  });
});

describe('list rows read as rows that open a screen', () => {
  it.each([`${APP_DIR}/page.tsx`, `${APP_DIR}/workspaces/[workspaceId]/page.tsx`])(
    '%s uses the cell style and a chevron',
    (path) => {
      const code = source(path);

      expect(code).toMatch(/className="cell/);
      expect(code).toMatch(/<Chevron \/>/);
    },
  );

  it('gives a cell a touch target of at least 44px', () => {
    const css = source('apps/web/src/app/globals.css');
    const cell = css.slice(css.indexOf('.cell {'), css.indexOf('}', css.indexOf('.cell {')));

    expect(cell).toMatch(/min-height:\s*44px/);
  });

  it('highlights on touch, not only on hover', () => {
    const css = source('apps/web/src/app/globals.css');

    // A phone has no hover: a hover-only style leaves taps with no feedback.
    expect(css).toMatch(/\.cell:active/);
  });
});

describe('motion respects the accessibility setting', () => {
  const CSS = source('apps/web/src/app/globals.css');

  it('defines the screen entry animation', () => {
    expect(CSS).toMatch(/@keyframes screen-in/);
  });

  it('disables it under prefers-reduced-motion', () => {
    const reduced = CSS.slice(CSS.indexOf('prefers-reduced-motion'));

    expect(reduced).toMatch(/\.screen-in\s*\{\s*animation:\s*none/);
  });
});
