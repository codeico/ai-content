# IMPLEMENTATION_ROADMAP.md

# AI Multi-Account Content Automation Platform

**Version:** 1.0
**Status:** Implementation Roadmap
**Depends On:**

* `MASTER_PRODUCT_SPEC.md`
* `TECHNICAL_ARCHITECTURE.md`
* `DATABASE_SCHEMA.md`

---

# 1. Purpose

Dokumen ini mendefinisikan roadmap implementasi AI Content Automation Platform.

Project harus dibangun secara bertahap.

Tidak boleh mencoba membangun seluruh sistem dalam satu phase.

Setiap phase harus:

```text
Small

Focused

Testable

Verifiable

Reversible
```

Setiap phase memiliki:

* objective
* scope
* deliverables
* acceptance criteria
* explicit exclusions

Coding agent harus menyelesaikan satu phase sebelum melanjutkan ke phase berikutnya.

---

# 2. Implementation Philosophy

Urutan implementasi:

```text
Foundation
    ↓
Authentication
    ↓
Workspace
    ↓
Content Domain
    ↓
AI
    ↓
Jobs
    ↓
Scheduling
    ↓
Publishing
    ↓
PWA
    ↓
Hardening
```

Prinsip utama:

> Jangan membangun automation sebelum data model dan state management stabil.

---

# 3. Global Rules

Semua phase harus mengikuti aturan berikut.

## 3.1 No Scope Creep

Coding agent tidak boleh mengimplementasikan feature dari phase berikutnya.

Contoh:

Jika sedang mengerjakan:

```text
PHASE 2 — Workspace
```

maka jangan mulai:

```text
Instagram publishing

AI caption generation

Background worker
```

---

## 3.2 Tests Must Pass

Setiap phase harus selesai dengan:

```text
Typecheck passing

Lint passing

Tests passing

Build passing
```

---

## 3.3 Existing Features Must Not Break

Sebelum phase baru dianggap selesai:

```text
Existing tests
+
New tests
```

harus tetap lulus.

---

## 3.4 Database Migrations Are Immutable

Migration yang sudah dibuat tidak boleh diedit setelah digunakan.

Perubahan schema harus membuat migration baru.

---

## 3.5 Security First

Tidak boleh:

```text
Expose service_role key

Expose AI API key

Expose Instagram token

Trust client workspace_id blindly
```

---

# 4. Phase Overview

| Phase | Name                   | Primary Goal         |
| ----- | ---------------------- | -------------------- |
| 0     | Project Foundation     | Setup repository     |
| 1     | Authentication         | User identity        |
| 2     | Workspace System       | Multi-workspace      |
| 3     | Content Domain         | Content lifecycle    |
| 4     | AI Intelligence        | Analysis + captions  |
| 5     | Background Jobs        | Durable automation   |
| 6     | Scheduling             | Automated timing     |
| 7     | Publishing Integration | Instagram publishing |
| 8     | PWA + Notifications    | Mobile experience    |
| 9     | Observability          | Monitoring + audit   |
| 10    | Security Hardening     | Production safety    |
| 11    | Testing & Release      | Production readiness |

---

# ==================================================

# PHASE 0 — PROJECT FOUNDATION

# ==================================================

# Objective

Membangun repository foundation dan memastikan development environment stabil.

---

# Scope

Implement:

```text
Next.js

TypeScript

Tailwind CSS

Supabase client setup

Environment validation

Basic project structure

Testing foundation

Linting

Formatting
```

---

# Required Structure

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

---

# Required Configuration

Environment variables must be validated.

Example categories:

```text
NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

AI_ROUTER_BASE_URL

AI_ROUTER_API_KEY
```

Secrets must not be accessible from browser bundles.

---

# Deliverables

* Monorepo/project structure
* Next.js application
* TypeScript strict mode
* Tailwind setup
* ESLint
* Formatter
* Test framework
* Environment validation
* Basic README

---

# Acceptance Criteria

```text
npm install

npm run dev

npm run lint

npm run typecheck

npm test

npm run build
```

Semua command harus berhasil.

---

# Explicit Exclusions

Do not implement:

```text
Authentication

Database tables

Dashboard

AI features

Jobs

Instagram
```

---

# ==================================================

# PHASE 1 — AUTHENTICATION

# ==================================================

# Objective

Mengimplementasikan authentication menggunakan Supabase Auth.

---

# Scope

Implement:

```text
Sign up

Sign in

Sign out

Session handling

Profile creation

Protected routes
```

