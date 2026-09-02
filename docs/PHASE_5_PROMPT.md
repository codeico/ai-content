# PHASE 5 — FRONTEND-FIRST MOBILE PRODUCT EXPERIENCE

You are working inside the existing `ai-content` repository.

Repository:

`/Users/bangico/ai-content`

Current completed phases:

* PHASE 0 — Foundation
* Architecture Alignment — Generic OpenAI-Compatible AI Router
* PHASE 1 — Authentication
* PHASE 2 — Workspace Domain
* PHASE 3 — Content Domain
* PHASE 4 — AI Router Foundation

Latest completed commit before this phase:

`bbfe5c9`

PHASE 4 may have additional uncommitted work depending on the previous execution.

---

# PRIMARY OBJECTIVE

Build the **frontend experience first** so the application can be opened and meaningfully tested on a real mobile phone.

The goal of this phase is NOT to build the backend automation pipeline.

The goal is to make `ai-content` feel like a real, polished mobile-first product rather than an internal CRUD demo.

The frontend must be:

* mobile-first
* responsive
* installable/PWA-ready where appropriate
* visually distinctive
* production-quality
* fast
* touch-friendly
* accessible
* coherent across screens
* designed as an actual product

The existing authentication, workspace, and Content functionality should remain functional.

---

# CRITICAL DESIGN REQUIREMENT

You MUST use:

`https://github.com/Leonxlnx/taste-skill`

as a design/development skill reference.

Do not merely mention the repository.

Actually inspect and use the skill.

First inspect:

* repository README
* `skills/`
* `.claude-plugin/`
* relevant design/frontend instructions
* examples
* any installation or usage instructions

Determine the correct way to make the skill available to Hermes.

If the skill is compatible with Hermes's skill system, install/import it appropriately.

If direct installation is not supported, copy/adapt the relevant skill instructions into the project's own development skill/instructions without blindly duplicating unrelated material.

Document what was done.

The resulting UI must clearly demonstrate that the skill's principles were actually followed.

---

# TASTE / ANTI-AI-SLOP REQUIREMENT

This is a hard requirement.

Do NOT produce a generic AI-generated SaaS dashboard.

Avoid:

* generic purple gradients
* excessive glassmorphism
* meaningless gradient blobs
* giant centered hero sections
* default shadcn-looking screens
* excessive rounded cards
* every element inside a card
* uniform 3-column dashboard grids
* generic "Welcome back!" dashboards
* stock dashboard layouts
* excessive badges
* decorative icons without purpose
* fake metrics
* fake charts
* unnecessary animations
* oversized headings with little information
* visual noise
* excessive shadows
* arbitrary gradients
* "AI startup" visual clichés
* copying common Vercel/Linear/Notion dashboard patterns without a reason

Do NOT design something that merely looks impressive in a screenshot.

Design something that feels like a real product someone would actually use every day.

---

# DESIGN BEFORE CODE

Before implementing the UI:

1. Study the existing product specification.
2. Study the existing routes and domain model.
3. Study the Taste Skill.
4. Identify the core user workflow.
5. Define a visual direction.
6. Define typography.
7. Define spacing rhythm.
8. Define color system.
9. Define component hierarchy.
10. Define mobile navigation.
11. Define interaction patterns.
12. Then implement.

Do not start by generating random components.

---

# PRODUCT CONTEXT

The application is an automated content-management platform.

A user may eventually operate multiple niche/brand workspaces such as:

* Coding
* Trading
* Business
* Technology
* Other niches

Therefore:

```text
User
  └── Multiple Workspaces
        └── Content
```

Do NOT assume:

```text
User = one Instagram account
```

A workspace represents a distinct content operation / niche / brand context.

The frontend should communicate this naturally.

---

# MOBILE-FIRST PRIORITY

The primary target is a phone.

The interface must be designed for approximately:

* 360px
* 375px
* 390px
* 414px

before optimizing for desktop.

Test at least:

* iPhone-sized viewport
* Android-sized viewport
* tablet-ish width
* desktop width

Do not build desktop first and then shrink it.

---

# MOBILE NAVIGATION

Design an intentional mobile navigation system.

