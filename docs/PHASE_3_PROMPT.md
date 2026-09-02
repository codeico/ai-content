# PHASE 3 — CONTENT DOMAIN FOUNDATION

You are working inside the existing repository:

```text
/Users/bangico/ai-content
```

Your task is to implement:

```text
PHASE 3 — CONTENT DOMAIN FOUNDATION
```

The following phases are already complete:

```text
PHASE 0 — Project Foundation
ARCHITECTURE ALIGNMENT — OpenAI-Compatible AI Router
PHASE 1 — Authentication Foundation
PHASE 2 — Workspace Foundation
```

PHASE 2 was committed as:

```text
b4d2212
```

Do NOT restart, redesign, or regress any previous phase.

Do NOT start PHASE 4 or any later phase.

---

# 1. PRIMARY OBJECTIVE

Implement the application's foundational content domain.

The eventual product will discover videos, analyze them, generate captions, transform content, and publish content to multiple social accounts.

However, this phase must implement ONLY the internal content data model and workspace-scoped content management foundation.

The conceptual architecture becomes:

```text
User
 │
 └── Workspace
       │
       └── Content
```

Future phases will attach:

```text
Content
 ├── source/discovery metadata
 ├── media assets
 ├── AI analysis
 ├── generated captions
 ├── publishing destinations
 └── publishing jobs
```

Those future systems MUST NOT be implemented in this phase.

---

# 2. FIRST ACTIONS

Before modifying anything, inspect the repository.

Run:

```bash
pwd
git status
git log -n 10 --oneline
find . -maxdepth 4 -type f | sort
```

Read completely:

```text
docs/MASTER_PRODUCT_SPEC.md
docs/TECHNICAL_ARCHITECTURE.md
docs/DATABASE_SCHEMA.md
docs/IMPLEMENTATION_ROADMAP.md
docs/CODING_RULES.md
docs/PHASE_0_PROMPT.md
docs/ARCHITECTURE_ALIGNMENT_PROMPT.md
docs/PHASE_1_PROMPT.md
docs/PHASE_2_PROMPT.md
```

Inspect the actual implementation of:

```text
apps/web/
packages/
supabase/migrations/
tests/
```

Pay particular attention to the existing:

```text
profiles
workspaces
workspace_members
RLS helpers
workspace repository
workspace Server Actions
workspace routes
Supabase typed clients
```

Do not assume the documentation and implementation are identical.

The actual repository is authoritative.

---

# 3. REQUIRED IMPLEMENTATION PLAN

Before writing code, produce a concise implementation plan identifying:

```text
Current workspace architecture

Existing database conventions

Content entity design

Content lifecycle

Workspace ownership relationship

RLS strategy

Required indexes

Required repository functions

Required Server Actions

Required routes/UI

Required tests

Expected migration files

Expected source files
```

Do not implement before understanding the existing workspace security model.

---

# 4. PHASE SCOPE

This phase includes ONLY:

```text
Content entity

Workspace-scoped content ownership

Content creation

Content listing

Content retrieval

Content metadata editing

Content deletion

Content status foundation

Content RLS

Content repository

Minimal content UI

Tests
```

This phase does NOT include:

```text
TikTok discovery
TikTok scraping
TikTok downloading
Instagram
Instagram OAuth
Instagram publishing
Social media APIs
AI
OpenAI
AI Router
OpenRouter
Caption generation
Video analysis
Video processing
FFmpeg
Media transcoding
Background workers
Queues
Scheduling
Notifications
PWA
Analytics
Billing
```

Do not implement any of these.

---

# 5. CONTENT DOMAIN CONCEPT

A Content record represents an item that belongs to exactly one workspace.

Conceptually:

```text
workspace
    │
    └── content
          ├── title
          ├── description
          ├── source metadata
          ├── status
          └── timestamps
```

Do not treat Content as an Instagram post.

Do not treat Content as a TikTok video.

Content is an internal product entity.

Future phases can associate a Content record with external sources and publishing destinations.

---

# 6. CONTENT TABLE

Create:

```text
content
```

under:

```text
public.content
```

Before deciding exact columns, inspect:

```text
docs/DATABASE_SCHEMA.md
docs/MASTER_PRODUCT_SPEC.md
```

Follow the documented schema where one exists.

The table must minimally support:

```text
id

workspace_id

title or equivalent human-readable metadata

status

created_at

updated_at
```

