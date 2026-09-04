# MASTER_PRODUCT_SPEC.md

# AI Multi-Account Content Automation Platform

**Version:** 1.0
**Status:** Draft — Product Foundation
**Architecture Principle:** Multi-Workspace First
**Development Principle:** Specification First, Implementation Second

---

# 1. Product Vision

Membangun sebuah web application berbasis PWA yang memungkinkan satu pengguna mengelola beberapa akun Instagram dengan niche berbeda secara terpusat.

Setiap akun Instagram memiliki workspace sendiri yang berisi:

* Instagram account
* niche
* content strategy
* AI personality
* content sources
* content preferences
* content queue
* caption style
* posting schedule
* publishing history
* analytics

Sistem menggunakan AI untuk membantu:

* menganalisis kandidat konten
* mengklasifikasikan konten berdasarkan niche
* memberikan content score
* mendeteksi konten duplikat
* menghasilkan caption
* menghasilkan hashtag
* menyesuaikan gaya konten dengan identitas masing-masing akun

Tujuan utama produk adalah menciptakan sebuah:

> **AI-powered Multi-Account Content Operation Center**

---

# 2. Core Problem

Mengelola beberapa akun Instagram dengan niche berbeda membutuhkan proses yang berulang dan memakan waktu.

Contoh:

```text
Account 1
Coding

Account 2
Trading

Account 3
Business

Account 4
Future niche
```

Setiap akun membutuhkan:

```text
Content discovery
↓
Content selection
↓
Content analysis
↓
Caption writing
↓
Scheduling
↓
Publishing
↓
Monitoring
```

Jika dilakukan manual, pengguna harus berpindah-pindah antara:

* platform content discovery
* AI tools
* spreadsheet
* notes
* scheduler
* Instagram

Produk ini bertujuan menyatukan seluruh workflow tersebut dalam satu aplikasi.

---

# 3. Product Goal

## Primary Goal

Memungkinkan pengguna mengelola beberapa content operation berdasarkan niche dari satu dashboard.

## Secondary Goal

Mengurangi pekerjaan manual pada proses:

* content organization
* AI analysis
* caption generation
* scheduling
* publishing workflow
* notification monitoring

## Long-Term Goal

Membangun sistem yang dapat berkembang menjadi:

```text
Multi Account
+
Multi Niche
+
AI Content Intelligence
+
Automated Workflow
+
Content Operations Platform
```

---

# 4. Core Product Concept

Produk menggunakan konsep:

# WORKSPACE

Satu workspace merepresentasikan satu content operation.

Contoh:

```text
USER
│
├── WORKSPACE
│   └── Coding
│
├── WORKSPACE
│   └── Trading
│
├── WORKSPACE
│   └── Business
│
└── WORKSPACE
    └── Future Niche
```

Setiap workspace dapat terhubung dengan satu atau lebih social account di masa depan.

Namun untuk MVP:

> Satu Workspace = Satu Instagram Account

Arsitektur database tetap harus memungkinkan ekspansi ke multi-platform di masa depan.

---

# 5. Workspace Architecture

Setiap workspace memiliki struktur:

```text
WORKSPACE
│
├── Identity
│   ├── Name
│   ├── Niche
│   └── Description
│
├── Social Account
│   └── Instagram
│
├── AI Profile
│   ├── Personality
│   ├── Tone
│   ├── Audience
│   └── Instructions
│
├── Content Sources
│   ├── Keywords
│   ├── Topics
│   ├── Creators
│   └── Other approved sources
│
├── Content Rules
│   ├── Included topics
│   ├── Excluded topics
│   ├── Language
│   └── Minimum score
│
├── Content Queue
│
├── Caption Rules
│
├── Posting Schedule
│
├── Publishing History
│
└── Analytics
```

---

# 6. Example Workspaces

## Workspace 1 — Coding

```text
Name:
Coding Daily

Niche:
Programming

Audience:
Beginner and intermediate developers

Topics:
JavaScript
TypeScript
React
Next.js
Python
AI Coding
Developer Productivity

Tone:
Educational
Friendly
Practical

Posting:
2 times/day
```

---

## Workspace 2 — Trading

```text
Name:
Trading Daily

Niche:
Trading

Audience:
Retail traders

Topics:
Crypto
Forex
Technical Analysis
Price Action
Trading Psychology
Risk Management

Tone:
Professional
Analytical

Posting:
3 times/day
```

