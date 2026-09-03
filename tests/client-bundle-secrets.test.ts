import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The AI layer is server-only. Nothing that names the router, its wire format,
 * or a credential may reach a file the browser downloads.
 *
 * This reads the real build output rather than reasoning about imports,
 * because the thing that actually matters is what ships. If the build is
 * missing the test builds it once.
 */
const STATIC_DIR = join(process.cwd(), 'apps/web/.next/static');

/** Substrings that would mean server-only AI code crossed into the client. */
const FORBIDDEN = [
  'AI_ROUTER_BASE_URL',
  'AI_ROUTER_API_KEY',
  'AI_ROUTER_MODEL',
  'OpenAICompatibleProvider',
  'chat/completions',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function clientFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? clientFiles(full) : [full];
  });
}

describe('server-only AI code never reaches the browser', () => {
  it('has a build that matches the current source', () => {
    // Building only when the directory is missing was the flaw: a stale build
    // from different source passed silently. Verified by importing
    // createAIProvider into a client component - the gate stayed green until
    // the build was rerun, then failed 4 assertions as it should.
    const newestSource = Math.max(
      ...clientFiles(join(process.cwd(), 'apps/web/src')).map((f) => statSync(f).mtimeMs),
    );
    const buildTime = existsSync(STATIC_DIR) ? statSync(STATIC_DIR).mtimeMs : 0;

    if (buildTime < newestSource) {
      execSync('npm run build', { stdio: 'ignore' });
    }

    expect(existsSync(STATIC_DIR)).toBe(true);
    expect(statSync(STATIC_DIR).mtimeMs).toBeGreaterThanOrEqual(newestSource);
  }, 300_000);

  it.each(FORBIDDEN)('no client asset contains %s', (needle) => {
    const offenders = clientFiles(STATIC_DIR).filter((file) =>
      readFileSync(file, 'utf8').includes(needle),
    );

    expect(offenders).toEqual([]);
  });

  it('actually inspected a non-trivial number of assets', () => {
    // Guards against the suite passing because the directory was empty.
    expect(clientFiles(STATIC_DIR).length).toBeGreaterThan(5);
  });
});
