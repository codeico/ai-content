import type { Database } from '@ai-content/database/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * How the worker reaches the database as `job_worker`.
 *
 * This is the one open decision in Phase 7 and it is deliberately isolated
 * here so nothing else has to wait on it. The migration grants EXECUTE on
 * claim_job / complete_job / fail_job to a Postgres role called job_worker and
 * to nobody else. PostgREST, which supabase-js talks to, only switches into a
 * role named by the JWT's `role` claim — so there is no off-the-shelf
 * supabase-js path to run as job_worker.
 *
 * The candidates, each honest about its cost:
 *
 *   A. Mint a JWT with role=job_worker signed by the project's JWT secret and
 *      hand it to supabase-js as the bearer. Requires the JWT secret in the
 *      worker env and `grant job_worker to authenticator`. Preserves the
 *      least-privilege boundary exactly. Minting JWTs is a place people get
 *      wrong (alg none, no exp, leaked secret).
 *
 *   B. Grant the three verbs to service_role and use the existing admin
 *      client. Simplest. Also exactly what the security review called wrong:
 *      service_role has bypassrls and full table access, so a handler bug has
 *      the whole database instead of three verbs.
 *
 *   C. Direct Postgres connection as a login-enabled job_worker through the
 *      pooler. New dependency, second connection path.
 *
 * Until that is decided this throws. The trigger endpoint therefore returns
 * 503 with a stable code, and no job is claimed. That is the correct failure:
 * a worker that cannot prove which role it runs as must not run.
 */
export class WorkerClientNotConfiguredError extends Error {
  constructor() {
    super(
      'The job worker has no configured transport to the database. ' +
        'See apps/web/src/server/jobs/worker-client.ts for the open decision.',
    );
    this.name = 'WorkerClientNotConfiguredError';
  }
}

export type WorkerClient = SupabaseClient<Database>;

export function createWorkerClient(): WorkerClient {
  throw new WorkerClientNotConfiguredError();
}