Trading workspace harus memiliki aturan AI tambahan:

```text
Do not guarantee profits.
Do not promise returns.
Do not provide misleading financial claims.
Encourage responsible risk management.
```

---

## Workspace 3 — Business

```text
Name:
Business Daily

Niche:
Business

Audience:
Entrepreneurs
Startup founders
Business professionals

Topics:
Startup
Marketing
Sales
Entrepreneurship
Productivity
Business Strategy

Tone:
Professional
Motivational
Insightful

Posting:
2 times/day
```

---

# 7. Product Principles

Semua development harus mengikuti prinsip berikut.

## 7.1 Multi-Workspace First

Tidak ada fitur utama yang hanya dirancang untuk satu Instagram account.

Setiap domain harus mempertimbangkan:

```text
workspace_id
```

Contoh:

```text
content_sources
workspace_id

contents
workspace_id

schedules
workspace_id

captions
workspace_id

analytics
workspace_id
```

---

## 7.2 Supabase is the Source of Truth

Supabase PostgreSQL menjadi sumber data utama.

Redis tidak boleh menjadi source of truth.

Redis hanya digunakan untuk:

```text
Queue
Temporary execution state
Delayed jobs
Retries
```

Semua state penting harus tersimpan secara permanen di PostgreSQL.

---

## 7.3 AI Must Be Replaceable

Aplikasi tidak boleh bergantung langsung pada satu model AI.

Semua AI interaction harus melalui:

```text
AI Service Layer
```

Arsitektur:

```text
Application
      ↓
AI Service
      ↓
AI Provider Adapter
      ↓
OpenAI-Compatible AI Router
      ↓
Selected Model
```

Model dapat berbeda berdasarkan task.

---

## 7.4 Long Running Processing Must Not Block Web Requests

Request dari browser tidak boleh digunakan untuk proses panjang.

Contoh yang tidak boleh dilakukan:

```text
Browser Request
↓
Wait 5 minutes
↓
AI Processing
↓
Video Processing
↓
Return response
```

Gunakan:

```text
Request
↓
Create Job
↓
Queue
↓
Background Processing
↓
Update Database
↓
Realtime Update
```

---

## 7.5 Workspace Isolation

Konten dari satu workspace tidak boleh secara tidak sengaja masuk ke workspace lain.

Contoh:

```text
Coding Content

❌ tidak boleh otomatis dipublish ke Trading

Trading Content

❌ tidak boleh muncul di Business Queue
```

Isolasi harus diterapkan pada:

* database queries
* Row Level Security
* API authorization
* queue payload
* publishing workflow

---

# 8. User Roles

MVP hanya memiliki satu role utama:

## Owner

Owner dapat:

* membuat workspace
* menghubungkan Instagram account
* mengatur AI profile
* mengatur content preferences
* menambahkan content source
* melihat content queue
* mengedit caption
* menjadwalkan konten
* publish konten
* melihat history
* mengatur notification

Future:

```text
Owner
Manager
Editor
Viewer
```

Namun role collaboration bukan bagian dari MVP.

---

# 9. Core User Flow

## 9.1 First Time Setup

```text
Open Application
↓
Sign Up
↓
Create Workspace
↓
Choose Workspace Name
↓
Define Niche
↓
Define Target Audience
↓
Define Content Preferences
↓
Configure AI Personality
↓
Connect Instagram Account
↓
Configure Posting Schedule
↓
Add Content Sources
↓
Workspace Ready
```

---

## 9.2 Daily Content Workflow

```text
Content Discovery
↓
Content Candidate
↓
AI Analysis
↓
Duplicate Detection
↓
Content Score
↓
Generate Caption
↓
READY FOR REVIEW
↓
Schedule
↓
Publish
↓
Record History
↓
Notification
```

---

# 10. Content Discovery

Content discovery harus bersifat workspace-specific.

Arsitektur:

```text
WORKSPACE
    ↓
CONTENT PROFILE
    ↓
DISCOVERY RULES
    ↓
CONTENT CANDIDATES
    ↓
AI FILTER
    ↓
CONTENT QUEUE
```

Setiap workspace dapat memiliki:

```text
Keywords
Topics
Creators
Languages
Excluded Topics
Minimum Score
```

Contoh Coding Workspace:

```text
Keywords:
React
Next.js
JavaScript
Python
AI Coding

Excluded:
Politics
Celebrity
Gaming
```

