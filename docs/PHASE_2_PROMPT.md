# PHASE 2 — WORKSPACE FOUNDATION

You are working inside the existing repository:

```text
/Users/bangico/ai-content
```

Your task is to implement:

```text
PHASE 2 — WORKSPACE FOUNDATION
```

PHASE 0, Architecture Alignment, and PHASE 1 are complete.

Do NOT restart or redesign previous phases.

Do NOT start PHASE 3 or any later phase.

---

# 1. PRIMARY OBJECTIVE

Implement a secure multi-workspace foundation.

The product will eventually support multiple content operations owned by one user.

Examples:

```text
User
│
├── Workspace: Coding
│
├── Workspace: Trading
│
└── Workspace: Business
```

A workspace represents an independent content operation.

Future phases may attach:

```text
Content sources

Content strategies

AI configuration

Social media accounts

Schedules

Publishing jobs
```

to a workspace.

This phase implements only the workspace foundation.

---

# 2. FIRST ACTIONS

Before modifying any code, inspect the repository.

Run:

```bash
pwd
git status
git log -n 10 --oneline
find . -maxdepth 3 -type f | sort
```

Then read completely:

```text
docs/MASTER_PRODUCT_SPEC.md
docs/TECHNICAL_ARCHITECTURE.md
docs/DATABASE_SCHEMA.md
docs/IMPLEMENTATION_ROADMAP.md
docs/CODING_RULES.md
docs/PHASE_0_PROMPT.md
docs/ARCHITECTURE_ALIGNMENT_PROMPT.md
docs/PHASE_1_PROMPT.md
```

Then inspect:

```text
apps/web/
packages/
supabase/migrations/
tests/
README.md
```

Do not assume documentation is perfectly synchronized with the current implementation.

Inspect the actual repository.

---

# 3. REQUIRED IMPLEMENTATION PLAN

Before implementing anything, create a concise implementation plan.

The plan must identify:

```text
Current authentication architecture

Current profiles schema

Existing Supabase migration conventions

Workspace schema required

Membership schema required

Ownership model

RLS strategy

Required routes

Required Server Actions

Required tests

Files expected to change

Files expected to be created

Verification commands
```

Do not begin implementation until the existing Phase 1 architecture is understood.

---

# 4. PHASE SCOPE

This phase includes only:

```text
Workspaces

Workspace ownership

Workspace membership foundation

Workspace creation

Workspace listing

Workspace selection

Workspace update

Workspace deletion

Workspace-scoped authorization

RLS

Minimal workspace UI
```

This phase does NOT include:

```text
Instagram accounts

TikTok accounts

OAuth

Social media APIs

Content sources

Content discovery

Video downloading

Media processing

AI generation

AI Router integration

Captions

Scheduling

Publishing

Background jobs

Notifications

PWA

Analytics

Billing

Subscription

Collaboration features
```

Do not implement future features.

---

# 5. CORE DATA MODEL

The workspace architecture should support future growth.

Target conceptual model:

```text
auth.users
    │
    │ 1:1
    ▼
profiles
    │
    │ membership
    ▼
workspace_members
    │
    ▼
workspaces
```

The implementation must support:

```text
One user → many workspaces

One workspace → many members in the future

One workspace → one owner initially
```

Do not assume:

```text
One user = one workspace
```

Do not assume:

```text
One workspace = one social media account
```

Those are explicitly incorrect assumptions.

---

# 6. WORKSPACES TABLE

Create a new migration.

Create:

```text
workspaces
```

Before designing the exact schema, inspect:

```text
docs/DATABASE_SCHEMA.md
```

The minimum workspace structure should support:

```text
id

name

slug or stable identifier if justified

owner identity

created_at

updated_at
```

Do not add unrelated future columns.

Examples of forbidden premature columns:

```text
instagram_username

instagram_token

tiktok_url

ai_model

posting_schedule

content_niche
```

Those belong to later phases.

---

# 7. WORKSPACE OWNERSHIP

Each workspace must have a clear owner.

Ownership must be represented in a way that supports:

```text
Authorization

RLS

Future membership

Workspace deletion

Future ownership transfer if required
```

The owner should reference:

```text
profiles.id
```

or the appropriate authenticated user identity based on the existing schema.

Do not duplicate ownership information unnecessarily.

The ownership model must be explicit.

---

# 8. WORKSPACE MEMBERS

Create:

```text
workspace_members
```

even if the current UI does not expose collaboration yet.

This table establishes the correct future authorization model.

Minimum conceptual fields:

```text
workspace_id

profile_id

role

created_at
```

Do not implement invitations.

Do not implement team management UI.

Do not implement collaboration workflows.

The table exists because future phases must support workspace-scoped resources.

---

# 9. MEMBERSHIP ROLE

For Phase 2, keep roles minimal.

Recommended initial roles:

```text
owner

member
```

Do not create:

```text
admin

editor

viewer

billing_manager

publisher

content_manager
```

unless explicitly required by existing product documentation.

Avoid premature RBAC complexity.

The important distinction is:

```text
Workspace Owner
```

versus:

```text
Workspace Member
```

Future phases can expand roles.

---

# 10. OWNER MEMBERSHIP

When a workspace is created:

The owner should also have a corresponding membership record.

The system must guarantee:

```text
Workspace owner
↓
Automatically becomes workspace member
↓
role = owner
```

This should not depend on fragile client-side sequencing.

Preferred approach:

```text
Database-level trigger
```

or another reliable server-side mechanism.

Choose the simplest reliable architecture compatible with Supabase.

Requirements:

```text
No duplicate owner membership

No workspace without owner membership

No client-side race condition
```

Document the chosen approach.

---

# 11. UNIQUE MEMBERSHIP

A profile must not have duplicate membership records for the same workspace.

Enforce at the database level.

Expected conceptual constraint:

```text
UNIQUE(workspace_id, profile_id)
```

Do not rely only on application code.

---

# 12. RLS — WORKSPACES

Enable RLS.

Users must only access workspaces where they are members.

At minimum:

```text
Member
→ Can read workspace

Owner
→ Can update workspace

Owner
→ Can delete workspace

Authenticated non-member
→ Cannot access workspace
```

Do not create overly broad policies.

Do not use:

```sql
auth.uid() IS NOT NULL
```

as unrestricted access.

Policies must verify actual membership.

---

# 13. RLS — WORKSPACE MEMBERS

Enable RLS.

A user must not be able to inspect arbitrary workspace memberships.

At minimum:

```text
Workspace member
→ Can read membership rows for workspaces they belong to
```

For Phase 2:

Do NOT implement member management UI.

Do NOT implement arbitrary membership insertion from the client.

Workspace creation logic should safely establish the owner membership.

Be careful about recursive RLS policies.

Before writing policies, reason explicitly about:

```text
workspaces policy
↓
checks workspace_members

workspace_members policy
↓
checks workspaces
```

Avoid infinite recursion.

---

# 14. RLS RECURSION SAFETY

Do not create policies that recursively depend on each other.

Example dangerous pattern:

```text
workspaces policy
→ query workspace_members

workspace_members policy
→ query workspaces

→ recursive RLS
```

Use a safe strategy.

Possible approaches include:

```text
Security definer helper functions
```

or another architecture compatible with Supabase.

If using:

```sql
SECURITY DEFINER
```

requirements include:

```text
Explicit safe search_path

Minimal privilege

Clear purpose

No user-controlled SQL
```

Do not expose a generic privileged helper.

Keep helper functions narrowly scoped.

---

# 15. WORKSPACE CREATION

Authenticated users must be able to create a workspace.

Minimum input:

```text
Workspace name
```

Validate:

```text
Required

Trim whitespace

Reject empty names

Reasonable maximum length
```

Do not implement future workspace configuration.

Creation must:

```text
Create workspace

Assign owner

Create owner membership
```

The result must be atomic enough that partial workspace state is not created.

Do not rely on multiple unrelated browser calls.

---

# 16. WORKSPACE LISTING

Authenticated users must be able to see their workspaces.

The list must contain only workspaces where the authenticated user is a member.

