import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  listWorkspacesForUser,
  WORKSPACE_LIST_LIMIT,
} from '../apps/web/src/server/repositories/workspace-repository.ts';
import { createMockClient, MockQueryBuilder } from './helpers/mock-supabase.ts';

/**
 * Every list query must be bounded. The content list was unbounded until it was
 * paginated; this pins that the others are bounded too, and that no NEW
 * unbounded list can appear unnoticed.
 *
 * The workspace list matters more than its size suggests: its membership query
 * feeds an `.in(...)` filter built from its own result, so without a limit the
 * QUERY grows with the data, not just the response.
 */
const USER = 'user-1';

describe('listWorkspacesForUser is bounded', () => {
  it('limits the membership query that feeds the .in() filter', async () => {
    const members = new MockQueryBuilder({ data: [], error: null });
    const { client } = createMockClient({ workspace_members: members });

    await listWorkspacesForUser(client, USER);

    const limit = members.calls.find((c) => c.method === 'limit')?.args[0];
    expect(limit).toBe(WORKSPACE_LIST_LIMIT);
  });

  it('scopes the membership query to the caller', async () => {
    const members = new MockQueryBuilder({ data: [], error: null });
    const { client } = createMockClient({ workspace_members: members });

    await listWorkspacesForUser(client, USER);

    expect(members.calls).toContainEqual({ method: 'eq', args: ['user_id', USER] });
  });
});

describe('no list query is unbounded', () => {
  const REPOS = join(process.cwd(), 'apps/web/src/server/repositories');

  /**
   * A list function is bounded if it calls .limit(), or is bounded elsewhere by
   * a documented invariant. Captions are capped per content item, so their list
   * cannot grow without bound; that exemption is named here rather than assumed.
   */
  const BOUNDED_ELSEWHERE = new Set(['listCaptionsForContent']);

  it('every list* repository function limits its rows', () => {
    const unbounded: string[] = [];

    for (const file of readdirSync(REPOS).filter((f) => f.endsWith('.ts'))) {
      const text = readFileSync(join(REPOS, file), 'utf8');

      for (const match of text.matchAll(/export async function (list\w+)/g)) {
        const name = match[1]!;
        if (BOUNDED_ELSEWHERE.has(name)) continue;

        // Body runs to the next top-level export or end of file.
        const start = match.index!;
        const rest = text.slice(start + 1);
        const nextExport = rest.indexOf('\nexport ');
        const body = nextExport === -1 ? rest : rest.slice(0, nextExport);

        if (!body.includes('.limit(')) {
          unbounded.push(`${file}:${name}`);
        }
      }
    }

    // A new unbounded list means one workspace's data can dominate a request.
    expect(unbounded).toEqual([]);
  });

  it('names its exemption rather than hiding it', () => {
    // If captions ever lose their per-content cap, this exemption is wrong.
    const caption = readFileSync(
      join(process.cwd(), 'packages/shared/src/content/caption.ts'),
      'utf8',
    );
    expect(caption).toMatch(/CAPTION_MAX_VERSIONS/);
  });
});
