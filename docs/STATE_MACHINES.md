# State Machines

Four lifecycles, four owners. This document exists because one question kept
being ambiguous: **is `PUBLISHED` a content state or a publishing record
state?** The answer is a publishing record state, and the reasoning is below.

Every state names the entity that owns it, what may precede and follow it, and
which phase makes it reachable. A state no code can produce is not modelled —
it is a lie in the schema, and it makes the enum useless as a description of
what the system can actually do.

## Why four and not one

The owner's decision, accepted:

> `content.status` must represent the lifecycle of the content asset itself.
> Publishing state belongs to separate publishing entities.

The forcing cases are real, not hypothetical:

- one content item published more than once
- the same item published to several social accounts
- a failed attempt retried
- a history of attempts that must survive
- a successful publication that stays true regardless of what the content is
  doing now

None of those fit a single column on the content row. A content item can sit at
`ready` while it is scheduled, published to one account, retried, and published
again elsewhere — and `ready` remains the honest description of the asset.

---

## 1. Content lifecycle — owned by `content.status`

The readiness of the asset. Not where it has been published.

| State      | Previous              | Next                  | Phase                |
| ---------- | --------------------- | --------------------- | -------------------- |
| `draft`    | — (creation)          | `ready`, `archived`   | 3 — live             |
| `ready`    | `draft`               | `draft`, `archived`   | 3 — live             |
| `archived` | `draft`, `ready`      | `draft`, `ready`      | 3 — live             |

Three states, all reachable today by a user action.

`ready` is terminal in the sense that matters here: **it does not advance when
the item is scheduled or published.** That is the whole point of the
separation.

## 2. Media lifecycle — owned by `content.media_status`

Independent of content state, because acquisition runs asynchronously from
editorial review. An item can be `ready` with no media, or `draft` with media
already stored.

| State           | Previous                     | Next                      | Phase    |
| --------------- | ---------------------------- | ------------------------- | -------- |
| `external_only` | — (default)                  | `temporary`               | 6 — live |
| `temporary`     | `external_only`              | `available`, `external_only` | 8 — live |
| `available`     | `temporary`                  | `external_only`           | 6 — live |
| `missing`       | — (reserved, unreachable)    | —                         | 6 — live |

**Who may write it.** Nobody through the table. Phase 8 removed
`media_status`, `storage_provider` and `storage_key` from every client role's
INSERT/UPDATE grant (`anon`, `authenticated`, `service_role`). The only writers
are three `SECURITY DEFINER` verbs, each of which proves something before it
moves the row:

- `reserve_content_media(ws, content, ext)` — `external_only → temporary`.
  Generates the object key server-side (`<ws>/<content>/<uuid>.<ext>`); a
  browser never chooses a path. Idempotent for the same extension; refuses a
  different extension on an existing reservation.
- `confirm_content_media(ws, content, key)` — `temporary → available`, only
  if `storage.objects` already holds that exact key in the private
  `content-media` bucket. Idempotent once confirmed.
- `release_content_media(ws, content)` — `temporary|available → external_only`,
  only after the object is gone from the catalogue. Idempotent.

`missing` stays in the CHECK for forward compatibility but no verb produces it
yet; a later acquisition phase that detects a vanished object will own that
transition. The old owner-facing "Media" selector was removed: the form has no
`media_status` input and the Server Action never reads one.

Still enforced by `content_available_requires_storage`: `available` requires
`storage_key`. Additionally, `content_storage_before_delete` (BEFORE DELETE,
`content_reject_stored_delete()`) refuses to delete a row whose `storage_key`
is set — bytes are removed via the Storage API and released first, so a
deletion can never orphan an object.

Deferred: `PROCESSING`, `DELETED` — each needs a job phase to reach it.

## 3. Job lifecycle — owned by `jobs.status`

Durable execution. Introduced by Phase 7.

Design decisions and their reasoning live in `docs/PHASE_7_PLAN.md`; this table
records only the ownership question.

## 4. Publishing lifecycle — owned by three entities, not one

This is where the ambiguity was. Publishing is not one state but three
questions, each with its own row:

**`scheduled_posts` — intent.** "This content should go to that account at that
time." One content item may have many, to different accounts or at different
times.

**`publish_attempts` — each individual try.** The spec already gives it
`attempt_number`, `status`, `error_code`, `external_reference_id`. A retry is a
new row, not a mutated one, so the history of what was tried survives.

**`published_posts` — the durable result.** `external_post_id`, `permalink`,
`published_at`. A successful publication is a fact that stays true regardless of
what the content asset does afterwards.

So the answer to the question at the top: **`PUBLISHED` is a `published_posts`
row existing.** It is not a value of `content.status`, and it never should be —
the moment it is, "has this been published?" becomes unanswerable for an item
published twice.

---

## The specification conflict, resolved

`DATABASE_SCHEMA` §12 lists fifteen content states including `SCHEDULED`,
`PUBLISHING`, `PUBLISHED` and `PUBLISH_FAILED`. Under the decision above, those
four do not belong to `content` at all.

Classification of all fifteen:

| Documented state   | Actual owner              | Verdict                             |
| ------------------ | ------------------------- | ----------------------------------- |
| `DISCOVERED`       | content                   | future — needs discovery            |
| `VALIDATING`       | job                       | job state, not content              |
| `ANALYZING`        | job                       | job state, not content              |
| `SCORING`          | job                       | job state, not content              |
| `READY_FOR_REVIEW` | content                   | `ready` today                       |
| `APPROVED`         | content                   | future — needs a review step        |
| `SCHEDULED`        | `scheduled_posts`         | **not a content state**             |
| `PUBLISHING`       | `publish_attempts`        | **not a content state**             |
| `PUBLISHED`        | `published_posts`         | **not a content state**             |
| `REJECTED`         | content                   | future — needs a review step        |
| `FAILED`           | job or `publish_attempts` | ambiguous as a content state        |
| `DUPLICATE`        | content                   | future — needs embeddings           |
| `REQUIRES_REVIEW`  | content                   | future — needs rights checking      |
| `ARCHIVED`         | content                   | `archived` today                    |
| `PUBLISH_FAILED`   | `publish_attempts`        | **not a content state**             |

Five of the fifteen were never content states. Three are job states. `FAILED` is
ambiguous and is resolved by asking *what* failed — the job, or the attempt.

§12 has been updated to record this rather than leaving the contradiction in
place.
