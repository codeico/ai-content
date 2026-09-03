import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * A manifest that points at a missing or wrongly-sized icon fails to install
 * with no error the user ever sees: the browser simply stops offering it.
 *
 * Verified in a real browser against the running server, not just on disk -
 * both icons return 200, decode, and match their declared sizes exactly.
 */
const MANIFEST = readFileSync(join(process.cwd(), 'apps/web/src/app/manifest.ts'), 'utf8');
const PUBLIC_DIR = join(process.cwd(), 'apps/web/public');

/** PNG header: width and height live at bytes 16-24 of an IHDR chunk. */
function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(join(PUBLIC_DIR, file));
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Every icon the manifest declares, with its stated size. */
const DECLARED = [...MANIFEST.matchAll(/src: '\/([\w.-]+)',\s*sizes: '(\d+)x(\d+)'/g)].map((m) => ({
  file: m[1]!,
  width: Number(m[2]),
  height: Number(m[3]),
}));

describe('every declared icon exists at its declared size', () => {
  it('declares at least the two install icons plus a maskable one', () => {
    expect(DECLARED.length).toBeGreaterThanOrEqual(3);
  });

  it.each(DECLARED)('$file exists', ({ file }) => {
    expect(existsSync(join(PUBLIC_DIR, file)), `${file} is declared but missing`).toBe(true);
  });

  it.each(DECLARED)('$file is a real PNG, not an empty placeholder', ({ file }) => {
    const buf = readFileSync(join(PUBLIC_DIR, file));

    expect(buf.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(statSync(join(PUBLIC_DIR, file)).size).toBeGreaterThan(500);
  });

  it.each(DECLARED)('$file really is $width x $height', ({ file, width, height }) => {
    // A 512 icon declared as 192 is silently rejected by the install check.
    expect(pngSize(file)).toEqual({ width, height });
  });
});

describe('the maskable icon has a safe zone', () => {
  it('is declared with purpose maskable', () => {
    expect(MANIFEST).toMatch(/purpose: 'maskable'/);
  });

  it('is a separate file from the ordinary icons', () => {
    // Measured: the ordinary icons run to the edges, inset 0%. Marking those
    // maskable would let Android's circle crop eat the glyph.
    const maskable = MANIFEST.match(/src: '\/([\w.-]+)',[^}]*purpose: 'maskable'/s)?.[1];

    expect(maskable).toBeDefined();
    expect(maskable).not.toBe('icon-192.png');
    expect(maskable).not.toBe('icon-512.png');
  });

  it('keeps the ordinary icons unmarked', () => {
    const beforeMaskable = MANIFEST.slice(0, MANIFEST.indexOf('maskable'));

    expect(beforeMaskable).not.toMatch(/icon-192\.png'[^}]*purpose/);
  });
});

describe('the manifest satisfies the install criteria', () => {
  it('runs standalone rather than in a browser tab', () => {
    expect(MANIFEST).toMatch(/display: 'standalone'/);
  });

  it('has a name and a short name', () => {
    expect(MANIFEST).toMatch(/name: '/);
    expect(MANIFEST).toMatch(/short_name: '/);
  });

  it('starts inside the app, not on the marketing page', () => {
    expect(MANIFEST).toMatch(/start_url: '\/app'/);
  });

  it('sets a theme colour so the status bar is not default white', () => {
    expect(MANIFEST).toMatch(/theme_color: '/);
  });
});

describe('offline support stays in its phase', () => {
  it('registers no service worker yet', () => {
    // A service worker and offline shell are PHASE 10 (IMPLEMENTATION_ROADMAP
    // "PWA + NOTIFICATIONS"), and CODING_RULES section 3 forbids building a
    // future phase early. The manifest and icons are correct so that phase has
    // nothing to fix, but installability itself waits for the worker.
    const appDir = join(process.cwd(), 'apps/web/src');

    expect(existsSync(join(appDir, 'app/sw.ts'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'apps/web/public/sw.js'))).toBe(false);
  });
});
