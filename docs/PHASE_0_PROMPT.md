# PHASE_0_PROMPT.md

# PHASE 0 — PROJECT FOUNDATION

You are working inside the existing repository:

```text
ai-content
```

Your task is to implement:

```text
PHASE 0 — PROJECT FOUNDATION
```

This phase is strictly limited to project foundation.

Do not start any future phase.

---

# 1. PRIMARY INSTRUCTION

Before writing or modifying any code, inspect the repository and read the project documentation.

You MUST read:

```text
docs/MASTER_PRODUCT_SPEC.md
docs/TECHNICAL_ARCHITECTURE.md
docs/DATABASE_SCHEMA.md
docs/IMPLEMENTATION_ROADMAP.md
docs/CODING_RULES.md
```

Then inspect:

```text
package.json
existing source files
existing configuration files
git status
```

Do not assume the repository is empty.

Do not overwrite existing implementation without first understanding it.

---

# 2. CURRENT PHASE

You are implementing only:

```text
PHASE 0 — PROJECT FOUNDATION
```

The objective is:

> Create a stable, strict, testable project foundation that future phases can build upon.

---

# 3. REQUIRED WORKFLOW

Follow this exact sequence:

```text
Inspect
↓
Read Documentation
↓
Audit Repository
↓
Create Implementation Plan
↓
Implement Phase 0
↓
Run Tests
↓
Fix Failures
↓
Review Git Diff
↓
Final Verification
↓
Completion Report
```

Do not skip steps.

---

# 4. FIRST ACTIONS

Run and inspect:

```bash
pwd
git status
git log -n 5 --oneline
find . -maxdepth 3 -type f | sort
```

Then read all required documentation.

Before implementing anything, provide a concise internal implementation plan.

The plan must identify:

* current repository state
* existing tooling
* existing dependencies
* missing foundation components
* files expected to be created
* files expected to be modified
* verification commands

Do not implement future phases.

---

# 5. PHASE 0 OBJECTIVES

Implement a production-quality foundation for the project.

Required:

```text
Next.js application

TypeScript strict mode

Tailwind CSS

ESLint

Formatter

Test framework

Environment validation

Supabase client foundation

Project structure

Basic developer documentation
```

---

# 6. REQUIRED PROJECT STRUCTURE

Target structure:

```text
ai-content/
│
├── apps/
│   └── web/
│
├── packages/
│   ├── database/
│   ├── ai/
│   ├── jobs/
│   └── shared/
│
├── docs/
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── tests/
│
├── package.json
├── README.md
└── .env.example
```

Important:

The repository does not need unnecessary placeholder code.

Create packages only when their structure is meaningful and future-safe.

Avoid fake implementations.

Avoid empty files whose only purpose is satisfying directory structure.

---

# 7. PACKAGE MANAGEMENT

Inspect the existing repository first.

Do not replace the package manager without reason.

If the repository already uses:

```text
npm
```

continue using npm unless there is a documented technical reason not to.

Do not introduce multiple package managers.

Do not commit lockfiles from multiple package managers.

---

# 8. MONOREPO DECISION

The architecture documentation expects:

```text
apps/
packages/
```

Therefore establish a clean workspace structure.

Before selecting workspace tooling:

1. Inspect existing setup.
2. Prefer the smallest solution compatible with the project.
3. Avoid unnecessary monorepo frameworks.

Do not introduce Turborepo unless clearly justified.

A simple npm workspace configuration is preferred if sufficient.

---

# 9. NEXT.JS FOUNDATION

The web application should live in:

```text
apps/web
```

Use the existing project setup if present.

Otherwise establish a modern Next.js application.

Required:

```text
App Router

TypeScript

Strict mode

Production build support
```

Do not implement:

```text
Authentication

Dashboard

Workspace UI

Content management

AI features
```

A minimal application shell is sufficient.

---

# 10. TYPESCRIPT RULES

Enable strict TypeScript.

Verify:

```text
strict: true
```

Do not disable strict checking to make code compile.

Do not use:

```typescript
any
```

to silence errors.

Fix the actual type issue.

---

# 11. TAILWIND FOUNDATION

Configure Tailwind correctly for the web application.

The purpose is foundation only.

Do not spend this phase designing the product UI.

A minimal page is enough to verify:

```text
Next.js rendering

Global CSS

Tailwind compilation
```

---

# 12. LINTING

Configure ESLint.

The project should have a single clear lint command.

Expected:

```bash
npm run lint
```

