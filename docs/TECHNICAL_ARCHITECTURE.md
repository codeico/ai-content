# TECHNICAL_ARCHITECTURE.md

# AI Multi-Account Content Automation Platform

**Version:** 1.0
**Status:** Architecture Foundation
**Depends On:** `MASTER_PRODUCT_SPEC.md`

---

# 1. Purpose

Dokumen ini mendefinisikan arsitektur teknis untuk AI Content Automation Platform.

Dokumen ini menjelaskan:

* komponen sistem
* tanggung jawab setiap service
* komunikasi antar service
* data flow
* background processing
* scheduling
* AI processing
* media storage
* publishing architecture
* notification architecture
* security boundaries
* deployment strategy

Dokumen ini merupakan technical source of truth.

Semua implementasi harus mengikuti prinsip yang didefinisikan di sini.

---

# 2. Architecture Goals

Arsitektur harus memenuhi tujuan berikut.

## Primary Goals

```text
Multi-workspace architecture

Low operational cost

Free-tier friendly

No always-on personal computer

Secure secret handling

Scalable architecture

Reliable background processing

Clear service boundaries
```

---

# 3. Architecture Principles

## 3.1 Managed Services First

Production system tidak boleh bergantung pada:

```text
Personal Mac

Personal Laptop

Home Internet

Always-on local server
```

Production workload harus berjalan pada managed infrastructure.

---

## 3.2 Database is the Source of Truth

Supabase PostgreSQL adalah authoritative data store.

Semua state penting harus tersimpan di database.

Contoh:

```text
Content status

Publishing status

Schedule

Job status

Retry count

Notification state
```

Tidak boleh hanya tersimpan di:

```text
Memory

Redis

Browser

Temporary server process
```

---

## 3.3 Stateless Application Layer

Next.js application layer harus bersifat stateless.

Vercel instance dapat:

```text
Start

Stop

Scale

Restart
```

tanpa kehilangan state penting.

---

## 3.4 Background Work Must Be Durable

Background job harus dapat bertahan jika:

```text
Server restarts

Function times out

Worker crashes

Network fails
```

Job state harus dapat dipulihkan.

---

## 3.5 Provider Abstraction

External provider tidak boleh tersebar langsung di seluruh application code.

Gunakan abstraction layer untuk:

```text
AI Provider

Social Publishing Provider

Storage Provider

Queue Provider

Notification Provider
```

---

# 4. High-Level Architecture

```text
                           USER
                             │
                             ▼
                  ┌─────────────────────┐
                  │                     │
                  │     NEXT.JS PWA     │
                  │                     │
                  │      VERCEL         │
                  │                     │
                  └──────────┬──────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼

         ┌────────────┐ ┌────────────┐ ┌────────────┐
         │ SUPABASE   │ │ AI SERVICE │ │ WEB PUSH   │
         │            │ │            │ │            │
         │ PostgreSQL │ │ OpenAI-    │ │ Notifications
         │ Auth       │ │ Compatible │ │            │
         │ Realtime   │ │ AI Router  │ │            │
         │ pgvector   │ └────────────┘ └────────────┘
         └─────┬──────┘
               │
               │
               ▼
        ┌───────────────┐
        │ JOB EXECUTION │
        │               │
        │ Scheduler     │
        │ AI Jobs       │
        │ Publishing    │
        │ Retry         │
        └───────┬───────┘
                │
        ┌───────┼────────┐
        │       │        │
        ▼       ▼        ▼

    Storage   Instagram  Other
   Supabase      API     Future
```

---

# 5. Core Services

Sistem terdiri dari beberapa logical service.

```text
Frontend

Application API

Database

Authentication

Realtime

Background Jobs

Scheduler

AI Service

Storage

Publishing Service

Notification Service
```

Logical service tidak selalu berarti deployment terpisah.

MVP harus menghindari unnecessary infrastructure complexity.

---

# 6. Frontend Architecture

Frontend menggunakan:

```text
Next.js

React

TypeScript

Tailwind CSS

shadcn/ui
```

Frontend bertanggung jawab untuk:

```text
Authentication UI

Workspace switching

Dashboard

Content management

Content review

Caption editing

Scheduling

Settings

Notifications UI
```

Frontend tidak boleh menangani:

```text
AI secrets

Instagram secrets

Publishing credentials

Service role keys

Redis credentials
```

---

