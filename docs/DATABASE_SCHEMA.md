# DATABASE_SCHEMA.md

# AI Multi-Account Content Automation Platform

**Version:** 1.0
**Status:** Database Architecture Foundation
**Depends On:**

* `MASTER_PRODUCT_SPEC.md`
* `TECHNICAL_ARCHITECTURE.md`

---

# 1. Purpose

Dokumen ini mendefinisikan logical database schema untuk AI Content Automation Platform.

Dokumen ini menjadi source of truth untuk:

* database entities
* table relationships
* workspace isolation
* primary keys
* foreign keys
* state machines
* indexes
* Row Level Security
* auditability
* background jobs
* publishing history
* notification storage

Dokumen ini belum merupakan SQL migration final.

SQL migration harus mengimplementasikan schema ini.

---

# 2. Database Principles

Database harus mengikuti prinsip berikut.

## 2.1 PostgreSQL as Source of Truth

Supabase PostgreSQL adalah authoritative data store.

State penting tidak boleh hanya disimpan di:

* browser
* Redis
* memory
* temporary worker state

---

## 2.2 UUID Primary Keys

Semua domain entity menggunakan UUID.

Contoh:

```text
id UUID PRIMARY KEY
```

UUID digunakan untuk:

* distributed-safe identity
* API safety
* future scalability
* avoiding sequential ID exposure

---

## 2.3 Timestamps

Semua major entity memiliki:

```text
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Timestamp harus menggunakan UTC.

---

## 2.4 Workspace Isolation

Semua data yang terkait content operation harus dapat dilacak ke:

```text
workspace_id
```

Workspace adalah security boundary utama.

---

## 2.5 Foreign Keys

Foreign key harus digunakan untuk menjaga referential integrity.

Tidak boleh menggunakan loose string reference jika entity relationship jelas.

---

## 2.6 Soft Delete

MVP tidak menggunakan soft delete secara default untuk seluruh tabel.

Gunakan:

```text
deleted_at
```

hanya jika entity memang membutuhkan recoverability.

Untuk entity penting seperti publishing history dan audit log:

> Record tidak boleh dihapus secara sembarangan.

---

# 3. PostgreSQL Extensions

Required:

```text
uuid-ossp
```

atau native PostgreSQL:

```text
gen_random_uuid()
```

Untuk future semantic similarity:

```text
pgvector
```

---

# 4. Core Entity Overview

```text
auth.users
    │
    ▼
profiles
    │
    ▼
workspace_members
    │
    ▼
workspaces
    │
    ├───────────────┐
    │               │
    ▼               ▼
social_accounts   content_profiles
    │               │
    │               │
    │               ▼
    │           content_sources
    │               │
    │               ▼
    │            contents
    │               │
    │       ┌───────┼─────────┐
    │       │       │         │
    │       ▼       ▼         ▼
    │   analysis captions   embeddings
    │       │       │
    │       │       ▼
    │       │   scheduled_posts
    │       │       │
    │       │       ▼
    │       │ publish_attempts
    │       │       │
    │       │       ▼
    │       │ published_posts
    │       │
    │       ▼
    │      jobs
    │
    └───────────────┐
                    │
                    ▼
             notifications
                    │
                    ▼
            push_subscriptions
