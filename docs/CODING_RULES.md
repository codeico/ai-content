# CODING_RULES.md

# AI Multi-Account Content Automation Platform

**Version:** 1.0
**Status:** Mandatory Engineering Rules

---

# 1. Purpose

Dokumen ini mendefinisikan aturan wajib bagi setiap coding agent atau developer yang bekerja di repository ini.

Dokumen ini harus dibaca sebelum:

* menulis code
* mengubah architecture
* membuat database migration
* menambahkan dependency
* mengubah API contract
* memulai implementation phase

Jika terdapat konflik antara improvisasi coding agent dan dokumen architecture project:

> Ikuti dokumen project.

---

# 2. Required Reading Order

Sebelum memulai pekerjaan, coding agent wajib membaca:

```text
docs/MASTER_PRODUCT_SPEC.md
```

Kemudian:

```text
docs/TECHNICAL_ARCHITECTURE.md
```

Kemudian:

```text
docs/DATABASE_SCHEMA.md
```

Kemudian:

```text
docs/IMPLEMENTATION_ROADMAP.md
```

Kemudian:

```text
docs/CODING_RULES.md
```

Coding agent tidak boleh langsung mengasumsikan architecture berdasarkan kebiasaan atau template default.

---

# 3. Phase Discipline

Project dibangun berdasarkan implementation phase.

Coding agent hanya boleh mengerjakan:

```text
Current Phase
```

Tidak boleh mengimplementasikan feature dari:

```text
Future Phase
```

Contoh:

Jika current task adalah:

```text
PHASE 2 — Workspace System
```

maka jangan mulai mengimplementasikan:

* AI analysis
* AI Router integration
* content discovery
* background workers
* scheduling
* Instagram publishing
* push notifications

Walaupun implementasinya terlihat mudah.

---

# 4. No Scope Creep

Jika menemukan ide improvement yang berada di luar current phase:

Jangan langsung implementasikan.

Catat sebagai:

```text
Potential Future Improvement
```

Kemudian lanjutkan scope current phase.

---

# 5. Existing Code First

Sebelum membuat file atau abstraction baru:

1. Inspect existing repository.
2. Search apakah functionality serupa sudah ada.
3. Reuse existing pattern jika sesuai.
4. Hindari duplicate abstraction.

Tidak boleh membuat duplicate:

```text
services

utilities

database clients

validation layers
```

tanpa alasan yang jelas.

---

# 6. Do Not Rewrite Without Reason

Coding agent tidak boleh melakukan large-scale rewrite hanya karena:

```text
"I prefer another architecture"
```

atau:

```text
"This can be cleaner"
```

Refactor besar hanya diperbolehkan jika:

* diperlukan oleh current phase
* terdapat bug architecture nyata
* security issue
* performance issue yang terbukti
* existing design tidak dapat memenuhi requirement

Setiap large refactor harus dijelaskan.

---

# 7. Small Changes First

Prefer:

```text
Small

Focused

Incremental
```

changes.

Hindari:

```text
Large unrelated changes
```

dalam satu task.

Ideal:

```text
Inspect

↓

Plan

↓

Implement

↓

Test

↓

Verify
```

---

# 8. TypeScript Rules

Project menggunakan:

```text
TypeScript strict mode
```

Tidak boleh:

```typescript
any
```

kecuali alasan yang sangat jelas dan terdokumentasi.

Prefer:

```typescript
unknown
```

kemudian lakukan validation.

Tidak boleh:

```typescript
as any
```

untuk menghilangkan type error.

Type error harus diperbaiki pada source problem.

---

# 9. Runtime Validation

TypeScript type tidak cukup untuk external input.

Semua external input harus divalidasi.

Termasuk:

```text
API request

Form input

Webhook payload

Environment variables

Third-party API response
```

Recommended:

```text
Zod
```

atau validator yang telah disepakati architecture.

---

# 10. Environment Variables

Semua environment variable harus:

* documented
* validated
* categorized

Secrets tidak boleh:

```text
Hardcoded

Committed

Logged

Returned to client
```

---

# 11. Secret Naming Rules

Server-only secrets tidak boleh menggunakan:

```text
NEXT_PUBLIC_
```

Contoh aman:

```text
AI_ROUTER_API_KEY

SUPABASE_SERVICE_ROLE_KEY
```

Contoh public:

```text
NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

# 12. Database Rules

Database schema mengikuti:

```text
docs/DATABASE_SCHEMA.md
```

Jangan membuat table secara spontan tanpa memeriksa schema document.

Jika schema perlu berubah:

1. Jelaskan alasan.
2. Update database documentation.
3. Buat migration baru.
4. Jangan mengubah migration lama yang sudah digunakan.

---

# 13. Migration Rules

Migration harus:

```text
Sequential

Deterministic

Versioned

Committed
```

Tidak boleh:

```text
Manual production schema changes
```

tanpa migration.

---

# 14. Migration Safety

Migration harus mempertimbangkan:

```text
Existing data

Foreign keys

Indexes

Rollback implications
```

Hindari destructive migration tanpa alasan kuat.

Contoh berbahaya:

```sql
DROP TABLE
```

atau:

```sql
DROP COLUMN
```

tanpa migration strategy.

---

# 15. Database Integrity

Gunakan database constraints untuk invariant penting.

Contoh:

```text
NOT NULL

UNIQUE

CHECK

FOREIGN KEY
```

Jangan mengandalkan frontend validation untuk menjaga data integrity.

---

# 16. Workspace Isolation

Workspace adalah security boundary.

Semua workspace-bound operation harus memverifikasi authorization.

Tidak boleh percaya pada:

```text
workspace_id
```

yang dikirim browser tanpa verification.

Server harus memverifikasi bahwa authenticated user memiliki membership.

---

# 17. RLS Rules

Row Level Security harus digunakan untuk user-facing database access.

Policy harus mengikuti prinsip:

```text
Least Privilege
```

Default:

```text
Deny unless explicitly allowed
```

---

# 18. Service Role Rules

Supabase Service Role hanya digunakan server-side.

Tidak boleh:

```text
Expose to browser

Store in client code

Send through API response
```

Service role digunakan untuk:

* background jobs
* internal service operations
* trusted server workflows

---

# 19. Authentication Rules

Authentication harus menggunakan:

```text
Supabase Auth
```

Jangan membuat custom authentication system tanpa requirement yang jelas.

Session validation harus dilakukan server-side untuk sensitive operations.

---

# 20. Authorization Rules

Authentication:

```text
Who are you?
```

Authorization:

```text
Are you allowed to do this?
```

Keduanya harus diperiksa secara terpisah.

Authenticated user tidak otomatis memiliki akses ke semua workspace.

---

# 21. API Rules

API harus:

```text
Validated

Authenticated

Authorized

Predictable
```

Setiap mutation endpoint harus:

1. Validate input.
2. Authenticate user.
3. Authorize workspace access.
4. Execute operation.
5. Return safe response.

---

# 22. API Error Rules

Jangan mengembalikan raw internal error ke client.

Gunakan structured error.

Contoh:

```json
{
  "error": {
    "code": "WORKSPACE_ACCESS_DENIED",
    "message": "You do not have access to this workspace."
  }
}
```

Internal details hanya boleh masuk ke server logs.

---

# 23. AI Provider Rules

AI integration harus melalui abstraction.

Application domain tidak boleh langsung bergantung pada vendor AI tertentu:

```text
SDK provider spesifik
```

atau HTTP implementation provider tertentu.

Dependency architecture adalah OpenAI-compatible API contract, bukan satu vendor.
Base URL dan credential harus configurable (`AI_ROUTER_BASE_URL`,
`AI_ROUTER_API_KEY`). Asumsi provider-specific harus terisolasi di dalam
infrastructure/provider adapter.

Gunakan interface concept:

```text
AIProvider
```

Provider implementation:

```text
OpenAICompatibleProvider
```

harus dapat diganti di masa depan tanpa mengubah business logic.

---

# 24. AI Output Validation

AI output adalah untrusted input.

Semua structured AI response harus:

```text
Parse

Validate

Normalize
```

sebelum disimpan ke database.

Jangan langsung:

```text
JSON.parse()