# 7. Next.js Application Layer

Next.js application bertindak sebagai:

```text
Web Application

BFF
Backend For Frontend

API Boundary

Server-side Orchestrator
```

Next.js menangani:

```text
Authenticated requests

Input validation

Database access

Server Actions

Route Handlers

Webhook receivers

Short orchestration tasks
```

Next.js tidak boleh digunakan untuk:

```text
Long-running workers

Permanent job loops

Infinite polling

Large video processing

Always-on scheduler
```

---

# 8. Recommended Application Structure

```text
src/

├── app/
│
│   ├── (auth)/
│   │
│   ├── (dashboard)/
│   │
│   ├── api/
│   │
│   └── layout.tsx
│
├── components/
│
├── features/
│
│   ├── workspaces/
│   ├── content/
│   ├── sources/
│   ├── captions/
│   ├── scheduling/
│   ├── publishing/
│   └── notifications/
│
├── lib/
│
│   ├── supabase/
│   ├── ai/
│   ├── publishing/
│   ├── storage/
│   ├── queue/
│   └── notifications/
│
├── server/
│
│   ├── services/
│   ├── repositories/
│   └── jobs/
│
└── types/
```

Struktur final dapat berkembang.

Namun domain logic tidak boleh bercampur langsung dengan UI components.

---

# 9. Supabase Architecture

Supabase digunakan sebagai core backend platform.

Responsibilities:

```text
PostgreSQL

Authentication

Row Level Security

Realtime

pgvector

Database Functions
```

Supabase adalah source of truth untuk:

```text
Users

Workspaces

Content

Content Analysis

Captions

Schedules

Publishing History

Notifications

Jobs

Audit Logs
```

---

# 10. Supabase Authentication

Authentication menggunakan:

```text
Supabase Auth
```

MVP dapat mendukung:

```text
Email + Password

Magic Link
```

Future:

```text
Google OAuth

Other OAuth providers
```

Authentication state harus dikelola menggunakan SSR-compatible Supabase client.

---

# 11. Authorization

Authorization menggunakan dua layer.

## Layer 1

Application authorization.

Server harus memverifikasi:

```text
Authenticated User

Workspace Access

Requested Resource Ownership
```

---

## Layer 2

Database authorization.

Gunakan:

```text
Supabase Row Level Security
```

Contoh prinsip:

```text
User A

Workspace A

→ hanya dapat membaca Workspace A


User B

Workspace B

→ tidak dapat membaca Workspace A
```

RLS harus menjadi defense-in-depth.

---

# 12. Workspace Isolation

Semua domain utama harus memiliki workspace context.

Contoh:

```text
workspace_id
```

berlaku untuk:

```text
Content

Sources

AI Profile

Schedules

Publishing

Analytics
```

Setiap server operation harus melakukan:

```text
Request

↓
Authentication

↓
Workspace Membership Validation

↓
Resource Ownership Validation

↓
Operation
```

---

# 13. Database Access Layer

Database access tidak boleh tersebar di seluruh aplikasi.

Gunakan repository atau service layer.

Contoh:

```text
server/

repositories/

workspace.repository.ts

content.repository.ts

caption.repository.ts

schedule.repository.ts
```

Tujuan:

```text
Centralized queries

Consistent authorization

Easier testing

Less duplicated SQL
```

---

# 14. Realtime Architecture

Supabase Realtime digunakan untuk update UI.

Contoh:

```text
AI Analysis Started

ANALYZING

↓

AI Analysis Completed

READY_FOR_REVIEW
```

Frontend menerima perubahan secara realtime.

Realtime digunakan untuk:

```text
Content status

Job status

Publishing status

Notifications
```

Realtime tidak boleh menjadi satu-satunya mekanisme untuk mengetahui state.

Frontend harus tetap dapat melakukan:

```text
Initial database fetch

+
Realtime updates
```

---

# 15. AI Architecture

AI interaction harus melalui AI Service Layer.

```text
Application

      ↓

AI Service

      ↓

OpenAI-Compatible Provider Adapter

      ↓

Configurable AI Router Endpoint

      ↓

Underlying Model
```

AI Router endpoint dikonfigurasi lewat `AI_ROUTER_BASE_URL` dan
`AI_ROUTER_API_KEY` (server-only). Domain layer hanya mengenal `AIProvider`;
asumsi provider-specific harus terisolasi di dalam adapter.