```

---

# 5. profiles

Profile merupakan extension dari:

```text
auth.users
```

## Purpose

Menyimpan informasi aplikasi user.

## Columns

| Column       | Type        | Description        |
| ------------ | ----------- | ------------------ |
| id           | UUID        | FK ke auth.users   |
| display_name | TEXT        | Nama pengguna      |
| avatar_url   | TEXT        | Optional avatar    |
| created_at   | TIMESTAMPTZ | Creation timestamp |
| updated_at   | TIMESTAMPTZ | Update timestamp   |

## Primary Key

```text
id
```

## Foreign Key

```text
id
→ auth.users.id
```

---

# 6. workspaces

Workspace adalah core organizational entity.

Satu user dapat memiliki banyak workspace.

## Columns

| Column      | Type        | Description          |
| ----------- | ----------- | -------------------- |
| id          | UUID        | Workspace ID         |
| name        | TEXT        | Workspace name       |
| slug        | TEXT        | URL-safe identifier  |
| niche       | TEXT        | Primary niche        |
| description | TEXT        | Optional description |
| timezone    | TEXT        | IANA timezone        |
| created_by  | UUID        | Creator user         |
| created_at  | TIMESTAMPTZ | Creation timestamp   |
| updated_at  | TIMESTAMPTZ | Update timestamp     |

## Constraints

```text
name NOT NULL
slug NOT NULL
niche NOT NULL
timezone NOT NULL
```

## Recommended Unique Constraint

```text
UNIQUE(created_by, slug)
```

> **Implemented subset (Phases 2–7A).** Live columns: `id`, `name`, `owner_id`
> (the spec's `created_by`), `created_at`, `updated_at`. `niche` and
> `description` live in `public.workspace_profiles` (see §9 note), not here, so
> a workspace can exist before it is described and `niche NOT NULL` never needs
> a backfill. `slug` and `timezone` are not modelled yet: no route uses a slug
> (URLs are by UUID) and nothing schedules yet.

---

# 7. workspace_members

Walaupun MVP hanya memiliki owner, membership table tetap dibuat sejak awal.

Tujuan:

* future team collaboration
* explicit workspace access
* consistent authorization model

## Columns

| Column       | Type        | Description        |
| ------------ | ----------- | ------------------ |
| id           | UUID        | Membership ID      |
| workspace_id | UUID        | Workspace          |
| user_id      | UUID        | User               |
| role         | TEXT        | owner              |
| created_at   | TIMESTAMPTZ | Creation timestamp |

## MVP Role

```text
owner
```

Future:

```text
manager
editor
viewer
```

## Unique Constraint

```text
UNIQUE(workspace_id, user_id)
```

---

# 8. social_accounts

Menyimpan akun social media yang terhubung.

MVP:

```text
Instagram
```

Future:

```text
TikTok
YouTube
Facebook
```

## Columns

| Column                  | Type        | Description                      |
| ----------------------- | ----------- | -------------------------------- |
| id                      | UUID        | Account ID                       |
| workspace_id            | UUID        | Workspace                        |
| platform                | TEXT        | instagram                        |
| external_account_id     | TEXT        | Platform account ID              |
| username                | TEXT        | Username                         |
| display_name            | TEXT        | Account display name             |
| status                  | TEXT        | Connection status                |
| access_token_encrypted  | TEXT        | Encrypted token                  |
| refresh_token_encrypted | TEXT        | Optional encrypted refresh token |
| token_expires_at        | TIMESTAMPTZ | Token expiration                 |
| metadata                | JSONB       | Provider metadata                |
| connected_at            | TIMESTAMPTZ | Connection time                  |
| created_at              | TIMESTAMPTZ | Creation timestamp               |
| updated_at              | TIMESTAMPTZ | Update timestamp                 |

## Status

```text
ACTIVE
EXPIRED
DISCONNECTED
ERROR
```

## Constraints

```text
UNIQUE(platform, external_account_id)
```

Untuk MVP:

```text
UNIQUE(workspace_id, platform)
```

Karena:

> Satu workspace = satu Instagram account.

---

# 9. content_profiles

Content Profile mendefinisikan identitas content workspace.

## Purpose

Menyimpan:

* target audience
* tone
* style
* content goals
* AI instructions
* restrictions

## Columns

| Column           | Type        |
| ---------------- | ----------- |
| id               | UUID        |
| workspace_id     | UUID        |
| target_audience  | TEXT        |
| tone             | TEXT        |
| writing_style    | TEXT        |
| content_goals    | TEXT        |
| ai_instructions  | TEXT        |
| restrictions     | TEXT        |
| default_language | TEXT        |
| created_at       | TIMESTAMPTZ |
| updated_at       | TIMESTAMPTZ |

## Constraint

```text
UNIQUE(workspace_id)
```

Satu workspace memiliki satu primary content profile pada MVP.

> **Implemented as `public.workspace_profiles` (Phase 7A, decided 2026-09-03 — do
> not "fix" back toward this table).** Table name says what it is: the
> workspace's profile, not a profile of a content item (`content_profiles` reads
> as a sibling of `content_sources`/`content_analysis`, which it is not). Columns
> live: `niche` (≤100) and `description` (≤1000) moved here from §6 `workspaces`
> so `workspaces` stays the small identity row and no `NOT NULL` backfill is
> needed; plus `target_audience`, `tone`, `writing_style`, `content_goals`,
> `restrictions` (each ≤1000). All nullable, non-blank when present ("not set"
> is NULL, never ''). Not modelled yet: `ai_instructions` (overlaps
> tone/style/restrictions; add when a prompt needs a distinct field) and
> `default_language` (no consumer). RLS: members read via
> `workspace_ids_for_current_user()`; INSERT/UPDATE owner-only via
> `workspaces.owner_id`; no client DELETE (cascade only; "clear" is an UPDATE to
> NULL). Migration `20260903120000_create_workspace_profiles.sql`. Length caps
> mirror `PROFILE_SHORT_MAX_LENGTH` / `PROFILE_LONG_MAX_LENGTH` in
> `packages/shared/src/workspace/profile.ts`.

---

# 10. content_sources

Menyimpan konfigurasi sumber discovery.

Contoh:

```text
Keywords

Topics

Creators

