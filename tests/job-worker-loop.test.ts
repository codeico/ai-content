import { describe, expect, it, vi } from 'vitest';

import type { Job } from '../apps/web/src/server/jobs/handler.ts';
import { runWorker } from '../apps/web/src/server/jobs/worker.ts';

/**
 * The worker loop against a scripted rpc() stub. This proves the LOOP: how it
 * translates outcomes into complete_job / fail_job calls, how it counts a
 * fenced write, when it stops. It does not prove the database — that is
 * supabase/local/prove-jobs.sh against real Postgres, because claim safety,
 * stale reclaim and fencing are Postgres properties and a stub can only
 * assert what it was told to say.
 */
function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    workspace_id: 'ws-1',
    type: 'proof',
    status: 'running',
    payload: { mode: 'ok' },
    result: null,
    attempt_count: 1,
    max_attempts: 3,
    scheduled_for: '2026-09-04T00:00:00Z',
    locked_at: '2026-09-04T00:00:00Z',
    locked_by: 'tok',
    dedup_key: null,
    last_error_code: null,
    cancel_requested: false,
    created_at: '2026-09-04T00:00:00Z',
    updated_at: '2026-09-04T00:00:00Z',
    ...overrides,
  };
}

/** claim_job returns an all-null row when nothing was claimed. */
const NOTHING = { id: null };

interface Script {
  claims: Array<Job | typeof NOTHING>;
  completeReturns?: boolean;
  failReturns?: string | null;
}

function scripted(script: Script) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  let claimIndex = 0;

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });

    if (fn === 'claim_job') {
      const next = script.claims[claimIndex] ?? NOTHING;
      claimIndex += 1;
      return { data: next, error: null };
    }

    if (fn === 'complete_job') {
      return { data: script.completeReturns ?? true, error: null };
    }

    if (fn === 'fail_job') {
      return {
        data: script.failReturns === undefined ? 'pending' : script.failReturns,
        error: null,
      };
    }

    throw new Error(`unexpected rpc ${fn}`);
  });

  return { client: { rpc } as never, calls };
}

const FAR_FUTURE = Date.now() + 60_000;

describe('runWorker translates outcomes into fenced verbs', () => {
  it('completes an ok proof job with the result and the invocation token', async () => {
    const { client, calls } = scripted({ claims: [job()] });

    const report = await runWorker(client, { workerToken: 'inv-A', deadline: FAR_FUTURE });

    expect(report).toEqual({
      claimed: 1,
      completed: 1,
      failed: 0,
      fenced: 0,
      stoppedBecause: 'no_work',
    });

    const complete = calls.find((c) => c.fn === 'complete_job');
    expect(complete?.args).toMatchObject({ job_id: 'job-1', worker_token: 'inv-A' });
    expect(complete?.args.job_result).toEqual({ mode: 'ok', echo: null, attempt: 1 });
  });

  it('fails a fail-mode proof job as retryable with the closed code', async () => {
    const { client, calls } = scripted({ claims: [job({ payload: { mode: 'fail' } })] });

    const report = await runWorker(client, { workerToken: 'inv-A', deadline: FAR_FUTURE });

    expect(report.failed).toBe(1);
    const fail = calls.find((c) => c.fn === 'fail_job');
    expect(fail?.args).toEqual({
      job_id: 'job-1',
      worker_token: 'inv-A',
      error_code: 'proof_failed',
      retryable: true,
    });
  });

  it('fails fail_final as NOT retryable', async () => {
    const { client, calls } = scripted({ claims: [job({ payload: { mode: 'fail_final' } })] });

    await runWorker(client, { workerToken: 'inv-A', deadline: FAR_FUTURE });

    expect(calls.find((c) => c.fn === 'fail_job')?.args.retryable).toBe(false);
  });

  it('fail_until fails below the target attempt and completes at it', async () => {
    const below = scripted({
      claims: [job({ payload: { mode: 'fail_until', attempt: 3 }, attempt_count: 2 })],
    });
    await runWorker(below.client, { workerToken: 'a', deadline: FAR_FUTURE });
    expect(below.calls.some((c) => c.fn === 'fail_job')).toBe(true);

    const at = scripted({
      claims: [job({ payload: { mode: 'fail_until', attempt: 3 }, attempt_count: 3 })],
    });
    await runWorker(at.client, { workerToken: 'a', deadline: FAR_FUTURE });
    const complete = at.calls.find((c) => c.fn === 'complete_job');
    expect(complete?.args.job_result).toEqual({ mode: 'fail_until', succeededOnAttempt: 3 });
  });
});