Recommended structure:

```text
lib/

ai/

client.ts

provider.ts

models.ts

schemas.ts

tasks/

analyze-content.ts

generate-caption.ts

score-content.ts

check-duplicate.ts
```

---

# 16. AI Provider Interface

AI provider harus menggunakan interface konseptual.

```text
AIProvider

generate()

analyze()

embed()
```

Application tidak boleh mengetahui detail endpoint provider.

Contoh:

```text
Application

↓

aiService.analyzeContent()

↓

Provider Adapter

↓

External AI API
```

Dengan demikian provider dapat diganti tanpa mengubah seluruh aplikasi.

---

# 17. AI Model Strategy

Model dapat berbeda berdasarkan task.

Contoh:

```text
Task

Content Analysis
→ Medium / Strong Model


Caption Generation
→ Fast / Low Cost Model


Complex Review
→ Strong Model


Embedding
→ Embedding Model
```

Model configuration sebaiknya disimpan dalam environment atau application configuration.

Tidak hardcode model name di seluruh codebase.

---

# 18. AI Structured Output

Semua output AI yang digunakan aplikasi harus divalidasi.

Flow:

```text
AI Response

↓

Raw JSON

↓

Zod Validation

↓

Valid

↓

Persist to Database
```

Jika output invalid:

```text
Retry

or

Mark Job Failed
```

AI response mentah dapat disimpan untuk debugging dengan mempertimbangkan privacy dan storage.

---

# 19. Background Processing Architecture

Ini adalah bagian paling penting.

Next.js request tidak boleh menunggu pekerjaan panjang.

Gunakan asynchronous workflow.

```text
User Action

↓

Create Database Record

↓

Create Job

↓

Return Response

↓

Background Worker

↓

Process Job

↓

Update Database

↓

Realtime Update
```

---

# 20. Job Source of Truth

Database adalah source of truth untuk jobs.

Setiap job memiliki record:

```text
id

type

workspace_id

entity_id

status

attempt_count

max_attempts

scheduled_for

started_at

completed_at

error

created_at
```

Redis tidak menjadi satu-satunya tempat penyimpanan job.

---

# 21. Job State Machine

Job state:

```text
PENDING

↓

QUEUED

↓

RUNNING

↓

COMPLETED
```

Alternative states:

```text
RETRYING

FAILED

CANCELLED
```

Job tidak boleh berubah status tanpa transition yang valid.

---

# 22. Queue Architecture

Queue digunakan untuk:

```text
AI Analysis

Caption Generation

Duplicate Detection

Scheduled Publishing

Retry

Notifications
```

Queue abstraction:

```text
Queue Service

↓

Queue Provider Adapter

↓

Redis / Future Provider
```

Recommended logical interface:

```text
enqueue()

schedule()

cancel()

retry()
```

Application domain tidak boleh langsung bergantung pada Redis command.

---

# 23. Redis / Upstash Role

Redis digunakan untuk:

```text
Queue execution

Temporary locks

Rate limiting

Short-lived execution state
```

Redis tidak digunakan untuk:

```text
Permanent content data

User data

Publishing history

Source of truth
```

---

# 24. Background Worker Strategy

Untuk MVP, background processing harus dapat berjalan tanpa personal computer.

Pilihan implementasi harus memenuhi:

```text
Serverless compatible

Scheduled execution

Retry capability

No permanent local process
```

Architecture:

```text
Scheduler Trigger

↓

Find Due Jobs

↓

Claim Job

↓

Execute

↓

Update Database

↓

Retry or Complete
```

Worker harus stateless.

---

# 25. Scheduler Architecture

Scheduler tidak boleh berupa:

```text
while(true)

check schedule

sleep

repeat
```

Tidak boleh membutuhkan:

```text
Always-on VPS

Mac Mini

Local daemon
```

Gunakan scheduled trigger.

Konsep:

```text
Cron Trigger

↓

Call Secure Job Endpoint

↓

Find Due Jobs

↓

Claim Jobs

↓

Execute Limited Batch
```

---

# 26. Scheduled Job Polling

Scheduler melakukan:

```text
Every N Minutes

↓

Query Jobs

WHERE

status = PENDING

AND

scheduled_for <= NOW()
```

Kemudian:

```text
Claim Job Atomically
```

Atomic claim penting untuk mencegah:

```text
Two workers

↓

Execute same job
```