Approved Sources
```

## Columns

| Column        | Type        |
| ------------- | ----------- |
| id            | UUID        |
| workspace_id  | UUID        |
| source_type   | TEXT        |
| name          | TEXT        |
| platform      | TEXT        |
| configuration | JSONB       |
| enabled       | BOOLEAN     |
| created_at    | TIMESTAMPTZ |
| updated_at    | TIMESTAMPTZ |

## source_type

```text
KEYWORD
TOPIC
CREATOR
URL
API
MANUAL
```

## configuration example

```json
{
  "keywords": [
    "React",
    "Next.js",
    "TypeScript"
  ]
}
```

---

# 11. contents

Contents adalah entity utama dari seluruh content pipeline.

Setiap candidate content harus memiliki satu record.

## Columns

| Column               | Type        | Description                |
| -------------------- | ----------- | -------------------------- |
| id                   | UUID        | Content ID                 |
| workspace_id         | UUID        | Workspace                  |
| source_id            | UUID        | Optional source            |
| platform             | TEXT        | Source platform            |
| source_url           | TEXT        | Original URL               |
| external_content_id  | TEXT        | Source platform content ID |
| creator_name         | TEXT        | Creator                    |
| creator_handle       | TEXT        | Creator handle             |
| title                | TEXT        | Optional title             |
| description          | TEXT        | Source description         |
| language             | TEXT        | Detected language          |
| media_type           | TEXT        | video/image                |
| media_status         | TEXT        | Media lifecycle            |
| storage_provider     | TEXT        | Storage provider           |
| storage_key          | TEXT        | Object storage key         |
| duration_seconds     | NUMERIC     | Optional duration          |
| thumbnail_url        | TEXT        | Optional thumbnail         |
| transcript           | TEXT        | Optional transcript        |
| rights_status        | TEXT        | Rights state               |
| attribution_required | BOOLEAN     | Attribution requirement    |
| attribution_text     | TEXT        | Required attribution       |
| status               | TEXT        | Content state              |
| discovered_at        | TIMESTAMPTZ | Discovery time             |
| created_at           | TIMESTAMPTZ | Creation                   |
| updated_at           | TIMESTAMPTZ | Update                     |

> **Implemented naming (Phase 6, decided 2026-09-03 — do not "fix" back toward this table).**
> `public.content` uses `source_type` (not `platform`) and `external_id` (not
> `external_content_id`). `platform` was rejected because the column is a
> neutral owner-set label and must not imply an integration; `external_id` is
> the shorter, conventional name. `sources.source_type` (§10) is a different
> enum on a different table — the same column name on two tables is ordinary
> SQL, not a conflict, and no rename is planned. Live checks on these columns
> (http(s)-only `source_url`, non-blank `external_id`, length caps 2048/200,
> storage pair set-together-or-null and non-blank) are in
> `supabase/migrations/20260903100000_*` and `20260903110000_*`; those files
> are the source of truth over this table where they differ.

---

# 12. Content Status State Machine

Valid states:

```text
DISCOVERED

VALIDATING

ANALYZING

SCORING

READY_FOR_REVIEW

APPROVED

SCHEDULED

PUBLISHING

PUBLISHED

REJECTED

FAILED

DUPLICATE

REQUIRES_REVIEW

ARCHIVED
```

Recommended transition:

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

Alternative transitions:

```text
ANY VALIDATION STAGE
    ↓
REQUIRES_REVIEW

READY_FOR_REVIEW
    ↓
REJECTED

ANALYZING
    ↓
FAILED

SCORING
    ↓
DUPLICATE
```

---

# 13. Content Rights Status

```text
UNKNOWN

ALLOWED

REQUIRES_REVIEW

REJECTED
```

Important principle:

```text
Public Content

≠

Automatically Allowed To Republish
```

Jika rights status tidak jelas:

```text
REQUIRES_REVIEW
```

harus tersedia sebagai workflow state.

---

# 14. Content Media Status

```text
EXTERNAL_ONLY

TEMPORARY

AVAILABLE

PROCESSING

MISSING

