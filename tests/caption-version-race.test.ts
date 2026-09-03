import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  CaptionRepositoryError,
  insertEditedCaptionVersion,
  insertNextCaptionVersion,
  isUniqueViolation,
} from '../apps/web/src/server/repositories/caption-repository.ts';

/**
 * Two writers computing MAX(version) + 1 at the same moment pick the same
 * number. UNIQUE(content_id, version) (20260903130000, line 62) rejects the
 * loser with 23505, and the fix is to re-read MAX and insert again.
 *
 * The retry used to live in generateCaption only, so a lost race discarded
 * text a person had typed into the edit form while recovering a model output
 * that could simply be regenerated — backwards, since only one of those is
 * irreplaceable. It now lives in the repository, where every caller inherits
 * it.
 */
type Row = Record<string, unknown>;

/** Minimal Supabase double: fails the insert `failures` times with 23505. */
function clientThatLosesRaces(failures: number) {
  let inserts = 0;
  let maxVersion = 3;

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: { version: maxVersion }, error: null })),
    insert: vi.fn((row: Row) => {
      inserts += 1;
      const attempt = inserts;
      return {
        select: () => ({
          single: async () => {
            if (attempt <= failures) {
              // Someone else took this version between our read and write.
              maxVersion += 1;
              return { data: null, error: { code: '23505', message: 'duplicate key' } };
            }
            return { data: { ...row, id: 'new-caption' }, error: null };
          },
        }),
      };
    }),
  };

  return {
    client: { from: vi.fn(() => builder) } as never,
    builder,
    get inserts() {
      return inserts;
    },
  };
}

const CAPTION = {
  body: 'a caption',
  model_name: 'test-model',
  prompt_version: 'caption-v2',
  created_by: '00000000-0000-4000-8000-000000000001',
};

describe('a lost version race is retried once', () => {
  it('recovers a generated caption', async () => {
    const supabase = clientThatLosesRaces(1);

    const saved = await insertNextCaptionVersion(supabase.client, 'ws-1', 'content-1', CAPTION);

    expect(saved.id).toBe('new-caption');
    expect(supabase.inserts).toBe(2);
  });

  it('recovers an edited caption, which carries text a person typed', async () => {
    const supabase = clientThatLosesRaces(1);

    const saved = await insertEditedCaptionVersion(supabase.client, 'ws-1', 'content-1', {
      body: 'text the user typed',
      created_by: CAPTION.created_by,
      derived_from_prompt_version: 'caption-v2',
    });

    expect(saved.id).toBe('new-caption');
    expect(supabase.inserts).toBe(2);
  });

  it('re-reads MAX(version) before retrying instead of reusing the taken number', async () => {
    const supabase = clientThatLosesRaces(1);

    await insertNextCaptionVersion(supabase.client, 'ws-1', 'content-1', CAPTION);

    const versions = supabase.builder.insert.mock.calls.map((c) => (c[0] as Row).version);
    expect(versions).toEqual([4, 5]);
  });
});

describe('the retry is bounded', () => {
  it('gives up after one retry rather than looping', async () => {
    // A second collision means sustained concurrent writes to one content row.
    // Re-reading MAX forever would be a livelock, not a fix.
    const supabase = clientThatLosesRaces(2);

    const error = await insertNextCaptionVersion(
      supabase.client,
      'ws-1',
      'content-1',
      CAPTION,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CaptionRepositoryError);
    expect(isUniqueViolation((error as CaptionRepositoryError).cause)).toBe(true);
    expect(supabase.inserts).toBe(2);
  });

  it('does not retry an error that is not a version collision', async () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: { version: 1 }, error: null })),
      insert: vi.fn(() => ({
        select: () => ({
          single: async () => ({ data: null, error: { code: '42501', message: 'denied' } }),
        }),
      })),
    };
    const client = { from: vi.fn(() => builder) } as never;

    await expect(insertNextCaptionVersion(client, 'ws-1', 'content-1', CAPTION)).rejects.toThrow(
      CaptionRepositoryError,
    );
    // An RLS denial does not become permitted by trying twice.
    expect(builder.insert).toHaveBeenCalledTimes(1);
  });
});

describe('the retry is not duplicated at the call site', () => {
  const ACTIONS = readFileSync(
    join(
      process.cwd(),
      'apps/web/src/app/app/workspaces/[workspaceId]/content/[contentId]/caption-actions.ts',
    ),
    'utf8',
  );

  it('generateCaption does not wrap the insert in its own retry', () => {
    // Two layers of retry would mean four inserts against a contended row.
    expect(ACTIONS).not.toMatch(/isUniqueViolation/);
  });
});