↓

Database Insert
```

tanpa validation.

---

# 25. Prompt Versioning

Prompt penting harus memiliki:

```text
prompt_version
```

AI result harus menyimpan metadata:

```text
model_provider

model_name

prompt_version
```

Tujuannya:

```text
Debugging

Reproducibility

Model comparison
```

---

# 26. AI Cost Safety

Walaupun API digunakan dengan budget pribadi atau free tier:

AI call tetap harus dikontrol.

Implement:

```text
Timeout

Retry policy

Maximum retry

Input size limit
```

Jangan membuat infinite AI retry loop.

---

# 27. Job System Rules

Background job harus durable.

State tidak boleh hanya disimpan di:

```text
Memory

setTimeout

Browser
```

Job harus dapat bertahan ketika:

```text
Worker restart

Process crash

Deployment restart
```

---

# 28. Job Idempotency

Job handler harus aman terhadap retry.

Contoh buruk:

```text
Retry

↓

Create duplicate Instagram post
```

Setiap external side effect harus mempertimbangkan idempotency.

---

# 29. Job Locking

Job hanya boleh dikerjakan oleh satu worker pada satu waktu.

Gunakan atomic claim.

Jangan:

```text
SELECT job

↓

Later UPDATE job
```

tanpa locking strategy.

---

# 30. Stale Job Recovery

Job dengan status:

```text
RUNNING
```

tidak boleh selamanya berada dalam state tersebut.

Harus ada recovery mechanism berdasarkan:

```text
locked_at

timeout

attempt_count
```

---

# 31. Retry Rules

Retry hanya dilakukan untuk error yang retryable.

Contoh retryable:

```text
Network timeout

Temporary provider failure

Rate limit
```

Contoh non-retryable:

```text
Invalid credentials

Validation error

Malformed request
```

---

# 32. External Provider Rules

Semua external provider harus dibungkus adapter.

Contoh:

```text
AIProvider

ContentDiscoveryProvider

MediaStorage

SocialPublisher
```

Business logic tidak boleh langsung bergantung pada HTTP endpoint provider.

---

# 33. Timeout Rules

Setiap external network request harus memiliki timeout.

Tidak boleh:

```text
fetch()
```

tanpa timeout strategy untuk critical background operation.

---

# 34. Logging Rules

Jangan log:

```text
API keys

Access tokens

Refresh tokens

Authorization headers

User secrets
```

Sensitive values harus di-redact.

---

# 35. Error Logging

Error log harus memiliki context yang cukup.

Contoh:

```text
workspace_id

job_id

content_id

operation
```

Namun tetap tidak boleh menyimpan secret.

---

# 36. Content Rights Rules

Public content tidak otomatis berarti bebas digunakan.

System harus mempertahankan:

```text
rights_status
```

dan:

```text
attribution_required
```

Content dengan rights tidak jelas harus dapat masuk:

```text
REQUIRES_REVIEW
```

---

# 37. Publishing Rules

Publishing adalah external side effect.

Publishing flow harus:

```text
Create attempt

↓

Call provider

↓

Record result

↓

Update state
```

Tidak boleh langsung mengubah status menjadi:

```text
PUBLISHED
```

sebelum provider success terverifikasi.

---

# 38. Publishing Idempotency

Setiap publishing operation harus memiliki stable:

```text
idempotency_key
```

Retry tidak boleh menghasilkan post duplikat.

---

# 39. Unknown Provider Result

Jika request berhasil dikirim tetapi response tidak diketahui:

Jangan langsung retry blindly.

Gunakan state:

```text
UNKNOWN
```

atau equivalent.

System harus mencoba reconciliation sebelum melakukan publish ulang jika provider mendukungnya.

---

# 40. Timezone Rules

Database timestamps:

```text
UTC
```

Workspace menyimpan:

```text
IANA timezone
```

UI mengkonversi ke timezone workspace.

Jangan menyimpan ambiguous local datetime tanpa timezone context.

---

# 41. State Machine Rules

Entity yang memiliki status harus memiliki transition yang jelas.

Tidak boleh:

```text
Random status update
```

langsung dari UI.

Business logic harus memvalidasi transition.

Contoh:

```text
APPROVED

