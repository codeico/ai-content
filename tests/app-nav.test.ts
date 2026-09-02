import { describe, expect, it } from 'vitest';

import { activeTab } from '../apps/web/src/components/active-tab.ts';

describe('activeTab', () => {
  it.each([
    ['/app', 'workspaces'],
    ['/app/workspaces/550e8400-e29b-41d4-a716-446655440000', 'workspaces'],
    ['/app/workspaces/x/content/y', 'workspaces'],
    ['/app/account', 'account'],
    ['/app/account/anything', 'account'],
    ['/login', null],
    ['/', null],
  ] as const)('%s → %s', (path, expected) => {
    expect(activeTab(path)).toBe(expected);
  });
});
