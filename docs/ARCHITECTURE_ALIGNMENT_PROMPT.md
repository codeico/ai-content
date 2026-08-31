# ARCHITECTURE_ALIGNMENT_PROMPT.md

# ARCHITECTURE ALIGNMENT — OPENAI-COMPATIBLE AI ROUTER

You are working inside the existing repository:

```text
/Users/bangico/ai-content
```

PHASE 0 has already been completed successfully.

Do NOT restart PHASE 0.

Do NOT start PHASE 1.

Do NOT implement authentication, database tables, AI generation, background jobs, content discovery, scheduling, or publishing.

Your task is a controlled architecture alignment update.

---

# 1. IMPORTANT CONTEXT

The project originally documented the AI integration using:

```text
OpenRouter
```

This is no longer the correct architectural assumption.

The project will use a custom AI Router/API endpoint that is:

```text
OpenAI-compatible
```

The AI Router may route requests to different underlying providers and models.

Therefore the application architecture must depend on:

```text
OpenAI-Compatible API Contract
```

and NOT on:

```text
OpenRouter-specific API behavior
OpenRouter-specific SDK assumptions
OpenRouter-specific environment variable names
```

OpenRouter may still be usable in the future as one possible compatible endpoint.

However, it must not be the architectural dependency of this project.

---

# 2. PRIMARY OBJECTIVE

Update the project documentation and Phase 0 foundation so future implementation phases safely target:

```text
Generic AI Router
        ↓
OpenAI-Compatible API
        ↓
Chat/Completion Models
```

instead of:

```text
Application
        ↓
OpenRouter-specific integration
```

The architecture must allow the AI backend endpoint to be changed without changing application business logic.

---

# 3. STRICT SCOPE

This task is an architecture alignment task only.

You MAY:

```text
Update documentation

Update environment variable naming

Update environment validation

Update README

Update tests

Update architecture terminology

Update Phase 0 artifacts

Create small generic configuration boundaries
```

You MUST NOT:

```text
Start Phase 1

Implement authentication

Create profiles table

Create workspace tables

Create RLS policies

Implement AIProvider business logic

Call an AI API

Generate captions

Analyze content

Implement OpenAI SDK integration

Implement OpenRouter SDK integration

Implement model routing

Implement background jobs

Implement scheduling

Implement Instagram integration

Implement TikTok integration

Implement dashboard features
```

This is NOT Phase 4.

Do not accidentally implement future AI functionality.

---

# 4. FIRST ACTIONS

Before making changes:

Run:

```bash
pwd
git status
git log -n 10 --oneline
git diff --cached
git diff
find docs -maxdepth 2 -type f | sort
find packages -maxdepth 4 -type f | sort
```

Then read completely:

```text
docs/MASTER_PRODUCT_SPEC.md

docs/TECHNICAL_ARCHITECTURE.md

docs/DATABASE_SCHEMA.md

docs/IMPLEMENTATION_ROADMAP.md

docs/CODING_RULES.md

docs/PHASE_0_PROMPT.md
```

Also inspect the current Phase 0 implementation, especially:

```text
.env.example

README.md

packages/shared/src/env/

tests/env.test.ts

package.json

apps/web/
```

Do not assume the Phase 0 completion report is sufficient.

Inspect the actual repository state.

---

# 5. REQUIRED ARCHITECTURAL CHANGE

Replace the conceptual dependency:

```text
OpenRouter
```

with:

```text
OpenAI-Compatible AI Router
```

The architecture should describe the AI integration as:

```text
Application
      ↓
AI Provider Abstraction
      ↓
OpenAI-Compatible Client
      ↓
Configurable AI Router Endpoint
      ↓
Underlying Models
```

Important:

The application should not care whether the compatible endpoint is backed by:

```text
Custom AI Router

OpenRouter

Local AI gateway

Self-hosted gateway

Another OpenAI-compatible provider
```

That decision belongs to configuration and provider infrastructure.

---

# 6. ENVIRONMENT VARIABLE MIGRATION

The existing Phase 0 environment currently references:

```text
OPENROUTER_API_KEY
```

This is too provider-specific.

Update the architecture to use generic AI Router configuration.

Preferred environment variables:

```text
AI_ROUTER_BASE_URL

AI_ROUTER_API_KEY
```

Optionally, if the architecture genuinely benefits from it:

```text
AI_ROUTER_DEFAULT_MODEL
```

Do not add unnecessary variables.

