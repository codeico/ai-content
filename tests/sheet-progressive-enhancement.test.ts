import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The bottom sheet must never become the reason a form stops working.
 *
 * Every form it wraps is a Server Action form that has to function with no
 * JavaScript, so the sheet only *presents* markup that is already there. Two
 * bugs found while building it, both verified in a real browser:
 *
 * 1. Closing on the submit event dismissed the sheet on FAILURE too, taking
 *    "Title is required." with it — the user saw the sheet vanish and nothing
 *    created, with no explanation. Dismissal now depends on the action's
 *    result, not on the click.
 * 2. A render prop cannot cross the Server/Client boundary. Passing one threw
 *    "Functions are not valid as a child of Client Components", so the close
 *    handle travels by context instead.
 */
const SHEET = readFileSync(join(process.cwd(), 'apps/web/src/components/sheet.tsx'), 'utf8');
const HOOK = readFileSync(
  join(process.cwd(), 'apps/web/src/components/use-close-on-success.ts'),
  'utf8',
);

/** Every form presented in a sheet. All must dismiss on the same rule. */
const SHEET_FORMS = [
  'apps/web/src/app/app/workspaces/[workspaceId]/create-content-form.tsx',
  'apps/web/src/app/app/create-workspace-form.tsx',
  'apps/web/src/app/app/workspaces/[workspaceId]/rename-workspace-form.tsx',
  'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/edit-content-form.tsx',
  'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/edit-source-form.tsx',
];

function formSource(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const CSS = readFileSync(join(process.cwd(), 'apps/web/src/app/globals.css'), 'utf8');

describe('the form works without JavaScript', () => {
  it('renders the form when the sheet has not enhanced yet', () => {
    // Before mount, and forever on a client that runs no JS, the markup is a
    // plain section containing the form - not a button that cannot be pressed.
    expect(SHEET).toMatch(/if \(!enhanced\)/);
    expect(SHEET).toMatch(/sheet-fallback-title/);
  });

  it('does not own the form', () => {
    // The sheet presents children; it never renders inputs or an action.
    expect(SHEET).not.toMatch(/<input/);
    expect(SHEET).not.toMatch(/action=\{/);
  });

  it('waits for mount before enhancing', () => {
    expect(SHEET).toMatch(/useEffect\(\(\) => setEnhanced\(true\), \[\]\)/);
  });
});

describe('dismissal follows the action result, not the click', () => {
  it('the sheet does not close itself on submit', () => {
    // The regression: a submit listener closed on failure too.
    expect(SHEET).not.toMatch(/addEventListener\('submit'/);
  });

  it('the shared hook closes only when the action returned no error', () => {
    expect(HOOK).toMatch(/if \(state\.error \|\| state\.fieldErrors\) return;/);
    expect(HOOK).toMatch(/close\(\)/);
  });

  it('the shared hook waits for the action to settle', () => {
    // Closing while isPending would tear the form down mid-submit.
    expect(HOOK).toMatch(/if \(!submitted\.current \|\| isPending\) return;/);
  });

  it.each(SHEET_FORMS)('%s uses the shared rule rather than its own', (path) => {
    // Three copies of this logic is three chances to get it wrong in only one
    // of them, where the mistake is invisible until a validation error is lost.
    expect(formSource(path)).toMatch(/useCloseOnSuccess\(isPending, state\)/);
  });
});

describe('the close handle crosses the server boundary safely', () => {
  it('travels by context, not as a prop', () => {
    expect(SHEET).toMatch(/createContext/);
    expect(SHEET).toMatch(/export function useSheet/);
  });

  it('children stay serialisable', () => {
    // `children: (props) => ReactNode` threw at runtime under RSC.
    expect(SHEET).toMatch(/children: ReactNode/);
  });

  it('close is a no-op outside a sheet, so the form also works inline', () => {
    expect(SHEET).toMatch(/close: \(\) => \{\}/);
  });
});

describe('the sheet is a real dialog', () => {
  it('uses <dialog> so focus trapping and Escape come from the platform', () => {
    expect(SHEET).toMatch(/<dialog/);
    expect(SHEET).toMatch(/showModal\(\)/);
  });

  it('names itself for assistive tech', () => {
    expect(SHEET).toMatch(/aria-labelledby="sheet-title"/);
  });

  it('dismisses on a backdrop click but not on a click inside the panel', () => {
    expect(SHEET).toMatch(/event\.target === ref\.current/);
  });
});

describe('the sheet fits a phone', () => {
  it('clears the home indicator', () => {
    // pb-safe lost to pb-4 in the cascade, leaving 0px and a submit button
    // under the home indicator.
    expect(SHEET).toMatch(/env\(safe-area-inset-bottom\)/);
  });

  it('is bounded by the dynamic viewport height', () => {
    const sheet = CSS.slice(
      CSS.indexOf('.sheet[open] {'),
      CSS.indexOf('}', CSS.indexOf('.sheet[open] {')),
    );

    expect(sheet).toMatch(/max-height:\s*100dvh/);
  });

  it('stops animating under prefers-reduced-motion', () => {
    const reduced = CSS.slice(CSS.indexOf('prefers-reduced-motion'));

    expect(reduced).toMatch(/\.sheet\[open\]/);
  });
});

describe('the content screen leads with what it is for', () => {
  const PAGE = readFileSync(
    join(
      process.cwd(),
      'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/page.tsx',
    ),
    'utf8',
  );

  it('puts Caption above the edit forms', () => {
    // Measured before: the page was 3371px (4 phone screens) and Caption began
    // at 1372px, behind Details and Source. After: 2319px, Caption at 171px.
    const caption = PAGE.indexOf('captions-heading');
    const details = PAGE.indexOf('Edit details');

    expect(caption).toBeGreaterThan(-1);
    expect(caption).toBeLessThan(details);
  });

  it('presents Details and Source as sheets rather than inline forms', () => {
    expect(PAGE).toMatch(/<Sheet trigger="Edit details"/);
    expect(PAGE).toMatch(/<Sheet trigger=\{hasSource \? 'Edit source' : 'Add a source'\}/);
  });

  it('names the source trigger for what it does', () => {
    // "Edit source" on content with no source invites a user to edit nothing.
    expect(PAGE).toMatch(/'Add a source'/);
  });
});

describe('a closed sheet takes up no space and says nothing', () => {
  it('scopes the sheet layout to [open]', () => {
    // Found on an empty workspace at 320px: a bare `.sheet { display: flex }`
    // overrides the user-agent `dialog:not([open]) { display: none }`. The
    // closed sheet was 568px tall - the whole viewport - and its <h2> stayed
    // in the accessibility tree, so the screen read "New content" twice: once
    // for the trigger, once for the hidden sheet title.
    expect(CSS).toMatch(/\.sheet\[open\]\s*\{[\s\S]{0,200}display:\s*flex/);
  });

  it('does not style the sheet unconditionally', () => {
    // `.sheet {` without [open] is the regression.
    expect(CSS).not.toMatch(/\n\s*\.sheet\s*\{/);
  });
});