Do NOT add future integration columns merely because they might be useful.

---

# 7. DO NOT PREMATURELY MODEL EXTERNAL SOURCES

Do NOT create fields such as:

```text
tiktok_url
tiktok_video_id
source_platform
source_creator
source_url
original_video_url
download_url
instagram_media_id
```

unless the existing product specification explicitly requires them in the Content entity itself.

Prefer keeping external-source concerns separate.

A future phase may introduce:

```text
content_sources
```

or an equivalent domain entity.

Do not implement that future entity now unless the existing Phase 3 specification explicitly defines it as part of this phase.

---

# 8. CONTENT STATUS

The content entity needs a minimal lifecycle state.

Use the existing product specification if it defines the exact values.

If the specification does not define them, use the smallest useful state machine.

Recommended conceptual states:

```text
draft
ready
archived
```

Do NOT introduce states for future automation such as:

```text
processing
analyzing
caption_generating
scheduled
publishing
published
failed
```

Those states belong to later systems.

The purpose of this phase is content-domain foundation, not workflow orchestration.

---

# 9. STATUS CONSTRAINT

Status must be constrained at the database level.

Do not allow arbitrary strings.

Use either:

```text
CHECK constraint
```

or a PostgreSQL enum if that is consistent with the existing database conventions.

Choose the simpler approach unless the documentation specifies otherwise.

---

# 10. WORKSPACE RELATIONSHIP

Every Content record must belong to exactly one Workspace.

Conceptually:

```text
content.workspace_id
        ↓
workspaces.id
```

Use an explicit foreign key.

Do not allow orphaned content.

Do not allow a content record to belong to multiple workspaces.

---

# 11. DELETE BEHAVIOR

Think carefully about:

```text
workspace
    ↓
content
```

For this phase, workspace deletion should remove its content records cleanly unless the existing product specification explicitly requires preservation.

Do NOT allow:

```text
content
    ↓
workspace
```

to delete a workspace.

The foreign key direction must be safe.

Use:

```text
workspace deleted
→ content deleted
```

if consistent with the documented lifecycle.

---

# 12. CONTENT RLS

Enable RLS on:

```text
public.content
```

A user may access Content only when they are a member of the corresponding Workspace.

Conceptually:

```text
User
 ↓
workspace_members
 ↓
workspace
 ↓
content
```

Required behavior:

```text
Workspace member
→ can read content

Workspace member
→ can create content in that workspace

Workspace member
→ can update content in that workspace

Workspace member
→ can delete content in that workspace
```

Unless the existing product specification explicitly defines owner-only content mutations.

Do not assume workspace ownership is required for every content operation.

---

# 13. CROSS-WORKSPACE ISOLATION

This is mandatory.

If:

```text
User A
    Workspace A
        Content A

User B
    Workspace B
        Content B
```

then:

```text
User A
→ cannot read Content B

User A
→ cannot update Content B

User A
→ cannot delete Content B

User B
→ cannot read Content A

User B
→ cannot update Content A

User B
→ cannot delete Content A
```

Test this using actual RLS behavior.

Do not rely solely on application-level filtering.

---

# 14. RLS RECURSION

Reuse the safe membership strategy established in Phase 2.

Do not create:

```text
content policy
→ directly queries workspace_members

workspace_members policy
→ directly queries workspaces

workspaces policy
→ directly queries workspace_members
```

if this causes recursive policy evaluation.

Use the existing security-definer helper where appropriate.

Do not create a second competing authorization architecture without a strong reason.

---

# 15. CONTENT CREATION

Authenticated workspace members must be able to create Content.

Minimum required input:

```text
workspace_id
title
```

Status should default to:

```text
draft
```

Do not trust:

```text
user_id
owner_id
```

from the browser.

The authenticated identity comes from the Supabase session.

The server must verify that the authenticated user is a member of the requested workspace.

---

# 16. CONTENT INPUT VALIDATION

Use the existing Zod architecture.

Validate:

```text
workspace_id

title

status where explicitly editable
```

At minimum:

```text
title must not be empty after trimming

title must have a reasonable maximum length

workspace_id must be a valid UUID
```

Do not accept arbitrary status strings.

---

# 17. CONTENT LISTING

Implement workspace-scoped content listing.

The listing must:

```text
show only content belonging to the active workspace

respect RLS

not expose other workspaces

have deterministic ordering
```

