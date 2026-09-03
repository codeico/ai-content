import { describe, expect, it, vi } from 'vitest';

import {
  CaptionRepositoryError,
  selectCaptionAsActive,
} from '../apps/web/src/server/repositories/caption-repository.ts';

/**
 * Selecting a caption is two writes - archive the old active, then activate
 * the target - because the partial unique index (20260903130000, line 83)
 * permits only one active row per content, so they cannot both be in flight.
 *
 * The failure window is therefore real and deliberate: if the second write
 * fails, the content has NO active caption. That is documented as acceptable,
 * and these tests hold the design to what the comment promises rather than
 * taking its word. Zero active is recoverable by selecting again and never
 * violates the index; two active would violate it.
 *
 * There is no transaction here - PostgREST issues each statement separately -
 * so the ORDER of these three steps is the entire safety property.
 */
interface Step {
  kind: 'verify' | 'archive' | 'activate';
  filters: Record<string, unknown>;
}

/** Replays the real call chain, recording each step and failing where asked. */
function trackingClient(failAt?: 'archive' | 'activate') {
  const steps: Step[] = [];

  function chain() {
    const filters: Record<string, unknown> = {};
    let kind: Step['kind'] = 'verify';

    const self: Record<string, unknown> = {
      select: vi.fn(() => self),
      eq: vi.fn((col: string, val: unknown) => {
        filters[col] = val;
        return self;
      }),
      neq: vi.fn((col: string, val: unknown) => {
        filters[`neq:${col}`] = val;
        return self;
      }),
      update: vi.fn((patch: { status: string }) => {
        kind = patch.status === 'archived' ? 'archive' : 'activate';
        return self;
      }),
      maybeSingle: vi.fn(async () => {
        steps.push({ kind, filters });
        if (kind === 'verify') {
          return { data: { id: 'target', status: 'draft' }, error: null };
        }
        if (failAt === 'activate') {
          return { data: null, error: { message: 'activate failed' } };
        }
        return { data: { id: 'target', status: 'active' }, error: null };
      }),
      // The archive statement is awaited directly, with no .maybeSingle().
      then: (resolve: (r: { error: unknown }) => unknown) => {
        steps.push({ kind, filters });
        return resolve({ error: failAt === 'archive' ? { message: 'archive failed' } : null });
      },
    };

    return self;
  }

  return { client: { from: vi.fn(() => chain()) } as never, steps };
}

const kinds = (steps: Step[]) => steps.map((s) => s.kind);

describe('selecting a caption verifies before it writes', () => {
  it('checks the target exists before archiving anything', async () => {
    const { client, steps } = trackingClient();

    await selectCaptionAsActive(client, 'ws-1', 'content-1', 'target');

    // Archiving first would let a stale page or a tampered id strip the
    // content's active caption and then fail with "not found" - the user
    // loses their selection to an id that was never valid.
    expect(kinds(steps)).toEqual(['verify', 'archive', 'activate']);
  });

  it('writes nothing when the target is not in this workspace and content', async () => {
    const writes: string[] = [];
    const self: Record<string, unknown> = {
      select: vi.fn(() => self),
      eq: vi.fn(() => self),
      neq: vi.fn(() => self),
      update: vi.fn(() => {
        writes.push('write');
        return self;
      }),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };

    const result = await selectCaptionAsActive(
      { from: vi.fn(() => self) } as never,
      'ws-1',
      'content-1',
      'not-mine',
    );

    expect(result).toBeNull();
    expect(writes).toEqual([]);
  });
});

describe('a failure between the two writes leaves zero active, never two', () => {
  it('stops at a failed archive rather than activating on top of it', async () => {
    const { client, steps } = trackingClient('archive');

    await expect(selectCaptionAsActive(client, 'ws-1', 'content-1', 'target')).rejects.toThrow(
      CaptionRepositoryError,
    );

    // Continuing past a failed archive is exactly what produces two active
    // rows, which the partial unique index would then reject anyway.
    expect(kinds(steps)).toEqual(['verify', 'archive']);
  });

  it('surfaces a failed activate instead of reporting success', async () => {
    const { client, steps } = trackingClient('activate');

    await expect(selectCaptionAsActive(client, 'ws-1', 'content-1', 'target')).rejects.toThrow(
      CaptionRepositoryError,
    );

    // Zero active: recoverable by selecting again, and the user is told.
    expect(kinds(steps)).toEqual(['verify', 'archive', 'activate']);
  });
});

describe('each write is scoped so it cannot reach another content row', () => {
  it('archives only this content, and never the caption being selected', async () => {
    const { client, steps } = trackingClient();

    await selectCaptionAsActive(client, 'ws-1', 'content-1', 'target');

    const archive = steps.find((s) => s.kind === 'archive')!.filters;
    expect(archive.workspace_id).toBe('ws-1');
    expect(archive.content_id).toBe('content-1');
    expect(archive.status).toBe('active');
    // Without neq, re-selecting the already-active caption archives it and
    // the content ends up with nothing active.
    expect(archive['neq:id']).toBe('target');
  });

  it('activates by id within the same workspace and content', async () => {
    const { client, steps } = trackingClient();

    await selectCaptionAsActive(client, 'ws-1', 'content-1', 'target');

    const activate = steps.find((s) => s.kind === 'activate')!.filters;
    expect(activate.workspace_id).toBe('ws-1');
    expect(activate.content_id).toBe('content-1');
    expect(activate.id).toBe('target');
  });
});