---

# Database

Create:

```text
profiles
```

Integrate with:

```text
auth.users
```

---

# Required Flow

```text
Visitor

↓

Sign Up

↓

Supabase Auth User Created

↓

Profile Created

↓

Redirect Dashboard
```

---

# Acceptance Criteria

User dapat:

```text
Create account

Login

Refresh page without losing session

Logout

Access protected route only when authenticated
```

---

# Tests

Test:

```text
Unauthenticated access blocked

Authenticated access allowed

Profile created correctly
```

---

# Explicit Exclusions

Do not implement:

```text
Workspace

Content

AI

Instagram

Jobs
```

---

# ==================================================

# PHASE 2 — WORKSPACE SYSTEM

# ==================================================

# Objective

Membangun multi-workspace architecture.

---

# Scope

Implement:

```text
Create workspace

List workspaces

Switch workspace

Workspace membership

Workspace settings
```

---

# Database

Create:

```text
workspaces

workspace_members
```

---

# Workspace Creation Flow

```text
User

↓

Create Workspace

↓

Workspace Created

↓

Owner Membership Created

↓

Workspace Becomes Active
```

---

# Required Fields

```text
name

slug

niche

timezone
```

---

# Security

User hanya boleh mengakses:

```text
workspace
```

yang memiliki membership.

---

# Acceptance Criteria

User dapat:

```text
Create multiple workspaces

Switch active workspace

Access only own workspace

Update workspace settings
```

---

# Tests

Test:

```text
Workspace isolation

Membership authorization

Unauthorized access rejection
```

---

# Explicit Exclusions

Do not implement:

```text
Content discovery

AI

Publishing

Jobs
```

---

# ==================================================

# PHASE 3 — CONTENT DOMAIN

# ==================================================

# Objective

Membangun content lifecycle tanpa automation.

Semua operasi dilakukan manual melalui application layer.

---

# Scope

Implement:

```text
Content creation

Content listing

Content detail

Content status

Content sources

Content metadata

Rights status
```

---

# Database

Create:

```text
content_profiles

content_sources

contents
```

---

# Content States

Implement:

```text
DISCOVERED

READY_FOR_REVIEW

APPROVED

REJECTED

ARCHIVED
```

State lain akan ditambahkan ketika automation mulai dibangun.

---

# UI

Implement basic dashboard:

```text
Content List

Content Detail

Content Status

Workspace Content Profile
```

---

# Acceptance Criteria

User dapat:

```text
Create content manually

Attach source URL

Assign metadata

Approve content

Reject content

Archive content
```

---

# Tests

Test:

```text
Workspace isolation

Valid state transitions

Invalid state transitions rejected
```

---

# Explicit Exclusions

Do not implement:

```text
TikTok crawling

Media downloading

AI

Jobs

Scheduling

Publishing
```

---

# ==================================================

# PHASE 4 — AI INTELLIGENCE

# ==================================================

# Objective

Mengintegrasikan AI Router yang OpenAI-compatible untuk content analysis dan
caption generation.

---

# Scope

Implement:

```text
AI provider abstraction

OpenAI-compatible AI Router provider adapter

Configurable API base URL

Server-side API key

Content analysis

Content scoring

Caption generation

Caption regeneration

Caption versioning
```

---

# Database

Create:

```text
content_analysis

captions
```

---

# AI Provider Interface

Example concept:

```text
AIProvider

analyzeContent()

generateCaption()
```

Application tidak boleh bergantung langsung pada implementation provider
tertentu. Yang menjadi dependency adalah OpenAI-compatible API contract, dan
endpoint-nya configurable.

---

# Content Analysis

AI menerima:

```text
Title

Description

Transcript

Workspace niche

Target audience

Content goals
```

AI menghasilkan:

```text
Summary

Topic

Content type

Niche relevance score

Audience match score

Quality score

Freshness score

Overall score
```

---

# Caption Generation

AI menerima:

```text
Content analysis

Workspace profile

Tone

Writing style

Restrictions
```

AI menghasilkan:

```text
Caption

Hashtags

Call to action
```

---

# Acceptance Criteria

User dapat:

```text
Analyze content

View analysis

Generate caption

Regenerate caption

Select active caption
```

---

# Tests

Mock AI provider.

Test:

```text
Provider abstraction

Analysis persistence

Caption versioning

AI failure handling
```

---

# Explicit Exclusions

Do not implement:

```text
Background jobs

Automatic discovery

Automatic posting
```

AI dipanggil manual pada phase ini.

---

# ==================================================

# PHASE 5 — BACKGROUND JOB SYSTEM

# ==================================================

# Objective

Membangun durable background job infrastructure.

---

# Scope

Implement:

```text
Job creation

Job claiming

Job locking

Retry

Exponential backoff

Stale job recovery

Worker abstraction
```

---

# Database

Create:

```text
jobs
```

---

# Required Job States

```text
PENDING

RUNNING

RETRYING

COMPLETED

FAILED

CANCELLED
```

---

# Required Job Types

Initial:

```text
ANALYZE_CONTENT

GENERATE_CAPTION
```

---

# Worker Architecture

```text
Scheduler

↓

Database Job

↓

Worker Claim

↓

Execution

↓

Success / Failure
```

---

# Atomic Claim

Must use concurrency-safe mechanism.

Preferred:

```text
PostgreSQL

FOR UPDATE SKIP LOCKED
```

or RPC equivalent.

---

# Retry Strategy

Example:

```text
Attempt 1

↓

Failure

↓

Retry after 1 minute

↓

Failure

↓

Retry after 5 minutes

↓

Failure

↓

Retry after 30 minutes

↓

Failed permanently
```

Exact strategy configurable.

---

# Acceptance Criteria

System dapat:

```text
Create jobs

Claim jobs safely

Prevent duplicate execution

Retry failed jobs

Recover stale jobs
```

---

# Tests

Test:

```text
Concurrent workers

Duplicate claims

Retry limits

Stale job recovery

Worker crash scenario
```

---

# Explicit Exclusions

Do not implement:

```text
TikTok automation

Instagram publishing
```

---

# ==================================================

# PHASE 6 — CONTENT DISCOVERY

# ==================================================

# Objective

Membangun content candidate ingestion pipeline.

Important:

Phase ini tidak langsung berarti unrestricted scraping.

Source adapter harus dirancang agar platform implementation dapat diganti.

---

# Scope

Implement:

```text
Discovery provider abstraction

Source ingestion

Candidate creation

URL normalization

Duplicate detection

Manual source import
```

---

# Initial Provider Interface

Concept:

```text
ContentDiscoveryProvider

discover()

normalizeUrl()

extractMetadata()
```

---

# Initial MVP Flow

```text
Source URL

↓

Normalize URL

↓

Extract Metadata

↓

Create Candidate

↓

Duplicate Check

↓

Content Record
```

---

# Important Rule

Discovery layer tidak boleh tightly coupled dengan UI.

Provider implementation harus dapat diganti.

---

# Database

Use:

```text
content_sources

contents
```

Add migration jika diperlukan untuk:

```text
normalized_url

external_content_id
```

---

# Acceptance Criteria

System dapat:

```text
Import content candidate

Normalize source

Detect obvious duplicates

Store source metadata

Create content record
```

---

# Explicit Exclusions

Do not implement:

```text
Automatic downloading

Automatic reposting

Automatic publishing
```

---

# ==================================================

# PHASE 7 — MEDIA PROCESSING

# ==================================================

# Objective

Membangun media pipeline yang aman dan terisolasi.

---

# Scope

Implement abstraction untuk:

```text
Media retrieval

Temporary storage

Metadata inspection

Thumbnail extraction

Media cleanup
```

---

# Architecture

```text
Content

↓

Media Provider

↓

Temporary Storage

↓

Validation

↓

Processing

↓

Ready Media
```

---

# Storage Rules

Storage provider abstraction:

```text
MediaStorage

uploadTemporary()

getSignedUrl()

deleteTemporary()
```

---

# Database

Update:

```text
contents
```

Media fields:

```text
media_status

storage_provider

storage_key

duration_seconds
```

---

# Acceptance Criteria

System dapat:

```text
Store temporary media

Read media metadata

Generate signed access URL

Cleanup expired media
```

---

# Explicit Exclusions

Do not implement:

```text
Publishing

Scheduling
```

---

# ==================================================

# PHASE 8 — CONTENT SCHEDULING

# ==================================================

# Objective

Membangun scheduling system.

---

# Scope

Implement:

```text
Posting schedule rules

Scheduled posts

Timezone handling

Due post detection

Cancellation
```

---

# Database

Create:

```text
posting_schedules

scheduled_posts
```

---

# Required Flow

