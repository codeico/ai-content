import { describe, expect, it } from 'vitest';

import { authenticateTrigger } from '../apps/web/src/server/jobs/trigger-auth.ts';

const SECRET = 'a'.repeat(32) + 'correct-horse-battery';

describe('authenticateTrigger: unconfigured means closed', () => {
  it('rejects every call when no secret is configured', () => {
    expect(authenticateTrigger(`Bearer ${SECRET}`, undefined)).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
    expect(authenticateTrigger(`Bearer ${SECRET}`, '')).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
  });
});

describe('authenticateTrigger: one failure shape for every miss', () => {
  const misses: Array<[string, string | null]> = [
    ['missing header', null],
    ['empty header', ''],
    ['wrong scheme', `Basic ${SECRET}`],
    ['no scheme', SECRET],
    ['wrong secret same length', `Bearer ${'b'.repeat(SECRET.length)}`],
    ['wrong secret shorter', 'Bearer short'],
    ['wrong secret longer', `Bearer ${SECRET}x`],
    ['secret with trailing garbage', `Bearer ${SECRET} extra`],
    ['prefix of the secret', `Bearer ${SECRET.slice(0, -1)}`],
  ];

  it.each(misses)('%s → unauthorized, indistinguishable from any other miss', (_label, header) => {
    expect(authenticateTrigger(header, SECRET)).toEqual({ ok: false, reason: 'unauthorized' });
  });

  it('exposes no other reason value anywhere in the result type', () => {
    // A second reason would be a second thing an attacker could learn.
    const results = misses.map(([, h]) => authenticateTrigger(h, SECRET));
    const reasons = new Set(results.map((r) => (r.ok ? 'ok' : r.reason)));
    expect(reasons).toEqual(new Set(['unauthorized']));
  });
});

describe('authenticateTrigger: accepts exactly the configured secret', () => {
  it('accepts a correct bearer token', () => {
    expect(authenticateTrigger(`Bearer ${SECRET}`, SECRET)).toEqual({ ok: true });
  });

  it('is case-insensitive on the scheme, not on the secret', () => {
    expect(authenticateTrigger(`bearer ${SECRET}`, SECRET)).toEqual({ ok: true });
    expect(authenticateTrigger(`Bearer ${SECRET.toUpperCase()}`, SECRET).ok).toBe(false);
  });

  it('tolerates surrounding whitespace on the header, not inside the token', () => {
    expect(authenticateTrigger(`  Bearer ${SECRET}  `, SECRET)).toEqual({ ok: true });
  });
});

describe('authenticateTrigger: constant-time by construction', () => {
  it('uses timingSafeEqual, not ===, for the secret comparison', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('apps/web/src/server/jobs/trigger-auth.ts', 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).toMatch(/timingSafeEqual\(presented, expected\)/);
    // The only === allowed is on the length guard and the undefined check;
    // never on the secret bytes themselves.
    expect(code).not.toMatch(/presented\s*===|===\s*presented|configuredSecret\s*===\s*match/);
  });
});