Likely areas:

* Home / Overview
* Content
* Workspace
* Settings

But do NOT blindly implement these names.

Choose the navigation based on the actual product information architecture.

The navigation should:

* be thumb-friendly
* have clear active state
* not obscure content
* respect safe-area insets
* work with iOS Safari
* work when installed as a PWA
* avoid excessive height

Do not create five or six navigation items just because there is space.

---

# RESPONSIVE DESKTOP

Desktop should feel like the same product, not a completely different application.

Use responsive layout changes intentionally.

Examples:

Mobile:

```text
bottom navigation
single-column content
compact headers
full-width actions
```

Desktop:

```text
sidebar/navigation
wider content area
appropriate multi-column layouts
persistent workspace context
```

Do not simply stretch the mobile layout to desktop.

---

# EXISTING FUNCTIONALITY

Preserve and improve the existing:

## Authentication

* Login
* Signup
* Logout
* Authenticated route protection

## Workspaces

* List workspaces
* Create workspace
* Open workspace
* Rename workspace
* Delete workspace

## Content

* List content
* Create content
* Open content
* Edit content
* Delete content
* Status:

  * draft
  * ready
  * archived

Do not break existing server-side authorization.

Do not move security logic into the client.

---

# FRONTEND INFORMATION ARCHITECTURE

Create a coherent product shell around the existing functionality.

At minimum, provide polished experiences for:

## 1. Authentication

Login and signup should feel like part of the same product.

Do not use a generic auth template.

Include:

* clear hierarchy
* useful empty/loading/error states
* mobile-friendly forms
* accessible validation
* appropriate keyboard behavior

---

## 2. Workspace Overview

Create a proper workspace-level experience.

The user should immediately understand:

* which workspace they are in
* what content exists
* what needs attention
* how to create content
* where they are in the product

Do not invent fake analytics.

Use only real data currently available.

If a metric does not exist, do not fabricate it.

---

## 3. Content Experience

Make Content feel like the central product object.

Design:

* content list
* empty state
* create flow
* content detail
* edit flow
* delete flow
* status presentation

The UI should make the lifecycle obvious without overwhelming the user.

---

# FUTURE FEATURES — VISUAL PLACEHOLDERS ONLY

The product will eventually support:

* TikTok discovery
* source videos
* AI analysis
* AI captions
* media processing
* Instagram publishing
* scheduling
* automation

DO NOT IMPLEMENT these systems yet.

However, the frontend architecture may reserve appropriate visual space for the future workflow if it improves the product design.

For example:

```text
Content
 ├── Source
 ├── Creative
 ├── Caption
 └── Publish
```

But these must NOT pretend to be functional.

If something is not implemented, clearly show it as unavailable / coming later rather than creating fake functionality.

Do not add fake backend calls.

---

# DESIGN SYSTEM

Create or refine a coherent design system using the project's existing Tailwind/shadcn infrastructure where appropriate.

But do not let the component library dictate the visual identity.

The design system should define:

* typography
* spacing
* radii
* borders
* surfaces
* buttons
* inputs
* navigation
* cards where genuinely useful
* dialogs
* sheets
* status indicators
* loading states
* empty states
* error states

Avoid excessive component abstraction.

Only create components that represent real reusable patterns.

---

# TYPOGRAPHY

Typography is part of the product identity.

Do not default to the most generic SaaS typography treatment.

Choose typography intentionally based on the Taste Skill and product character.

Create a clear hierarchy:

* display/title
* section title
* body
* metadata
* labels
* navigation

Avoid using huge font sizes merely to make the interface look "designed."

---

# COLOR

Choose a deliberate visual identity.

Do not default to:

```text
purple + indigo + gradient
```

unless the design research genuinely supports it.

Use color to communicate:

* hierarchy
* state
* interaction
* brand
* attention

not decoration.

Ensure accessible contrast.

---

# MOTION

Use motion sparingly and intentionally.

Good candidates:

* page transitions
* sheet/dialog appearance
* navigation state
* content creation feedback
* status changes
* loading

Avoid:

* constant floating animations
* excessive parallax
* decorative bouncing
* animations that slow down interaction

