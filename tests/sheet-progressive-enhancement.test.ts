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

    // The fallback branch must actually render children and label itself.
    // Matching the id alone survived renaming it, because the string also
    // appears on the aria-labelledby attribute.
    const fallback = SHEET.slice(
      SHEET.indexOf('if (!enhanced)'),
      SHEET.indexOf('return (\n    <>'),
    );
    expect(fallback).toMatch(/aria-labelledby="sheet-fallback-title"/);
    expect(fallback).toMatch(/id="sheet-fallback-title"/);
    expect(fallback).toMatch(/\{children\}/);
  });

  it('does not own the form', () => {
    // The sheet presents children; it never renders inputs or an action.
    expect(SHEET).not.toMatch(/<input/);
    expect(SHEET).not.toMatch(/action=\{/);
  });

  it('waits for hydration before enhancing', () => {
    // The server snapshot must be `false` so SSR and the hydration pass render
    // the no-JS markup; the client snapshot flips to `true` afterwards. This
    // is React's own idiom for the question — an effect calling setState was
    // the previous answer and is what the compiler lint now forbids.
    expect(SHEET).toMatch(/useSyncExternalStore\(/);
    expect(SHEET).toMatch(/\(\) => true,\s*\(\) => false,/);
    // The old pattern must not come back under either name.
    expect(SHEET).not.toMatch(/useEffect\(\(\) => set\w+\(true\)/);
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

  it('the shared hook closes only on the pending→settled edge', () => {
    // Closing while isPending would tear the form down mid-submit, and
    // closing on mount would dismiss a sheet that merely opened with an old
    // success state. Both are ruled out by acting on the falling edge only.
    expect(HOOK).toMatch(/wasPending\.current && !isPending/);
    expect(HOOK).toMatch(/if \(!settledNow\) return;/);
    // Errors still veto the close.
    expect(HOOK).toMatch(/if \(state\.error \|\| state\.fieldErrors\) return;/);
    // And the ref is only ever touched inside the effect, never in render.
    const renderBody = HOOK.slice(HOOK.indexOf('const wasPending'), HOOK.indexOf('useEffect('));
    expect(renderBody).not.toMatch(/\.current\s*=/);
  });

  it.each(SHEET_FORMS)('%s uses the shared rule rather than its own', (path) => {
    // Three copies of this logic is three chances to get it wrong in only one
    // of them, where the mistake is invisible until a validation error is lost.
    expect(formSource(path)).toMatch(/useCloseOnSuccess\(isPending, state\)/);
  });
});

describe('the close handle crosses the server boundary safely', () => {
  it('travels by context, not as a prop', () => {
    // createContext also appears in the react import, so match the call that
    // actually builds the context plus the hook that reads it.
    expect(SHEET).toMatch(/const SheetContext = createContext</);
    expect(SHEET).toMatch(/export function useSheet\(\)/);
    expect(SHEET).toMatch(/useContext\(SheetContext\)/);
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
    // Swapping <dialog> for a <div> loses focus trapping, background
    // inertness and Escape, and nothing else in the file would complain.
    // The opening tag and the closing tag must both be the real element.
    // `<dialog>` also appears in the doc comment, so match the JSX: an
    // indented opening tag and the matching close.
    expect(SHEET).toMatch(/\n\s+<dialog\n/);
    expect(SHEET).toMatch(/\n\s+<\/dialog>/);
    expect(SHEET).toMatch(/ref\.current\?\.showModal\(\)/);
    expect(SHEET).toMatch(/ref\.current\?\.close\(\)/);
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