Contoh Trading Workspace:

```text
Keywords:
Bitcoin
Crypto
Forex
Trading
Price Action

Excluded:
Politics
Celebrity
Gambling
```

---

# 11. Content Source Policy

MVP harus membedakan antara:

## Content Discovery

Menemukan kandidat konten berdasarkan:

* keywords
* creators
* topics
* approved sources

dan:

## Content Acquisition

Menggunakan atau memproses media hanya melalui jalur yang sesuai dengan hak penggunaan, izin, lisensi, atau API/platform capability yang berlaku.

Sistem tidak boleh mengasumsikan bahwa semua video publik dapat secara bebas:

```text
Download
Reupload
Republish
```

Setiap kandidat konten dapat memiliki metadata:

```text
source_url
creator
platform
license_status
permission_status
attribution_required
```

Untuk MVP, sistem harus mendukung status:

```text
UNKNOWN
ALLOWED
REQUIRES_REVIEW
REJECTED
```

Jika status hak penggunaan tidak jelas:

> Content harus dapat ditandai untuk manual review.

---

# 12. Content Entity

Setiap kandidat konten harus memiliki struktur konseptual:

```text
Content
│
├── Identity
│   ├── ID
│   ├── Workspace
│   └── Source
│
├── Source Information
│   ├── Platform
│   ├── URL
│   ├── Creator
│   └── Original Metadata
│
├── Analysis
│   ├── Topic
│   ├── Summary
│   ├── Language
│   └── Scores
│
├── AI Output
│   ├── Caption
│   ├── Hashtags
│   └── Recommendations
│
├── Rights / Review
│
├── Publishing
│   ├── Status
│   ├── Schedule
│   └── Published URL
│
└── Audit History
```

---

# 13. Content State Machine

Konten tidak boleh menggunakan status bebas.

Gunakan state machine.

```text
DISCOVERED
    ↓
VALIDATING
    ↓
ANALYZING
    ↓
SCORING
    ↓
READY_FOR_REVIEW
    ↓
APPROVED
    ↓
SCHEDULED
    ↓
PUBLISHING
    ↓
PUBLISHED
```

Possible alternative states:

```text
REJECTED
FAILED
DUPLICATE
REQUIRES_REVIEW
ARCHIVED
```

Transition tidak boleh sembarangan.

Contoh:

```text
PUBLISHED
→
DISCOVERED

NOT ALLOWED
```

---

# 14. AI Content Intelligence

AI digunakan untuk membantu analisis konten.

Input konseptual:

```text
Content Metadata
+
Transcript
+
Source Description
+
Workspace Profile
+
Content Rules
```

Output harus structured.

Contoh:

```json
{
  "topic": "React Performance",
  "summary": "Tips for optimizing React component rendering",
  "language": "English",
  "content_type": "Educational",
  "audience_match_score": 91,
  "quality_score": 88,
  "relevance_score": 95,
  "overall_score": 91,
  "reason": "Highly relevant to the workspace audience"
}
```

Semua AI output harus divalidasi menggunakan schema validation.

Contoh teknologi:

```text
Zod
```

AI tidak boleh langsung menghasilkan data yang dipercaya aplikasi tanpa validasi.

---

# 15. AI Content Score

Content Score digunakan untuk membantu prioritas.

Formula konseptual:

```text
OVERALL SCORE

=
Niche Relevance
+
Audience Match
+
Content Quality
+
Freshness
+
Originality
-
Duplicate Risk
```

Contoh:

```text
Niche Relevance: 95
Audience Match: 90
Content Quality: 88
Freshness: 85
Duplicate Risk: -10

Final Score: 89
```

Score harus dapat dikonfigurasi di masa depan.

Namun MVP dapat menggunakan formula sederhana.

---

# 16. Duplicate Detection

Duplicate detection memiliki beberapa lapisan.

## Layer 1 — Source URL

```text
Same URL

→ DUPLICATE
```

## Layer 2 — Source Identity

Jika source ID atau media identity sama:

```text
→ DUPLICATE
```

## Layer 3 — Semantic Similarity

```text
Transcript
↓
Embedding
↓
pgvector
↓
Similarity Search
```

Contoh:

```text
Content A:
Bitcoin reaches $100,000

Content B:
BTC breaks the six-figure level
```

Walaupun berbeda secara teks:

```text
High Semantic Similarity
```

Sistem dapat menandai:

```text
POTENTIAL_DUPLICATE
```

Keputusan akhir MVP dapat dilakukan melalui:

* threshold otomatis
* manual review

---

# 17. AI Profile

Setiap workspace memiliki AI Profile sendiri.

AI Profile berisi:

```text
Role
Audience
Tone
Writing Style
Content Goals
Rules
Restrictions
```

Contoh:

```text
ROLE

You are a programming content strategist.

AUDIENCE

Beginner and intermediate developers.

STYLE

Educational.
Practical.
Friendly.

GOAL

Make technical concepts easy to understand.

AVOID

Misleading technical claims.
Low-value clickbait.
```

AI Profile tidak boleh di-hardcode.

Harus tersimpan sebagai konfigurasi workspace.

---

# 18. Caption Generation

Caption generation menggunakan:

```text
Workspace Profile
+
AI Instructions
+
Content Analysis
+
Content Metadata
```

Output:

```text
Caption
Hashtags
Call To Action
Optional Short Summary
```

User harus dapat:

```text
Regenerate
Edit
Approve
Reject
```

Caption tidak boleh langsung dianggap final tanpa disimpan sebagai entity terpisah.

---

# 19. Caption Versions

Satu konten dapat memiliki beberapa caption.

```text
Content
│
├── Caption Version 1
│
├── Caption Version 2
│
└── Caption Version 3
```

User dapat memilih:

```text
ACTIVE CAPTION
```

Ini penting agar regenerasi AI tidak menghapus hasil sebelumnya.

---

# 20. Scheduling

Scheduling bersifat workspace-specific.

Contoh:

```text
CODING

09:00
18:00


TRADING

08:00
12:00
20:00


BUSINESS

10:00
16:00
```

Setiap workspace memiliki:

```text
Timezone
Days
Posting Times
Enabled Status
```

Sistem harus menyimpan waktu menggunakan UTC.

User interface menampilkan waktu berdasarkan timezone workspace.

---

# 21. Scheduling Flow

```text
Content Approved
      ↓
Choose Schedule Slot
      ↓
Create Scheduled Post
      ↓
Queue Publishing Job
      ↓
Wait Until Scheduled Time
      ↓
Publishing Attempt
      ↓
Success / Failure
      ↓
Update Database
      ↓
Notification
```

---

# 22. Publishing

Publishing harus memiliki service layer sendiri.

```text
Publishing Service
│
├── Authentication
├── Media Preparation
├── Create Media Container
├── Publish
├── Status Check
├── Retry
└── Error Handling
```

Arsitektur:

```text
Application
      ↓
Publishing Service
      ↓
Platform Adapter
      ↓
Instagram API
```

Jangan menghubungkan UI langsung ke Instagram API.

---

# 23. Publishing State

```text
DRAFT

SCHEDULED

QUEUED

PUBLISHING

PUBLISHED

FAILED

RETRYING

CANCELLED
```

Setiap publishing attempt harus dicatat.

---

# 24. Retry Strategy

Publishing failure tidak boleh menyebabkan konten hilang.

Gunakan:

```text
Attempt 1
↓
Failure
↓
Retry Delay
↓
Attempt 2
↓
Failure
↓
Retry Delay
↓
Attempt 3
↓
FAILED
↓
Notify User
```

Jumlah retry harus configurable.

MVP dapat menggunakan:

```text
Maximum 3 attempts
```

---

# 25. Notification System

Notification bersifat event-driven.

Events:

```text
CONTENT_DISCOVERED

CONTENT_READY

CONTENT_REQUIRES_REVIEW

CAPTION_GENERATED

SCHEDULE_CREATED

PUBLISH_STARTED

PUBLISHED

PUBLISH_FAILED

SYSTEM_ERROR
```

Flow:

```text
Event
↓
Notification Record
↓
Notification Queue
↓
Web Push
↓
User Device
```

Notification juga harus tersedia dalam aplikasi.

---

# 26. PWA Requirements

Aplikasi harus dapat digunakan sebagai Progressive Web App.

Required:

```text
Web App Manifest

Application Icons

Standalone Display

Service Worker

Offline App Shell

Push Notifications
```

User harus dapat:

```text
Open Website
↓
Add To Home Screen
↓
Open Like Native Application
```

---

# 27. PWA Platform Expectation

Behavior dapat berbeda antara:

```text
iOS Safari

Android Chrome

Desktop Browser
```

Push notification dan background behavior harus mengikuti capability browser/platform yang tersedia.

Aplikasi tidak boleh mengasumsikan bahwa semua browser memiliki behavior background yang identik.

---

# 28. Dashboard

Dashboard utama menampilkan seluruh workspace.

Contoh:

```text
DASHBOARD

WORKSPACES

[ Coding ]
Ready: 12
Scheduled: 2
Published Today: 1

[ Trading ]
Ready: 8
Scheduled: 3
Published Today: 2

[ Business ]
Ready: 15
Scheduled: 2
Published Today: 1
```

Kemudian:

```text
TODAY'S ACTIVITY

09:00 Coding Published

12:00 Trading Scheduled

16:00 Business Scheduled
```

---

# 29. Workspace Dashboard

Ketika user membuka workspace:

```text
CODING WORKSPACE

Overview

Content Queue

Sources

AI Profile

Schedule

Publishing History

Settings
```

Semua halaman harus berada dalam workspace context.

---

# 30. Account Switcher

User dapat berpindah workspace.

```text
ALL WORKSPACES

Coding

Trading

Business

+ Create Workspace
```

Ketika workspace dipilih:

```text
Application Context
=
Selected Workspace
```

Seluruh data yang ditampilkan harus sesuai dengan workspace tersebut.

---

# 31. MVP Pages

MVP memiliki halaman:

```text
/

Authentication

/dashboard

/workspaces

/workspaces/[workspaceId]

/workspaces/[workspaceId]/content

/workspaces/[workspaceId]/sources

/workspaces/[workspaceId]/schedule

/workspaces/[workspaceId]/history

/workspaces/[workspaceId]/settings

/notifications

/settings
```

Struktur final dapat berubah berdasarkan Next.js route design.

---

# 32. Infrastructure Architecture

```text
USER
│
▼
VERCEL
Next.js PWA
│
├──────────────┐
│              │
▼              ▼
SUPABASE       APPLICATION SERVICES
│
├── PostgreSQL
├── Auth
├── Realtime
└── pgvector

BACKGROUND SERVICES
│
├── Queue
├── AI Jobs
├── Scheduling
├── Publishing
└── Notifications

EXTERNAL SERVICES
│
├── AI Provider
│   └── OpenAI-compatible AI Router
│
├── Instagram API
│
└── Supabase Storage
    └── Private Media Storage (MVP)
```

---

# 33. Technology Stack

## Frontend

```text
Next.js

TypeScript

React

Tailwind CSS

shadcn/ui
```

---

## Hosting

```text
Vercel
```

Digunakan untuk:

```text
Web Application

SSR

Server Actions

API Routes

Webhooks
```

---

## Database

```text
Supabase PostgreSQL
```

Digunakan untuk:

```text
Application Data

Authentication

Realtime

Row Level Security

pgvector
```

---

## Queue

```text
Redis

Upstash
```

Queue abstraction harus memungkinkan provider diganti di masa depan.

---

## Storage

```text
Supabase Storage (private bucket for the MVP)
```

Phase 8 deliberately selects Supabase Storage because it shares the product's
existing auth/RLS control plane and needs no additional provider credentials.
The domain reference remains `storage_provider` + `storage_key`, so a future
R2 adapter is possible without changing the content schema. Signed public URLs
are generated only when needed and are never stored as identity.

Digunakan untuk:

```text
Temporary Media

Thumbnails

Approved Media Assets
```

Media lifecycle harus dipertimbangkan agar storage tidak terus bertambah.

---

## AI

```text
OpenAI-Compatible AI Router
```

Endpoint AI Router bersifat configurable melalui `AI_ROUTER_BASE_URL`.

Project menargetkan OpenAI API contract, bukan satu vendor tertentu. Endpoint
compatible apa pun dapat digunakan: custom router, self-hosted gateway, local
server, atau hosted provider seperti OpenRouter. Semuanya opsional dan dapat
diganti tanpa mengubah application code.

Aplikasi harus memiliki provider abstraction.

Tidak boleh:

```text
Direct AI API calls scattered across application
```

---

# 34. Database Principles

Database harus mengikuti:

```text
UUID Primary Keys

created_at

updated_at

Foreign Key Constraints

Indexes

Workspace Scoping

Row Level Security
```

