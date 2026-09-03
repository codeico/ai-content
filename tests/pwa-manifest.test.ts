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

describe('offline support is app-shell only', () => {
  it('ships a service worker', () => {
    // Phase 10 was opened deliberately by the owner on 2026-09-03. Until then
    // this gate asserted the opposite: that no worker had appeared early.
    expect(existsSync(join(process.cwd(), 'apps/web/public/sw.js'))).toBe(true);
  });

  it('never caches HTML or RSC payloads', () => {
    const sw = readFileSync(join(process.cwd(), 'apps/web/public/sw.js'), 'utf8');

    // Every page is force-dynamic and authorisation is per request, so a
    // cached shell could serve one user's workspace to another.
    expect(sw).toMatch(/request\.mode === 'navigate'/);
    expect(sw).toMatch(/_rsc/);
    expect(sw).toMatch(/\/_next\/static\//);
  });

  it('falls back to an honest offline page', () => {
    const sw = readFileSync(join(process.cwd(), 'apps/web/public/sw.js'), 'utf8');

    expect(sw).toMatch(/OFFLINE_URL/);
    expect(existsSync(join(process.cwd(), 'apps/web/src/app/offline/page.tsx'))).toBe(true);
  });
});

describe('the service worker cannot cache a personalised response', () => {
  const SW = readFileSync(join(process.cwd(), 'apps/web/public/sw.js'), 'utf8');

  it('allowlists /_next/static/ and not /_next/', () => {
    // The image optimiser is at /_next/image?url=..., is not content-hashed,
    // and proxies whatever URL it is handed - including a signed one.
    expect(SW).toMatch(/startsWith\('\/_next\/static\/'\)/);
    expect(SW).not.toMatch(/startsWith\('\/_next\/'\)/);
  });

  it('refuses a response the origin marked private', () => {
    // Second line of defence: if the path allowlist is ever widened, these
    // headers still keep a per-user response out of a shared cache.
    expect(SW).toMatch(/function isCacheable/);
    expect(SW).toMatch(/no-store/);
    expect(SW).toMatch(/Set-Cookie/);
    expect(SW).toMatch(/Vary/);
  });

  it('applies that check on the write path, not just defines it', () => {
    // A helper that nothing calls is decoration.
    expect(SW).toMatch(/response\.ok && isCacheable\(response\)/);
  });

  it('only handles same-origin GETs', () => {
    expect(SW).toMatch(/request\.method !== 'GET'/);
    expect(SW).toMatch(/url\.origin !== self\.location\.origin/);
  });
});

describe('a forgotten cache bump stays harmless', () => {
  const SW = readFileSync(join(process.cwd(), 'apps/web/public/sw.js'), 'utf8');

  /**
   * SHELL_CACHE is bumped by hand. That is only safe because nothing mutable
   * is cached at a stable URL: chunks are content-hashed so a stale entry is
   * never requested again, and navigations are network-first so page HTML is
   * never served stale.
   *
   * These assertions hold that reasoning true. If a future change caches
   * something mutable at a fixed path, the constant becomes load-bearing and
   * forgetting it starts serving wrong code to returning visitors.
   */
  it('caches only content-hashed paths beyond the four shell assets', () => {
    const allowlist = SW.slice(SW.indexOf('const isStatic'), SW.indexOf('if (!isStatic) return;'));

    expect(allowlist).toMatch(/\/_next\/static\//);
    expect(allowlist).toMatch(/SHELL_ASSETS\.includes/);
  });

  it('keeps the shell asset list to identity-free, rarely-changing files', () => {
    const list = SW.slice(SW.indexOf('const SHELL_ASSETS'), SW.indexOf('self.addEventListener'));

    // Adding an HTML route here would make it stale-able at a stable URL.
    expect(list).not.toMatch(/'\/app/);
    expect(list).toMatch(/OFFLINE_URL/);
  });

  it('serves navigations network-first so HTML is never stale', () => {
    const nav = SW.slice(
      SW.indexOf("request.mode === 'navigate'"),
      SW.indexOf('// Immutable build'),
    );

    // fetch() first, cache only as the fallback.
    expect(nav.indexOf('fetch(request)')).toBeLessThan(nav.indexOf('caches.match'));
  });

  it('drops every cache that is not the current one on activate', () => {
    expect(SW).toMatch(/keys\.filter\(\(k\) => k !== SHELL_CACHE\)/);
  });

  it('states the safety argument next to the constant it justifies', () => {
    // Kept deliberately narrow. Earlier versions of this check matched
    // phrases that also appear elsewhere in the file, so deleting the
    // explanation passed twice. Asserting on prose is weak by nature - the
    // real protection is the four behavioural tests above, and this only
    // guards against the comment being dropped wholesale.
    const versionDoc = SW.slice(SW.indexOf('/*\n * Cache version.'), SW.indexOf('const VERSION'));

    expect(versionDoc.length).toBeGreaterThan(400);
    expect(versionDoc).toMatch(/content-hashed/);
  });
});

describe('the install survives a change of start URL', () => {
  it('pins an explicit id', () => {
    // Without id the install is keyed on start_url. Change start_url later
    // and the browser treats it as a different app: existing installs are
    // orphaned and the user gets a second icon instead of an update.
    expect(MANIFEST).toMatch(/id: '\/app'/);
  });

  it('declares a scope that covers the auth screens', () => {
    // Navigating outside scope opens a browser tab on top of the installed
    // app. Login and signup are part of the flow, so scope is the origin.
    expect(MANIFEST).toMatch(/scope: '\/'/);
  });

  it('does not lock the orientation', () => {
    // Forcing portrait breaks landscape use and anyone relying on a rotated
    // device. The layout already handles both.
    expect(MANIFEST).not.toMatch(/orientation:/);
  });
});
