# Phase 7 — Security Review (Nathan)

Design review of the `jobs` table, requested before any migration was written.
Six findings. I verified the claims I could check against the repository rather
than accepting them; verification notes are inline.

## HIGH — service role is the wrong default for the worker

**Finding.** Running the worker as service role removes the RLS backstop
exactly where handler code gets the least review. `jobs` would be the first
real consumer of the admin client.

**Verified.** `packages/database/src/client/admin.ts` exists, and grep across
`apps/web/src` and `packages` finds no application code calling it. The admin
client is currently unused by any live path — so `jobs` would indeed be the
first, and the claim is accurate rather than rhetorical.

**Proposal.** A dedicated `job_worker` Postgres role with `EXECUTE` on three
narrow `SECURITY DEFINER` functions — claim, complete, fail — and no table
grants at all. The worker cannot read or write `jobs` directly; it can only
call the three verbs the design permits.

## HIGH — no INSERT or UPDATE policies for users

**Finding.** A direct insert lets a client choose which handler runs. A direct
update lets a client forge `COMPLETED`, or clear the lock and cause double
execution.

**Assessment.** This is the strongest finding. It reframes the table: `jobs`
is not user-writable data with a policy on top, it is an execution surface.
Enqueue and cancel go through definer functions; a `RUNNING` job is cancelled
cooperatively via `cancel_requested` rather than by mutating its state under a
running worker.

## HIGH — `last_error_message` will eventually hold a secret

**Finding.** Handlers will talk to Meta and to an AI router. Provider errors
routinely echo request context — a token, an API key, a signed URL — and free
text written by a handler lands in a database column and then in a UI.

**Proposal.** A closed error-code enum for anything the UI renders, an
allowlisted mapping function, a length cap, a regex tripwire for
credential-shaped strings, and the raw column kept out of every tenant-readable
projection.

**Note.** This matches an existing guarantee rather than adding a new one: the
repository already has a gate that fails the build if an AI provider import
reaches a client component. Same class of leak, different path.

## MEDIUM — never grant SELECT on the raw table

**Finding.** A content-shaped policy — "members of the workspace may read" —
would expose `payload`, `result`, `locked_by` and `last_error_message` to every
member.

**Proposal.** A `security_invoker` view exposing only the columns a tenant
needs, with the raw table unreadable.

## MEDIUM — polymorphic `entity_type` / `entity_id` cannot be constrained

**Finding.** `jobs` cannot carry the protection `captions` has.

**Verified.** `captions` has
`foreign key (content_id, workspace_id) references content(id, workspace_id)`,
which makes attaching a caption to another workspace's content a database
error rather than a policy question. A polymorphic pair genuinely cannot express
that — the referenced table is not known at schema time.

**Proposal.** Either per-type FK columns, or mandatory workspace-scoped
re-resolution in every handler. The second is a discipline rather than a
guarantee, which argues for the first where the entity type is known.

## MEDIUM — cascade on workspace delete is wrong for execution

**Finding.** Cascade is right for stored rows but not for in-flight work: a
running `PUBLISH_POST` can act on behalf of a deleted tenant, because the
worker holds the job in memory after the row is gone.

**Verified.** Eight `on delete cascade` clauses exist across the migrations,
so cascade is the established convention here and would have been the default
choice without this finding.

**Proposal.** Two-phase deletion, plus `where locked_by = $2` no-op semantics
so a completing worker whose job has been removed writes nothing.

---

## My assessment

Findings 1, 2 and 5 change the design rather than adding hardening to it. The
shape I was about to write — a normal table with RLS policies and a service-role
worker — is wrong in a way that would have been expensive to unwind after real
jobs existed.

The reframing I accept: **`jobs` is an execution surface, not user data.**
Everything a user may do to a job is a verb, not a write.

Not yet resolved: how the claim function interacts with `SKIP LOCKED`, and
whether a definer function can express the stale-lease recovery without opening
a double-execution window. That is with Marcus.
