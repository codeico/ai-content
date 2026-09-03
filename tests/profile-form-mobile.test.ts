import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The profile form is the longest in the app: seven fields, six of them
 * multi-line. Measured on a 390x844 phone before this change: 1623px tall with
 * six fixed 120px boxes, and Save at 1483px - off screen at load, reachable
 * only by scrolling past every field.
 *
 * After: textareas start at 68px and grow to fit, the page is 1332px, and Save
 * is visible without scrolling.
 */
const FORM = readFileSync(
  join(
    process.cwd(),
    'apps/web/src/app/app/workspaces/[workspaceId]/profile/edit-profile-form.tsx',
  ),
  'utf8',
);
const AUTO_GROW = readFileSync(
  join(process.cwd(), 'apps/web/src/components/auto-grow-textarea.tsx'),
  'utf8',
);
const UI = readFileSync(join(process.cwd(), 'apps/web/src/components/ui.tsx'), 'utf8');

describe('the commit action stays in reach', () => {
  it('sticks Save to the bottom on a phone', () => {
    expect(FORM).toMatch(/sticky bottom-0/);
  });

  it('clears the home indicator', () => {
    expect(FORM).toMatch(/pb-safe/);
  });

  it('returns to normal flow on a wider screen', () => {
    // A sticky bar on a desktop form is clutter; there is room for the button.
    expect(FORM).toMatch(/sm:static/);
  });
});

describe('long fields fit their content', () => {
  it('uses the auto-growing textarea for the six long fields', () => {
    expect(FORM).toMatch(/<AutoGrowTextarea/);
    expect(FORM).not.toMatch(/<Textarea/);
  });

  it('grows to fit and can shrink back', () => {
    // Without resetting to auto first, the box only ever grows: delete text
    // and the field keeps the height of the longest thing ever typed.
    expect(AUTO_GROW).toMatch(/style\.height = 'auto'/);
    expect(AUTO_GROW).toMatch(/scrollHeight/);
  });

  it('sizes itself to the server-rendered value before any typing', () => {
    expect(AUTO_GROW).toMatch(/useEffect\(\(\) => fit\(ref\.current\), \[\]\)/);
  });
});

describe('the design system stays out of the client bundle', () => {
  it('ui.tsx is not a client component', () => {
    // It is imported by Server Components. Marking it 'use client' to gain one
    // hook would pull every primitive into the browser bundle.
    expect(UI.slice(0, 200)).not.toMatch(/'use client'/);
  });

  it('the auto-growing textarea is the client component instead', () => {
    expect(AUTO_GROW).toMatch(/^'use client'/);
  });

  it('both share one box style rather than drifting apart', () => {
    expect(UI).toMatch(/export const TEXTAREA_CLASS/);
    expect(AUTO_GROW).toMatch(/TEXTAREA_CLASS/);
  });
});

describe('typing does not zoom the page on iOS', () => {
  it('keeps controls at 16px', () => {
    // Safari zooms into any field under 16px, which then needs a pinch to
    // undo. text-base is 16px; anything smaller here would reintroduce it.
    expect(UI).toMatch(/const CONTROL_CLASS =[\s\S]{0,300}text-base/);
  });

  it('gives every control a 44px touch target', () => {
    expect(UI).toMatch(/const CONTROL_CLASS =[\s\S]{0,300}min-h-11/);
  });
});
