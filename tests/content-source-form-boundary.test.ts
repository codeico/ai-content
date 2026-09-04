import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
  join(
    process.cwd(),
    'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/edit-source-form.tsx',
  ),
  'utf8',
);
const ACTION = readFileSync(
  join(process.cwd(), 'apps/web/src/app/app/workspaces/[workspaceId]/content-actions.ts'),
  'utf8',
);

describe('source editing cannot write system-owned media state', () => {
  it('has no media_status field, select, or hidden input', () => {
    expect(SOURCE).not.toContain('name="media_status"');
    expect(SOURCE).not.toContain('OWNER_SETTABLE_MEDIA_STATUSES');
    expect(SOURCE).not.toContain('mediaStatusLocked');
  });

  it('the Server Action never reads media_status from form data', () => {
    const body = ACTION.slice(
      ACTION.indexOf('export async function updateContentSource'),
      ACTION.indexOf('export async function deleteContent'),
    );
    expect(body).not.toContain("formData.get('media_status')");
    expect(body).not.toContain('storageOwned');
  });
});
