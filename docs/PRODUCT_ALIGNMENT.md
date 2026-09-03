# Product & Architecture Alignment

Written after the owner restated the product vision. This is an assessment, not
a plan of work: it records what the repository actually contains, where it
disagrees with the specification, and which dependency actually gates the next
phase.

Everything below was verified against migrations and source. Where I could not
verify something, it says so.

## 1. What this product is

A multi-workspace content automation engine. Each workspace is an independent
content operation — its own niche, its own connected Instagram account, its own
schedule. The system discovers short-form video, acquires and stores the media,
generates captions and metadata through a configurable AI router, schedules the
result, and publishes it as a Reel.

The application is a **control plane over an automated pipeline**, not a CRUD
tool with AI attached. That distinction decides most design questions: the user
should see what was discovered, what is processing, what is ready, what is
scheduled, what published, what failed and why.

## 2. What exists today

Six tables, all with `workspace_id` denormalised for a direct RLS predicate:

`profiles`, `workspaces`, `workspace_members`, `workspace_profiles`, `content`,
`captions`.

`content` already carries the media foundation the pipeline needs:
`source_type`, `source_url`, `external_id`, `storage_provider`, `storage_key`,
`media_status`, plus a CHECK that `media_status = 'available'` requires
`storage_key` — so "stored" cannot be claimed without a stored object.

`captions` are versioned, have immutable provenance columns, and exactly one
active version per content item enforced by a partial unique index.

The AI layer is an `AIProvider` interface with an OpenAI-compatible adapter. No
vendor is named in application code and no model is hardcoded.

## 3. What does not exist

`social_accounts`, `jobs`, `posting_schedules`, `scheduled_posts`,
`published_posts`, `publish_attempts`, `content_analysis`, `embeddings`,
`audit_logs`, `notifications`, `push_subscriptions`, and any table holding
discovery configuration.

That is eleven of the seventeen tables the schema describes. The product is
roughly a third built, and the built third is the identity and content
foundation rather than the automation.

## 4. The conflict I found

**`DATABASE_SCHEMA` §12 defines a fifteen-state content state machine. The
shipped `content.status` has three: `draft`, `ready`, `archived`.**

This matters because every other deviation in this schema is annotated. §14
records exactly why `media_status` ships three of six values. §17 records why
four caption columns are deferred. §2 and §11 carry implemented-subset notes.

§12 carries nothing. So a reader cannot tell whether three states is a
deliberate subset or an oversight, and the next person to touch it will either
implement twelve unreachable states or assume the spec was abandoned.

My reading is that three states is **correct for today** — nothing can move a
row into `ANALYZING` or `PUBLISHING` because neither the job system nor the
publisher exists, and a status value no code can produce is a lie in the
schema. But that reasoning is not written down anywhere, which is the same
one-directional documentation gap that let the README call the PWA "planned"
after it shipped.

**Open question I have not resolved:** whether `SCHEDULED` and `PUBLISHED`
belong in `content.status` at all, or in a `scheduled_posts` / `published_posts`
row that references the content. The spec puts them in the status enum. But a
single content item can be republished after a failure, and could in principle
publish to more than one account over time — and both cases are awkward if
publish state lives in a single column on the content row. This is with Marcus.
It should be settled before the scheduling phase, not after there is production
data.

## 5. Dependency order

The vision states the chain, and the research in `INSTAGRAM_FEASIBILITY.md`
hardens one link of it:

```
object storage  →  public media URL  →  Instagram publishing
```

Meta fetches media from a URL rather than accepting an upload. So object storage
is not an optional convenience for publishing — it is a prerequisite. Building
the Instagram connection first produces a button that authorises an account the
system cannot send anything to.

Two things gate almost everything else:

**Object storage** gates media acquisition, publishing, and any AI work that
needs the media itself rather than its metadata.

**A job system** gates discovery, media acquisition, scheduling and publishing,
because all four are long-running work that must survive a failed request. The
architecture doc is explicit that Postgres is the source of truth and the queue
is only transport.

Neither depends on AI credentials, which the deployment still does not have.

## 6. What I am NOT proposing

`content_analysis` scoring. It has been declined twice on the same grounds: the
score has no consumer. There is no candidate queue for it to rank. It also
cannot be honestly verified without a real model — it would produce confident
numbers nobody can check.

Instagram connection before storage, for the reason in section 5.

Placeholder screens for Discovery, Automation or Publishing history. An empty
page that claims a capability is worse than an absent one.

## 7. Does the current architecture support the end state?

For the parts that exist, yes, and specifically:

- Workspace isolation is enforced at the database rather than in application
  code, so a missed filter in a future automation path fails closed.
- `storage_provider` / `storage_key` are a provider-agnostic pair, so R2 is a
  configuration choice rather than a schema commitment.
- The AI layer can be repointed without touching domain code.
- Media lifecycle is already independent of editorial state, which is what lets
  acquisition run asynchronously from review.

The risk I want checked before building further is the state-machine question in
section 4 — because it is the one decision here that is expensive to reverse
once real content is flowing.
