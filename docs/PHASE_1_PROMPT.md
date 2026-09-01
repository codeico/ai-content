# PHASE 1 — AUTHENTICATION FOUNDATION

You are working inside the existing repository:

```text
/Users/bangico/ai-content
```

Your task is to implement:

```text
PHASE 1 — AUTHENTICATION FOUNDATION
```

This phase begins only after:

```text
PHASE 0 — Project Foundation
ARCHITECTURE ALIGNMENT — OpenAI-Compatible AI Router
```

Both previous stages are complete.

Do NOT redesign or restart them.

Do NOT start Phase 2 or any later phase.

---

# 1. PRIMARY OBJECTIVE

Implement a secure Supabase authentication foundation.

At the end of this phase, the application must support:

```text
User registration

User login

User logout

Session persistence

Protected routes

Authenticated user retrieval

Profile creation

Profile ownership security
```

The implementation must use:

```text
Supabase Auth
```

The authentication architecture must work correctly with:

```text
Next.js App Router
React Server Components
Server Actions where appropriate
Middleware or current recommended route protection mechanisms
Supabase SSR
```

Do not implement product features beyond authentication.

---

# 2. FIRST ACTIONS

Before writing or modifying code, inspect the actual repository.

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
```

Then inspect the existing implementation:

```text
README.md

.env.example

package.json

apps/web/

packages/shared/

packages/database/

tests/
```

Do not assume documentation matches implementation.

The repository state is authoritative.

---

# 3. REQUIRED IMPLEMENTATION PLAN

Before making changes, create a concise implementation plan.

The plan must identify:

```text
Current authentication state

Existing Supabase client architecture

Required database migration(s)

Required RLS policies

Required routes/pages

Session handling strategy

Profile creation strategy

Files expected to be created

Files expected to be modified

Verification commands
```

Do not implement anything before understanding the existing architecture.

---

# 4. PHASE SCOPE

This phase includes only:

```text
Supabase Auth integration

Signup

Login

Logout

Session handling

Protected routes

Authenticated user retrieval

profiles table

Profile creation

Basic RLS

Minimal auth UI
```

This phase does NOT include:

```text
Workspace creation

Multi-user workspace membership

Roles beyond authentication ownership foundation

Content management

Content discovery

TikTok integration

Video downloading

Media processing

AI analysis

Caption generation

AI Router integration

Background jobs

Scheduling

Instagram publishing

Push notifications

PWA

Full dashboard

Billing

Subscription
```

Do not implement future functionality.

---

# 5. SUPABASE PROJECT REQUIREMENT

Before implementing database-dependent functionality, verify whether a real Supabase project is configured.

Check:

```text
NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY
```

Do not print secret values.

If `.env.local` is missing or Supabase credentials are unavailable:

Do NOT invent credentials.

Do NOT fake a Supabase implementation.

Do NOT silently replace Supabase Auth with local authentication.

You may implement all code and migrations that do not require live credentials.

Clearly report any live integration verification that could not be completed.

However, if valid Supabase credentials are available, use them only through the existing secure server-side architecture.

Never expose the service role key.

---

# 6. AUTHENTICATION ARCHITECTURE

Use the existing Supabase client boundaries established in Phase 0.

Expected separation:

```text
Browser Client
    ↓
Used only in browser-safe contexts

Server Client
    ↓
Used for Server Components / Server Actions / Route Handlers

Admin Client
    ↓
Server-only privileged operations
```

Do not redesign these boundaries unnecessarily.

Do not expose:

```text
SUPABASE_SERVICE_ROLE_KEY
```

to the browser.

Do not use the admin client for normal user authentication flows unless absolutely required.

Normal authentication must respect user context.

---

# 7. REQUIRED AUTHENTICATION FLOWS

Implement:

## Signup

A new user must be able to:

```text
Enter email

Enter password

Create account
```

Use Supabase Auth.

Do not store passwords manually.

Do not create custom password hashing.

After signup, handle the result correctly depending on Supabase email confirmation settings.

The application must not assume:

```text
Signup always creates an active session
```

Support both:

```text
Immediate session creation
```

and:

```text
Email confirmation required
```

Show an appropriate user-facing state.

Do not leak implementation errors.

---

# 8. LOGIN

Implement login using:

```text
Email
Password
```

Requirements:

```text
Correct Supabase authentication call

Validation before submission

Safe error handling

Loading state

No password logging

No secret exposure
```

After successful authentication:

```text
Redirect authenticated user appropriately
```

Do not redirect users into unimplemented future dashboards unless a minimal protected application page exists.

---

# 9. LOGOUT

Implement logout.

Requirements:

```text
Invalidate Supabase session

Clear authentication state

