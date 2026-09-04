import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  decodeWorkerTokenClaims,
  JOB_WORKER_ROLE,
  mintWorkerToken,
  WORKER_TOKEN_ISSUER,
  WORKER_TOKEN_TTL_S,
  WorkerTokenSecretError,
} from '../apps/web/src/server/jobs/worker-token.ts';

const SECRET = 'super-secret-jwt-signing-key-that-is-long-enough-0123456789';
const NOW = 1_800_000_000_000; // fixed clock, ms

/**
 * An independent HS256 verifier. Deliberately NOT the code under test: if the
 * minted token verifies here, it verifies under PostgREST, which implements
 * the same RFC 7515 algorithm. This is the interoperability proof.
 */
function verifyHs256(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  if (expected !== s) return null;
  const header = JSON.parse(Buffer.from(h, 'base64url').toString()) as Record<string, unknown>;
  if (header['alg'] !== 'HS256') return null;
  return JSON.parse(Buffer.from(p, 'base64url').toString()) as Record<string, unknown>;
}

describe('mintWorkerToken', () => {
  it('produces a three-part JWT that an independent HS256 verifier accepts', () => {
    const token = mintWorkerToken(SECRET, () => NOW);
    expect(token.split('.')).toHaveLength(3);
    expect(verifyHs256(token, SECRET)).not.toBeNull();
  });

  it('is rejected by the verifier under a different secret', () => {
    const token = mintWorkerToken(SECRET, () => NOW);
    expect(verifyHs256(token, SECRET + 'x')).toBeNull();
  });

  it('is rejected if a single payload byte is altered', () => {
    const token = mintWorkerToken(SECRET, () => NOW);
    const [h, p, s] = token.split('.') as [string, string, string];
    const tampered = Buffer.from(p, 'base64url').toString().replace('job_worker', 'service_ro');
    const forged = `${h}.${Buffer.from(tampered).toString('base64url')}.${s}`;
    expect(verifyHs256(forged, SECRET)).toBeNull();
  });

  it('claims role=job_worker and nothing that names another role', () => {
    const claims = decodeWorkerTokenClaims(mintWorkerToken(SECRET, () => NOW));
    expect(claims.role).toBe(JOB_WORKER_ROLE);
    expect(JOB_WORKER_ROLE).toBe('job_worker');
    expect(JSON.stringify(claims)).not.toMatch(/service_role|authenticated|anon/);
  });

  it('carries iat from the clock and exp exactly TTL later', () => {
    const claims = decodeWorkerTokenClaims(mintWorkerToken(SECRET, () => NOW));
    expect(claims.iat).toBe(Math.floor(NOW / 1_000));
    expect(claims.exp - claims.iat).toBe(WORKER_TOKEN_TTL_S);
  });

  it('carries the issuer so a leaked token is attributable', () => {
    const claims = decodeWorkerTokenClaims(mintWorkerToken(SECRET, () => NOW));
    expect(claims.iss).toBe(WORKER_TOKEN_ISSUER);
  });

  it('header is HS256 / JWT and nothing else', () => {
    const [h] = mintWorkerToken(SECRET, () => NOW).split('.') as [string];
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({
      alg: 'HS256',
      typ: 'JWT',
    });
  });

  it('refuses a secret shorter than 32 bytes', () => {
    expect(() => mintWorkerToken('short', () => NOW)).toThrow(WorkerTokenSecretError);
    expect(() => mintWorkerToken('a'.repeat(31), () => NOW)).toThrow(WorkerTokenSecretError);
    expect(() => mintWorkerToken('a'.repeat(32), () => NOW)).not.toThrow();
  });

  it('is deterministic for a fixed clock and secret', () => {
    expect(mintWorkerToken(SECRET, () => NOW)).toBe(mintWorkerToken(SECRET, () => NOW));
  });

  it('two mints one second apart differ, so tokens are not reusable across invocations', () => {
    expect(mintWorkerToken(SECRET, () => NOW)).not.toBe(mintWorkerToken(SECRET, () => NOW + 1_000));
  });
});

describe('the TTL is long enough for one invocation', () => {
  it('exceeds the route maxDuration', async () => {
    const { readFileSync } = await import('node:fs');
    const route = readFileSync('apps/web/src/app/api/jobs/run/route.ts', 'utf8');
    const maxDuration = Number(/export const maxDuration = (\d+);/.exec(route)?.[1]);
    expect(maxDuration).toBeGreaterThan(0);
    expect(WORKER_TOKEN_TTL_S).toBeGreaterThan(maxDuration);
  });
});