DELETED
```

Media lifecycle harus terpisah dari content workflow state.

> **Implemented subset (Phase 6, decided 2026-09-03).** The live `media_status`
> column stores lowercase values and only the three states the product can
> honestly produce today: `external_only` (default; storage pair must be null),
> `available` (storage pair must be set), `missing` (pair may be kept or
> cleared). Lowercase matches the existing `status` column convention
> (`draft`/`ready`/`archived`), so the uppercase spelling above is
> documentation style, not a target. TEMPORARY, PROCESSING and DELETED are
> not modelled: nothing can put a row into those states until a storage or
> job phase exists. Each is a future `check` widening in a new migration,
> never a rewrite of the applied ones.

---

# 15. content_analysis

Menyimpan hasil AI analysis.

Satu content dapat memiliki beberapa analysis version di masa depan.

Untuk MVP:

Satu primary analysis aktif.

## Columns

| Column                | Type        |
| --------------------- | ----------- |
| id                    | UUID        |
| content_id            | UUID        |
| workspace_id          | UUID        |
| topic                 | TEXT        |
| summary               | TEXT        |
| language              | TEXT        |
| content_type          | TEXT        |
| niche_relevance_score | NUMERIC     |
| audience_match_score  | NUMERIC     |
| quality_score         | NUMERIC     |
| freshness_score       | NUMERIC     |
| originality_score     | NUMERIC     |
| duplicate_risk_score  | NUMERIC     |
| overall_score         | NUMERIC     |
| reasoning             | TEXT        |
| model_provider        | TEXT        |
| model_name            | TEXT        |
| prompt_version        | TEXT        |
| raw_response          | JSONB       |
| created_at            | TIMESTAMPTZ |
| updated_at            | TIMESTAMPTZ |

## Score Range

```text
0 - 100
```

## AI Provider Metadata

`model_provider`, `model_name`, dan `prompt_version` bersifat provider-neutral
dan wajib tetap demikian.

`model_provider` menyimpan identitas provider yang benar-benar melayani request
pada saat itu, bukan asumsi vendor permanen. Karena AI backend diakses sebagai
OpenAI-compatible AI Router yang endpoint-nya configurable, provider dapat
berubah antar request atau antar environment.

Kolom ini tidak boleh diberi default vendor tertentu, dan tidak boleh dipakai
untuk mengunci business logic ke satu provider.

## Recommended Index

```text
(workspace_id, overall_score DESC)
```

---

# 16. content_embeddings

Digunakan untuk semantic duplicate detection.

Requires:

```text
pgvector
```

## Columns

| Column         | Type        |             |
| -------------- | ----------- | ----------- |
| id             | UUID        |             |
| content_id     | UUID        |             |
| workspace_id   | UUID        |             |
| embedding      | VECTOR      | Vector data |
| model_provider | TEXT        |             |
| model_name     | TEXT        |             |
| source_hash    | TEXT        |             |
| created_at     | TIMESTAMPTZ |             |

Satu content dapat memiliki embedding berbeda di masa depan.

MVP dapat menggunakan satu embedding.

---

# 17. captions

Caption harus versioned.

AI regenerate tidak boleh menghapus caption sebelumnya.

## Columns

| Column         | Type        |
| -------------- | ----------- |
| id             | UUID        |
| content_id     | UUID        |
| workspace_id   | UUID        |
| version        | INTEGER     |
| body           | TEXT        |
| hashtags       | JSONB       |
| call_to_action | TEXT        |
| status         | TEXT        |
| generated_by   | TEXT        |
| model_provider | TEXT        |
| model_name     | TEXT        |
| prompt_version | TEXT        |
| created_by     | UUID        |
| created_at     | TIMESTAMPTZ |
| updated_at     | TIMESTAMPTZ |

## Caption Status

```text
DRAFT

ACTIVE

ARCHIVED
```

## Constraint

```text
UNIQUE(content_id, version)
```

Recommended:

Hanya satu caption:

```text
ACTIVE
```

per content.

> **Implemented subset (Phase 7B).** Live in
> `20260903130000_create_captions.sql`: `id`, `content_id`, `workspace_id`,
> `version`, `body`, `status`, `model_name`, `prompt_version`, `created_by`,
> `created_at`, `updated_at`. Both recommendations above are enforced:
> `UNIQUE(content_id, version)` and a partial unique index on
> `(content_id) WHERE status = 'active'`.
>
> Deliberately not modelled yet:
>
> - `model_provider` — the AI layer is vendor-neutral by rule
>   (`docs/AI_ARCHITECTURE.md`), so a provider label would either name the
>   endpoint or be a constant. `model_name` plus `prompt_version` already give
>   the reproducibility CODING_RULES §25 asks for.
> - structured `hashtags` / `call_to_action` — captions are stored as one body
>   until publishing needs the parts separately.
> - token usage and latency — no consumer exists; cost tracking is its own
>   phase.
>
> `workspace_id` is denormalised for a direct RLS predicate rather than a join
> through `content`, matching every other table. It cannot drift: a composite
> FK `(content_id, workspace_id) → content(id, workspace_id)` makes attaching a
> caption to another workspace's content a database error, not a policy
> question. Access follows **content** (any workspace member may generate and
> select), not the owner-only `workspace_profiles`.

---

# 18. posting_schedules

Menyimpan aturan posting berulang per workspace.

Contoh:

```text
Monday
09:00

Monday
18:00

Tuesday
09:00
```

## Columns

| Column       | Type        |
| ------------ | ----------- |
| id           | UUID        |
| workspace_id | UUID        |
| day_of_week  | SMALLINT    |
| time_of_day  | TIME        |
| timezone     | TEXT        |
| enabled      | BOOLEAN     |
| created_at   | TIMESTAMPTZ |
| updated_at   | TIMESTAMPTZ |

## day_of_week

```text
0 = Sunday

1 = Monday

...

6 = Saturday
```

---

# 19. scheduled_posts

Merepresentasikan satu publishing event.

Posting schedule adalah rule.

Scheduled post adalah actual occurrence.

## Columns

| Column            | Type        |
| ----------------- | ----------- |
| id                | UUID        |
| workspace_id      | UUID        |
| content_id        | UUID        |
| social_account_id | UUID        |
| caption_id        | UUID        |
| scheduled_for     | TIMESTAMPTZ |
| timezone          | TEXT        |
| status            | TEXT        |
| idempotency_key   | TEXT        |
| created_at        | TIMESTAMPTZ |
| updated_at        | TIMESTAMPTZ |

## Status

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

## Unique Constraint

```text
UNIQUE(idempotency_key)
```

Idempotency key digunakan untuk mencegah duplicate publishing.

---

# 20. publish_attempts

Setiap attempt publishing harus dicatat.

## Columns

| Column                | Type        |
| --------------------- | ----------- |
| id                    | UUID        |
| scheduled_post_id     | UUID        |
| workspace_id          | UUID        |
| attempt_number        | INTEGER     |
| status                | TEXT        |
| provider              | TEXT        |
| external_reference_id | TEXT        |
| request_metadata      | JSONB       |
| response_metadata     | JSONB       |
| error_code            | TEXT        |
| error_message         | TEXT        |
| started_at            | TIMESTAMPTZ |
| completed_at          | TIMESTAMPTZ |
| created_at            | TIMESTAMPTZ |

## Status

```text
STARTED