The expected conceptual configuration should be:

```text
AI_ROUTER_BASE_URL
    Example:
    https://your-ai-router.example/v1

AI_ROUTER_API_KEY
    Server-only secret

AI_ROUTER_DEFAULT_MODEL
    Optional future default model identifier
```

Important:

Do not hardcode:

```text
OpenRouter URLs

OpenAI URLs

Specific model names
```

The endpoint must remain configurable.

---

# 7. OPENAI-COMPATIBLE API CONTRACT

Document the assumption clearly.

The AI Router is expected to expose an API compatible with the OpenAI API contract.

Future implementation should therefore target a configurable interface conceptually similar to:

```text
POST /v1/chat/completions
```

or another explicitly documented OpenAI-compatible endpoint.

However:

Do NOT implement the HTTP client now.

Do NOT add the OpenAI SDK now unless absolutely required for configuration typing, which is unlikely.

Do NOT test live API calls.

This task only establishes the architectural contract.

---

# 8. DOCUMENTATION UPDATE REQUIREMENTS

Review every project document and replace incorrect provider-specific assumptions.

The following files must be inspected:

```text
docs/MASTER_PRODUCT_SPEC.md

docs/TECHNICAL_ARCHITECTURE.md

docs/DATABASE_SCHEMA.md

docs/IMPLEMENTATION_ROADMAP.md

docs/CODING_RULES.md

docs/PHASE_0_PROMPT.md

README.md
```

Do not blindly perform global search-and-replace.

Each occurrence must be reviewed in context.

---

# 9. MASTER PRODUCT SPEC UPDATE

Update terminology so the product describes:

```text
Configurable AI Router
```

or:

```text
OpenAI-Compatible AI Provider
```

where appropriate.

Do not describe OpenRouter as a mandatory dependency.

If OpenRouter is mentioned as an example, make it clear that it is optional and replaceable.

---

# 10. TECHNICAL ARCHITECTURE UPDATE

The AI architecture must clearly establish separation between:

```text
Domain Layer
```

and:

```text
AI Transport/Provider Layer
```

Target conceptual architecture:

```text
Application Domain
        │
        ▼
AIProvider Interface
        │
        ▼
OpenAI-Compatible Provider Adapter
        │
        ▼
Configurable AI Router
        │
        ▼
Underlying Model
```

Important:

Do not implement the actual AIProvider interface unless it is already necessary for Phase 0 architecture.

A documentation-level contract is sufficient.

Avoid premature code abstraction.

The goal is to ensure Phase 4 can later implement the correct abstraction without rewriting the application.

---

# 11. DATABASE SCHEMA UPDATE

Review the database schema documentation.

Any AI-related metadata should not assume:

```text
OpenRouter
```

as the provider identity.

Future AI metadata should conceptually support:

```text
provider_type

provider_name

model_name

router_base_url identifier if appropriate

prompt_version
```

However:

Do NOT create migrations.

Do NOT modify the actual database.

Only update the documentation if necessary.

Do not over-design provider metadata.

The key requirement is:

> Future database records must not incorrectly assume OpenRouter is the permanent provider.

---

# 12. IMPLEMENTATION ROADMAP UPDATE

Update Phase 4 terminology.

The phase should no longer say:

```text
OpenRouter provider
```

as a mandatory implementation.

Replace with a generic concept such as:

```text
OpenAI-Compatible AI Provider
```

or:

```text
Configurable AI Router Provider
```

Phase 4 should eventually support:

```text
AI provider abstraction

OpenAI-compatible provider adapter

Configurable API base URL

Server-side API key

Content analysis

Caption generation
```

Do not change the scope of Phase 4 beyond this provider architecture correction.

Do not change phase order unless a real dependency problem exists.

---

# 13. CODING RULES UPDATE

Update AI-related engineering rules.

The coding rules must state:

```text
Application domain logic must not depend directly on a specific AI vendor.

AI integrations must use an abstraction.

The initial implementation targets an OpenAI-compatible API contract.

Base URL and credentials must be configurable.

Provider-specific assumptions must be isolated inside the infrastructure/provider adapter.
```

Remove any rule that makes OpenRouter a mandatory architectural dependency.

Do not weaken existing security rules.

---

# 14. PHASE 0 PROMPT UPDATE

Update:

```text
docs/PHASE_0_PROMPT.md
```

so future re-execution or auditing does not incorrectly require:

```text
OPENROUTER_API_KEY
```

