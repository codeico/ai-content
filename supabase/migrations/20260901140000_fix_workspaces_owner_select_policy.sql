-- Phase 2 — fix: owner cannot read their own just-created workspace via
-- INSERT ... RETURNING.
--
-- Root cause, confirmed empirically (scripts/verify-phase-2-rls.mjs and the
-- throwaway repros that preceded it): PostgREST's `.insert().select().single()`
-- compiles to a single `INSERT ... RETURNING`. When a table has RLS enabled,
-- Postgres checks the SELECT policy against each returned row as part of that
-- same statement. That check runs against the row as produced by the INSERT
-- itself — it does not wait for this table's `AFTER INSERT` trigger (which
-- creates the caller's `workspace_members` "owner" row) to finish, because
-- AFTER ROW triggers for a command fire once at the end of the query, after
-- row processing (including the RETURNING projection) has already happened
-- for every row. So at the moment the SELECT policy is evaluated for
-- RETURNING, `workspace_ids_for_current_user()` — which reads
-- `workspace_members` — legitimately still sees no row for the workspace
-- being created, and the request fails with "new row violates row-level
-- security policy for table \"workspaces\"" even though the same insert
-- without `RETURNING`, or a second separate request, both succeed.
--
-- A plain `insert` (as used for automated tests and admin backfills) or a
-- follow-up `select` in a new request are unaffected — see the two-request
-- flow this fix removes the need for.
--
-- Fix: add a second clause to the workspaces SELECT policy that checks
-- `owner_id = auth.uid()` directly on the row, with no dependency on
-- `workspace_members`. This is not a workaround bolted onto a race — it is a
-- strictly correct widening of an already-true invariant: the owner column
-- is on the `workspaces` row itself, so this check has no trigger-ordering
-- dependency at all, and it can never grant access the membership-based
-- clause was not already going to grant once the trigger settles. It also
-- makes owner access more robust: an owner's ability to read their own
-- workspace no longer depends on the owner-membership trigger having run
-- correctly, which is a strictly stronger guarantee than the original
-- membership-only policy provided.
alter policy "Members can read their workspaces"
  on public.workspaces
  using (
    owner_id = (select auth.uid())
    or id in (select public.workspace_ids_for_current_user())
  );