```text
Schedule Rule

↓

Generate Posting Slot

↓

Select Content

↓

Create Scheduled Post

↓

Wait Until Due

↓

Queue Publishing Job
```

---

# Timezone Rule

User memasukkan:

```text
Local Workspace Time
```

Database menyimpan:

```text
UTC
```

UI menampilkan:

```text
Workspace Timezone
```

---

# Acceptance Criteria

User dapat:

```text
Create schedule

Set posting time

Select content

Schedule content

Cancel scheduled post
```

---

# Tests

Test:

```text
Timezone conversion

DST handling

Duplicate schedule prevention

Cancellation
```

---

# Explicit Exclusions

Do not implement:

```text
Instagram API
```

Publishing job hanya dapat menggunakan mock provider pada phase ini.

---

# ==================================================

# PHASE 9 — INSTAGRAM PUBLISHING

# ==================================================

# Objective

Mengintegrasikan publishing provider secara aman.

---

# Scope

Implement:

```text
Social account abstraction

Instagram account connection

Token storage

Publishing provider

Publish attempts

Publishing history

Idempotency
```

---

# Database

Create:

```text
social_accounts

publish_attempts

published_posts
```

---

# Provider Interface

Concept:

```text
SocialPublisher

connect()

validateAccount()

publish()

getPublishStatus()
```

---

# Publishing Flow

```text
Scheduled Post

↓

Due

↓

Create Publish Job

↓

Worker Claims Job

↓

Create Publish Attempt

↓

Provider Publish Request

↓

Success?

YES
↓

Create Published Post

Update Scheduled Post

NO
↓

Retry / Fail
```

---

# Required Safety

Must implement:

```text
Idempotency

Retry safety

Unknown provider response handling

Duplicate publishing prevention
```

---

# Acceptance Criteria

System dapat:

```text
Connect social account

Validate connection

Publish using provider adapter

Store publish history

Retry safe failures
```

---

# Tests

Mock provider tests:

```text
Successful publish

Timeout

Provider error

Duplicate retry

Unknown result
```

---

# Explicit Exclusions

Do not add:

```text
Multiple platform publishing
```

MVP hanya satu platform provider.

---

# ==================================================

# PHASE 10 — PWA + NOTIFICATIONS

# ==================================================

# Objective

Menjadikan web application dapat digunakan seperti mobile app.

---

# Scope

Implement:

```text
Web manifest

Installable PWA

Service worker

Offline shell

Push subscriptions

In-app notifications
```

---

# Database

Create:

```text
notifications

push_subscriptions
```

---

# PWA Requirements

App harus:

```text
Installable

Responsive

Mobile friendly

Launchable from home screen
```

---

# Notification Events

Initial:

```text
Content Ready

Caption Generated

Publish Success

Publish Failed
```

---

# Notification Flow

```text
System Event

↓

Create Notification

↓

Check Push Subscription

↓

Send Push

↓

User Opens App

↓

Mark Read
```

---

# Acceptance Criteria

User dapat:

```text
Install application

Receive supported push notifications

View notification history
```

---

# Important Platform Limitation

Implementation harus mempertimbangkan perbedaan:

```text
iOS Safari

Android Chrome

Desktop Browser
```

Push notification capability tidak boleh diasumsikan identik di semua platform.

---

# ==================================================

# PHASE 11 — OBSERVABILITY

# ==================================================

# Objective

Menjadikan automation system dapat di-debug.

---

# Scope

Implement:

```text
Audit logs

Job visibility

Publish history

Error tracking abstraction

Operational dashboard
```

---

# Database

Create:

```text
audit_logs
```

---

# Dashboard

Show:

```text
Recent Jobs

Failed Jobs

Upcoming Posts

Recent Publish Attempts

System Errors
```

---

# Acceptance Criteria

Developer dapat mengetahui:

```text
What failed

When it failed

Why it failed

Which workspace affected

Whether retry occurred
```

---

# ==================================================

# PHASE 12 — SECURITY HARDENING

# ==================================================

# Objective

Production security review.

---

# Scope

Review:

```text
RLS

API authorization

Secret handling

Token encryption

Rate limiting

Input validation

Webhook validation

CSRF strategy

CORS

Security headers
```

---

# Required Security Checks

## Secrets

Verify:

```text
No secret in frontend bundle
```

---

## Workspace Isolation

Attempt:

```text
Workspace A user

↓

Access Workspace B data
```

Must fail.

---

## Publishing

Attempt:

```text
Duplicate publish

Replay request

Unauthorized publish
```

