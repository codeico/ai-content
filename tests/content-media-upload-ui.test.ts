import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const COMPONENT = join(
  ROOT,
  'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/media-upload-form.tsx',
);
const PAGE = readFileSync(
  join(ROOT, 'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/page.tsx'),
  'utf8',
);

function source(): string {
  return readFileSync(COMPONENT, 'utf8');
}

describe('content media upload UI', () => {
  it('accepts only the two Reels-ready video types', () => {
    const code = source();
    expect(code).toContain('video/mp4,video/quicktime,.mp4,.mov');
    expect(code).not.toMatch(/image\/\*/);
  });

  it('does not submit the File through a Server Action or Next.js', () => {
    const code = source();
    expect(code).toContain('performContentMediaUpload(file');
    expect(code).toContain('uploadContentMediaFile(supabase, ticket, selected)');
    expect(code).not.toMatch(/formData\.set\([^,]+,\s*file/);
  });

  it('has honest uploading, success and error feedback', () => {
    const code = source();
    expect(code).toContain("'Uploading…'");
    expect(code).toContain("'Video uploaded.'");
    expect(code).toContain('role="alert"');
    expect(code).toContain('role="status"');
  });

  it('never offers an overwrite when media is already available', () => {
    const code = source();
    expect(code).toContain("mediaStatus === 'available'");
    expect(code).toContain('A stored video is ready.');
    expect(code).not.toContain('Replace video');
  });

  it('lets a member remove an available video without sending its storage key', () => {
    const code = source();
    expect(code).toContain('removeUpload: () => Promise<ConfirmMediaUploadResult>');
    expect(code).toContain("mediaStatus === 'available'");
    expect(code).toContain('Remove video');
    expect(code).toContain('await removeUpload()');
    expect(code).not.toMatch(/removeUpload\([^)]*storageKey/);
  });

  it('lets a member cancel a temporary reservation instead of being stuck with its extension', () => {
    const code = source();
    expect(code).toContain("mediaStatus === 'temporary'");
    expect(code).toContain('Choose the same file type to retry');
    expect(code).toContain('Cancel reservation');
  });

  it('is wired into the authenticated content detail page with bound ids', () => {
    expect(PAGE).toContain(
      "from '@/app/app/workspaces/[workspaceId]/content/[contentId]/media-actions'",
    );
    expect(PAGE).toContain(
      "from '@/app/app/workspaces/[workspaceId]/content/[contentId]/media-upload-form'",
    );
    expect(PAGE).toContain('requestContentMediaUpload.bind(null, workspace.id, content.id)');
    expect(PAGE).toContain('confirmContentMedia.bind(null, workspace.id, content.id)');
    expect(PAGE).toContain('removeContentMediaUpload.bind(null, workspace.id, content.id)');
    expect(PAGE).toContain('<MediaUploadForm');
  });

  it('renders available media from a server-created signed URL, never the storage key', () => {
    expect(PAGE).toContain('createContentMediaReadUrl(supabase, content.storage_key)');
    expect(PAGE).toMatch(/<video[\s\S]*src=\{mediaUrl\}/);
    expect(PAGE).toMatch(/controls/);
    expect(PAGE).toMatch(/preload="metadata"/);
    expect(PAGE).not.toMatch(/src=\{content\.storage_key\}/);
    expect(source()).not.toContain('storageKey');
  });
});