Do not trust client-side filtering.

The server/database authorization boundary must enforce access.

The initial UI can display:

```text
Workspace name

Role

Creation date if useful
```

Keep it minimal.

---

# 17. ACTIVE WORKSPACE

The application needs a concept of an active workspace.

However:

Do NOT prematurely persist active workspace selection to the database unless clearly justified.

For Phase 2, a route-based approach is preferred.

Recommended structure:

```text
/app
```

Lists workspaces.

Then:

```text
/app/workspaces/[workspaceId]
```

represents the active workspace context.

The workspace must be verified server-side before rendering.

A user must not access:

```text
/app/workspaces/[workspaceId]
```

for a workspace they do not belong to.

Do not trust route parameters alone.

---

# 18. WORKSPACE DETAIL PAGE

Create a minimal protected workspace page.

Example:

```text
Workspace

Name

Your role

Workspace ID

Basic actions
```

This is NOT a dashboard.

Do not implement:

```text
Content statistics

Analytics

Instagram metrics

Content queue

AI controls
```

The page only proves:

```text
Workspace context works

Authorization works

Workspace-scoped routes work
```

---

# 19. WORKSPACE UPDATE

The workspace owner must be able to update basic workspace metadata.

For Phase 2, only support:

```text
name
```

Do not implement:

```text
AI configuration

Niche configuration

Social accounts

Schedules

Brand configuration
```

Authorization must be enforced server-side and by RLS.

A member must not be able to rename a workspace unless explicitly documented otherwise.

---

# 20. WORKSPACE DELETION

Implement workspace deletion carefully.

Only the owner may delete a workspace.

Before deletion:

Verify ownership server-side.

Do not trust hidden UI state.

Database relationships should handle dependent records appropriately.

At this phase, dependencies should primarily be:

```text
workspace_members
```

Deletion must not accidentally affect unrelated workspaces or profiles.

After deletion:

```text
Redirect to workspace list
```

Do not implement soft-delete unless required by the documentation.

Keep Phase 2 simple.

---

# 21. SLUG DECISION

Do not automatically add a slug.

A slug should only be added if the existing product documentation requires:

```text
Human-readable workspace URLs
```

Otherwise use UUID identifiers.

Do not introduce slug uniqueness and slug regeneration complexity without a real requirement.

---

# 22. DATABASE MIGRATION

Create a new timestamped migration under:

```text
supabase/migrations/
```

The migration should contain only Phase 2 database changes.

Expected areas:

```text
workspaces

workspace_members

constraints

indexes

triggers or helper functions if required

RLS

policies
```

Do not modify the Phase 1 migration.

Do not edit historical migrations.

---

# 23. DATABASE CONSTRAINTS

Use database constraints for invariants.

At minimum consider:

```text
Primary keys

Foreign keys

Unique membership constraint

Role constraint

Non-null required fields
```

Do not rely only on TypeScript validation.

The database must protect critical relationships.

---

# 24. DELETE BEHAVIOR

Define foreign key delete behavior explicitly.

Think through:

```text
User deleted
→ Profile deleted

Profile deleted
→ Membership deleted

Workspace deleted
→ Membership deleted
```

The behavior must be intentional.

Do not leave critical relationships ambiguous.

Do not accidentally cascade deletion from:

```text
workspace
```

to:

```text
profile
```

or:

```text
auth.users
```

---

# 25. SERVER ACTIONS

Workspace mutations should use server-side boundaries.

Appropriate actions include:

```text
createWorkspace

updateWorkspace

deleteWorkspace
```

Requirements:

```text
Server-side validation

Authenticated user verification

Authorization verification

Safe error handling

No trust in client identity input
```

Do not accept:

```text
owner_id
```

from the browser as trusted authority.

Derive ownership from the authenticated session.

---

# 26. INPUT VALIDATION

Use the existing validation approach.

The project already includes:

```text
Zod
```

Reuse it.

At minimum validate:

```text
Workspace name

Workspace ID where applicable
```

Do not duplicate validation unnecessarily.

---

# 27. ERROR HANDLING

User-facing errors should be understandable.

