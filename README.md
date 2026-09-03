# AI Content

AI Multi-Account Content Automation Platform.

A PWA for managing several Instagram accounts — each with its own niche, content
strategy, and AI personality — from a single place. Content discovery, AI analysis,
caption generation, scheduling, and publishing are handled per workspace.

> **Project status: Phases 0–7B complete — authentication, workspaces, content
> domain, AI router foundation, mobile-first frontend, content source/media
> foundation, the workspace AI profile, and AI caption generation.** Background
> jobs, scheduling, and publishing are
> delivered by later phases; see [Implemented vs Planned](#implemented-vs-planned).

## Technology Stack

| Concern        | Choice                                                   |
| -------------- | -------------------------------------------------------- |
| Framework      | Next.js 16 (App Router)                                  |
| Language       | TypeScript (strict)                                      |
| UI             | React 19, Tailwind CSS v4                                |
| Database       | Supabase (PostgreSQL, Auth, Realtime)                    |
| AI integration | OpenAI-compatible configurable AI Router (`packages/ai`) |
| Validation     | Zod                                                      |
| Testing        | Vitest                                                   |
| Tooling        | ESLint (flat config), Prettier                           |
| Workspaces     | npm workspaces                                           |
| Hosting        | Vercel                                                   |

## Repository Structure

```text
ai-content/
├── apps/
│   └── web/              Next.js application (App Router, Server Actions)
├── packages/
│   ├── shared/           Environment validation, Zod schemas for each domain
│   ├── database/         Supabase client factories and hand-maintained DB types
│   └── ai/               Provider-neutral AIProvider + OpenAI-compatible adapter
├── docs/                 Specifications — the project's source of truth
├── supabase/
│   ├── migrations/       Schema, RLS policies, and constraints
│   └── seed.sql
└── tests/                Vitest suites for the workspace packages and web app
```

`packages/jobs` is named in the architecture but is not created yet. It is
introduced by the phase that needs it, so the repository does not carry empty
directories or fake service implementations.

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
| AI Router (opt.)   | `AI_ROUTER_BASE_URL`, `AI_ROUTER_API_KEY`                   | `createAIProvider()` throws when used |

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

The provider lives in `packages/ai` behind a provider-neutral `AIProvider`
interface with one `OpenAICompatibleProvider` adapter. No application feature
calls it yet. OpenRouter is **not** an architectural dependency — see
[docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md).

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

**Implemented (Phases 0–7B)**

- npm workspace structure, Next.js App Router shell, TypeScript strict mode
- ESLint, Prettier, Vitest; environment validation with runtime/server/AI separation
- Supabase browser, server, and admin client factories
- Authentication (sign up, sign in, sign out, protected routes) with `profiles`
- Multi-workspace model: `workspaces`, `workspace_members`, Row Level Security
  via `workspace_ids_for_current_user()`
- Content domain: `content` with status lifecycle, workspace-scoped repositories,
  validated Server Actions
- AI router foundation: `packages/ai` provider abstraction, called by caption
  generation
- Mobile-first frontend for workspaces and content
- Content source and media foundation: neutral `source_type`, `source_url`,
  `external_id`, object-storage reference pair, and `media_status` lifecycle
- Workspace AI profile: `workspace_profiles` holding niche, description,
  audience, tone, writing style, goals, and restrictions. Owner-editable,
  member-readable, and used as the context for caption generation
- AI caption generation: versioned `captions` per content item, written from the
  title, source, and workspace AI profile. Regenerating appends a version and
  never overwrites; exactly one version can be active. Requires `AI_ROUTER_*`;
  without it the section states plainly that AI is not configured

**Planned (later phases)**

AI analysis and scoring, background jobs, scheduling, content discovery, media
processing, Instagram publishing, PWA and push notifications, observability, and
security hardening. The order is defined in `docs/IMPLEMENTATION_ROADMAP.md`.

Database changes are made only through new files in `supabase/migrations/`;
applied migrations are never edited. The Supabase CLI is pinned as a
devDependency: `npm run db:push:dry` previews pending migrations against the
linked project, `npm run db:push` applies them, `npm run db:migrations` shows
local vs remote state.

## Documentation

Read before contributing:

- `docs/MASTER_PRODUCT_SPEC.md` — product scope
- `docs/TECHNICAL_ARCHITECTURE.md` — system architecture
- `docs/DATABASE_SCHEMA.md` — database design
- `docs/IMPLEMENTATION_ROADMAP.md` — phase plan
- `docs/CODING_RULES.md` — mandatory engineering rules