Replace provider-specific future configuration with generic AI Router configuration.

Important:

The updated Phase 0 prompt must still preserve this requirement:

> Future AI credentials must not block Phase 0 development.

Therefore:

```text
AI_ROUTER_BASE_URL
AI_ROUTER_API_KEY
```

must remain future-provider configuration.

The application must not crash merely because these values are absent during Phase 0.

---

# 15. ENVIRONMENT VALIDATION UPDATE

Inspect the actual implementation in:

```text
packages/shared/src/env/
```

Maintain the good Phase 0 architecture:

```text
Runtime/public variables

Server-only variables

Future provider variables
```

Update the future provider group.

Expected direction:

```text
Runtime Environment
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

Server Environment
- SUPABASE_SERVICE_ROLE_KEY

Future AI Router Environment
- AI_ROUTER_BASE_URL
- AI_ROUTER_API_KEY
- AI_ROUTER_DEFAULT_MODEL if justified
```

Important:

Do not make future AI Router variables required for:

```text
npm run dev

npm test

npm run build
```

during the current implementation stage.

The validation must remain lazy and testable.

Preserve the Phase 0 safety properties already implemented.

---

# 16. ENVIRONMENT SECURITY

Verify:

```text
AI_ROUTER_API_KEY
```

is treated as:

```text
Server-only secret
```

It must never:

```text
Use NEXT_PUBLIC_

Appear in client bundles

Be returned from API routes

Be logged

Appear in error messages
```

The base URL may be server-side configuration as well.

Do not automatically expose it to the browser unless a future architecture explicitly requires that.

Default assumption:

```text
AI router configuration belongs to server-side infrastructure.
```

---

# 17. TEST UPDATE REQUIREMENTS

Update relevant tests.

The existing environment tests currently validate OpenRouter-specific behavior.

Replace them with generic AI Router tests.

Tests should verify at minimum:

```text
Missing AI router configuration does not block Phase 0

AI_ROUTER_API_KEY remains optional during Phase 0

Future provider environment validation is isolated

Malformed configured AI_ROUTER_BASE_URL is rejected when that future configuration is explicitly validated

Secret values are never echoed in validation errors
```

Do not reduce test quality.

Preserve existing non-vacuous behavior.

Do not remove tests simply to make the refactor easier.

---

# 18. README UPDATE

Update the README technology description.

The stack should describe:

```text
AI Integration:
OpenAI-compatible configurable AI Router
```

Do not claim that:

```text
AI features are implemented
```

Do not claim:

```text
OpenRouter is integrated
```

if no API integration exists.

Clearly distinguish:

```text
Foundation implemented
```

from:

```text
AI integration planned for Phase 4
```

---

# 19. NO PROVIDER LOCK-IN

The updated architecture must make this possible in the future:

Configuration A:

```text
AI_ROUTER_BASE_URL=https://router-a.example/v1
AI_ROUTER_API_KEY=...
```

Configuration B:

```text
AI_ROUTER_BASE_URL=https://router-b.example/v1
AI_ROUTER_API_KEY=...
```

Configuration C:

```text
AI_ROUTER_BASE_URL=http://localhost:1234/v1
AI_ROUTER_API_KEY=...
```

The application business logic should not require architectural changes when the compatible router endpoint changes.

However:

Do not implement actual router switching now.

This is an architecture requirement for future phases.

---

# 20. BACKWARD COMPATIBILITY

The repository is still in early development.

Do not preserve:

```text
OPENROUTER_API_KEY
```

solely for backward compatibility unless there is an actual implemented user dependency.

Since the project is still in Phase 0:

Prefer clean migration to:

```text
AI_ROUTER_BASE_URL
AI_ROUTER_API_KEY
```

Avoid supporting duplicate environment variable names unnecessarily.

The goal is to remove incorrect architecture early.

---

# 21. PRESERVE GOOD PHASE 0 DECISIONS

Do not regress the existing successful foundation.

Preserve:

```text
npm workspaces

No Turborepo unless justified

Next.js application structure

TypeScript strict mode

Additional strict compiler checks

Tailwind setup

ESLint

Prettier

Vitest

Lazy environment validation

Environment separation

Supabase client boundaries

Server-only admin protection

No future phase implementation

Root verification commands
```

Do not rewrite Phase 0 merely because this alignment task touches configuration.

Make the smallest correct change.

---

# 22. DO NOT ADD DEPENDENCIES UNNECESSARILY

This architecture alignment should probably not require new dependencies.

