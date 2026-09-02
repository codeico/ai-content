# PHASE 4 — AI ROUTER FOUNDATION

You are working inside the existing `ai-content` repository.

Repository path:

`/Users/bangico/ai-content`

## CURRENT STATE

Completed phases:

* PHASE 0 — Repository/Foundation
* Architecture Alignment — Generic OpenAI-Compatible AI Router
* PHASE 1 — Supabase Authentication
* PHASE 2 — Workspace Domain
* PHASE 3 — Content Domain Foundation

Latest commit:

`bbfe5c9`

The repository currently has:

* Next.js App Router
* React
* TypeScript strict mode
* Supabase Auth
* Supabase Postgres
* Workspace isolation
* Content domain
* Server Actions
* Repository pattern
* Zod validation
* RLS
* Vitest

PHASE 3 has been live-verified and is complete.

---

# OBJECTIVE

Implement **PHASE 4 — AI Router Foundation** only.

The objective is to create a clean, provider-agnostic AI abstraction capable of communicating with a configurable **OpenAI-compatible API endpoint**.

This phase establishes the AI infrastructure.

It does NOT yet implement content caption generation, content analysis, TikTok processing, Instagram publishing, jobs, scheduling, or autonomous workflows.

---

# NON-NEGOTIABLE ARCHITECTURE

The architecture MUST remain:

```text
Application Domain
        ↓
AIProvider Interface
        ↓
OpenAI-Compatible Provider Adapter
        ↓
Configurable AI Router Endpoint
        ↓
Underlying Model
```

The application must depend on an internal AI abstraction, NOT directly on OpenRouter or any other specific provider.

The implementation must be compatible with APIs following the OpenAI-compatible chat completions contract.

---

# CRITICAL PROVIDER-INDEPENDENCE RULE

DO NOT make OpenRouter an architectural dependency.

Do NOT create:

* OpenRouterProvider
* OpenRouter-specific application interfaces
* OpenRouter-specific database schema
* OpenRouter-specific configuration
* OpenRouter-specific business logic

An OpenRouter endpoint may be used only as an example of an OpenAI-compatible endpoint in documentation or tests.

The actual provider configuration must remain generic.

The intended configuration is:

```text
AI_ROUTER_BASE_URL
AI_ROUTER_API_KEY
```

Both are server-only.

NEVER expose the API key through:

```text
NEXT_PUBLIC_*
```

Do not introduce:

```text
OPENROUTER_API_KEY
```

Do not rename the generic configuration to provider-specific names.

---

# SCOPE

Implement only the following:

1. AI provider interface
2. OpenAI-compatible provider adapter
3. AI client/service abstraction
4. Server-only configuration handling
5. Request/response types
6. Safe error normalization
7. Timeout handling
8. Basic retry policy only if clearly justified and bounded
9. Unit tests
10. Integration-style tests using mocked HTTP
11. Documentation
12. Required verification commands

---

# DO NOT IMPLEMENT

Do NOT implement any of the following in PHASE 4:

* TikTok discovery
* TikTok scraping
* TikTok downloading
* video downloading
* FFmpeg
* media processing
* video analysis
* Instagram OAuth
* Instagram API
* Instagram publishing
* Instagram accounts
* social_accounts table
* content_sources table
* jobs
* queues
* Redis
* Upstash
* background workers
* scheduling
* cron
* notifications
* PWA
* push notifications
* caption generation workflow
* automatic content processing
* Content → AI integration
* AI-generated captions
* AI content analysis
* autonomous agents
* multi-agent workflows
* analytics
* billing
* usage metering
* model marketplace
* provider database
* provider management UI
* AI settings UI
* admin dashboard
* user-configurable API keys
* storing provider credentials in Supabase
* storing prompts in database

DO NOT modify the Content domain except where absolutely required by existing shared infrastructure.

DO NOT start PHASE 5.

STOP after PHASE 4.

---

# FIRST: INSPECT THE REPOSITORY

Before modifying anything:

1. Inspect the complete repository structure.
2. Read:

   * `README.md`
   * `CLAUDE.md` if present
   * relevant architecture documentation
   * `docs/PRODUCT_SPEC.md` if present
   * `docs/DATABASE_SCHEMA.md` if present
   * previous phase prompts