Redirect to public page or login page
```

Verify logout behavior does not leave protected content accessible.

---

# 10. SESSION HANDLING

Implement proper session persistence for Next.js App Router.

The architecture must correctly support:

```text
Server Components

Server Actions

Route protection

Browser navigation

Page refresh
```

Do not rely only on client-side state.

Authentication state must be verifiable on the server.

Do not implement security based solely on:

```text
localStorage
```

or client-side React state.

---

# 11. ROUTE PROTECTION

Create a minimal route structure.

Recommended conceptual structure:

```text
/
    Public landing page

/login
    Login page

/signup
    Signup page

/app
    Protected authenticated area
```

The exact route structure may differ if existing architecture requires it.

However:

```text
/app
```

or equivalent must be server-protected.

Unauthenticated access must redirect to login.

Authenticated users should not be unnecessarily shown login/signup pages.

Avoid redirect loops.

---

# 12. AUTHENTICATED APPLICATION SHELL

Create only a minimal protected application page.

Example:

```text
AI Content

Authenticated successfully

User email

Logout button
```

This is NOT the final dashboard.

Do not implement:

```text
Navigation system

Workspace switcher

Content feed

Analytics

Settings dashboard
```

The purpose is only to verify:

```text
Authentication works

Protected routes work

Server-side user retrieval works
```

---

# 13. DATABASE — PROFILES TABLE

Implement the first application database migration.

Create:

```text
profiles
```

The table should represent application-level user identity linked to:

```text
auth.users
```

Minimum expected fields should be based on the existing database documentation.

Before creating the migration:

Read:

```text
docs/DATABASE_SCHEMA.md
```

Do not invent unrelated columns.

The profile table should generally support:

```text
id

auth user ownership

created timestamp

updated timestamp
```

Additional fields may be included only when documented and justified.

Important:

```text
profiles.id
```

must be tied to:

```text
auth.users.id
```

using the correct PostgreSQL UUID relationship.

Do not duplicate authentication credentials.

---

# 14. PROFILE CREATION STRATEGY

Implement reliable profile creation.

Preferred approach:

```text
Database trigger on auth.users
```

if compatible with the documented architecture.

Alternative approaches may be used only if clearly justified.

The key requirement is:

> A newly created authenticated user should reliably receive a corresponding profile record.

Requirements:

```text
No duplicate profile creation

No dependency on client-side timing

No requirement that the user visits a specific page first

Safe failure behavior
```

Do not use fragile client-side profile creation after signup as the primary mechanism.

If a database trigger is used:

```text
Keep the migration readable

Use security-aware PostgreSQL functions

Avoid unsafe search_path behavior

Document ownership assumptions
```

---

# 15. UPDATED_AT HANDLING

If the schema includes:

```text
updated_at
```

implement a reliable update strategy.

Prefer a reusable database trigger function if appropriate.

Do not duplicate unnecessary trigger logic.

Keep the migration minimal.

---

# 16. ROW LEVEL SECURITY

Enable RLS for:

```text
profiles
```

At minimum:

Users must be able to:

```text
Read their own profile

Update their own profile
```

Users must NOT be able to:

```text
Read arbitrary user profiles

Update another user's profile

Insert arbitrary profiles pretending to be another user
```

The profile creation mechanism must remain compatible with the chosen strategy.

Do not use:

```text
auth.uid() IS NOT NULL
```

as a blanket unrestricted policy.

Policies must enforce actual ownership.

Expected conceptual ownership rule:

```sql
auth.uid() = id
```

Use the correct SQL syntax and migration structure.

---

# 17. DATABASE MIGRATION DISCIPLINE

Create actual migration files under:

```text
supabase/migrations/
```

Use a clear timestamped naming convention.

Do not edit an already-applied migration.

Since this is the first application migration, create a new migration cleanly.

The migration should include:

```text
profiles table

foreign key relationship

timestamps

profile creation mechanism

RLS enablement

ownership policies
```

Do not add:

```text
workspaces

contents

jobs

providers

instagram accounts
```

Those belong to later phases.

---

# 18. MIGRATION IDEMPOTENCY

Do not design migrations to be repeatedly executed manually using excessive:

```sql
IF EXISTS
```

or:

```sql
IF NOT EXISTS
```

everywhere.

Supabase migrations are ordered migration history.

Write normal forward migrations.

Only use defensive SQL where genuinely required.

Do not hide migration mistakes.

---

# 19. AUTH UI

Implement minimal authentication pages.

Required:

```text
Signup form

Login form
```

Requirements:

```text
Accessible labels

Email validation

Password validation

Loading states

Error states

Keyboard accessibility

Reasonable mobile layout
```

Do not spend time building the final product design system.

Do not add a component library unless already justified by the project.

Use the existing Tailwind foundation.

---

# 20. FORM VALIDATION

Use appropriate validation.

The project already contains:

```text
Zod
```

Reuse existing validation architecture where appropriate.

Requirements:

```text
Validate email

