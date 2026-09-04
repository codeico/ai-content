import { timingSafeEqual } from 'node:crypto';

/**
 * Authenticates a call to the job worker trigger.
 *
 * The trigger runs cross-tenant by design — it is the one surface here that
 * RLS does not govern — so whoever can call it can make the worker run. This
 * is the gate.
 *
 * Decisions:
 *
 *   Bearer secret, not a Supabase key. The service-role key would work and
 *   would be the wrong tool: leaking it is total compromise, leaking this is
 *   "the worker may run early", and rotation touches nothing else.
 *
 *   Constant-time comparison. A byte-by-byte `===` on secrets leaks their
 *   length and prefix through timing. `timingSafeEqual` requires equal-length
 *   buffers, so lengths are compared first — that comparison leaks only the
 *   length, which a 32+ character random secret does not care about.
 *
 *   One failure shape. Missing header, wrong scheme, wrong secret and
 *   unconfigured secret all return the same `unauthorized`. A caller must not
 *   be able to learn which of those it hit.
 *
 *   Unconfigured means closed. If JOB_WORKER_TRIGGER_SECRET is not set, every
 *   call is rejected. A missing secret must never mean "no auth".
 */
export type TriggerAuthResult = { ok: true } | { ok: false; reason: 'unauthorized' };

export function authenticateTrigger(
  authorizationHeader: string | null,
  configuredSecret: string | undefined,
): TriggerAuthResult {
  if (configuredSecret === undefined || configuredSecret.length === 0) {
    return { ok: false, reason: 'unauthorized' };
  }

  if (authorizationHeader === null) {
    return { ok: false, reason: 'unauthorized' };
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader.trim());

  if (match === null) {
    return { ok: false, reason: 'unauthorized' };
  }

  const presented = Buffer.from(match[1] as string, 'utf8');
  const expected = Buffer.from(configuredSecret, 'utf8');

  if (presented.length !== expected.length) {
    return { ok: false, reason: 'unauthorized' };
  }

  if (!timingSafeEqual(presented, expected)) {
    return { ok: false, reason: 'unauthorized' };
  }

  return { ok: true };
}