SUCCEEDED

FAILED

UNKNOWN
```

`UNKNOWN` digunakan jika request ke provider berhasil dikirim tetapi hasil tidak dapat dipastikan.

Ini penting untuk idempotency safety.

---

# 21. published_posts

Menyimpan hasil publish yang berhasil.

## Columns

| Column            | Type        |
| ----------------- | ----------- |
| id                | UUID        |
| workspace_id      | UUID        |
| scheduled_post_id | UUID        |
| social_account_id | UUID        |
| platform          | TEXT        |
| external_post_id  | TEXT        |
| permalink         | TEXT        |
| published_at      | TIMESTAMPTZ |
| metadata          | JSONB       |
| created_at        | TIMESTAMPTZ |

## Constraints

```text
UNIQUE(platform, external_post_id)
```

Recommended:

```text
UNIQUE(scheduled_post_id)
```

Satu scheduled post hanya boleh menghasilkan satu published post.

---

# 22. jobs

Jobs adalah durable background task entity.

Database adalah source of truth.

## Columns

| Column             | Type        |
| ------------------ | ----------- |
| id                 | UUID        |
| workspace_id       | UUID        |
| type               | TEXT        |
| entity_type        | TEXT        |
| entity_id          | UUID        |
| status             | TEXT        |
| priority           | SMALLINT    |
| scheduled_for      | TIMESTAMPTZ |
| started_at         | TIMESTAMPTZ |
| completed_at       | TIMESTAMPTZ |
| attempt_count      | INTEGER     |
| max_attempts       | INTEGER     |
| locked_at          | TIMESTAMPTZ |
| locked_by          | TEXT        |
| last_error_code    | TEXT        |
| last_error_message | TEXT        |
| payload            | JSONB       |
| result             | JSONB       |
| created_at         | TIMESTAMPTZ |
| updated_at         | TIMESTAMPTZ |

---

# 23. Job Types

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

Future types dapat ditambahkan.

---

# 24. Job Status

```text
PENDING

QUEUED

RUNNING

RETRYING

COMPLETED

FAILED

CANCELLED
```

---

# 25. Job Locking

Untuk mencegah dua worker menjalankan job yang sama:

```text
locked_at

locked_by
```

digunakan.

Concept:

```text
Worker

↓

Atomic Claim

↓

Set

status = RUNNING

locked_at = NOW()

locked_by = worker_identifier
```

---

# 26. Job Recovery

Stale job dapat ditemukan melalui:

```text
status = RUNNING

AND

locked_at < timeout
```

Kemudian:

```text
RETRYING
```

atau:

```text
FAILED
```

tergantung:

```text
attempt_count

max_attempts
```

---

# 27. notifications

Menyimpan in-app notification.

## Columns

| Column       | Type        |
| ------------ | ----------- |
| id           | UUID        |
| user_id      | UUID        |
| workspace_id | UUID        |
| type         | TEXT        |
| title        | TEXT        |
| body         | TEXT        |
| data         | JSONB       |
| read_at      | TIMESTAMPTZ |
| created_at   | TIMESTAMPTZ |

## Types

```text
CONTENT_READY

CONTENT_REQUIRES_REVIEW

CAPTION_GENERATED

SCHEDULE_CREATED

PUBLISH_STARTED

PUBLISHED

PUBLISH_FAILED

SYSTEM_ERROR
```

---

# 28. push_subscriptions

Menyimpan Web Push subscription.

## Columns

| Column       | Type        |
| ------------ | ----------- |
| id           | UUID        |
| user_id      | UUID        |
| endpoint     | TEXT        |
| p256dh       | TEXT        |
| auth         | TEXT        |
| user_agent   | TEXT        |
| enabled      | BOOLEAN     |
| last_used_at | TIMESTAMPTZ |
| created_at   | TIMESTAMPTZ |
| updated_at   | TIMESTAMPTZ |

## Unique Constraint

```text
UNIQUE(endpoint)
```

Invalid subscription harus dapat:

```text
enabled = false
```

---

# 29. audit_logs

Mencatat critical action.

Audit logs tidak boleh digunakan sebagai source of truth utama.

Audit logs digunakan untuk:

* debugging
* investigation
* history

## Columns

| Column        | Type        |
| ------------- | ----------- |
| id            | UUID        |
| workspace_id  | UUID        |
| actor_user_id | UUID        |
| action        | TEXT        |
| entity_type   | TEXT        |
| entity_id     | UUID        |
| metadata      | JSONB       |
| created_at    | TIMESTAMPTZ |

## Example Actions

```text
WORKSPACE_CREATED

CONTENT_CREATED

CONTENT_APPROVED

CONTENT_REJECTED

CAPTION_GENERATED