Recommended ordering:

```text
created_at DESC
```

with a stable secondary key if necessary.

Do not implement:

```text
full-text search

advanced filters

pagination system

analytics

sorting UI
```

unless already explicitly required by the product specification.

Keep the first implementation simple.

---

# 18. CONTENT DETAIL

Implement a minimal content detail route.

Recommended conceptual structure:

```text
/app/workspaces/[workspaceId]/content/[contentId]
```

The exact route may differ if the current application structure requires it.

Requirements:

```text
workspace membership verified

content belongs to workspace

content is not accessible through another workspace URL

invalid UUID handled safely

missing/unauthorized content does not leak existence
```

Use the server-side authorization boundary.

Do not trust:

```text
workspaceId
contentId
```

as authorization.

---

# 19. CONTENT UPDATE

Implement basic content metadata editing.

At minimum:

```text
title
status
```

Only fields defined for Phase 3 may be changed.

The update must verify:

```text
authenticated user

workspace membership

content belongs to workspace
```

Do not allow a user to change:

```text
content.workspace_id
```

through a normal metadata update.

Moving content between workspaces is NOT part of this phase.

---

# 20. CONTENT DELETE

Implement content deletion.

The operation must verify:

```text
authenticated user

workspace membership

content belongs to requested workspace
```

After successful deletion:

```text
redirect to workspace content list
```

Do not implement:

```text
soft-delete
recycle bin
bulk delete
```

unless explicitly required by the product specification.

---

# 21. CONTENT REPOSITORY

Create a server-side repository following the existing workspace repository architecture.

It should provide only the operations needed by Phase 3.

Conceptually:

```text
createContent
listContent
getContent
updateContent
deleteContent
```

Do not expose database internals to UI components.

Do not create a generic repository framework.

Keep the repository explicit and small.

---

# 22. SERVER ACTIONS

Implement Server Actions for mutations.

Conceptually:

```text
createContent
updateContent
deleteContent
```

Each action must:

```text
re-read authenticated session server-side

validate input

verify workspace/content relationship

use authenticated Supabase client

allow RLS to enforce database authorization

return/redirect safely
```

Do not trust client-supplied user identity.

Do not use the admin client as a shortcut.

---

# 23. SERVER-SIDE AUTHORIZATION

Every mutation must independently establish:

```text
Who is the user?
```

and:

```text
Does that user have access to this workspace/content?
```

Do not rely on:

```text
hidden form fields

React state

URL visibility

client-side workspace selection
```

as security boundaries.

---

# 24. MINIMAL CONTENT UI

Extend the existing workspace page with a minimal content list.

Conceptually:

```text
Workspace
│
├── Workspace name
│
└── Content
     ├── Content A
     ├── Content B
     └── Create Content
```

Create a minimal form:

```text
Title
Create
```

Content detail page should expose:

```text
Title
Status
Created date
Updated date
Edit
Delete
```

Do NOT create a full production dashboard.

---

# 25. NO MEDIA UI

Do not display:

```text
video player
thumbnail processing
download button
upload pipeline
video transcoding status
```

There is no media-processing system yet.

Content is currently metadata only.

---

# 26. DATABASE INDEXES

Add indexes where justified.

At minimum consider:

```text
content.workspace_id
```

and ordering/query patterns such as:

```text
workspace_id + created_at
```

Do not create dozens of speculative indexes.

Every index should support an actual query implemented in this phase.

---

# 27. UPDATED_AT

Reuse the existing:

```text
set_updated_at()
```

mechanism established by earlier phases if appropriate.

Do not create duplicate timestamp trigger functions.

---

# 28. MIGRATION DISCIPLINE

Create a new timestamped migration.

Do NOT modify:

```text
20260901120000_create_workspaces.sql

20260901140000_fix_workspaces_owner_select_policy.sql
```

Those are historical migrations.

Create a forward migration only.

The migration should include:

```text
content table

constraints

foreign keys

indexes

updated_at trigger

RLS

policies
```

and nothing unrelated.

---

# 29. DATABASE SECURITY

Critical invariants must be enforced by PostgreSQL.

At minimum:

```text
workspace_id NOT NULL

title NOT NULL

valid status

foreign key to workspace

RLS enabled
```

Do not rely solely on TypeScript.

---

# 30. TEST REQUIREMENTS

Add meaningful tests.