Must fail safely.

---

## AI

Verify:

```text
API key cannot be exposed

Prompt injection does not alter system authority

Untrusted content is isolated
```

---

# Acceptance Criteria

Security checklist completed.

Critical issues resolved.

---

# ==================================================

# PHASE 13 — TESTING & RELEASE

# ==================================================

# Objective

Mempersiapkan production release.

---

# Required Tests

## Unit Tests

```text
Domain logic

State transitions

AI adapters

Job logic
```

---

## Integration Tests

```text
Database

Supabase

Job claiming

Publishing workflow
```

---

## End-to-End Tests

Critical flows:

```text
Signup

Create Workspace

Create Content

Analyze

Generate Caption

Approve

Schedule

Publish
```

---

# Production Checklist

Verify:

```text
Environment variables

Database migrations

RLS

Build

Error handling

Retry logic

Idempotency

Logging

PWA

Mobile UI
```

---

# 5. Recommended Development Order

Exact implementation sequence:

```text
PHASE 0
Project Foundation
        ↓
PHASE 1
Authentication
        ↓
PHASE 2
Workspace System
        ↓
PHASE 3
Content Domain
        ↓
PHASE 4
AI Intelligence
        ↓
PHASE 5
Background Jobs
        ↓
PHASE 6
Content Discovery
        ↓
PHASE 7
Media Processing
        ↓
PHASE 8
Content Scheduling
        ↓
PHASE 9
Instagram Publishing
        ↓
PHASE 10
PWA + Notifications
        ↓
PHASE 11
Observability
        ↓
PHASE 12
Security Hardening
        ↓
PHASE 13
Testing & Release
```

---

# 6. Dependency Rules

Certain phases depend on previous phases.

| Phase | Depends On      |
| ----- | --------------- |
| 1     | 0               |
| 2     | 1               |
| 3     | 2               |
| 4     | 3               |
| 5     | 4               |
| 6     | 3               |
| 7     | 6               |
| 8     | 5 + 3           |
| 9     | 5 + 7 + 8       |
| 10    | 1               |
| 11    | 5 + 9           |
| 12    | All core phases |
| 13    | All phases      |

---

# 7. Parallel Development Possibilities

Setelah foundation stabil, beberapa area dapat dikerjakan paralel.

Contoh:

```text
PHASE 4 — AI
```

dan:

```text
PHASE 6 — Discovery
```

dapat dikembangkan secara relatif independen setelah:

```text
PHASE 3 — Content Domain
```

selesai.

Namun untuk MVP development dengan satu coding agent:

> Sequential implementation lebih aman.

---

# 8. Definition of Done

Satu phase hanya dianggap COMPLETE jika:

```text
Scope implemented

Acceptance criteria passed

Tests added

Existing tests pass

Lint passes

Typecheck passes

Build passes

No known regression

Documentation updated
```

Coding agent tidak boleh menyatakan:

```text
DONE
```

hanya karena code berhasil dibuat.

---

# 9. Phase Completion Report

Setiap phase harus menghasilkan summary:

```text
PHASE X COMPLETE

Implemented:
- ...

Files changed:
- ...

Database migrations:
- ...

Tests added:
- ...

Verification:
- npm run lint
- npm run typecheck
- npm test
- npm run build

Known limitations:
- ...

Explicitly not implemented:
- ...
```

---

# 10. Recommended MVP Boundary

Untuk MVP pertama, target minimum yang benar-benar usable:

```text
Authentication

↓

Workspace

↓

Manual Content Input

↓

AI Analysis

↓

AI Caption Generation

↓

Manual Approval

↓

Scheduling

↓

Single Social Account

↓

Publishing

↓

PWA
```

Discovery automation dapat dikembangkan setelah pipeline inti terbukti stabil.

Reason:

```text
Bad Content Discovery

≠

Broken Product
```

Namun:

```text
Broken Scheduling

or

Broken Publishing
```

akan membuat core product tidak berguna.

---

# 11. Most Important Rule

Jangan mulai dari:

```text
Scraping

Automation

Publishing
```

Mulailah dari:

```text
Data Model

↓

Content Lifecycle

↓

Manual Workflow

↓

AI

↓

Background Jobs

↓

Automation
```

Karena automation hanya akan mempercepat proses.

Jika proses dasar belum stabil:

> Automation hanya akan mempercepat kegagalan.

---

# END OF IMPLEMENTATION ROADMAP