---

# 27. Job Claim Strategy

Gunakan atomic database update.

Concept:

```text
UPDATE jobs

SET

status = RUNNING

started_at = NOW()

WHERE

id = ?

AND

status IN ('PENDING', 'RETRYING')
```

Jika affected rows:

```text
1

→ Worker owns job
```

Jika:

```text
0

→ Another worker already claimed it
```

---

# 28. Stale Job Recovery

Jika worker crash:

```text
RUNNING
```

job tidak boleh selamanya stuck.

Gunakan recovery.

Concept:

```text
Find jobs

WHERE

status = RUNNING

AND

started_at < timeout threshold
```

Kemudian:

```text
Retry

or

Mark Failed
```

Recovery harus idempotent.

---

# 29. Job Idempotency

Semua critical jobs harus mempertimbangkan duplicate execution.

Terutama:

```text
Publishing
```

Contoh:

```text
Worker starts publishing

↓

Instagram receives request

↓

Network timeout

↓

Worker does not know result
```

Worker tidak boleh langsung:

```text
Publish again blindly
```

Harus memiliki:

```text
Idempotency key

Publishing state

External reference tracking
```

---

# 30. Publishing Architecture

Publishing menggunakan abstraction.

```text
Application

↓

Publishing Service

↓

Platform Adapter

↓

Instagram API
```

Recommended structure:

```text
lib/

publishing/

provider.ts

instagram/

client.ts

publish.ts

status.ts
```

---

# 31. Publishing Workflow

```text
Scheduled Post

↓

Due

↓

Create Publish Job

↓

Claim Job

↓

Validate Content

↓

Validate Account

↓

Prepare Media

↓

Create Instagram Media

↓

Check Processing

↓

Publish

↓

Persist Result

↓

Notify User
```

---

# 32. Publishing Safety

Sebelum publishing:

```text
Content approved?

Schedule valid?

Instagram account connected?

Token valid?

Content media available?

Rights/review status acceptable?
```

Jika salah satu gagal:

```text
Do not publish

↓

Mark Failure / Review Required
```

---

# 33. Social Account Token Security

Instagram credentials harus dianggap secret.

Requirements:

```text
Never expose access token to browser

Never store token in localStorage

Never send token through client API

Encrypt sensitive credentials at rest

Limit access to server-side services
```

Token refresh logic harus dipisahkan dari UI.

---

# 34. Storage Architecture

Storage abstraction:

```text
Application

↓

Storage Service

↓

Storage Provider

↓

Supabase Storage (MVP)
```

**Provider decision (Phase 8, 2026-09-05).** The MVP uses a private Supabase
Storage bucket. This reuses the installed client and workspace/RLS authority;
adding R2 now would add credentials, an S3 signing layer and a second access
control plane without unlocking a product capability. R2 remains a possible
future adapter, not the active deployment provider.

The public schema stays provider-neutral and stores only:

```text
storage_provider

storage_key
```

The bucket name is adapter-owned (`content-media`). MIME type and size live in
Storage metadata until a real query needs them in Postgres. Signed URLs are
short-lived bearer capabilities and are never stored as media identity.

---

# 35. Media Lifecycle

Media dapat memiliki lifecycle.

```text
TEMPORARY

↓

APPROVED

↓

PUBLISHED

↓

ARCHIVED

↓

DELETED
```

Temporary media harus memiliki cleanup strategy.

Contoh:

```text
Delete temporary media after X days
```

Hal ini penting untuk menjaga free-tier storage usage.

---

# 36. Media Upload Strategy

Browser tidak sebaiknya mengirim media besar melalui Next.js server.

Preferred flow:

```text
Browser

↓

Request Upload Authorization

↓

Generate Signed Upload URL

↓

Direct Upload

↓

Storage

↓

Confirm Upload

↓

Database Record
```

Server tidak menjadi proxy untuk file besar.

---

# 37. Notification Architecture

Notification memiliki dua channel.

## In-App Notification

Disimpan di:

```text
Supabase PostgreSQL
```

Digunakan untuk:

```text
Notification Center

Unread State

History
```

---

## Web Push Notification

Digunakan untuk:

```text
Published

Publishing Failed

Content Ready

Important System Error
```

Flow:

```text
Event

↓

Create Notification Record

↓

Queue Notification Job

↓

Push Service

↓

User Device
```

---

# 38. Push Subscription Storage

