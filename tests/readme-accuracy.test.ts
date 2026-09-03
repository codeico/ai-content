import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The README's "Implemented" list is the only place a reader learns what this
 * product actually does. It drifted once already: four capabilities shipped
 * (content description, caption editing, the generation cap, pagination)
 * while the list still described the state three commits earlier.
 *
 * These tie each claim to something in the code that must exist for it to be
 * true. They cannot prove a feature works — tests elsewhere do that — but they
 * fail when the README describes a product this repository is not.
 */
const ROOT = process.cwd();
const README = readFileSync(join(ROOT, 'README.md'), 'utf8');

function migrations(): string {
  return readdirSync(join(ROOT, 'supabase/migrations')).join('\n');
}

function source(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

describe('README claims match the code', () => {
  it('claims caption generation only while a caller of packages/ai exists', () => {
    expect(README).toMatch(/AI caption generation/);
    // The claim is false the moment nothing imports the provider.
    expect(
      source(
        'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/caption-actions.ts',
      ),
    ).toMatch(/createAIProvider/);
  });

  it('claims content description only while the column and prompt use exist', () => {
    expect(README).toMatch(/Content description/);
    expect(migrations()).toMatch(/add_content_description/);
    expect(source('apps/web/src/server/ai/caption-prompt.ts')).toMatch(/description/);
  });

  it('claims caption editing only while the action exists', () => {
    expect(README).toMatch(/Caption editing/);
    expect(
      source(
        'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/caption-actions.ts',
      ),
    ).toMatch(/export async function editCaption/);
  });

  it('claims write-once provenance only while the trigger migration exists', () => {
    expect(README).toMatch(/write-once/);
    expect(migrations()).toMatch(/captions_immutable_columns/);
  });

  it('claims a generation cap that matches the shared constant', () => {
    const cap = source('packages/shared/src/content/caption.ts').match(
      /CAPTION_MAX_VERSIONS = (\d+)/,
    )?.[1];

    expect(cap).toBeDefined();
    expect(README).toContain(`capped at ${cap}`);
  });

  it('claims a page size that matches the repository', () => {
    const size = source('apps/web/src/server/repositories/content-repository.ts').match(
      /CONTENT_PAGE_SIZE = (\d+)/,
    )?.[1];

    expect(size).toBeDefined();
    expect(README).toContain(`(${size} per page)`);
  });

  it('does not claim a capability that is still credential-blocked', () => {
    // These need credentials this repository has never had. If one appears in
    // the implemented list, either it was really built or the README overclaims.
    const implemented = README.slice(README.indexOf('**Implemented'), README.indexOf('**Planned'));

    expect(implemented).not.toMatch(/Instagram publishing/i);
    expect(implemented).not.toMatch(/media processing/i);
    expect(implemented).not.toMatch(/background jobs/i);
  });
});

describe('the README does not claim the PWA before it exists', () => {
  it('claims an installable PWA only while the worker and manifest fields exist', () => {
    expect(README).toMatch(/Installable PWA/);

    // The three things that make the claim true, not just the word "PWA".
    expect(existsSync(join(process.cwd(), 'apps/web/public/sw.js'))).toBe(true);
    expect(source('apps/web/src/app/manifest.ts')).toMatch(/id: '\/app'/);
    expect(existsSync(join(process.cwd(), 'apps/web/public/icon-maskable-512.png'))).toBe(true);
  });

  it('claims an offline fallback only while the page exists', () => {
    expect(README).toMatch(/offline fallback/i);
    expect(existsSync(join(process.cwd(), 'apps/web/src/app/offline/page.tsx'))).toBe(true);
  });

  it('claims the bottom navigation only while it has three tabs', () => {
    expect(README).toMatch(/three-tab bottom\s+navigation/);

    const nav = source('apps/web/src/components/app-nav.tsx');
    const tabs = nav.match(/\{ key: '/g) ?? [];
    expect(tabs).toHaveLength(3);
  });

  it('stops listing the PWA as planned', () => {
    const planned = README.slice(README.indexOf('**Planned (later phases)**'));

    // Listing a shipped feature as planned is the same defect as the reverse.
    expect(planned).not.toMatch(/\bPWA\b/);
  });

  it('records the Instagram storage prerequisite where someone planning would look', () => {
    expect(README).toMatch(/INSTAGRAM_FEASIBILITY/);
    expect(existsSync(join(process.cwd(), 'docs/INSTAGRAM_FEASIBILITY.md'))).toBe(true);
  });
});