At minimum cover:

```text
Content title validation

Content UUID validation

Valid status

Invalid status

Repository create behavior

Repository list behavior

Repository get behavior

Repository update behavior

Repository delete behavior

Workspace scoping
```

Where practical, test that repository queries always include workspace context.

Do not remove existing tests.

All Phase 0–2 tests must continue passing.

---

# 31. LIVE SUPABASE VERIFICATION

If the linked Supabase project is available, perform live verification.

Use temporary test users/workspaces.

Test:

```text
User A
→ Workspace A
→ Content A

User B
→ Workspace B
→ Content B
```

Verify:

```text
A can create Content A
A can read Content A
A can update Content A
A can delete Content A

B cannot read Content A
B cannot update Content A
B cannot delete Content A

B can create/read/update/delete Content B
```

Also verify:

```text
Workspace A deletion
→ Content A is deleted
```

if cascade deletion is selected.

---

# 32. LIVE RLS VERIFICATION

Do not merely verify through the application's UI.

Use the authenticated Supabase path to confirm RLS.

Explicitly test:

```text
cross-workspace SELECT
cross-workspace UPDATE
cross-workspace DELETE
cross-workspace INSERT
```

Unauthorized operations must be denied or produce zero affected rows according to the operation.

Document the exact observed behavior.

---

# 33. TEST DATA CLEANUP

After live verification:

Remove all temporary:

```text
users

profiles

workspaces

memberships

content
```

created specifically for testing.

Verify no orphaned test records remain.

Do not leave test data in the production project.

---

# 34. SECURITY REVIEW

Before declaring Phase 3 complete, explicitly inspect:

```text
Content RLS

Cross-workspace isolation

Workspace membership checks

Server Action authorization

Repository workspace scoping

Content ID tampering

Workspace ID tampering

Admin client usage

Service role exposure

Foreign key deletion behavior
```

The most important question:

> Can a valid authenticated user access another workspace's content by changing workspaceId/contentId in the URL or request payload?

The answer must be NO.

---

# 35. DO NOT IMPLEMENT CONTENT DISCOVERY

Even though the ultimate product concept involves random TikTok videos, DO NOT implement discovery now.

Do not add:

```text
TikTok scraping

TikTok API

TikTok downloader

TikTok search

Trending videos

Random video selection

Video URLs

Creator metadata
```

Those belong to a future content-discovery phase.

---

# 36. DO NOT IMPLEMENT AI

Do not use:

```text
AI_ROUTER_BASE_URL

AI_ROUTER_API_KEY
```

in application execution during this phase.

Do not create:

```text
AIProvider

OpenAICompatibleProvider

caption generator

AI analysis

prompt templates

model selection
```

AI belongs to Phase 4.

Preserve the architecture alignment.

---

# 37. DO NOT IMPLEMENT SOCIAL MEDIA

Do not create:

```text
instagram_accounts

social_accounts

Instagram OAuth

Meta API

publishing destinations
```

Those are future domain entities.

---

# 38. DO NOT IMPLEMENT JOBS

Do not create:

```text
jobs

queues

workers

cron

schedules

automation
```

The content domain must remain synchronous and simple in Phase 3.

---

# 39. DEPENDENCY DISCIPLINE

Do not add unnecessary dependencies.

Do NOT add:

```text
ORM

AI SDK

Instagram SDK

TikTok SDK

Queue library

Redis

BullMQ

FFmpeg

Media processing libraries
```

This phase should use the existing stack.

---

# 40. PRESERVE PHASE 2

Do not regress:

```text
Authentication

profiles

workspaces

workspace_members

workspace RLS

workspace repository

workspace Server Actions

workspace routes
```

Workspace tests must continue passing.

Do not rewrite the workspace authorization system merely to implement Content.

Reuse the existing security architecture.

---

# 41. ENVIRONMENT

Do not make any new environment variables required.

Especially:

```text
AI_ROUTER_BASE_URL
AI_ROUTER_API_KEY
```

must remain optional.

The project must still build without AI configuration.

---

# 42. REQUIRED VERIFICATION

Run:

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

All must pass.

If one fails:

```text
diagnose
→ fix root cause
→ rerun
```

Do not suppress failures.

---

# 43. FINAL DIFF REVIEW

Before completion:

```bash
git status
git diff --stat
git diff
```

If staged:

```bash
git diff --cached --stat
git diff --cached
```