Push subscription disimpan per:

```text
User

Device

Browser
```

Concept:

```text
push_subscriptions

id

user_id

endpoint

keys

user_agent

created_at

last_used_at
```

Subscription invalid harus dapat dinonaktifkan.

---

# 39. PWA Architecture

PWA membutuhkan:

```text
Web App Manifest

Service Worker

Application Icons

Standalone Mode
```

Service worker bertanggung jawab untuk:

```text
App shell caching

Static asset caching

Push events

Notification click events
```

Jangan mencoba membuat seluruh backend logic berjalan di service worker.

---

# 40. Offline Strategy

MVP menggunakan:

```text
Offline App Shell
```

Offline behavior:

```text
Application UI

↓

Can Open

↓

Show Cached Shell

↓

Show Offline State
```

Data mutating operation tidak perlu mendukung full offline synchronization pada MVP.

---

# 41. API Architecture

Application API dibagi berdasarkan domain.

Contoh:

```text
/api/workspaces

/api/workspaces/[id]

/api/workspaces/[id]/content

/api/workspaces/[id]/sources

/api/workspaces/[id]/schedule

/api/workspaces/[id]/publishing
```

Internal job endpoint:

```text
/api/internal/jobs/process
```

Internal endpoints harus:

```text
Require secret authentication

Not accessible publicly
```

---

# 42. Webhook Architecture

External services dapat mengirim webhook.

Contoh:

```text
Instagram

Future Providers
```

Webhook endpoint harus:

```text
Verify signature

Validate payload

Prevent replay when possible

Persist event

Return quickly
```

Heavy processing setelah webhook harus dipindahkan ke background job.

---

# 43. Error Handling Strategy

Setiap domain operation harus menghasilkan error yang jelas.

Gunakan structured error.

Concept:

```text
code

message

details

retryable
```

Contoh:

```text
INSTAGRAM_TOKEN_EXPIRED

retryable: false
```

atau:

```text
NETWORK_TIMEOUT

retryable: true
```

---

# 44. Retry Strategy

Retry hanya untuk error yang bersifat transient.

Retryable:

```text
Network timeout

Temporary API failure

Rate limit
```

Non-retryable:

```text
Invalid credentials

Invalid content

Permission denied
```

Retry menggunakan:

```text
Exponential Backoff
```

Contoh:

```text
Attempt 1

↓

Wait 1 minute

Attempt 2

↓

Wait 5 minutes

Attempt 3

↓

Wait 15 minutes
```

---

# 45. Rate Limiting

External API memiliki rate limits.

Sistem harus memiliki abstraction:

```text
Rate Limit Awareness
```

AI Provider:

```text
Maximum concurrent requests
```

Instagram:

```text
Publishing limits

API limits
```

Jika rate limited:

```text
Job

↓

RETRYING

↓

Scheduled for later
```

---

# 46. Observability

MVP harus memiliki observability minimum.

Log:

```text
Job Started

Job Completed

Job Failed

Publishing Attempt

External API Failure
```

Logs tidak boleh menyimpan:

```text
API Keys

Access Tokens

Secrets
```

---

# 47. Audit Logs

Critical actions harus memiliki audit record.

Contoh:

```text
Workspace Created

Content Approved

Content Rejected

Schedule Changed

Publishing Started

Publishing Completed

Publishing Failed
```

Audit log penting untuk debugging automation.

---

# 48. Environment Variables

Environment dibagi berdasarkan kategori.

```text
DATABASE

SUPABASE_URL

SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY


AI

AI_API_KEY

AI_BASE_URL


INSTAGRAM

INSTAGRAM_APP_ID

INSTAGRAM_APP_SECRET


QUEUE

REDIS_URL

REDIS_TOKEN


STORAGE

No additional provider secret for the MVP. Supabase Storage uses the existing
`NEXT_PUBLIC_SUPABASE_URL` and user-scoped Supabase session; the private bucket
and policies are provisioned by migration.


APPLICATION

APP_URL

INTERNAL_CRON_SECRET
```

Variable naming dapat berubah.

Secret tidak boleh di-commit ke repository.

---

# 49. Environment Separation

Minimum:

```text
Development

Production
```

Future:

```text
Preview

Staging
```

Database production tidak boleh digunakan sebagai database development.

---

# 50. Deployment Architecture

Production:

```text
Git Repository

↓

Vercel

↓

Next.js Deployment
```

Database:

```text
Supabase Project
```

Storage:

```text
Supabase Storage (private content-media bucket)
```

Queue:

```text
Managed Redis Provider
```

External services:

```text
AI Provider

Instagram API

Web Push
```

---

# 51. Deployment Principle

Deployment harus:

```text
Automated

Repeatable

Environment-based

Secret-based
```

Tidak boleh bergantung pada:

```text
Manual SSH deployment

Local production scripts

Personal computer uptime
```

---

# 52. Cost Strategy

Target:

```text
MVP

≈ Rp0/month
```

dengan asumsi penggunaan masih berada dalam free tier.

Cost-sensitive architecture:

```text
Avoid unnecessary media storage

Avoid large AI requests

Avoid permanent compute

Avoid unnecessary polling

Avoid duplicate processing
```

Namun:

> Free tier bukan jaminan unlimited infrastructure.

Sistem harus dapat dimonitor agar penggunaan tidak melewati quota.

---

# 53. Resource Protection

Gunakan:

```text
Job concurrency limits

AI request limits

Media size limits

Workspace limits where necessary

Upload validation
```

Tujuannya:

```text
Prevent accidental quota exhaustion
```

---

# 54. Scalability Strategy

Architecture harus dapat berkembang.

Current:

```text
Single user

Few workspaces

Few jobs
```

Future:

```text
Many users

Many workspaces

High job volume
```

Scaling strategy:

```text
Database

↓

Indexes

↓

Query optimization


Queue

↓

More workers


AI

↓

Concurrency control


Storage

↓

Object storage scaling
```

Tidak boleh mengubah product domain model ketika volume meningkat.

---

# 55. Security Boundaries

```text
BROWSER

No secrets

↓

NEXT.JS SERVER

Authenticated operations

↓

SERVICE LAYER

Business logic

↓

EXTERNAL PROVIDERS

AI

Instagram

Storage

Queue
```

Sensitive operations hanya berjalan server-side.

---

# 56. Critical Data Flow

## Create Workspace

```text
User

↓

Next.js

↓

Validate Input

↓

Supabase

↓

Create Workspace

↓

Realtime Update
```

---

## Analyze Content

```text
User / Discovery

↓

Create Content

↓

Create Job

↓

Background Trigger

↓

Claim Job

↓

Load Content

↓

AI Service

↓

Validate Output

↓

Save Analysis

↓

Update Content Status

↓

Realtime
```

---

## Generate Caption

```text
Content Approved

↓

Create Caption Job

↓

Worker

↓

Load Workspace AI Profile

↓

Load Content Analysis

↓

AI Service

↓

Validate Caption

↓

Save Caption Version

↓

Content Ready
```

---

## Publish Scheduled Content

```text
Scheduler

↓

Find Due Posts

↓

Create / Claim Publish Job

↓

Validate

↓

Prepare Media

↓

Instagram API

↓

Persist Result

↓

Update Status

↓

Notification
```

---

# 57. Architecture Decision: No Permanent Worker

MVP tidak menggunakan:

```text
Always-on Node.js Worker

Permanent VPS

Mac Mini daemon
```

Sebagai gantinya:

```text
Scheduled Trigger

↓

Secure Endpoint

↓

Database Job Claim

↓

Bounded Execution

↓

Database State Update
```

Ini sesuai dengan prinsip:

```text
Managed Infrastructure

Low Cost

No Personal Server Dependency
```

---

# 58. Architecture Decision: Database-Backed Jobs

Job harus tersimpan di PostgreSQL.

Alasan:

```text
Durability

Visibility

Recovery

Auditing

Simpler MVP infrastructure
```

Redis dapat membantu execution.

Namun kehilangan Redis tidak boleh menyebabkan sistem kehilangan knowledge tentang job penting.

---

# 59. Architecture Decision: Thin Vercel Layer

Vercel digunakan untuk:

```text
Web

SSR

API

Short Jobs

Webhook

Scheduled Trigger
```

Vercel tidak digunakan untuk:

```text
Permanent Worker

Heavy Video Processing

Infinite Process
```

---

# 60. Architecture Decision: Provider Adapters

External services harus berada di belakang adapter.

```text
AIProvider

StorageProvider

PublishingProvider

QueueProvider
```

Keuntungan:

```text
Replaceable

Testable

Mockable

Less vendor lock-in
```

