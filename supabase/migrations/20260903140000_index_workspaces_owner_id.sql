-- Index workspaces.owner_id.
--
-- Every owner-write RLS policy on workspace_profiles resolves
-- `workspace_id in (select id from public.workspaces where owner_id = auth.uid())`,
-- and RLS evaluates that per row access, not once per request. Postgres does
-- not index a foreign key automatically, so the lookup was a sequential scan
-- (verified with EXPLAIN against the linked project).
--
-- At two workspaces this costs 0.018ms and the index is not needed yet. It is
-- added now because the cost is a single small btree, the access pattern is
-- fixed by the policies rather than by a query someone might rewrite, and the
-- same column backs `workspaces_owner_id_fkey` (on delete restrict), whose
-- check also scans the child side.
--
-- Additive only: no policy, column, or row is touched.

create index if not exists workspaces_owner_id_idx on public.workspaces (owner_id);

comment on index public.workspaces_owner_id_idx is
  'Supports owner-scoped RLS subqueries and the owner_id foreign key check.';
