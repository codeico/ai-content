import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The copy control has no DOM test (no jsdom in this project), so these pin the
 * two properties that a refactor could quietly destroy and that no type check
 * would catch.
 *
 * The one that matters: a failed clipboard write must NOT report success. The
 * user believes they hold the caption, leaves the app, and pastes nothing —
 * losing the artefact the whole feature exists to produce.
 */
const SOURCE = readFileSync(
  join(
    process.cwd(),
    'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/copy-caption-button.tsx',
  ),
  'utf8',
);

describe('copy control honesty', () => {
  it('sets the copied state only inside the try, never after a catch', () => {
    const tryBlock = SOURCE.slice(SOURCE.indexOf('try {'), SOURCE.indexOf('} catch'));
    const catchBlock = SOURCE.slice(SOURCE.indexOf('} catch'), SOURCE.indexOf('}\n  }'));

    expect(tryBlock).toContain("setState('copied')");
    expect(catchBlock).toContain("setState('failed')");
    expect(catchBlock).not.toContain("setState('copied')");
  });

  it('awaits the clipboard write, so a rejection reaches the catch', () => {
    // Without await, writeText's rejection escapes as an unhandled rejection
    // and the button reports success regardless.
    expect(SOURCE).toMatch(/await navigator\.clipboard\.writeText/);
  });

  it('renders a distinct label for the failed state', () => {
    expect(SOURCE).toContain("state === 'failed'");
    expect(SOURCE).toMatch(/Press and hold to copy/);
  });

  it('clears the reset timer on unmount', () => {
    // Otherwise the timer fires against an unmounted component.
    expect(SOURCE).toContain('clearTimeout(timer)');
  });

  it('copies the caption body verbatim, with no trimming or slicing', () => {
    const call = SOURCE.slice(SOURCE.indexOf('writeText('), SOURCE.indexOf('writeText(') + 40);
    expect(call).toContain('writeText(body)');
  });
});