3. Inspect:

   * existing environment validation
   * Supabase server/client architecture
   * package boundaries
   * TypeScript configuration
   * test configuration
   * existing shared packages
4. Inspect git history and current HEAD.
5. Confirm the repository is clean before starting.

Do not assume the previous implementation is correct merely because the completion report says so.

---

# AI ABSTRACTION

Create an internal abstraction similar to:

```ts
interface AIProvider {
  chat(request: AIChatRequest): Promise<AIChatResponse>;
}
```

Use appropriate naming based on the existing repository conventions.

The interface must NOT contain OpenRouter-specific concepts.

Keep the application-facing interface provider-neutral.

---

# REQUEST MODEL

Define a minimal, reusable request model supporting at least:

* model
* messages
* optional temperature
* optional max output token configuration if supported by the chosen contract

Messages should support the standard roles necessary for chat completion, such as:

* system
* user
* assistant

Do not add a huge speculative schema.

Do not model every provider-specific option.

Only implement the subset required by this project.

---

# RESPONSE MODEL

Normalize the provider response into an internal application-facing representation.

The application should not have to understand the raw OpenAI-compatible response structure.

At minimum, the normalized result should provide:

* generated text
* model
* usage information when available
* finish reason when available

Usage information should be optional because not every compatible endpoint necessarily returns identical metadata.

Do not expose raw provider-specific response structures throughout the application.

---

# OPENAI-COMPATIBLE ADAPTER

Implement one generic adapter for an OpenAI-compatible HTTP endpoint.

The adapter should construct requests equivalent to:

```text
POST {AI_ROUTER_BASE_URL}/chat/completions
```

Use:

```text
Authorization: Bearer {AI_ROUTER_API_KEY}
Content-Type: application/json
```

Do not hardcode a specific provider.

Handle whether `AI_ROUTER_BASE_URL` already contains a trailing slash correctly.

Do not accidentally produce:

```text
//chat/completions
```

or:

```text
/chat/completions/chat/completions
```

depending on configuration.

Normalize the base URL safely.

---

# SERVER-ONLY SECURITY

The AI API key is a secret.

The following MUST NOT happen:

* importing the server secret into client components
* returning the secret from Server Actions
* putting it in browser-readable JSON
* putting it in `NEXT_PUBLIC_*`
* logging it
* including it in thrown errors
* exposing it through API responses
* storing it in the database

If the repository already has server-only guards, reuse them.

If a package requires server-only protection, follow the existing architecture.

---

# ENVIRONMENT CONFIGURATION

Use the existing environment validation architecture.

The existing variables are:

```text
AI_ROUTER_BASE_URL
AI_ROUTER_API_KEY
```

They are optional at the environment layer because the project may boot without AI configured.

Do NOT introduce:

```text
AI_ROUTER_DEFAULT_MODEL
```

unless an actual caller in this phase genuinely requires it.

There is currently no application AI caller requiring a default model.

Do not invent one.

Configuration errors should occur only when attempting to use the AI service, not when unrelated pages such as login/workspace/content pages are loaded.

---

# TIMEOUTS

The AI HTTP request must have a bounded timeout.

Do not allow requests to hang indefinitely.

Use the existing project conventions if available.

Otherwise implement a sensible server-side timeout using AbortController or equivalent.

The timeout must produce a normalized, non-secret error.

---

# ERROR HANDLING

Normalize at least:

1. missing configuration
2. authentication failure
3. rate limiting
4. upstream 4xx
5. upstream 5xx
6. network failure
7. timeout
8. malformed upstream response

Do not leak:

* API keys
* Authorization headers
* full request headers
* secrets contained in configuration
* unnecessary raw upstream payloads

Errors should be useful for server-side debugging without exposing credentials.

Do not blindly retry every error.

---

# RETRY POLICY

If implementing retries:

* keep them bounded
* never retry authentication failures
* never retry malformed requests
* never create an unbounded loop
* prefer retrying transient network/5xx/429 conditions only
* respect Retry-After when practical
* keep the total retry budget small

If retries add unnecessary complexity at this phase, a single bounded request with clear error handling is acceptable.

Do not build a job queue or background retry system.

---

# MODEL HANDLING

The model must be supplied by the caller.

Do not create a database model registry.

Do not create a provider/model management UI.

Do not hardcode one production model.

Do not create a fake default model merely to make tests pass.

