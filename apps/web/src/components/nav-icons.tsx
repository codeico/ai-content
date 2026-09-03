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
 *
 * Silhouettes are deliberately different masses. A four-square grid and a
 * portrait document read as the same block at 24px, so Workspaces is a layers
 * glyph (stacked planes, distinct outline) and the document carries only two
 * inner lines - three smudge once the active fill is applied.
 */
interface IconProps {
  /** Active tabs render filled; inactive render as outlines. */
  active?: boolean;
}

const BASE = 'h-6 w-6';
const FILL_OPACITY = 0.16;

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
      fillOpacity={active ? FILL_OPACITY : 0}
    >
      {/* Layers: several workspaces stacked, one on top. */}
      <path d="M12 3.5 3.5 8l8.5 4.5L20.5 8 12 3.5Z" />
      <path d="M3.5 12.5 12 17l8.5-4.5" fill="none" />
      <path d="M3.5 17 12 21.5l8.5-4.5" fill="none" />
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
      fillOpacity={active ? FILL_OPACITY : 0}
    >
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M8 9h8M8 14h5" fill="none" />
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
      fillOpacity={active ? FILL_OPACITY : 0}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.6-3.6 4.2-5.5 7.5-5.5s5.9 1.9 7.5 5.5" fill="none" />
    </svg>
  );
}