Respect:

```text
prefers-reduced-motion
```

---

# MOBILE UX DETAILS

Pay special attention to:

* 44px+ touch targets
* safe-area insets
* sticky controls where useful
* keyboard overlap
* scrolling behavior
* bottom navigation
* modal/sheet behavior
* form usability
* text wrapping
* long content titles
* loading states
* network failure states
* empty states

Do not rely on hover for essential functionality.

---

# PWA READINESS

The user wants to test the application from a phone.

Make the frontend PWA-ready.

Inspect the existing application before adding anything.

If PWA infrastructure is not yet present, implement only the safe frontend foundation necessary for installation/testing, such as:

* manifest
* icons if appropriate and available
* theme metadata
* viewport configuration
* mobile web behavior

Do NOT implement:

* push notification backend
* notification queues
* background workers
* offline synchronization
* complex service-worker architecture

unless already present and required.

Keep PWA work intentionally minimal in this phase.

---

# REAL DATA ONLY

Do not populate the UI with fake production metrics.

For development/demo purposes, if empty states need visual content, use clearly identified seed/demo data only if it does not interfere with the real user's data.

Prefer real Supabase data.

Do not create fake:

* views
* likes
* followers
* revenue
* AI scores
* publishing statistics
* automation statistics

unless those domains actually exist.

---

# ACCESSIBILITY

The UI must support:

* keyboard navigation
* visible focus
* semantic HTML
* accessible labels
* proper button/link semantics
* sufficient contrast
* reduced motion
* screen-reader-friendly states

Do not use clickable `div`s where buttons/links are appropriate.

---

# PERFORMANCE

Keep the frontend lightweight.

Avoid adding large dependencies merely for visual effects.

Prefer:

* CSS
* existing Tailwind utilities
* existing component primitives
* small focused components

Do not add a UI framework on top of the existing stack.

---

# ICONS

Use the existing icon library if present.

Icons must communicate meaning.

Do not put icons beside every piece of text just for decoration.

---

# IMAGES / ASSETS

Do not introduce random stock images merely to fill space.

If imagery is useful, use intentional assets.

Do not use placeholder illustrations that make the product feel like a template.

---

# ERROR / LOADING / EMPTY STATES

Every major screen should have intentional states for:

* loading
* empty
* error
* success
* destructive action confirmation

Do not leave browser-default errors as the primary UX.

---

# SECURITY BOUNDARY

The frontend must not weaken the existing server security.

Do not:

* expose Supabase service-role credentials
* expose AI API keys
* bypass Server Actions
* move authorization decisions into client state
* trust workspace IDs from client UI
* create client-side admin APIs

Existing server-side authorization remains authoritative.

---

# ROUTING

Inspect the existing App Router structure.

Do not duplicate routes unnecessarily.

Use layouts where appropriate.

Keep route boundaries understandable.

Do not redesign the entire application routing architecture just for visual reasons.

---

# COMPONENT ARCHITECTURE

Avoid both extremes:

Bad:

```text
One giant page.tsx containing everything
```

Also bad:

```text
150 tiny components for trivial markup
```

Extract meaningful reusable patterns such as:

* AppShell
* MobileNav
* WorkspaceSwitcher
* PageHeader
* ContentList
* ContentRow/Card
* StatusBadge
* EmptyState
* FormField
* etc.

Use names that match the actual product.

---

# REAL MOBILE VERIFICATION

After implementation, run the application locally and verify it using a mobile-sized viewport.

At minimum verify:

* login
* workspace list
* workspace creation
* workspace navigation
* content creation
* content list
* content detail
* content edit
* content deletion
* mobile navigation
* responsive layout

Verify that:

* no horizontal overflow exists
* buttons are usable by touch
* bottom navigation does not cover content
* forms are usable with a mobile keyboard
* text does not unexpectedly overflow
* dialogs/sheets fit the viewport

If browser automation is available, use it.

If not, use the project's available verification methods.

---

# DESKTOP VERIFICATION

Also verify:

* desktop navigation
* workspace context
* content list
* content detail
* forms
* responsive transitions

Desktop must remain polished.

---