SCHEDULE_CREATED

SCHEDULE_CANCELLED

PUBLISH_STARTED

PUBLISH_SUCCEEDED

PUBLISH_FAILED
```

---

# 30. Entity Relationship Summary

```text
USER
 │
 ├── PROFILE
 │
 └── WORKSPACE MEMBERSHIP
        │
        ▼
    WORKSPACE
        │
        ├── SOCIAL ACCOUNT
        │
        ├── CONTENT PROFILE
        │
        ├── CONTENT SOURCE
        │
        ├── CONTENT
        │      │
        │      ├── CONTENT ANALYSIS
        │      │
        │      ├── CONTENT EMBEDDING
        │      │
        │      ├── CAPTIONS
        │      │
        │      └── SCHEDULED POST
        │              │
        │              ├── PUBLISH ATTEMPTS
        │              │
        │              └── PUBLISHED POST
        │
        ├── JOBS
        │
        ├── NOTIFICATIONS
        │
        └── AUDIT LOGS
```

---

# 31. Workspace Foreign Key Rules

Semua workspace-bound entity harus memiliki:

```text
workspace_id
```

Contoh:

```text
contents

captions

content_analysis

content_embeddings

scheduled_posts

jobs

notifications

audit_logs
```

Walaupun entity dapat memperoleh workspace melalui foreign key chain, `workspace_id` tetap digunakan untuk:

* security scoping
* query performance
* authorization
* simpler RLS
* operational visibility

---

# 32. Cross-Workspace Integrity

Database harus mencegah relationship yang tidak konsisten.

Contoh invalid state:

```text
Content.workspace_id = Workspace A

Caption.workspace_id = Workspace B
```

Tidak boleh terjadi.

Implementation harus menggunakan salah satu:

```text
Composite foreign key strategy
```

atau:

```text
Database trigger validation
```

atau:

```text
Strict application transaction validation
```

Untuk MVP, database-level integrity lebih diutamakan jika implementasinya tetap sederhana.

---

# 33. Recommended Indexes

## workspaces

```text
(created_by)

(slug)
```

---

## workspace_members

```text
(user_id)

(workspace_id, user_id)
```

---

## social_accounts

```text
(workspace_id)

(platform, external_account_id)
```

---

## contents

Critical indexes:

```text
(workspace_id)

(workspace_id, status)

(workspace_id, created_at DESC)

(source_url)

(platform, external_content_id)
```

---

## content_analysis

```text
(workspace_id, overall_score DESC)

(content_id)
```

---

## captions

```text
(content_id)

(workspace_id)
```

---

## scheduled_posts

Critical:

```text
(status, scheduled_for)

(workspace_id, scheduled_for)

(social_account_id, scheduled_for)
```

---

## jobs

Critical:

```text
(status, scheduled_for)

(workspace_id, status)

(status, locked_at)
```

---

## notifications

```text
(user_id, read_at)

(user_id, created_at DESC)

(workspace_id, created_at DESC)
```

---

# 34. Unique Content Detection

Database-level duplicate detection pertama menggunakan:

```text
platform

external_content_id
```

Recommended constraint:

```text
UNIQUE(
    workspace_id,
    platform,
    external_content_id
)
```

Namun:

Satu source yang sama pada workspace berbeda mungkin memiliki policy berbeda.

Karena itu unique constraint global tidak selalu tepat.

MVP menggunakan:

```text
workspace scoped uniqueness
```

---

# 35. Source URL Normalization

Raw URL tidak boleh selalu digunakan langsung sebagai unique identity.

Sebelum comparison:

```text
URL

↓

Normalize

↓

Remove Tracking Parameters

↓

Canonical URL

↓

Compare
```

Optional columns:

```text
source_url_normalized
```

Recommended unique index:

```text
(workspace_id, source_url_normalized)
```

---

# 36. Content Score Rules

Score fields:

```text
0 <= score <= 100
```

Recommended PostgreSQL CHECK constraints:

```text
CHECK (
    overall_score >= 0
    AND overall_score <= 100
)
```

Sama untuk seluruh score field.

---

# 37. Caption Version Rules

Caption version:

```text
1

2

3

4
```

Tidak boleh:

```text
1

1
```

Unique:

```text
(content_id, version)
```

Active caption strategy:

Satu content hanya boleh memiliki satu:

```text
ACTIVE
```

Recommended implementation:

Partial unique index.

Concept:

```text
UNIQUE(content_id)
WHERE status = 'ACTIVE'
```

---

# 38. Scheduled Post Integrity

Satu scheduled post harus memiliki:

```text
workspace_id

content_id

social_account_id

scheduled_for
```

Caption dapat nullable jika belum dipilih.

Namun sebelum status:

```text
QUEUED
```

atau:

```text
PUBLISHING
```

caption harus tersedia.

---

# 39. Publishing Integrity

Publishing harus mengikuti chain:

```text
CONTENT

↓

SCHEDULED_POST

↓

PUBLISH_ATTEMPT

↓