Semua data yang terkait workspace harus dapat dilacak melalui:

```text
workspace_id
```

---

# 35. Proposed Core Tables

```text
profiles

workspaces

workspace_members

social_accounts

content_profiles

content_sources

contents

content_analysis

content_embeddings

captions

posting_schedules

scheduled_posts

publish_attempts

published_posts

notifications

push_subscriptions

jobs

audit_logs
```

Detail schema akan didefinisikan dalam:

```text
DATABASE_SCHEMA.md
```

---

# 36. Security Model

Security requirements:

## Secrets

Tidak boleh dikirim ke browser:

```text
AI API Key

Instagram Secret

Service Role Key

Storage Secret

Redis Secret
```

---

## Authentication

Menggunakan:

```text
Supabase Auth
```

---

## Authorization

Menggunakan:

```text
Row Level Security
+
Application Authorization
```

---

## Token Storage

Social account token harus:

```text
Encrypted at rest
```

Browser tidak boleh memiliki akses langsung ke secret publishing credentials.

---

# 37. API Design Principles

API harus:

```text
Workspace Scoped

Authenticated

Authorized

Validated

Rate Limited where needed

Auditable
```

Contoh:

```text
/workspaces/:workspaceId/content

/workspaces/:workspaceId/sources

/workspaces/:workspaceId/schedule
```

Workspace ID tidak boleh otomatis memberikan akses.

Setiap request harus memverifikasi bahwa user memiliki akses terhadap workspace tersebut.

---

# 38. Background Job Principles

Job payload harus kecil.

Jangan memasukkan file video besar ke Redis.

Gunakan:

```text
Job
↓
content_id
workspace_id
```

Worker kemudian mengambil data dari database/storage.

Contoh:

```json
{
  "job_type": "ANALYZE_CONTENT",
  "workspace_id": "uuid",
  "content_id": "uuid"
}
```

---

# 39. Job Types

MVP:

```text
DISCOVER_CONTENT

VALIDATE_CONTENT

ANALYZE_CONTENT

GENERATE_CAPTION

CHECK_DUPLICATE

SCHEDULE_POST

PUBLISH_POST

SEND_NOTIFICATION
```

Job harus memiliki:

```text
status

attempt_count

max_attempts

error

started_at

completed_at
```

---

# 40. Realtime Architecture

Supabase Realtime digunakan untuk update UI.

Contoh:

```text
Content Status Changed

ANALYZING
↓
READY
```

Dashboard langsung berubah tanpa refresh.

Realtime tidak boleh menjadi source of truth.

Database tetap menjadi authoritative state.

---

# 41. Analytics MVP

Analytics awal cukup sederhana.

Per workspace:

```text
Total Content

Ready Content

Scheduled Content

Published Content

Failed Publishing

Posts Today
```

Future analytics:

```text
Engagement

Reach

Views

Likes

Comments

Growth

Best Posting Time

AI Content Performance Analysis
```

---

# 42. MVP Scope

MVP HARUS mencakup:

## Foundation

```text
Authentication

Workspace System

Multi Workspace

Account Switching

Database

RLS
```

## Content

```text
Content Sources

Content Queue

Content Status

Content Analysis

Content Score

Duplicate Detection Foundation
```

## AI

```text
AI Profile

Content Analysis

Caption Generation

Hashtag Generation
```

## Scheduling

```text
Posting Schedule

Scheduled Posts

Schedule Management
```

## Publishing

```text
Instagram Connection

Publishing Workflow

Publishing Status

Retry
```

## PWA

```text
Installable

App Shell

Push Notification Support
```

---

# 43. Explicit Non-Goals for MVP

MVP TIDAK BOLEH langsung membangun:

```text
Multi-user collaboration

Team roles beyond foundation

Video editor

Automatic subtitle rendering

AI video generation

Complex video transcoding

Custom FFmpeg pipelines

Full analytics suite

Multi-platform publishing

TikTok publishing

YouTube publishing

Autonomous AI agents

Complex recommendation engine

Billing system

Subscription system

Marketplace

Public API
```

Semua fitur tersebut adalah future scope.

---

# 44. Future Roadmap

## Phase Future A

```text
Advanced Analytics

Content Performance Tracking

Better Duplicate Detection
```

## Phase Future B

```text
Multi-platform Publishing

TikTok

YouTube Shorts

Facebook
```

## Phase Future C