---

# 61. Architecture Decision: Workspace Context Everywhere

Setiap operation yang berhubungan dengan content harus mengetahui:

```text
workspace_id
```

Tidak boleh ada:

```text
Global Content Queue
```

tanpa workspace context.

Exception harus eksplisit.

---

# 62. Failure Scenarios

## AI Provider Down

```text
Job Failed

↓

Retry if retryable

↓

Keep Content State Safe

↓

Notify User if final failure
```

---

## Instagram API Failure

```text
Publishing Failed

↓

Record Attempt

↓

Retry if transient

↓

Do Not Duplicate Publish

↓

Notify User
```

---

## Worker Crash

```text
Job stuck RUNNING

↓

Stale Job Recovery

↓

Retry / Fail
```

---

## Database Temporary Failure

```text
Transaction Failure

↓

Do not mark Job Completed

↓

Retry safely
```

---

# 63. Testing Architecture

Critical layers should be independently testable.

```text
Unit Tests

AI Service

Content State Machine

Scheduling Logic

Publishing Logic

Authorization


Integration Tests

Database

RLS

Job Processing


Manual Tests

PWA

Push Notification

Instagram Publishing
```

External providers harus dapat dimock.

---

# 64. Technical Non-Goals

MVP tidak membangun:

```text
Kubernetes

Microservices

Custom message broker

Self-hosted Redis

Self-hosted PostgreSQL

Permanent worker servers

Complex event sourcing

Distributed workflow engine
```

Alasan:

```text
Overengineering
```

MVP harus menggunakan arsitektur sederhana yang tetap memiliki batas yang jelas.

---

# 65. Recommended Implementation Order

Technical implementation:

```text
1.

Project Foundation

Next.js

TypeScript

Lint

Test Setup


2.

Supabase

Auth

Database

RLS


3.

Workspace System

CRUD

Workspace Context

Account Switcher


4.

Content Domain

Content

State Machine

Queue UI


5.

AI Layer

Provider Adapter

Analysis

Caption Generation


6.

Jobs

Database-backed Jobs

Scheduler Trigger

Claiming

Retry


7.

Scheduling

Posting Schedule

Scheduled Posts


8.

Instagram

OAuth

Publishing

Status


9.

PWA

Manifest

Service Worker

Push


10.

Hardening

Logs

Audit

Recovery

Rate Limits
```

---

# 66. Architecture Acceptance Criteria

Technical architecture dianggap berhasil jika:

### Application

* Application dapat berjalan tanpa permanent server.
* Application layer stateless.
* Secret tidak pernah dikirim ke browser.

### Database

* Supabase menjadi source of truth.
* Workspace isolation diterapkan.
* RLS aktif untuk user-facing data.

### Jobs

* Job dapat bertahan setelah deployment restart.
* Job dapat diretry.
* Stale job dapat dipulihkan.
* Duplicate execution dipertimbangkan.

### AI

* Provider dapat diganti.
* Output tervalidasi.
* Model tidak tersebar sebagai hardcode.

### Publishing

* Publishing memiliki idempotency strategy.
* Failure direkam.
* Retry aman.

### PWA

* Application installable.
* Push architecture tersedia.
* Browser capability differences ditangani secara graceful.

### Deployment

* Production tidak membutuhkan Mac Mini.
* Semua komponen menggunakan managed infrastructure.
* Deployment repeatable.

---

# 67. Final Architecture Summary

```text
                    USER
                      │
                      ▼
             NEXT.JS PWA
                VERCEL
                      │
                      ▼
                APPLICATION
                 SERVICES
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼

    SUPABASE        AI SERVICE    PUBLISHING
        │             │             │
        │             ▼             ▼
        │         AI PROVIDER    INSTAGRAM
        │
        ▼
 DATABASE JOBS
        │
        ▼
 SCHEDULED TRIGGER
        │
        ▼
 JOB EXECUTION
        │
        ├── AI
        ├── Caption
        ├── Duplicate Check
        ├── Publishing
        └── Notification
```

---

# 68. Final Technical Philosophy

```text
Simple

Managed

Durable

Stateless

Workspace Scoped

Provider Abstracted

Database Backed

Serverless Friendly

Cost Conscious
```

The system should remain simple during MVP development while preserving clear upgrade paths for future scale.

---

# END OF TECHNICAL ARCHITECTURE