→

SCHEDULED
```

valid.

Namun:

```text
REJECTED

→

PUBLISHED
```

tidak valid.

---

# 42. Frontend Rules

Frontend tidak boleh menjadi source of truth untuk business state.

Frontend bertanggung jawab untuk:

```text
Display

User interaction

Optimistic UI
```

Backend/database tetap menjadi authoritative state.

---

# 43. Client-Side Security Rule

Tidak ada secret yang boleh berada di:

```text
React state

localStorage

sessionStorage

browser JavaScript bundle
```

---

# 44. Dependency Rules

Sebelum menambahkan dependency:

1. Check apakah existing dependency sudah dapat menyelesaikan masalah.
2. Check bundle impact.
3. Check maintenance status.
4. Check apakah dependency benar-benar diperlukan.

Jangan menambahkan library hanya untuk convenience kecil.

---

# 45. Dependency Approval

Untuk dependency besar atau architectural:

Coding agent harus menjelaskan:

```text
Why needed

Alternatives considered

Impact
```

Contoh:

```text
Queue framework

ORM

State management library

Large UI framework
```

---

# 46. Testing Rules

Setiap feature baru harus memiliki test sesuai levelnya.

Minimal:

```text
Unit test
```

Tambahkan integration test jika feature melibatkan:

```text
Database

Authentication

External provider adapter

Job concurrency
```

---

# 47. Do Not Fake Tests

Tidak boleh membuat test yang:

```text
Always passes

Mocks everything meaningless

Tests implementation detail only
```

Test harus memverifikasi behavior penting.

---

# 48. Regression Rule

Bug yang ditemukan harus:

1. Reproduce.
2. Add regression test jika practical.
3. Fix.
4. Verify fix.

Jangan hanya patch symptom.

---

# 49. Verification Commands

Setiap phase harus menjalankan command yang tersedia.

Expected categories:

```text
npm run lint

npm run typecheck

npm test

npm run build
```

Jika command tidak ada:

Coding agent harus menjelaskan.

Jangan mengklaim command berhasil jika tidak dijalankan.

---

# 50. No False Completion Claims

Coding agent tidak boleh mengatakan:

```text
Everything works
```

tanpa verification.

Gunakan:

```text
Verified

Not verified

Requires manual testing
```

secara jujur.

---

# 51. Manual Verification

Untuk feature yang membutuhkan external interaction:

Coding agent harus membedakan:

```text
Automated tests passed
```

dan:

```text
Live external provider test required
```

Contoh:

```text
Instagram OAuth

Actual publishing

Push notification
```

---

# 52. UI Rules

UI harus:

```text
Responsive

Accessible

Keyboard usable

Mobile friendly
```

Jangan hanya mengoptimalkan desktop.

Karena application dirancang sebagai:

```text
PWA
```

---

# 53. Accessibility Rules

Minimum:

```text
Semantic HTML

Keyboard navigation

Focus states

Accessible labels

Sufficient contrast
```

---

# 54. Mobile-First Consideration

Critical actions harus dapat dilakukan melalui mobile.

Contoh:

```text
Approve Content

Reject Content

Generate Caption

Schedule Post

View Publish Status
```

---

# 55. PWA Rules

PWA implementation tidak boleh mengganggu:

```text
Authentication

Caching correctness

Fresh data

Deployment updates
```

Service worker caching harus dirancang hati-hati.

---

# 56. File Organization Rules

Jangan membuat:

```text
utils.ts
helpers.ts
common.ts
misc.ts
```

sebagai dumping ground.

File harus memiliki purpose jelas.

Prefer domain-oriented organization.

---

# 57. Naming Rules

Names harus:

```text
Explicit

Predictable

Domain-oriented
```

Hindari:

```text
data

item

thing

temp

