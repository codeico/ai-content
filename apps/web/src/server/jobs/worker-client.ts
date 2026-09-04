import type { Database } from '@ai-content/database/client';
import { loadFutureProviderEnv, loadRuntimeEnv } from '@ai-content/shared/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { mintWorkerToken } from '@/server/jobs/worker-token';

/**
 * How the worker reaches the database as `job_worker`.
 *
 * Decision: option A — a self-minted JWT. Full reasoning and the empirical
 * answer to "does this widen anything" live in docs/WORKER_TRANSPORT.md. The
 * short version: the migration grants EXECUTE on claim/complete/fail to a
 * Postgres role called job_worker and to nobody else; PostgREST SET ROLEs into
 * whatever the verified JWT's `role` claim names, provided `authenticator` is
 * a member; so the worker signs its own `role: job_worker` token with the
 * project JWT secret and supabase-js presents it. The database, not this
 * code, decides what the worker may do.
 *
 * The `apikey` header still carries the anon key. PostgREST's Supabase
 * front-door (Kong) requires it to route the request; the anon key is public
 * and grants nothing here — the Authorization bearer is what sets the role.
 *
 * `accessToken` is supabase-js's hook for third-party auth: when set, the
 * client uses its return value as the bearer on every request instead of a
 * Supabase Auth session, and the `auth` namespace is disabled — which is
 * right, this client is a service, not a user. The hook is called per
 * request; minting is a single HMAC so no memoisation is needed, and a
 * fresh token per call means a long invocation never presents an expired one.
 *
 * Unconfigured secret → throw a stable error → the trigger returns 503 and
 * no job is claimed. A worker that cannot prove which role it runs as must
 * not run.
 */
export class WorkerClientNotConfiguredError extends Error {
  constructor() {
    super(
      'The job worker cannot mint a job_worker token: SUPABASE_JWT_SECRET is not set. ' +
        'See docs/WORKER_TRANSPORT.md.',
    );
    this.name = 'WorkerClientNotConfiguredError';
  }
}

export type WorkerClient = SupabaseClient<Database>;

export function createWorkerClient(): WorkerClient {
  const { SUPABASE_JWT_SECRET: jwtSecret } = loadFutureProviderEnv();

  if (jwtSecret === undefined) {
    throw new WorkerClientNotConfiguredError();
  }

  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey } =
    loadRuntimeEnv();

  return createClient<Database>(url, anonKey, {
    accessToken: async () => mintWorkerToken(jwtSecret),
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
