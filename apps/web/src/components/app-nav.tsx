'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { activeTab } from '@/components/active-tab';

const TABS = [
  { key: 'workspaces', href: '/app', label: 'Workspaces' },
  { key: 'account', href: '/app/account', label: 'Account' },
] as const;

/**
 * Primary navigation. Two destinations, because the product has two: the
 * list of workspaces (content lives inside them) and the account.
 * Mobile: fixed bottom bar with safe-area padding. Desktop: inline in the top bar.
 */
export function AppNav({ placement }: { placement: 'bottom' | 'top' }) {
  const pathname = usePathname();
  const active = activeTab(pathname);

  if (placement === 'top') {
    return (
      <nav aria-label="Primary" className="flex items-center gap-1">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? 'page' : undefined}
            className={
              active === tab.key
                ? 'rounded-control bg-line/70 px-3 py-1.5 text-[14px] font-medium text-ink'
                : 'rounded-control px-3 py-1.5 text-[14px] font-medium text-ink-soft hover:bg-line/50 hover:text-ink'
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Primary"
      className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur-sm md:hidden"
    >
      <ul className="grid grid-cols-2">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={`press flex min-h-14 flex-col items-center justify-center gap-0.5 text-[13px] font-medium ${
                  isActive ? 'text-ink' : 'text-ink-faint'
                }`}
              >
                <span
                  aria-hidden
                  className={`h-0.5 w-6 rounded-full transition-colors ${
                    isActive ? 'bg-accent' : 'bg-transparent'
                  }`}
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
