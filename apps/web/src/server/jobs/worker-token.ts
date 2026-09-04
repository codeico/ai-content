import { createHmac } from 'node:crypto';

/**
 * Mints the JWT the worker presents to PostgREST to run as `job_worker`.
 *
 * Supabase issues tokens for anon/authenticated/service_role only. PostgREST,
 * however, will SET ROLE to whatever the verified `role` claim says, provided
 * `authenticator` is a member of that role (the migration grants it). So the
 * worker signs its own token with the project JWT secret — the same shared
 * secret Supabase uses — and PostgREST cannot tell the difference. That is
 * the point: the database, not this code, decides what job_worker may do.
 *
 * Why HS256 by hand rather than a library: the Supabase JWT secret is a
 * symmetric secret and HS256 is 15 lines of node:crypto. A JWT library here
 * would be a dependency whose only job is to be a place for `alg: none` to
 * hide. This code never VERIFIES a token — PostgREST does — so there is no
 * verifier here to confuse.
 *
 * Why short-lived: a token that outlives the invocation is a token nobody is
 * watching. Five minutes exceeds maxDuration with margin and expires before
 * a leaked one is useful for long.
 */

export const JOB_WORKER_ROLE = 'job_worker';

/** Seconds. Must exceed the route's maxDuration; tests/jobs-lease.test.ts asserts it. */
export const WORKER_TOKEN_TTL_S = 300;

/** Traceability: a token found in a log can be attributed to this minting path. */
export const WORKER_TOKEN_ISSUER = 'ai-content-worker';

export class WorkerTokenSecretError extends Error {
  constructor() {
    super('SUPABASE_JWT_SECRET must be at least 32 bytes; refusing to mint a weak worker token.');
    this.name = 'WorkerTokenSecretError';
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export interface WorkerTokenClaims {
  role: typeof JOB_WORKER_ROLE;
  iss: typeof WORKER_TOKEN_ISSUER;
  iat: number;
  exp: number;
}

/**
 * Sign a `job_worker` token.
 *
 * @param secret the project JWT secret (SUPABASE_JWT_SECRET).
 * @param now    injectable clock for tests; defaults to Date.now().
 */
export function mintWorkerToken(secret: string, now: () => number = Date.now): string {
  // Supabase's secret is >= 32 bytes; anything shorter here is a misconfig,
  // and HS256 with a short key is exactly the token an attacker brute-forces.
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new WorkerTokenSecretError();
  }

  const iat = Math.floor(now() / 1_000);
  const claims: WorkerTokenClaims = {
    role: JOB_WORKER_ROLE,
    iss: WORKER_TOKEN_ISSUER,
    iat,
    exp: iat + WORKER_TOKEN_TTL_S,
  };

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');

  return `${signingInput}.${signature}`;
}

/**
 * Decode (without verifying) for tests and diagnostics. Never use this to
 * trust a token; PostgREST is the verifier.
 */
export function decodeWorkerTokenClaims(token: string): WorkerTokenClaims {
  const [, payload] = token.split('.');

  if (payload === undefined) {
    throw new Error('not a JWT');
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as WorkerTokenClaims;
}