Review every change.

Search specifically for forbidden scope:

```bash
grep -Rni "Instagram" apps packages supabase --exclude-dir=node_modules || true
grep -Rni "TikTok" apps packages supabase --exclude-dir=node_modules || true
grep -Rni "AI_ROUTER" apps packages supabase --exclude-dir=node_modules || true
grep -Rni "OpenAI" apps packages supabase --exclude-dir=node_modules || true
grep -Rni "schedule" apps packages supabase --exclude-dir=node_modules || true
grep -Rni "queue" apps packages supabase --exclude-dir=node_modules || true
grep -Rni "worker" apps packages supabase --exclude-dir=node_modules || true
```

Review all matches.

Do not blindly delete legitimate documentation references.

The purpose is to detect accidental implementation of future phases.

---

# 44. DEFINITION OF DONE

PHASE 3 is complete only when:

## Database

* [ ] content table exists
* [ ] workspace foreign key exists
* [ ] status constraint exists
* [ ] required NOT NULL constraints exist
* [ ] useful workspace query index exists
* [ ] updated_at works
* [ ] RLS enabled

## Content Lifecycle

* [ ] authenticated member can create content
* [ ] member can list workspace content
* [ ] member can retrieve content
* [ ] member can update content
* [ ] member can delete content
* [ ] content remains workspace-scoped

## Security

* [ ] cross-workspace SELECT denied
* [ ] cross-workspace INSERT denied
* [ ] cross-workspace UPDATE denied
* [ ] cross-workspace DELETE denied
* [ ] URL ID tampering cannot bypass authorization
* [ ] Server Actions verify session
* [ ] Admin client is not used as authorization shortcut
* [ ] service role is not exposed

## UI

* [ ] workspace shows content list
* [ ] create content works
* [ ] content detail route exists
* [ ] content metadata can be edited
* [ ] content can be deleted

## Verification

* [ ] npm run lint → PASS
* [ ] npm run typecheck → PASS
* [ ] npm test → PASS
* [ ] npm run build → PASS
* [ ] npm run format:check → PASS

## Live Verification

When Supabase is available:

* [ ] Content CRUD verified
* [ ] Cross-workspace RLS verified
* [ ] Workspace cascade behavior verified
* [ ] Test data cleaned up

---

# 45. REQUIRED COMPLETION REPORT

When finished, respond exactly:

```text
PHASE 3 COMPLETE

Implemented:
- ...

Content Model:
- ...

Database Changes:
- ...

Migration:
- ...

Content Lifecycle:
- ...

RLS Policies:
- ...

Repository:
- ...

Server Actions:
- ...

Routes:
- ...

UI:
- ...

Files Added:
- ...

Files Modified:
- ...

Dependencies Added:
- ...

Tests Added/Updated:
- ...

Live Supabase Verification:
- ...

Live RLS Verification:
- ...

Test Data Cleanup:
- ...

Verification:
- npm run lint → PASS/FAIL
- npm run typecheck → PASS/FAIL
- npm test → PASS/FAIL
- npm run build → PASS/FAIL
- npm run format:check → PASS/FAIL

Security Review:
- Cross-workspace SELECT → ...
- Cross-workspace INSERT → ...
- Cross-workspace UPDATE → ...
- Cross-workspace DELETE → ...
- URL/request tampering → ...
- Server Action authorization → ...
- Admin client usage → ...
- Foreign key behavior → ...

Known Limitations:
- ...

Explicitly Not Implemented:
- ...

Ready For Next Phase:
- YES/NO
- Reason: ...
```

Do not claim live verification unless it actually happened.

Do not claim RLS is secure merely because policies exist.

---

# 46. FINAL REMINDER

You are implementing:

```text
PHASE 3 ONLY
```

The goal is:

```text
Secure Content Domain Foundation
```

NOT:

```text
TikTok discovery
```

NOT:

```text
TikTok scraping
```

NOT:

```text
Video downloading
```

NOT:

```text
AI caption generation
```

NOT:

```text
AI Router
```

NOT:

```text
Instagram integration
```

NOT:

```text
Scheduling
```

NOT:

```text
Publishing
```

NOT:

```text
Background jobs
```

Implement the smallest secure Content foundation required by the architecture.

Stop immediately after PHASE 3 is complete.

Do NOT start PHASE 4.

# END OF PHASE 3 PROMPT