Examples:

```text
Workspace name is required

You do not have access to this workspace

Unable to create workspace

Unable to update workspace
```

Do not expose:

```text
Raw SQL errors

Supabase internals

Stack traces

Secrets
```

---

# 28. MINIMAL UI REQUIREMENTS

Implement only what is required to verify the workspace system.

Recommended:

```text
/app

- Workspace list
- Create workspace action
```

```text
/app/workspaces/[workspaceId]

- Workspace name
- Current user's role
- Rename workspace
- Delete workspace
```

Do not build a final dashboard.

Keep the UI intentionally minimal.

---

# 29. AUTHENTICATION INTEGRATION

Reuse the Phase 1 authentication system.

Do not create another authentication layer.

Every workspace operation must derive the user from:

```text
Current authenticated Supabase session
```

Do not accept user IDs from client forms as authority.

---

# 30. TEST REQUIREMENTS

Add meaningful tests.

At minimum test:

```text
Workspace name validation

Workspace ID validation if implemented

Ownership decision logic

Member access logic

Owner-only mutation logic

Unauthorized access rejection
```

Where practical, test database assumptions.

Do not require live Supabase credentials for unit tests.

Existing tests must remain passing.

Do not remove tests.

---

# 31. LIVE SUPABASE VERIFICATION

If a real Supabase project is configured, perform live verification.

Recommended verification flow:

### User A

```text
Create User A

Create Workspace A

Verify owner membership created automatically

Verify User A can read Workspace A

Verify User A can rename Workspace A
```

### User B

```text
Create User B

Attempt to read Workspace A

Attempt to update Workspace A

Attempt to delete Workspace A
```

All unauthorized operations must fail or return zero rows according to the API path.

Verify directly against Supabase where practical.

Do not rely only on application UI.

---

# 32. LIVE RLS TESTING

If live verification is possible, explicitly test:

```text
User A owns Workspace A

User B is not a member

User B SELECT Workspace A
→ denied / zero rows

User B UPDATE Workspace A
→ denied / zero rows

User B DELETE Workspace A
→ denied / zero rows
```

Also test membership visibility.

Verify that User B cannot enumerate unrelated workspace membership data.

If a database helper function is used:

Test that it does not accidentally grant access.

---

# 33. TEST DATA CLEANUP

If real users and workspaces are created for verification:

Clean them up after testing.

Verify cleanup.

Do not leave:

```text
Test workspaces

Test memberships

Test profiles

Test users
```

unless intentionally retained.

Report cleanup results.

---

# 34. SECURITY REVIEW

Before declaring Phase 2 complete, explicitly review:

```text
Workspace ownership

Membership uniqueness

RLS policies

RLS recursion

Owner-only mutations

Route authorization

Server Action authorization

Cross-workspace access

Foreign key cascades
```

Do not declare completion based only on UI behavior.

Database security must be verified independently.

---

# 35. NO FUTURE RESOURCE TABLES

Do NOT create:

```text
contents

content_sources

content_items

social_accounts

instagram_accounts

media_assets

jobs

schedules

captions

ai_generations
```

Those belong to future phases.

The only new domain foundation in this phase should be:

```text
workspaces

workspace_members
```

and supporting database security infrastructure.

---

# 36. DEPENDENCY DISCIPLINE

Do not add dependencies unless genuinely required.

Do NOT add:

```text
ORM

Redux

State machine framework

Queue library

OAuth library

Social media SDK

AI SDK
```

This phase should primarily use:

```text
Next.js

Supabase

Zod

Existing project tooling
```

---

# 37. PRESERVE PREVIOUS PHASES

Do not regress:

```text
Phase 0 foundation

Environment validation

Supabase client boundaries

Authentication

Profile creation

Profile RLS

Route protection

AI Router architecture alignment
```

Specifically verify:

```text
npm run build
```

still works without:

```text
AI_ROUTER_BASE_URL

AI_ROUTER_API_KEY
```

configured.

Do not accidentally make future AI configuration required.

---

# 38. REQUIRED VERIFICATION

Before completion run:

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