Lint must pass before Phase 0 is complete.

Do not disable large categories of lint rules just to make the command pass.

---

# 13. FORMATTING

Configure a formatter.

Preferred:

```text
Prettier
```

Formatting should be consistent.

Provide a command similar to:

```bash
npm run format
```

Also provide:

```bash
npm run format:check
```

Phase verification should use format checking where practical.

---

# 14. TEST FOUNDATION

Configure a test framework.

Preferred:

```text
Vitest
```

unless the existing repository already has an appropriate test framework.

Required commands:

```bash
npm test
```

and, if appropriate:

```bash
npm run test:watch
```

Create meaningful initial tests.

Do not create meaningless tests such as:

```typescript
expect(true).toBe(true)
```

Initial tests should validate real foundation behavior.

Examples:

```text
Environment validation

Shared utility behavior

Package import boundaries
```

Keep tests appropriate to Phase 0.

---

# 15. ENVIRONMENT VALIDATION

Environment variables must be centrally validated.

Required variables:

```text
NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

AI_ROUTER_BASE_URL

AI_ROUTER_API_KEY
```

Important:

This phase should establish validation infrastructure.

It does NOT need to call:

```text
Supabase

AI Router
```

during normal application startup.

Environment validation must not make the local UI unusable when optional future integrations are intentionally not configured.

Therefore clearly distinguish:

```text
Required Runtime Variables
```

from:

```text
Future Provider Variables
```

Design the validation architecture carefully.

Do not create a situation where:

```text
npm run dev
```

fails simply because Phase 4 AI credentials are not yet configured.

---

# 16. ENVIRONMENT FILES

Create:

```text
.env.example
```

Requirements:

* include variable names
* include safe placeholder values
* never include real secrets
* include comments where helpful

Also ensure:

```text
.env.local
```

is ignored by git if appropriate.

Check existing `.gitignore` before modifying it.

---

# 17. SUPABASE FOUNDATION

Phase 0 should establish Supabase client architecture only.

Expected separation:

```text
Browser client

Server client

Admin/service client
```

However:

Do not use service role from client code.

Do not expose:

```text
SUPABASE_SERVICE_ROLE_KEY
```

through:

```text
NEXT_PUBLIC_
```

or browser bundles.

Do not implement:

```text
Authentication flow

Database queries

RLS policies
```

Those belong to future phases.

The goal is only to establish clean client factories or equivalent infrastructure.

---

# 18. PACKAGE ARCHITECTURE

The project is expected to eventually contain:

```text
packages/database
packages/ai
packages/jobs
packages/shared
```

During Phase 0:

Do not implement business logic.

You may establish minimal package boundaries and TypeScript configuration.

Avoid creating fake services.

Good:

```text
database package exports database types/configuration boundaries
```

Bad:

```text
Fake AIProvider implementation
```

Bad:

```text
Fake JobWorker implementation
```

Future packages should be prepared but not prematurely implemented.

---

# 19. SHARED CONFIGURATION

Avoid duplicated configuration where possible.

Examples:

```text
TypeScript configuration

ESLint configuration

Prettier configuration
```

However:

Do not introduce complicated configuration inheritance unless it genuinely improves maintainability.

Prefer understandable configuration over clever configuration.

---

# 20. ROOT PACKAGE SCRIPTS

Provide clear root commands where practical.

Target commands:

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run format
npm run format:check
```

If a command requires workspace syntax, ensure the root script abstracts it cleanly.

The developer should not need to remember long workspace commands for normal verification.

---

# 21. TYPECHECK

Provide a dedicated command:

```bash
npm run typecheck
```

Do not rely only on:

```bash
npm run build
```

for TypeScript verification.

Typecheck should be explicit.

---

# 22. BUILD

Ensure:

```bash
npm run build
```

can build the web application.

Do not require:

```text
Supabase database connection

AI Router API access

Instagram credentials
```

for a Phase 0 production build.

---

# 23. MINIMAL APPLICATION SHELL

Create a minimal application shell.

It may display:

```text
AI Content
Project Foundation Ready
```

or equivalent.

The goal is only to verify:

```text
Application boots

Next.js renders

Tailwind works

Global layout works
```

Do not design the actual dashboard yet.

---

# 24. README

Create or update the root:

```text
README.md
```

It should include:

```text
Project name

Short description

Technology stack

Repository structure

Prerequisites

Installation

Environment setup

Development commands