# TASTE SKILL AUDIT

Before declaring completion, perform a deliberate visual audit against the Taste Skill.

Ask:

1. Does this look like generic AI-generated SaaS?
2. Is there a recognizable visual point of view?
3. Is the typography intentional?
4. Is spacing intentional?
5. Is the color system intentional?
6. Are cards being used because they help, or because dashboards usually have cards?
7. Are there unnecessary gradients?
8. Are there unnecessary rounded containers?
9. Is the navigation hierarchy obvious?
10. Does the mobile interface feel designed specifically for mobile?
11. Does the product have visual character?
12. Could this screenshot be mistaken for hundreds of other AI-generated SaaS dashboards?

If the answer to the last question is yes, iterate before completion.

---

# DO NOT POLISH BY ADDING DECORATION

If the interface feels boring, do not solve that by adding:

* gradients
* shadows
* glowing blobs
* animations
* more cards
* more icons

Instead improve:

* hierarchy
* typography
* composition
* spacing
* information density
* navigation
* visual rhythm
* interaction design

---

# DOCUMENTATION

Create/update documentation describing:

* frontend information architecture
* design direction
* Taste Skill integration
* responsive strategy
* PWA readiness
* component architecture
* mobile verification

Document any intentional design decisions.

---

# TESTING

Existing tests must continue passing.

Add frontend tests where they provide meaningful value.

Do not write meaningless snapshot tests for every component.

Test important behavior such as:

* navigation
* form behavior
* validation
* loading/error states
* content interactions where practical

---

# REQUIRED VERIFICATION

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

All must pass.

Also perform:

* mobile viewport verification
* desktop viewport verification
* horizontal overflow check
* accessibility sanity check
* Taste Skill visual audit
* secret exposure audit

---

# SCOPE CONTROL

This phase is FRONTEND-FIRST.

Do not implement backend automation.

Do not implement:

* TikTok APIs
* TikTok scraping
* video downloading
* media processing
* FFmpeg
* Instagram APIs
* Instagram OAuth
* Instagram publishing
* scheduling
* queues
* Redis
* workers
* push notification backend
* AI content generation workflow
* caption generation
* analytics
* billing

The AI Router from PHASE 4 may remain completely unused by the frontend.

That is intentional.

---

# GIT

Do NOT automatically commit.

Leave the changes uncommitted for review.

---

# COMPLETION REPORT

When finished, report exactly:

```text
PHASE 5 COMPLETE

Frontend Objective:
- ...

Taste Skill:
- Repository inspected:
- Skill installed/imported:
- Relevant principles applied:
- Evidence in implementation:

Design Direction:
- ...

Information Architecture:
- ...

Mobile UX:
- ...

Desktop UX:
- ...

PWA Readiness:
- ...

Authentication UI:
- ...

Workspace UI:
- ...

Content UI:
- ...

Navigation:
- ...

Design System:
- ...

Typography:
- ...

Color:
- ...

Motion:
- ...

Accessibility:
- ...

Files Added:
- ...

Files Modified:
- ...

Dependencies Added:
- ...

Tests Added/Updated:
- ...

Mobile Verification:
- ...

Desktop Verification:
- ...

Taste Skill Audit:
- Generic AI SaaS appearance → PASS/FAIL
- Visual point of view → PASS/FAIL
- Typography → PASS/FAIL
- Spacing → PASS/FAIL
- Color → PASS/FAIL
- Mobile-specific design → PASS/FAIL
- Unnecessary decoration → PASS/FAIL

Security Review:
- Server secrets exposed → YES/NO
- AI API key exposed → YES/NO
- Supabase service role exposed → YES/NO
- Client-side authorization bypass → YES/NO

Verification:
- npm run lint → PASS/FAIL
- npm run typecheck → PASS/FAIL
- npm test → PASS/FAIL
- npm run build → PASS/FAIL
- npm run format:check → PASS/FAIL

Known Limitations:
- ...

Explicitly Not Implemented:
- ...

Git Status:
- ...

Ready For Next Phase:
- YES/NO
- Reason: ...
```

STOP after PHASE 5.

Do not start the next backend automation phase.
