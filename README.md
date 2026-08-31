# AI Content

AI Multi-Account Content Automation Platform.

A PWA for managing several Instagram accounts — each with its own niche, content
strategy, and AI personality — from a single place. Content discovery, AI analysis,
caption generation, scheduling, and publishing are handled per workspace.

> **Project status: Phase 0 — Project Foundation.**
> This repository currently contains the foundation only. The features described
> in `docs/MASTER_PRODUCT_SPEC.md` are delivered by later phases; see
> [Implemented vs Planned](#implemented-vs-planned).

## Technology Stack

| Concern        | Choice                                                      |
| -------------- | ----------------------------------------------------------- |
| Framework      | Next.js 16 (App Router)                                     |
| Language       | TypeScript (strict)                                         |
| UI             | React 19, Tailwind CSS v4                                   |
| Database       | Supabase (PostgreSQL, Auth, Realtime)                       |
| AI integration | OpenAI-compatible configurable AI Router (planned, Phase 4) |
| Validation     | Zod                                                         |
| Testing        | Vitest                                                      |
| Tooling        | ESLint (flat config), Prettier                              |
| Workspaces     | npm workspaces                                              |
| Hosting        | Vercel                                                      |

## Repository Structure

```text
ai-content/
├── apps/
│   └── web/              Next.js application
├── packages/
│   ├── shared/           Environment validation
│   └── database/         Supabase client factories
├── docs/                 Specifications — the project's source of truth
├── supabase/
│   ├── migrations/       Added from Phase 1 onward
│   └── seed.sql
└── tests/                Vitest suites for the workspace packages
```

`packages/ai` and `packages/jobs` are named in the architecture but are not
created yet. They are introduced by the phases that need them, so the repository
does not carry empty directories or fake service implementations.

## Prerequisites

- Node.js >= 20.9.0
- npm 10+

## Installation

```bash
npm install
```

## Environment Setup

```bash
cp .env.example .env.local
```

Then fill in your values. `.env.local` is git-ignored; never commit real secrets.

Variables are split into three groups:

| Group              | Variables                                                   | Behaviour when missing                |
| ------------------ | ----------------------------------------------------------- | ------------------------------------- |
| Required runtime   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase clients throw when used      |
| Server-only secret | `SUPABASE_SERVICE_ROLE_KEY`                                 | Admin client throws when used         |
| Future AI Router   | `AI_ROUTER_BASE_URL`, `AI_ROUTER_API_KEY`                   | Ignored until the phase that needs it |

Validation happens where a value is used, not at startup. `npm run dev` and
`npm run build` therefore work before any Supabase project or AI Router exists —
you only encounter an error when you reach a feature that genuinely needs one.

Variables prefixed `NEXT_PUBLIC_` are inlined into the browser bundle, so only
non-secret values may use that prefix. The service role key bypasses Row Level
Security and is server-only; the admin client additionally throws if it is ever
constructed in a browser environment. The AI Router base URL and key are
server-only for the same reason.

### AI Router

The AI backend is addressed as a **configurable, OpenAI-compatible AI Router**.
The application targets the OpenAI API contract (for example
`POST /v1/chat/completions`), not any single vendor, so `AI_ROUTER_BASE_URL` can
point at a custom router, a self-hosted gateway, a local server, or a hosted
provider without changing application code.

No AI integration exists yet — there is no HTTP client, no SDK, and no model
routing. Phase 4 implements the provider adapter behind an `AIProvider`
abstraction; Phase 0 only establishes the configuration contract.

## Development Commands

```bash
npm run dev            # Start the development server (http://localhost:3000)
npm run build          # Production build
npm start              # Serve the production build
```

## Verification Commands

```bash
npm run lint           # ESLint
npm run typecheck      # TypeScript, packages and web app
npm test               # Vitest
npm run test:watch     # Vitest in watch mode
npm run build          # Production build
npm run format         # Apply Prettier
npm run format:check   # Verify formatting
```

All of the above are expected to pass before a phase is considered complete.

## Implemented vs Planned

**Implemented (Phase 0)**

- npm workspace structure
- Next.js application shell with Tailwind
- TypeScript strict mode
- ESLint, Prettier, Vitest
- Environment validation with runtime/server/future-provider separation
- Supabase browser, server, and admin client factories

**Planned (later phases)**

Authentication, workspaces, content domain, AI analysis and captions, background
jobs, scheduling, Instagram publishing, PWA and push notifications, observability,
and security hardening. The order is defined in `docs/IMPLEMENTATION_ROADMAP.md`.

No database tables exist yet. The schema in `docs/DATABASE_SCHEMA.md` is created
by migrations starting in Phase 1.

## Documentation

Read before contributing:

- `docs/MASTER_PRODUCT_SPEC.md` — product scope
- `docs/TECHNICAL_ARCHITECTURE.md` — system architecture
- `docs/DATABASE_SCHEMA.md` — database design
- `docs/IMPLEMENTATION_ROADMAP.md` — phase plan
- `docs/CODING_RULES.md` — mandatory engineering rules