Verification commands
```

Do not document future implementation as if it already exists.

Clearly distinguish:

```text
Implemented
```

and:

```text
Planned
```

if necessary.

---

# 25. SUPABASE DIRECTORY

Ensure this structure exists:

```text
supabase/
├── migrations/
└── seed.sql
```

Phase 0 does not require actual application tables.

Do not prematurely implement:

```text
profiles

workspaces

contents

jobs
```

Those belong to future phases.

---

# 26. DO NOT IMPLEMENT

The following are explicitly forbidden during Phase 0:

```text
Authentication

Signup

Login

Logout

User profiles

Database schema

Database tables

Workspace system

Content management

Content discovery

TikTok integration

Video scraping

Media downloading

Media processing

AI analysis

Caption generation

AI Router API calls

Background workers

Job execution

Scheduling

Instagram integration

Publishing

Push notifications

PWA implementation

Dashboard
```

Do not create hidden partial implementations of future features.

---

# 27. DEPENDENCY DISCIPLINE

Before adding a dependency:

1. Check existing dependencies.
2. Confirm necessity.
3. Prefer stable, widely maintained packages.
4. Avoid large frameworks for small problems.

Do not add:

```text
Turborepo

Redux

ORM

Queue framework

UI component framework
```

during Phase 0 unless already present and required by existing architecture.

---

# 28. SECURITY REQUIREMENTS

Verify:

```text
No secrets committed

No secrets exposed to browser

.env.local ignored

.env.example contains placeholders only

Service role remains server-only
```

Do not log environment secrets.

---

# 29. TEST REQUIREMENTS

Tests must verify actual behavior.

At minimum:

* environment validation behavior
* one shared package behavior if applicable
* application configuration sanity where practical

Do not over-engineer tests for unimplemented features.

---

# 30. IMPLEMENTATION QUALITY

Prefer:

```text
Simple

Explicit

Maintainable

Minimal
```

Avoid:

```text
Premature abstraction

Placeholder architecture

Dead code

Unused dependencies

Unused environment variables

Fake services
```

---

# 31. REQUIRED VERIFICATION

Before declaring Phase 0 complete, run:

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

Also run:

```bash
npm run format:check
```

If a command fails:

1. Diagnose.
2. Fix the actual issue.
3. Re-run the command.

Do not claim success if commands were not executed.

---

# 32. FINAL REVIEW

Before completion:

Run:

```bash
git status
```

and:

```bash
git diff --stat
```

Review all changed files.

Check specifically for:

```text
Accidental secrets

Future phase code

Unused dependencies

TypeScript any

Disabled lint rules

Broken workspace configuration
```

---

# 33. DEFINITION OF DONE

PHASE 0 is complete only when all conditions below are true.

## Repository

* [ ] Clean workspace structure established
* [ ] apps/web exists
* [ ] packages structure established where meaningful
* [ ] supabase directory exists

## Application

* [ ] Next.js application runs
* [ ] TypeScript strict enabled
* [ ] Tailwind works
* [ ] Minimal application shell renders

## Tooling

* [ ] ESLint configured
* [ ] Formatter configured
* [ ] Vitest or existing appropriate test framework configured
* [ ] Root scripts available

## Environment

* [ ] Environment validation architecture exists
* [ ] `.env.example` exists
* [ ] Secrets are not exposed
* [ ] Future provider credentials do not block Phase 0 development

## Supabase

* [ ] Browser client boundary exists
* [ ] Server client boundary exists
* [ ] Admin client remains server-only

## Verification

* [ ] `npm run lint` passes
* [ ] `npm run typecheck` passes
* [ ] `npm test` passes
* [ ] `npm run build` passes
* [ ] `npm run format:check` passes

---

# 34. REQUIRED COMPLETION REPORT

When finished, respond with exactly this structure:

```text
PHASE 0 COMPLETE

Implemented:
- ...

Files Added:
- ...

Files Modified:
- ...

Dependencies Added:
- ...

Environment Variables:
- ...

Tests Added:
- ...

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

Architecture Notes:
- ...
```

Be precise.

Do not claim anything was verified unless you actually ran the command.

Do not say "everything works" without evidence.

---

# 35. FINAL REMINDER

You are implementing:

```text
PHASE 0 ONLY
```

Your success criteria is not the number of files created.

Your success criteria is:

```text
Stable foundation

Strict typing

Clean boundaries

Testable tooling

Safe environment handling

Successful verification
```

Do not begin Phase 1.

Stop after Phase 0 is complete.

# END OF PHASE 0 PROMPT
