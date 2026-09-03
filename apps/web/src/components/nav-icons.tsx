/**
 * Navigation glyphs.
 *
 * Inline SVG rather than an icon package: three glyphs do not justify a
 * dependency, and these need to switch between stroke and fill to mark the
 * active tab the way a native tab bar does.
 *
 * One family, one stroke width (1.75), one corner treatment - mixing icon
 * sets is the fastest way to make an interface look assembled rather than
 * designed.
 */
interface IconProps {
  /** Active tabs render filled; inactive render as outlines. */
  active?: boolean;
}

const BASE = 'h-6 w-6';

export function WorkspacesIcon({ active }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={BASE}
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      fillOpacity={active ? 0.16 : 0}
    >
      <rect x="3" y="4" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="4" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="14.5" width="7.5" height="5.5" rx="2" />
      <rect x="13.5" y="14.5" width="7.5" height="5.5" rx="2" />
    </svg>
  );
}

export function ContentIcon({ active }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={BASE}
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      fillOpacity={active ? 0.16 : 0}
    >
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M8 8h8M8 12h8M8 16h4" fill="none" />
    </svg>
  );
}

export function AccountIcon({ active }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={BASE}
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      fillOpacity={active ? 0.16 : 0}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.6-3.6 4.2-5.5 7.5-5.5s5.9 1.9 7.5 5.5" fill="none" />
    </svg>
  );
}
