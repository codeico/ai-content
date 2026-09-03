/**
 * Route → which primary tab is active. Pure so it can be unit-tested.
 *
 * Three tabs, not two: Content is where the work happens and previously had no
 * top-level entry at all - it was reachable only by opening a workspace first.
 * A bottom bar with two items reads as a leftover, and Material's guidance is
 * three to five destinations.
 */
export type PrimaryTab = 'workspaces' | 'content' | 'account';

export function activeTab(pathname: string): PrimaryTab | null {
  if (pathname === '/app/account' || pathname.startsWith('/app/account/')) return 'account';
  if (pathname === '/app/content' || pathname.startsWith('/app/content/')) return 'content';

  // A content screen nested under a workspace still belongs to Content: the
  // user is reading a caption, not managing workspaces.
  if (/^\/app\/workspaces\/[^/]+\/content(\/|$)/.test(pathname)) return 'content';

  if (pathname === '/app' || pathname.startsWith('/app/workspaces')) return 'workspaces';

  return null;
}