All commands must pass.

If a command fails:

```text
Diagnose
↓
Fix root cause
↓
Re-run
```

Do not hide failures.

---

# 39. REQUIRED LIVE APPLICATION VERIFICATION

If Supabase is configured, verify in a running browser:

```text
Anonymous user
→ Cannot access /app

Authenticated user
→ Can access /app

Authenticated user
→ Can create workspace

Workspace owner
→ Can open workspace detail

Workspace owner
→ Can rename workspace

Workspace owner
→ Can delete workspace
```

Do not claim browser verification unless actually performed.

---

# 40. FINAL REPOSITORY REVIEW

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

Search for scope creep:

```bash
grep -Rni "Instagram" apps packages supabase --exclude-dir=node_modules || true
grep -Rni "TikTok" apps packages supabase --exclude-dir=node_modules || true
grep -Rni "OpenAI" apps packages supabase --exclude-dir=node_modules || true
grep -Rni "schedule" apps packages supabase --exclude-dir=node_modules || true
grep -Rni "content" apps packages supabase --exclude-dir=node_modules || true
```

Review matches.

No future feature implementation should exist.

---

# 41. DEFINITION OF DONE

PHASE 2 is complete only when all conditions are true.

## Database

* [ ] workspaces table exists
* [ ] workspace_members table exists
* [ ] ownership relationship exists
* [ ] unique membership constraint exists
* [ ] role constraint exists
* [ ] foreign keys are correct
* [ ] delete behavior is intentional

## Workspace Lifecycle

* [ ] Authenticated user can create workspace
* [ ] Owner membership created reliably
* [ ] User can list accessible workspaces
* [ ] User can access authorized workspace
* [ ] Owner can rename workspace
* [ ] Owner can delete workspace

## Security

* [ ] RLS enabled on workspaces
* [ ] RLS enabled on workspace_members
* [ ] Non-members cannot access workspace
* [ ] Members cannot modify owner-only data
* [ ] Cross-workspace access prevented
* [ ] No recursive RLS failure
* [ ] Server Actions verify authorization

## Routes

* [ ] /app lists workspaces
* [ ] workspace detail route exists
* [ ] workspace route verifies membership
* [ ] unauthorized workspace access denied

## Verification

* [ ] npm run lint passes
* [ ] npm run typecheck passes
* [ ] npm test passes
* [ ] npm run build passes
* [ ] npm run format:check passes

## Live Verification

If Supabase credentials are available:

* [ ] Workspace creation verified
* [ ] Owner membership verified
* [ ] Cross-user RLS verified
* [ ] Unauthorized update verified
* [ ] Unauthorized delete verified
* [ ] Test data cleaned up

---

# 42. REQUIRED COMPLETION REPORT

When finished, respond exactly using this structure:

```text
PHASE 2 COMPLETE

Implemented:
- ...

Workspace Model:
- ...

Database Changes:
- ...

Migration:
- ...

Ownership Model:
- ...

Membership Model:
- ...

RLS Policies:
- ...

Server Actions:
- ...

Routes:
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
- Ownership enforcement → ...
- Membership enforcement → ...
- RLS recursion → ...
- Cross-workspace access → ...
- Server Action authorization → ...
- Foreign key deletion behavior → ...

Known Limitations:
- ...

Explicitly Not Implemented:
- ...

Ready For Next Phase:
- YES/NO
- Reason: ...
```

Do not claim live verification unless it actually occurred.

Do not claim Phase 2 is complete if RLS was only inspected but not meaningfully tested when a live Supabase project was available.

---

# 43. FINAL REMINDER

You are implementing:

```text
PHASE 2 ONLY
```

The goal is:

```text
Secure workspace foundation
```

The goal is NOT:

```text
Final dashboard
```

NOT:

```text
Social media account integration
```

NOT:

```text
AI integration
```

NOT:

```text
Content automation
```

NOT:

```text
Scheduling
```

Implement the smallest secure workspace architecture necessary for future phases.

Stop immediately after Phase 2 is complete.

Do NOT start Phase 3.

# END OF PHASE 2 PROMPT