The caller should be able to specify:

```text
model
```

for the request.

---

# HTTP IMPLEMENTATION

Prefer the platform's native `fetch`.

Do not add a heavy HTTP dependency unless there is a compelling repository-level reason.

If adding a dependency, explain why in the completion report.

---

# TESTING

Tests must verify the AI abstraction without requiring a real paid provider.

Use mocked HTTP/fetch behavior.

At minimum test:

### Configuration

* missing base URL
* missing API key
* valid configuration
* trailing slash normalization

### Request

* correct endpoint
* correct Authorization header
* correct Content-Type
* correct model
* correct messages
* optional parameters are handled correctly

### Response

* normal successful response
* normalized generated text
* model extraction
* usage extraction
* finish reason extraction

### Errors

* 401
* 403
* 429
* 400
* 500
* malformed JSON
* malformed successful response
* network failure
* timeout

### Security

Explicitly test that:

* API key never appears in normalized errors
* API key never appears in returned response objects
* Authorization header is not exposed to application callers

---

# IMPORTANT TEST CONSTRAINT

Do NOT call a real AI provider in automated tests.

Tests must be deterministic.

Do not require:

```text
AI_ROUTER_API_KEY
```

to run the normal test suite.

---

# NO CONTENT INTEGRATION YET

Although the Content domain exists, do NOT add:

```text
generateCaption()
analyzeContent()
processContentWithAI()
```

or similar workflow methods in this phase.

Do not modify Content status based on AI execution.

Do not add:

```text
processing
analyzing
caption_generating
caption_ready
failed
```

to the Content lifecycle.

The AI layer must remain infrastructure only.

---

# PACKAGE BOUNDARIES

Follow the existing monorepo architecture.

Prefer placing reusable AI contracts and implementation in an appropriate package such as:

```text
packages/ai
```

if that matches the repository's existing package structure.

Do not create unnecessary packages.

The final structure should make it clear that:

```text
application code
      ↓
AI abstraction
      ↓
OpenAI-compatible adapter
```

rather than:

```text
application code
      ↓
fetch()
```

---

# DOCUMENTATION

Update or create appropriate documentation explaining:

1. AI architecture
2. provider-neutral abstraction
3. OpenAI-compatible contract
4. environment variables
5. server-only secret handling
6. example request flow
7. testing strategy

Clearly state that OpenRouter is NOT an architectural dependency.

If an example endpoint is shown, label it as an example OpenAI-compatible endpoint only.

---

# SECURITY AUDIT

Before finishing, inspect the entire diff for:

* `NEXT_PUBLIC_AI`
* `OPENROUTER_API_KEY`
* hardcoded API keys
* hardcoded Authorization headers
* API key logging
* secrets in error messages
* client imports of server-only AI code
* database storage of AI credentials
* provider-specific application coupling

Also inspect package dependency direction.

The application must not become coupled directly to a specific AI vendor.

---

# REGRESSION PROTECTION

PHASE 0–3 behavior must continue working.

Do not break:

* authentication
* workspace isolation
* Content CRUD
* Content RLS
* existing Server Actions
* existing repositories
* existing build
* existing formatting

---

# REQUIRED VERIFICATION

Run all of:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

All must pass.

Also run an explicit repository search for provider lock-in and secret exposure.

---

# GIT

Do NOT commit automatically.

Leave the repository uncommitted after PHASE 4.

I will review the completion report and diff before deciding whether to commit.

---

# COMPLETION REPORT

When finished, report exactly:

```text
PHASE 4 COMPLETE

Implemented:
- ...

Architecture:
- ...

AIProvider Interface:
- ...

OpenAI-Compatible Adapter:
- ...

Configuration:
- ...

Security:
- ...

Timeout:
- ...

Error Handling:
- ...

Retry Behavior:
- ...

Model Handling:
- ...

Files Added:
- ...

Files Modified:
- ...

Dependencies Added:
- ...

Tests Added/Updated:
- ...

Mock HTTP Verification:
- ...

Security Tests:
- ...

Provider Lock-In Audit:
- ...

Regression Verification:
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

Git Status:
- ...

Ready For Next Phase:
- YES/NO
- Reason: ...
```

Do not claim completion unless every required verification command has actually been executed.

STOP after PHASE 4.

Do not begin PHASE 5.