Specifically:

Do NOT add:

```text
OpenAI SDK

OpenRouter SDK

AI SDK

LangChain

Model routing framework
```

unless an actual existing implementation requires it.

It should not.

This task is about:

```text
Architecture

Configuration

Documentation

Validation
```

not AI execution.

---

# 23. REQUIRED VERIFICATION

After implementation, run:

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

```bash
npm run format:check
```

Additionally:

Search the repository for unintended provider lock-in.

Examples:

```bash
grep -Rni "OPENROUTER_API_KEY" . \
  --exclude-dir=node_modules \
  --exclude=package-lock.json \
  --exclude-dir=.next
```

and:

```bash
grep -Rni "OpenRouter" . \
  --exclude-dir=node_modules \
  --exclude=package-lock.json \
  --exclude-dir=.next
```

Review every remaining match.

Allowed remaining matches only if they are:

```text
Historical documentation explicitly marked as an example
```

or:

```text
Intentional compatibility note
```

There must be no accidental architectural dependency.

Also verify:

```bash
grep -Rni "AI_ROUTER_" . \
  --exclude-dir=node_modules \
  --exclude=package-lock.json \
  --exclude-dir=.next
```

to ensure the new configuration is consistently documented.

---

# 24. FINAL DIFF REVIEW

Before completion run:

```bash
git status
git diff --cached --stat
git diff --stat
git diff --cached
```

Review for:

```text
Accidental future phase implementation

Authentication code

Database tables

AI HTTP calls

Provider SDK dependencies

Secrets

Unnecessary rewrites

Broken Phase 0 behavior
```

This task should remain focused.

---

# 25. DEFINITION OF DONE

This architecture alignment task is complete only when:

## Documentation

* [ ] OpenRouter is no longer a mandatory architecture dependency
* [ ] AI architecture targets an OpenAI-compatible API contract
* [ ] AI Router endpoint is documented as configurable
* [ ] Phase 4 documentation is updated
* [ ] Coding rules are updated
* [ ] Database documentation has no incorrect provider lock-in

## Environment

* [ ] OPENROUTER_API_KEY dependency removed
* [ ] AI_ROUTER_BASE_URL documented
* [ ] AI_ROUTER_API_KEY documented
* [ ] Future AI configuration remains optional during Phase 0
* [ ] AI secrets remain server-only

## Tests

* [ ] Environment tests updated
* [ ] Existing meaningful tests preserved
* [ ] New configuration behavior tested

## Safety

* [ ] No AI API calls implemented
* [ ] No provider SDK added unnecessarily
* [ ] No future phase started
* [ ] No secrets exposed

## Verification

* [ ] npm run lint passes
* [ ] npm run typecheck passes
* [ ] npm test passes
* [ ] npm run build passes
* [ ] npm run format:check passes

---

# 26. REQUIRED COMPLETION REPORT

When finished, respond using exactly this structure:

```text
ARCHITECTURE ALIGNMENT COMPLETE

Objective:
- ...

Architecture Changes:
- ...

Documentation Updated:
- ...

Environment Changes:
- ...

Code Changes:
- ...

Tests Updated:
- ...

Dependencies Added:
- ...

Dependencies Removed:
- ...

Verification:
- npm run lint → PASS/FAIL
- npm run typecheck → PASS/FAIL
- npm test → PASS/FAIL
- npm run build → PASS/FAIL
- npm run format:check → PASS/FAIL

Provider Lock-in Audit:
- OPENROUTER_API_KEY references → ...
- OpenRouter references → ...
- AI_ROUTER_* references → ...

Preserved Phase 0 Decisions:
- ...

Known Limitations:
- ...

Explicitly Not Implemented:
- ...

Ready For Next Phase:
- YES/NO
- Reason: ...
```

Do not claim the project is ready for Phase 1 unless all verification commands pass.

---

# 27. FINAL REMINDER

The correct AI architecture is:

```text
Business Logic
        ↓
AI Abstraction
        ↓
OpenAI-Compatible Provider Adapter
        ↓
Configurable AI Router Endpoint
        ↓
Any Compatible Model Backend
```

NOT:

```text
Business Logic
        ↓
OpenRouter-specific implementation
```

The project must remain provider-neutral.

This task is complete when the documentation and foundation are aligned with that principle.

Stop after the architecture alignment is complete.

Do NOT start PHASE 1.

# END OF ARCHITECTURE ALIGNMENT PROMPT