```text
AI Content Strategy

Trend Detection

Content Recommendation

Automatic Content Planning
```

## Phase Future D

```text
Team Collaboration

Roles

Approval Workflow
```

## Phase Future E

```text
Video Processing

Automatic Subtitle

Template System

Video Transformation
```

---

# 45. Development Rules

Coding agent harus mengikuti aturan berikut.

## Rule 1

Jangan membangun fitur di luar phase aktif.

---

## Rule 2

Jangan melakukan redesign besar tanpa kebutuhan.

---

## Rule 3

Selalu mempertahankan:

```text
Multi Workspace Architecture
```

---

## Rule 4

Tidak boleh hardcode:

```text
Single Account Assumption
```

---

## Rule 5

Tidak boleh menaruh secret di frontend.

---

## Rule 6

Tidak boleh membuat background processing bergantung pada browser request.

---

## Rule 7

Database migration harus aman dan reversible jika memungkinkan.

---

## Rule 8

Setiap fitur baru harus memiliki:

```text
Validation

Error Handling

Loading State

Empty State
```

---

## Rule 9

Tidak boleh menghapus existing functionality tanpa alasan yang jelas.

---

## Rule 10

Implementasi harus diverifikasi sebelum phase dinyatakan selesai.

---

# 46. Testing Requirements

Setiap phase harus memiliki:

```text
Unit Tests

Integration Tests where appropriate

Manual Verification Steps
```

Untuk fitur kritis:

```text
Authentication

Authorization

Workspace Isolation

Publishing

Scheduling
```

harus mendapatkan perhatian testing lebih tinggi.

---

# 47. Acceptance Criteria — Product Foundation

Product foundation dianggap siap jika:

### Workspace

* User dapat membuat workspace.
* User dapat memiliki lebih dari satu workspace.
* Workspace memiliki niche sendiri.
* User dapat berpindah workspace.
* Data tidak bocor antar workspace.

### Content

* Content selalu terkait workspace.
* Content memiliki state yang valid.
* Content dapat dianalisis AI.
* Content dapat memiliki score.
* Content duplicate dapat dideteksi.

### AI

* AI profile berbeda per workspace.
* Caption berbeda sesuai workspace profile.
* Model AI tidak hardcoded ke seluruh aplikasi.
* AI response tervalidasi.

### Scheduling

* Schedule berbeda per workspace.
* Scheduled post memiliki state.
* Publishing failure dapat direkam.

### PWA

* Aplikasi dapat di-install.
* Memiliki standalone experience.
* Mendukung push notification sesuai capability platform.

---

# 48. Architecture Success Criteria

Arsitektur dianggap benar jika:

```text
One User
↓
Multiple Workspaces
↓
Multiple Niches
↓
Independent Content Operations
```

dapat berjalan tanpa perubahan arsitektur fundamental.

Contoh:

```text
1 Workspace

→ Works


3 Workspaces

→ Works


10 Workspaces

→ Works


Future 100 Workspaces

→ Architecture remains conceptually valid
```

---

# 49. Core Product Philosophy

Produk ini bukan sekadar:

> Instagram Scheduler.

Produk ini bukan sekadar:

> AI Caption Generator.

Produk ini adalah:

> **A multi-workspace AI-powered content operation system designed to manage multiple niche-based social media content pipelines from one central application.**

Setiap workspace memiliki identitas sendiri.

```text
Different Niche

Different Audience

Different AI Brain

Different Content Rules

Different Content Queue

Different Schedule

Different Publishing Strategy
```

Namun semuanya dikelola dari satu platform.

---

# 50. Final Architecture Principle

```text
ONE USER

        │
        ▼

MULTIPLE WORKSPACES

        │

        ├── Coding
        │     │
        │     ├── AI Profile
        │     ├── Sources
        │     ├── Content
        │     └── Schedule
        │
        ├── Trading
        │     │
        │     ├── AI Profile
        │     ├── Sources
        │     ├── Content
        │     └── Schedule
        │
        ├── Business
        │     │
        │     ├── AI Profile
        │     ├── Sources
        │     ├── Content
        │     └── Schedule
        │
        └── Future Workspace
              │
              ├── AI Profile
              ├── Sources
              ├── Content
              └── Schedule
```

---

# END OF MASTER PRODUCT SPECIFICATION

This document is the primary product-level source of truth.

Implementation documents must not contradict this specification without an explicit architecture or product decision.
