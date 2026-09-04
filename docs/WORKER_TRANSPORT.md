# Worker transport: how the job worker runs as `job_worker`

Decision: **option A — the worker mints its own short-lived JWT with
`role: job_worker`**, signed with the project JWT secret, and hands it to
supabase-js as the bearer. PostgREST verifies the signature and `SET ROLE`s
into `job_worker`. The database, not application code, decides what the worker
may do.

This document records why, and the one question that had to be answered
empirically before it was safe.

## The problem

Nathan's Phase 7 review moved the worker off `service_role`: `claim_job`,
`complete_job`, `fail_job` are EXECUTE-able only by a dedicated role
`job_worker` that holds zero table grants. Verified against Postgres 17 with
Supabase's default privileges replicated — `authenticated` and `service_role`
both get `permission denied for function claim_job`.

But PostgREST only `SET ROLE`s to whatever the verified JWT's `role` claim
says, and Supabase only issues JWTs for `anon`, `authenticated`,
`service_role`. There is no off-the-shelf way to arrive as `job_worker`.

## Options considered

| | Cost | What enforces the boundary |
| --- | --- | --- |
| **A. Mint a `job_worker` JWT** | 1 env var (`SUPABASE_JWT_SECRET`), ~40 lines, `grant job_worker to authenticator` | Postgres grants |
| B. Grant the verbs to `service_role` | 3 lines | Application code — `service_role` has bypassrls and the whole database; a handler bug has everything |
| C. Direct Postgres connection as `job_worker` | New driver dependency, second connection path, pooling from serverless | Postgres grants |

A and C share the enforcement property. A reuses the client and the connection
path everything else already uses. C was kept in reserve for the day something
needs a transaction PostgREST cannot express.

## The question that needed evidence, not opinion

> Does `grant job_worker to authenticator` widen anything for `anon` or
> `authenticated` requests?

The intuition is "no, PostgREST picks the role from the verified claim, never
from the client." The intuition was **incomplete**, and the probe showed why.

`SET ROLE` checks membership against the **session** user, not the current
role. `authenticator` is the session user for every PostgREST request. So SQL
that PostgREST is already running as `anon` can, in principle, `SET ROLE` to
_anything authenticator is a member of_:

```
-- session_user = authenticator, current_user = anon
execute 'set role job_worker';     -- succeeds
```

Alarming — until the baseline, run on a database with **no** job_worker grant:

```
-- session_user = authenticator, current_user = anon
execute 'set role service_role';   -- succeeds, bypassrls = true
```

`anon` could already climb to `service_role`. This is the standing
PostgREST/Supabase model, not something the new grant introduces. The actual
wall is that **an attacker never gets to run `SET ROLE`**: PostgREST executes
only the SQL it constructs itself, and the only way to smuggle `SET ROLE` into
a request is a function body that already exists in the schema — which the
schema owner wrote, not the attacker.

Conclusion: `grant job_worker to authenticator` adds `job_worker` to a list
that already contains `service_role`. It widens nothing that is not already
wide. The evidence is `supabase/local/probe-authenticator.sql`.

What the grant _does_ depend on is the existing invariant that no function
body in this schema ever executes dynamic SQL or switches role.
`tests/migration-no-dynamic-sql.test.ts` enforces it across every migration:
no PL/pgSQL `EXECUTE` of a string, no `format(`, no `SET ROLE` — comments
stripped, trigger DDL excluded by shape. The gate's own discriminators are
tested so it cannot silently go blind.

## Design of the minted token

- **`role: "job_worker"`** — the only claim PostgREST reads for role switching.
- **`exp`: 5 minutes** — longer than `maxDuration` (60 s) by margin, short
  enough that a leaked token is worth little. A token that outlives the
  invocation is a token nobody is watching.
- **`iat`, `iss: "ai-content-worker"`** — so a token found in a log can be
  traced to its minting path.
- **HS256 via `node:crypto` HMAC** — Supabase's JWT secret is a shared secret;
  no new dependency. The verifier is PostgREST's, not ours, so `alg` confusion
  on _our_ side is not a risk; the token is never verified by this codebase.
- **The secret lives only in the worker's environment** —
  `SUPABASE_JWT_SECRET`, same trust tier as the service-role key, which is
  where the service-role key already lives. It is never in the browser bundle;
  `packages/shared/src/env/schema.ts` puts it in the server-only schema.

## What still holds

- `job_worker` holds **no table grants**. The token proves _which role_; the
  grants decide _what that role may do_ — three verbs.
- Handler code receives a client scoped to those three verbs. A bug in a
  handler cannot read `profiles`, cannot write `content`, cannot see another
  job's payload except through `claim_job`'s return.
- The trigger still requires the shared secret first. The JWT is minted only
  after the request is authenticated; it is never sent to the caller.