PUBLISHED_POST
```

Tidak boleh langsung membuat:

```text
PUBLISHED_POST
```

tanpa scheduled post context.

---

# 40. Publishing Idempotency

Setiap scheduled post memiliki:

```text
idempotency_key
```

Key harus:

```text
Unique

Stable

Generated Once
```

Publish retry harus menggunakan identity yang sama.

Jangan membuat idempotency key baru setiap retry.

---

# 41. JSONB Usage Rules

JSONB digunakan hanya untuk flexible metadata.

Contoh:

```text
Provider Metadata

Raw AI Response

Job Payload

Provider Response
```

Tidak boleh menyimpan seluruh relational domain dalam satu JSONB.

Contoh buruk:

```json
{
  "workspace": {},
  "contents": [],
  "captions": []
}
```

Data relational harus tetap menjadi table relational.

---

# 42. RLS Strategy

RLS harus aktif untuk user-facing tables.

Primary rule:

User hanya dapat mengakses data dari workspace yang memiliki membership.

Concept:

```text
EXISTS

workspace_members

WHERE

workspace_members.workspace_id = table.workspace_id

AND

workspace_members.user_id = auth.uid()
```

---

# 43. RLS Tables

RLS wajib dipertimbangkan untuk:

```text
profiles

workspaces

workspace_members

social_accounts

content_profiles

content_sources

contents

content_analysis

captions

scheduled_posts

published_posts

notifications

push_subscriptions

audit_logs
```

---

# 44. Service-Only Tables

Beberapa table dapat primarily digunakan oleh backend service:

```text
jobs

publish_attempts

content_embeddings
```

Namun tetap harus memiliki policy yang aman.

Browser tidak boleh dapat:

```text
Modify job state directly

Insert fake publish attempts

Modify embedding data
```

---

# 45. RLS Example Concept

Untuk `contents`:

```text
SELECT

Allowed if:

User is member of contents.workspace_id
```

Insert:

```text
Allowed if:

User belongs to workspace_id
```

Update:

```text
Allowed if:

User belongs to workspace_id
```

Delete:

MVP dapat dibatasi berdasarkan policy aplikasi.

---

# 46. Service Role Usage

Supabase Service Role hanya digunakan server-side.

Digunakan untuk:

```text
Background jobs

Publishing

System recovery

Internal service operations
```

Service role key:

```text
Never exposed to browser
```

---

# 47. Database Functions

Beberapa operasi sebaiknya menjadi database function/RPC.

Contoh:

```text
claim_due_jobs()

recover_stale_jobs()

claim_scheduled_posts()
```

Keuntungan:

```text
Atomic operations

Reduced race conditions

Centralized concurrency logic
```

---

# 48. Transaction Boundaries

Critical operations harus menggunakan transaction.

Contoh:

## Approve Content

```text
Update content

+

Create audit log
```

---

## Schedule Post

```text
Create scheduled_post

+

Update content status

+

Create job if needed

+

Create audit log
```

Semua harus berhasil atau rollback.

---

# 49. Atomic Job Claim

Recommended RPC concept:

```text
claim_next_due_job(worker_id)
```

Function:

```text
Find

PENDING / RETRYING

AND

scheduled_for <= NOW()

↓

Lock Row

↓

Update

status = RUNNING

locked_at = NOW()

locked_by = worker_id

↓

Return Claimed Job
```

Gunakan:

```text
FOR UPDATE SKIP LOCKED
```

untuk concurrency safety.

---

# 50. Stale Job Recovery Function

Recommended:

```text
recover_stale_jobs(timeout)
```

Logic:

```text
Find RUNNING jobs

WHERE

locked_at < NOW() - timeout
```

Then:

```text
attempt_count + 1
```

Jika:

```text
attempt_count < max_attempts

→ RETRYING
```

Jika tidak:

```text
FAILED
```

---

# 51. Database Trigger Usage

Trigger digunakan secara terbatas.

Recommended:

```text
updated_at auto-update
```

Optional:

```text
Create profile after auth user creation
```

Hindari trigger kompleks yang menyembunyikan business logic.

---

# 52. updated_at Trigger

Semua major tables menggunakan standard function.

Concept:

```text
set_updated_at()
```

Setiap:

```text
UPDATE
```

akan memperbarui:

```text
updated_at = NOW()
```

---

# 53. Audit Strategy

Audit log tidak boleh dibuat secara manual di banyak tempat tanpa abstraction.

Gunakan service:

```text
auditService.log()
```

atau database function.

Audit record minimal:

```text
workspace_id

actor

action

entity

timestamp
```

---

# 54. Data Retention

MVP harus mempertimbangkan pertumbuhan data.

Recommended policy:

## Temporary Media

```text
Delete after configurable period
```

---

## Raw AI Responses

Optional:

```text
Keep limited time

or

Store only on failure
```

---

## Completed Jobs

Keep for:

```text
Debugging window
```

Future cleanup:

```text
Archive old jobs
```

---

# 55. Deletion Rules

Workspace deletion tidak boleh langsung menjadi:

```text
DELETE FROM workspaces
```

tanpa strategi.

Future implementation harus mempertimbangkan:

```text
Confirmation

Cascade strategy

External token cleanup

Media cleanup