Validate password presence

Apply reasonable minimum password rules

Show useful validation feedback
```

Do not duplicate validation logic unnecessarily.

Do not expose Supabase internals directly to users.

---

# 21. SERVER ACTIONS

Server Actions may be used for:

```text
Signup

Login

Logout
```

if appropriate for the existing Next.js architecture.

Requirements:

```text
Validate input server-side

Do not trust browser validation

Return safe error messages

Redirect only after successful authentication state changes
```

Do not expose service role credentials.

---

# 22. ERROR HANDLING

Authentication errors should be handled safely.

Do not:

```text
Expose stack traces

Expose environment variables

Expose internal Supabase configuration

Reveal secrets
```

User-facing messages should be understandable.

Examples:

```text
Invalid email or password

Unable to create account

Please check your email for confirmation
```

Do not blindly display raw provider error strings.

---

# 23. PASSWORD SECURITY

Never:

```text
Log passwords

Store passwords in the database

Return passwords from server actions

Include passwords in errors

Persist passwords in localStorage
```

Passwords must only be handled transiently for Supabase authentication.

---

# 24. AUTH REDIRECTION RULES

Implement predictable route behavior.

Suggested rules:

```text
Unauthenticated user → protected route
↓
Redirect to /login

Authenticated user → /login
↓
Redirect to /app

Authenticated user → /signup
↓
Redirect to /app
```

Avoid infinite redirect loops.

Preserve intended destination only if implemented safely.

Do not over-engineer return URLs during this phase.

---

# 25. SUPABASE SSR

Use the existing Supabase SSR dependency:

```text
@supabase/ssr
```

Follow current supported patterns compatible with the installed version.

Do not use obsolete Supabase Auth Helpers packages.

Do not add deprecated authentication packages.

Before implementation, inspect installed dependency versions.

---

# 26. MIDDLEWARE / PROXY / ROUTE GUARD

Use the current recommended Next.js and Supabase pattern compatible with the installed versions.

Do not blindly copy outdated examples.

Inspect:

```text
Next.js version

@supabase/ssr version
```

Then implement the correct request/session refresh mechanism.

The architecture must ensure that server-side authentication state is fresh enough for protected routes.

Do not depend solely on client-side session refresh.

---

# 27. TEST REQUIREMENTS

Add meaningful tests.

At minimum test:

```text
Authentication validation

Invalid email handling

Invalid password input

Protected route decision logic where practical

Profile ownership assumptions

Database migration structure where practical
```

Do not create meaningless tests.

Do not require live Supabase credentials for normal unit tests.

Live integration tests may be separate and optional.

Existing Phase 0 tests must remain passing.

Do not remove tests to make implementation easier.

---

# 28. LIVE SUPABASE VERIFICATION

If valid Supabase credentials and a project are available:

Verify as much of the real authentication flow as practical.

Potential verification:

```text
Migration applies

User can sign up

Profile is created

User can log in

Protected route blocks anonymous user

Authenticated user can access protected page

Logout works
```

Do not create unnecessary test accounts without cleanup.

If creating a real test user:

```text
Use a clearly identifiable test account

Avoid using personal credentials

Clean up if appropriate
```

If live verification is not possible:

State clearly:

```text
Not verified against live Supabase project
```

Do not claim it was tested.

---

# 29. DO NOT USE SERVICE ROLE AS A SHORTCUT

Do not use:

```text
SUPABASE_SERVICE_ROLE_KEY
```

to bypass RLS during normal application operations.

The service role client exists only for legitimate server-side administrative operations.

Normal authenticated user operations should use the authenticated server/browser client.

The profile ownership model must be enforced by RLS.

---

# 30. ENVIRONMENT VALIDATION

Preserve the Phase 0 environment architecture.

Do not make:

```text
AI_ROUTER_BASE_URL

AI_ROUTER_API_KEY
```

required.

Do not introduce new secrets unless required for authentication.

Supabase environment validation must remain:

```text
Safe

Lazy

Server-aware

Testable
```

Do not expose server-only secrets.

---

# 31. DO NOT MODIFY AI ARCHITECTURE

The architecture alignment task already established:

```text
OpenAI-Compatible AI Router
```

Do not modify:

```text
AI_ROUTER_BASE_URL

AI_ROUTER_API_KEY

AI architecture documentation
```

unless a direct bug is discovered.

AI integration belongs to Phase 4.

---

# 32. DEPENDENCY DISCIPLINE

Before adding dependencies:

1. Inspect current dependencies.
2. Reuse existing packages.
3. Add only what is genuinely required.
4. Prefer maintained and compatible libraries.

Do not add:

```text
NextAuth

Clerk

Auth0

Firebase Auth

Redux

ORM

