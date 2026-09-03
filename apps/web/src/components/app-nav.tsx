'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { activeTab } from '@/components/active-tab';
import { AccountIcon, ContentIcon, WorkspacesIcon } from '@/components/nav-icons';

const TABS = [
  { key: 'workspaces', href: '/app', label: 'Workspaces', Icon: WorkspacesIcon },
  { key: 'content', href: '/app/content', label: 'Content', Icon: ContentIcon },
  { key: 'account', href: '/app/account', label: 'Account', Icon: AccountIcon },
] as const;

/**
 * Primary navigation. Three destinations: the workspaces that own everything,
 * the content across all of them, and the account.
 *
 * Mobile: fixed bottom bar with safe-area padding. Desktop: inline in the top
 * bar. Same items, same order, same active rules - one structure widened, not
 * two designs.
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
      <ul className="grid grid-cols-3">
        {TABS.map((tab) => {
          const isActive = active === tab.key;

          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={`press flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  isActive ? 'text-accent' : 'text-ink-faint'
                }`}
              >
                {/*
                  Icon carries the active state as fill; the label carries it
                  as colour. Two signals rather than one, because colour alone
                  fails for a colour-blind user and a filled glyph alone is
                  easy to miss at 24px.
                */}
                <tab.Icon active={isActive} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