Scheduled job cancellation
```

Untuk MVP:

Workspace deletion dapat ditunda sampai workflow aman.

---

# 56. Data Ownership

Ownership hierarchy:

```text
USER

↓

WORKSPACE

↓

WORKSPACE DATA
```

Workspace adalah ownership boundary.

User tidak secara langsung memiliki content.

User memiliki akses ke content melalui workspace membership.

Ini penting untuk future collaboration.

---

# 57. Naming Conventions

Tables:

```text
snake_case

plural
```

Examples:

```text
workspaces

scheduled_posts

publish_attempts
```

Columns:

```text
snake_case
```

Foreign keys:

```text
workspace_id

content_id

user_id
```

Timestamp:

```text
created_at

updated_at
```

---

# 58. Database Migration Strategy

Migration harus:

```text
Versioned

Sequential

Committed to Git

Reviewable
```

Contoh:

```text
001_initial_schema.sql

002_workspace_tables.sql

003_content_domain.sql

004_jobs.sql

005_notifications.sql
```

Migration production tidak boleh diubah setelah deployed.

Jika ada perubahan:

```text
Create New Migration
```

---

# 59. Proposed Migration Order

```text
001_extensions.sql

002_profiles.sql

003_workspaces.sql

004_workspace_members.sql

005_social_accounts.sql

006_content_profiles.sql

007_content_sources.sql

008_contents.sql

009_content_analysis.sql

010_content_embeddings.sql

011_captions.sql

012_posting_schedules.sql

013_scheduled_posts.sql

014_publish_attempts.sql

015_published_posts.sql

016_jobs.sql

017_notifications.sql

018_push_subscriptions.sql

019_audit_logs.sql

020_functions.sql

021_indexes.sql

022_rls.sql
```

Final order dapat berubah.

Namun dependency harus tetap jelas.

---

# 60. Database Performance Principles

Query harus selalu mempertimbangkan:

```text
workspace_id
```

Avoid:

```text
SELECT * FROM contents
```

Preferred:

```text
SELECT

FROM contents

WHERE workspace_id = ?

ORDER BY created_at DESC

LIMIT ?
```

Pagination wajib untuk collection besar.

---

# 61. Pagination Strategy

Recommended:

```text
Cursor-based pagination
```

Untuk MVP, offset pagination dapat digunakan jika dataset masih kecil.

Namun API abstraction sebaiknya tidak mengunci seluruh aplikasi ke offset pagination.

---

# 62. Search Strategy

MVP search:

```text
PostgreSQL

ILIKE

Full Text Search
```

Future:

```text
Dedicated Search Engine
```

Tidak diperlukan pada MVP.

---

# 63. Semantic Search Strategy

Untuk duplicate detection:

```text
Transcript

+

Title

+

Description

↓

Embedding

↓

pgvector

↓

Similarity Search
```

Semantic similarity hanya salah satu signal.

Tidak boleh menjadi satu-satunya duplicate decision.

---

# 64. Future Multi-Platform Support

Schema sudah mendukung:

```text
social_accounts.platform
```

dan:

```text
contents.platform
```

Future:

```text
instagram

tiktok

youtube

facebook
```

Publishing provider adapter menangani perbedaan capability.

---

# 65. Future Multi-Account per Workspace

MVP:

```text
1 Workspace

↓

1 Instagram Account
```

Future:

```text
1 Workspace

↓

Multiple Social Accounts
```

Schema `social_accounts` sudah mendukung ekspansi tersebut.

MVP constraint dapat dihapus melalui migration jika diperlukan.

---

# 66. Final Core Table List

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

jobs

notifications

push_subscriptions

audit_logs
```

---

# 67. Database Architecture Acceptance Criteria

Database design dianggap siap jika:

### Identity

* User memiliki profile.
* User dapat memiliki banyak workspace.
* Workspace membership tersedia.

### Workspace

* Workspace memiliki timezone.
* Workspace memiliki niche.
* Workspace isolation dapat diterapkan.

### Content

* Content selalu memiliki workspace.
* Content memiliki state machine.
* Source dapat dilacak.
* Rights status tersedia.
* Media lifecycle tersedia.

### AI

* Analysis tersimpan.
* Score tersedia.
* Model metadata tersimpan.
* Caption versioning tersedia.
* Embedding dapat ditambahkan.

### Scheduling

* Recurring schedule tersedia.
* Actual scheduled post terpisah dari schedule rule.
* Time disimpan dalam UTC.

### Publishing

* Publish attempt dicatat.
* Published post memiliki external reference.
* Idempotency tersedia.

### Jobs

* Durable job storage tersedia.
* Retry tersedia.
* Lock tersedia.
* Stale recovery tersedia.

### Security

* Workspace scoping tersedia.
* RLS dapat diterapkan.
* Service-only operations dipisahkan.

---

# 68. Final Database Philosophy

Database harus tetap:

```text
Relational

Workspace Scoped

Auditable

Durable

Normalized

Extensible

Secure
```

Tidak boleh menjadi:

```text
One giant JSON document

Global unscoped data

Queue-only state

Frontend-owned state
```

---

# END OF DATABASE SCHEMA