handler2
```

jika domain name yang lebih jelas tersedia.

---

# 58. Comment Rules

Comment digunakan untuk menjelaskan:

```text
Why
```

bukan:

```text
What obvious code does
```

Bad:

```typescript
// Increment count
count++
```

Good:

```typescript
// Retry attempts are incremented before scheduling so crash recovery
// cannot repeatedly execute the same attempt indefinitely.
```

---

# 59. TODO Rules

Tidak boleh meninggalkan:

```text
TODO
```

untuk core functionality tanpa mencatat limitation.

Jika feature belum selesai:

Nyatakan secara eksplisit dalam phase completion report.

---

# 60. Documentation Update Rule

Jika implementation mengubah:

```text
Architecture

Database schema

API contract

Phase scope
```

documentation terkait harus diperbarui.

Code dan docs tidak boleh diverge tanpa alasan.

---

# 61. Before Editing Existing Architecture

Sebelum mengubah architecture yang sudah ada:

Coding agent harus:

1. Inspect current implementation.
2. Identify why change is necessary.
3. Check impact.
4. Preserve backward compatibility jika memungkinkan.
5. Update documentation.

---

# 62. Refactoring Rule

Refactor diperbolehkan jika:

```text
Current phase requires it
```

atau:

```text
Existing bug prevents progress
```

Refactor tidak boleh menjadi alasan untuk memperluas scope.

---

# 63. Git Rules

Changes harus:

```text
Focused

Reviewable

Logically grouped
```

Jangan mencampur:

```text
Formatting entire repository

+

New feature

+

Database redesign
```

dalam satu perubahan besar tanpa alasan.

---

# 64. Before Starting Work

Coding agent harus melakukan:

```text
pwd

git status

git log -n 5

find relevant files
```

Kemudian membaca dokumentasi yang diperlukan.

Jangan langsung mulai mengedit file.

---

# 65. Before Finishing Work

Coding agent wajib:

1. Review changed files.
2. Check git diff.
3. Run verification commands.
4. Review test failures.
5. Check for accidental secrets.
6. Verify scope boundaries.
7. Write completion report.

---

# 66. Completion Report Format

Setiap phase harus ditutup dengan format:

```text
PHASE X COMPLETE

Implemented:
- ...

Files Added:
- ...

Files Modified:
- ...

Database Migrations:
- ...

Tests Added:
- ...

Verification:
- command
- result

Known Limitations:
- ...

Explicitly Not Implemented:
- ...
```

---

# 67. When To Stop And Ask

Coding agent harus berhenti dan meminta clarification jika:

```text
Architecture documents conflict

Requirement ambiguous

Security-sensitive decision unclear

Database change destructive

External provider behavior uncertain

Current task requires out-of-scope work
```

Jangan membuat asumsi besar secara diam-diam.

---

# 68. When Not To Ask

Coding agent tidak perlu meminta clarification untuk:

```text
Minor naming

Small implementation detail

Standard validation

Test structure

Obvious bug fix
```

Gunakan engineering judgement.

---

# 69. Decision Hierarchy

Jika terjadi konflik keputusan:

```text
Security
    ↓
Data Integrity
    ↓
Correctness
    ↓
Architecture
    ↓
Maintainability
    ↓
Performance
    ↓
Convenience
```

Convenience tidak boleh mengorbankan security atau correctness.

---

# 70. MVP Philosophy

MVP bukan berarti:

```text
Careless

Insecure

Untested
```

MVP berarti:

```text
Minimal Scope

Correct Core

Clear Boundaries
```

---

# 71. Final Engineering Principle

Setiap coding decision harus mendukung prinsip:

```text
Simple enough to understand

Strong enough to scale

Safe enough to automate
```

---

# 72. Absolute Prohibitions

Coding agent tidak boleh:

```text
Expose secrets

Bypass authorization

Disable RLS to make things work

Use TypeScript any to silence errors

Blindly retry publishing

Store critical state only in memory

Implement future phases without instruction

Claim verification without running it

Perform destructive database changes casually
```

---

# 73. Final Rule

Jika ada keraguan antara:

```text
Fast implementation
```

dan:

```text
Correct implementation
```

pilih:

```text
Correct implementation
```

Karena sistem ini akan melakukan:

```text
AI Operations

Background Automation

Scheduled Publishing

External Side Effects
```

Kesalahan kecil dapat berkembang menjadi automation failure.

---

# END OF CODING RULES
