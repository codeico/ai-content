import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const BROWSER_ENV = readFileSync(join(process.cwd(), 'packages/shared/src/env/browser.ts'), 'utf8');
const UPLOAD_FORM = readFileSync(
  join(
    process.cwd(),
    'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/media-upload-form.tsx',
  ),
  'utf8',
);

describe('browser environment boundary', () => {
  it('uses static NEXT_PUBLIC reads that Next.js can inline', () => {
    expect(BROWSER_ENV).toContain('NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL');
    expect(BROWSER_ENV).toContain(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
    expect(BROWSER_ENV).not.toMatch(/source:\s*BrowserEnvSource\s*=\s*process\.env/);
  });

  it('constructs the browser client inside the upload error boundary', () => {
    expect(UPLOAD_FORM).not.toContain('const supabase = createSupabaseBrowserClient()');
    expect(UPLOAD_FORM).toMatch(
      /upload:\s*\(ticket, selected\)\s*=>\s*uploadContentMediaFile\(createSupabaseBrowserClient\(\),\s*ticket,\s*selected\)/,
    );
  });
});
