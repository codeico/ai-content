/** Route → which primary tab is active. Pure so it can be unit-tested. */
export function activeTab(pathname: string): 'workspaces' | 'account' | null {
  if (pathname === '/app/account' || pathname.startsWith('/app/account/')) return 'account';
  if (pathname === '/app' || pathname.startsWith('/app/workspaces')) return 'workspaces';
  return null;
}
