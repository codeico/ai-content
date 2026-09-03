import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Contextual top bar, the way a native app titles a screen.
 *
 * A phone screen has one job and says so in the bar: the title is the screen,
 * and Back points at the parent in the hierarchy — not at history. Browser
 * Back already does history; duplicating it would send a user who arrived by
 * link somewhere they have never been. `backHref` is therefore a route, and
 * the top-level screens simply omit it.
 *
 * On desktop the same bar widens rather than becoming a different component:
 * one layout, one set of states to reason about.
 */
interface AppBarProps {
  title: string;
  /** Parent screen. Omitted on the two root tabs, which have nowhere up to go. */
  backHref?: string;
  /** Accessible name for Back, e.g. "Back to Workspaces". */
  backLabel?: string;
  /** One primary action, right-aligned. More than one belongs in the page. */
  action?: ReactNode;
}

export function AppBar({ title, backHref, backLabel, action }: AppBarProps) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-5 border-b border-line bg-paper/95 backdrop-blur-sm sm:-mx-6">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
        {backHref ? (
          <Link
            href={backHref}
            aria-label={backLabel ?? `Back to ${title}`}
            className="press -ml-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-soft hover:text-ink"
          >
            <ChevronLeft />
          </Link>
        ) : null}

        <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-[-0.01em]">
          {title}
        </h1>

        {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
    </div>
  );
}

/** Inline so the bar needs no icon dependency for one glyph. */
function ChevronLeft() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.5 15.5 7 10l5.5-5.5" />
    </svg>
  );
}
