# Frontend

Phase 5 turned the CRUD screens into a product shell that is designed for a
phone first and holds up on a desktop. Nothing about server-side authorization
changed: pages and Server Actions still verify the session and workspace
membership on the server, and RLS remains the backstop.

## Taste Skill integration

Source: https://github.com/Leonxlnx/taste-skill (MIT).

Inspected: `README.md`, `.claude-plugin/plugin.json`, `skills/*/SKILL.md`,
`examples/`. The repo ships portable `SKILL.md` files for coding agents. Hermes
loads skills from `~/.hermes/skills/<category>/<name>/SKILL.md`, so the three
relevant skills were copied verbatim into a `taste-skill` category:

```text
~/.hermes/skills/taste-skill/taste-skill/SKILL.md        (design-taste-frontend, v2)
~/.hermes/skills/taste-skill/redesign-skill/SKILL.md     (redesign-existing-projects)
~/.hermes/skills/taste-skill/minimalist-skill/SKILL.md   (minimalist-ui)
~/.hermes/skills/taste-skill/LICENSE
```

The image-generation, brutalist, soft, stitch, and output skills were not
imported: they target landing pages, image boards, or unrelated aesthetics.

Design read (the skill's required first step): *redesign of an existing product
UI for a solo operator running several niche workspaces on a phone; calm,
editorial-utilitarian language; Tailwind v4 utilities, Geist + Geist Mono,
restrained motion.* Dials: VARIANCE 4, MOTION 3, DENSITY 5.

Principles applied, with where to see them:

| Principle (skill section)                           | Where                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Typography refresh first (redesign 11.D lever 1)    | `app/layout.tsx`: Geist + Geist Mono via `next/font`, tight tracking on titles                 |
| Neutral base, one accent, saturation < 80% (4.2)    | `globals.css` tokens: warm stone palette, single green accent that is also the "ready" colour  |
| Color consistency lock (4.2)                        | Accent used for focus, active tab, ready status, success notice; nothing else                  |
| Cards only when elevation means something (4.4)     | No cards. Lists use `border-t` / `border-b` rows; forms sit under a hairline                   |
| Shape consistency lock (4.4)                        | Two radii only: 6px controls, 8px surfaces                                                     |
| Label above input, error below, no placeholder-label (4.6) | `components/ui.tsx` `Field`                                                              |
| Full state cycles (4.5)                             | `app/app/loading.tsx` skeleton, `app/app/error.tsx`, `not-found.tsx`, `EmptyState`, inline errors |
| Tactile press feedback (4.5)                        | `.press` utility, translateY(1px) on `:active`                                                 |
| Reduced motion (6.B)                                | `@media (prefers-reduced-motion: reduce)` kills the entry animation and press transform        |
| No `window.alert` / confirm (redesign: Interactivity) | `components/confirm-delete.tsx` inline two-step confirm                                      |
| Em-dash ban (9.G)                                   | No em or en dashes in any visible UI string                                                    |
| No eyebrows / section numbering / status dots (9.F) | None used; the active-tab indicator is the only mark, and it conveys state                     |
| Sentence case, plain copy, no clichés (Content)     | "Nothing here yet", "Create draft", "You do not have access to this workspace."                |
| Skip link, back navigation, custom 404 (Strategic Omissions) | `app/app/layout.tsx` skip link, breadcrumb eyebrow link on every subpage, `not-found.tsx` |
| Preserve IA, slugs, form field names (11.C)         | Routes and `name=` attributes unchanged from Phase 3                                           |

The skill's landing-page rules (hero stack, bento rhythm, GSAP skeletons) do
not apply to a product UI and were deliberately not used.

## Design direction

- Light, warm stone canvas (`#f6f5f2`) with near-black ink; no dark mode yet
  (single theme locked per 4.11; dark mode is a follow-up, not a default).
- Typography does the hierarchy: 26/30px semibold titles, 15-17px body,
  13px metadata, tabular numerals for counts.
- Colour communicates state only: green = ready / active / success,
  amber = draft, muted = archived, rust = destructive.
- Motion: one 320ms entry rise on page content, colour transitions on hover,
  1px press. Nothing loops.

## Information architecture

```text
/                      Front door (public)
/login, /signup        Auth (shared CredentialForm)
/app                   Workspaces list + create          ─┐ tab: Workspaces
/app/workspaces/[id]   Workspace overview: content list,  │
                       create draft, owner settings       │
/app/workspaces/[id]/content/[cid]                        │
                       Content detail: edit, pipeline     │
                       placeholder, metadata, delete     ─┘
/app/account           Email + sign out                    tab: Account
```

Two primary destinations, so two tabs. Content is reached through its
workspace; there is no global content view because content is always
workspace-scoped.

## Responsive strategy

- Under `md` (768px): sticky top bar with wordmark only, fixed bottom tab bar
  (57px + safe-area), single column, full-width buttons, `main` reserves
  `pb-24` so nothing hides under the tabs.
- `md` and up: tabs move into the top bar, pages become a two-column grid
  (`minmax(0,1fr) 320px`): list on the left, create form / settings on the
  right. Content max width 1024px. Exception: the content detail page keeps a
  single column until `lg` (1024px) — at 768px its main column would be ~337px
  and the Source form inputs overflowed.
- `viewport-fit=cover` plus `env(safe-area-inset-*)` on `html` and the tab bar.
- All interactive targets are at least 44px tall (measured at 360/390/414).

## PWA readiness

- `app/manifest.ts`: name, `start_url: /app`, `display: standalone`, theme and
  background colour, 192/512 PNG icons.
- `app/icon.svg` (favicon) and `app/apple-icon.png` (180px).
- `metadata.appleWebApp` and `viewport.themeColor` in the root layout.
- No service worker, no offline cache, no push. Installable from Safari / Chrome
  "Add to Home Screen"; behaves as a normal online web app once installed.

## Component architecture

```text
components/ui.tsx            Button, ButtonLink, Field, Input, Select, Notice,
                             StatusMark, EmptyState, PageHeader (the design system)
components/app-nav.tsx       AppNav (bottom tabs / top links)
components/active-tab.ts     activeTab(pathname) pure helper (tested)
components/confirm-delete.tsx Inline two-step destructive confirm
app/app/layout.tsx           AppShell: auth gate + top bar + main + bottom nav
app/app/loading.tsx          Skeleton matching the list pages
app/app/error.tsx            Route error boundary with retry
app/not-found.tsx            404
```

Per-route forms (`create-workspace-form`, `rename-workspace-form`,
`create-content-form`, `edit-content-form`, delete buttons) are unchanged in
responsibility and now compose the primitives above.

## Mobile and desktop verification

Run against the dev server with a clean Playwright Chromium and a temporary
Supabase user (created and deleted via the service role; nothing left behind).

| Viewport     | Checked                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| 360x780      | content detail, inline delete confirm fits and focuses Cancel, delete redirects to list, account, sign out, protected redirect, login validation |
| 390x844      | login, workspaces empty state, create workspace, create content with a 70-char title, edit title+status re-renders, rename workspace re-renders |
| 414x896      | landing, bottom nav shown, top nav hidden, single column                                                     |
| 768x1024     | bottom nav hidden, top nav shown, two columns                                                                |
| 1280x800     | two columns 608/320, header 57px, content detail, validation error, delete workspace cascades                |

Every measurement reported `scrollWidth === clientWidth` (no horizontal
overflow) and zero interactive elements under 44px. `prefers-reduced-motion`
was emulated and the entry animation resolved to `none`. Geist loaded
(`document.fonts` status `loaded`). Focus outline on buttons and inputs
computed to the accent colour. Contrast of every text token against the canvas
is at least 4.8:1 (ink 15.8, soft 7.05, faint 4.80, accent 5.77, warn 5.42,
danger 6.38).

One pre-existing bug surfaced by the new UI and fixed at the root:
`updateWorkspace` and `updateContent` returned `{}` without refreshing, so the
page header kept the old title after a rename. Both now call `refresh()` from
`next/cache` on success.
