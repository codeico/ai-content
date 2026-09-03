import { describe, expect, it } from 'vitest';

import { activeTab } from '../apps/web/src/components/active-tab.ts';

describe('activeTab', () => {
  it.each([
    ['/app', 'workspaces'],
    ['/app/workspaces/550e8400-e29b-41d4-a716-446655440000', 'workspaces'],
    // A content screen nested under a workspace belongs to the Content tab:
    // the user is reading a caption, not managing workspaces. Before the
    // Content tab existed this correctly resolved to 'workspaces'.
    ['/app/workspaces/x/content/y', 'content'],
    ['/app/content', 'content'],
    ['/app/account', 'account'],
    ['/app/account/anything', 'account'],
    ['/login', null],
    ['/', null],
  ] as const)('%s → %s', (path, expected) => {
    expect(activeTab(path)).toBe(expected);
  });
});