UI component framework
```

The project authentication system must use Supabase Auth.

Do not replace the architecture.

---

# 33. REQUIRED ROOT COMMANDS

Ensure existing commands still work:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

Do not break Phase 0 tooling.

---

# 34. REQUIRED VERIFICATION

Before declaring Phase 1 complete, run:

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

If Supabase CLI is available and configured, also verify migration syntax appropriately.

Do not claim database migration success unless it was actually applied or validated.

---

# 35. MANUAL AUTH FLOW REVIEW

Review the actual flow logically or in the running application.

Verify:

```text
Anonymous user can see public page

Anonymous user cannot access protected page

Anonymous user can access login

Anonymous user can access signup

Signup validates input

Login validates input

Authenticated user can access protected page

Authenticated user can retrieve identity

Logout ends session

Authenticated user cannot access another user's profile through intended application paths
```

If live Supabase is unavailable, clearly separate:

```text
Code-level verification
```

from:

```text
Live Supabase verification
```

---

# 36. SECURITY REVIEW

Before completion inspect specifically for:

```text
Service role exposure

Passwords logged

Secrets in browser code

RLS bypass

Overly broad policies

Missing ownership checks

Client-only route protection

Redirect loops

Raw provider errors exposed

Profile duplication risk
```

Do not declare Phase 1 complete until these are reviewed.

---

# 37. FINAL DIFF REVIEW

Before completion run:

```bash
git status
git diff --stat
git diff
```

If files are staged:

```bash
git diff --cached --stat
git diff --cached
```

Review all changes.

Specifically verify that no future-phase functionality was accidentally added.

Search for suspicious scope expansion.

Examples:

```bash
grep -Rni "OpenAI" apps packages --exclude-dir=node_modules || true
grep -Rni "TikTok" apps packages --exclude-dir=node_modules || true
grep -Rni "Instagram" apps packages --exclude-dir=node_modules || true
grep -Rni "schedule" apps packages --exclude-dir=node_modules || true
```

Review matches.

---

# 38. DEFINITION OF DONE

PHASE 1 is complete only when all of the following are true.

## Authentication

* [ ] Signup implemented
* [ ] Login implemented
* [ ] Logout implemented
* [ ] Session persistence implemented
* [ ] Server-side authenticated user retrieval works
* [ ] Protected routes exist
* [ ] Anonymous users cannot access protected routes

## Database

* [ ] profiles table migration created
* [ ] profiles linked correctly to auth.users
* [ ] Profile creation strategy implemented
* [ ] Duplicate profile creation prevented
* [ ] RLS enabled
* [ ] Users can read own profile
* [ ] Users can update own profile
* [ ] Users cannot access arbitrary profiles

## Security

* [ ] No service role exposed
* [ ] No passwords logged
* [ ] No secrets in browser bundle
* [ ] No client-only security boundary
* [ ] No overly broad RLS policy

## UI

* [ ] Login page exists
* [ ] Signup page exists
* [ ] Protected application page exists
* [ ] Logout control exists
* [ ] Forms have accessible labels
* [ ] Validation errors are understandable

## Verification

* [ ] npm run lint passes
* [ ] npm run typecheck passes
* [ ] npm test passes
* [ ] npm run build passes
* [ ] npm run format:check passes

---

# 39. REQUIRED COMPLETION REPORT

When finished, respond with exactly this structure:

```text
PHASE 1 COMPLETE

Implemented:
- ...

Authentication Flow:
- Signup: ...
- Login: ...
- Logout: ...
- Session Handling: ...
- Route Protection: ...

Database Changes:
- ...

Migration:
- ...

RLS Policies:
- ...

Profile Creation:
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

Verification:
- npm run lint → PASS/FAIL
- npm run typecheck → PASS/FAIL
- npm test → PASS/FAIL
- npm run build → PASS/FAIL
- npm run format:check → PASS/FAIL

Security Review:
- Service role exposure → ...
- Password handling → ...
- RLS review → ...
- Protected routes → ...
- Client bundle secrets → ...

Known Limitations:
- ...

Explicitly Not Implemented:
- ...

Ready For Next Phase:
- YES/NO
- Reason: ...
```

Do not claim live Supabase verification unless it actually occurred.

Do not claim Phase 1 is complete if authentication only works visually but security boundaries are not verified.

---

# 40. FINAL REMINDER

You are implementing:

```text
PHASE 1 ONLY
```

The goal is:

```text
Secure authentication foundation
```

NOT:

```text
Product dashboard
```

NOT:

```text
Workspace system
```

NOT:

```text
AI integration
```

NOT:

```text
Automation system
```

Implement the smallest secure authentication foundation necessary for future phases.

Stop immediately after Phase 1 is complete.

Do NOT start Phase 2.

# END OF PHASE 1 PROMPT