describe('runWorker never writes a message, only a closed code', () => {
  it('maps a malformed payload to bad_payload, not retryable', async () => {
    const { client, calls } = scripted({ claims: [job({ payload: { mode: 'nonsense' } })] });

    await runWorker(client, { workerToken: 'a', deadline: FAR_FUTURE });

    expect(calls.find((c) => c.fn === 'fail_job')?.args).toMatchObject({
      error_code: 'bad_payload',
      retryable: false,
    });
  });

  it('maps an unregistered type to unknown_type, not retryable', async () => {
    const { client, calls } = scripted({ claims: [job({ type: 'publish_post' })] });

    await runWorker(client, { workerToken: 'a', deadline: FAR_FUTURE });

    expect(calls.find((c) => c.fn === 'fail_job')?.args).toMatchObject({
      error_code: 'unknown_type',
      retryable: false,
    });
  });

  it('a cancel_requested job is failed as cancelled without running', async () => {
    const { client, calls } = scripted({ claims: [job({ cancel_requested: true })] });

    await runWorker(client, { workerToken: 'a', deadline: FAR_FUTURE });

    expect(calls.find((c) => c.fn === 'fail_job')?.args).toMatchObject({
      error_code: 'cancelled',
      retryable: false,
    });
  });

  it('never passes any argument named like a message to the database', async () => {
    const { client, calls } = scripted({
      claims: [job({ payload: { mode: 'fail' } }), job({ id: 'job-2', type: 'nope' })],
    });

    await runWorker(client, { workerToken: 'a', deadline: FAR_FUTURE });

    for (const call of calls) {
      expect(Object.keys(call.args)).not.toContain('error_message');
      expect(Object.keys(call.args)).not.toContain('last_error_message');
      expect(Object.keys(call.args)).not.toContain('message');
    }
  });
});

describe('runWorker counts a lost lease as fenced, not as failure', () => {
  it('complete_job returning false increments fenced and nothing else', async () => {
    const { client } = scripted({ claims: [job()], completeReturns: false });

    const report = await runWorker(client, { workerToken: 'zombie', deadline: FAR_FUTURE });

    expect(report).toMatchObject({ claimed: 1, completed: 0, failed: 0, fenced: 1 });
  });

  it('fail_job returning null increments fenced and nothing else', async () => {
    const { client } = scripted({
      claims: [job({ payload: { mode: 'fail' } })],
      failReturns: null,
    });

    const report = await runWorker(client, { workerToken: 'zombie', deadline: FAR_FUTURE });

    expect(report).toMatchObject({ claimed: 1, completed: 0, failed: 0, fenced: 1 });
  });
});

describe('runWorker stops for the right reason', () => {
  it('stops with no_work when claim_job returns the all-null row', async () => {
    const { client, calls } = scripted({ claims: [] });

    const report = await runWorker(client, { workerToken: 'a', deadline: FAR_FUTURE });

    expect(report.stoppedBecause).toBe('no_work');
    expect(calls).toHaveLength(1);
  });

  it('stops with max_jobs before claiming a job it will not process', async () => {
    const { client, calls } = scripted({
      claims: [job(), job({ id: 'job-2' }), job({ id: 'job-3' })],
    });

    const report = await runWorker(client, { workerToken: 'a', deadline: FAR_FUTURE, maxJobs: 2 });

    expect(report).toMatchObject({ claimed: 2, stoppedBecause: 'max_jobs' });
    expect(calls.filter((c) => c.fn === 'claim_job')).toHaveLength(2);
  });

  it('does not claim when less than the headroom remains before the deadline', async () => {
    const { client, calls } = scripted({ claims: [job()] });
    let t = 1_000_000;
    const now = () => t;

    // Deadline 1s away: under the 2s headroom, so no claim at all.
    const report = await runWorker(client, { workerToken: 'a', deadline: t + 1_000, now });

    expect(report).toMatchObject({ claimed: 0, stoppedBecause: 'deadline' });
    expect(calls).toHaveLength(0);
    t += 1; // silence unused-mutation lint without changing behaviour
  });

  it('processes what it claimed even if the deadline passes mid-job, then stops', async () => {
    const { client, calls } = scripted({ claims: [job(), job({ id: 'job-2' })] });
    let t = 1_000_000;
    const now = () => t;
    const deadline = t + 10_000;

    // First claim is allowed; advance time past the deadline as a side effect
    // of the first rpc so the second iteration must stop.
    const rpc = (client as { rpc: ReturnType<typeof vi.fn> }).rpc;
    const original = rpc.getMockImplementation() as (...a: unknown[]) => Promise<unknown>;
    rpc.mockImplementation(async (...args: unknown[]) => {
      const out = await original(...args);
      t = deadline + 1;
      return out;
    });

    const report = await runWorker(client, { workerToken: 'a', deadline, now });

    expect(report).toMatchObject({ claimed: 1, completed: 1, stoppedBecause: 'deadline' });
    // Claimed once, settled once — no second claim after the deadline.
    expect(calls.filter((c) => c.fn === 'claim_job')).toHaveLength(1);
    expect(calls.filter((c) => c.fn === 'complete_job')).toHaveLength(1);
  });
});

describe('runWorker uses one token for the whole invocation', () => {
  it('every verb in an invocation carries the same worker_token', async () => {
    const { client, calls } = scripted({
      claims: [job(), job({ id: 'job-2', payload: { mode: 'fail' } })],
    });

    await runWorker(client, { workerToken: 'inv-42', deadline: FAR_FUTURE });

    const tokens = new Set(calls.map((c) => c.args.worker_token));
    expect(tokens).toEqual(new Set(['inv-42']));
    expect(calls.length).toBeGreaterThanOrEqual(4); // 2 claims + 2 settles + final empty claim
  });
});
