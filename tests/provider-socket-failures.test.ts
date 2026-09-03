import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AIError,
  OpenAICompatibleProvider,
  isBodyTransportFailure,
} from '../packages/ai/src/index.ts';

/**
 * Failure modes a mocked fetch cannot produce, driven at a real socket.
 *
 * The bug this was written for: `fetch` resolves when HEADERS arrive, not when
 * the body does. Clearing the abort timer at that point left `response.json()`
 * reading an open socket with no deadline, so a server that sent headers and
 * then stalled hung the caller indefinitely — observed still running at 20s
 * against a 1.5s timeout. That is a realistic load balancer failure, and in a
 * Server Action it pins the request until the platform kills it.
 */
let server: http.Server;
let base: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const route = req.url!.split('/').filter(Boolean)[0];

    if (route === 'headers-then-hang') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{"choices":[{"message":{"content":"');
      return; // body never completes
    }
    if (route === 'truncated') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{"choices":[{"message":{"content":"hal');
      // The delay matters: without it the socket dies before `fetch` settles
      // and the failure never reaches the body read this test is about.
      setTimeout(() => res.destroy(), 150);
      return;
    }
    if (route === 'not-json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('<html>gateway</html>');
      return;
    }
    if (route === 'ok') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'm', choices: [{ message: { content: 'hi' } }] }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function provider(route: string, timeoutMs = 600) {
  return new OpenAICompatibleProvider({
    baseUrl: `${base}/${route}`,
    apiKey: 'test-key',
    timeoutMs,
    maxRetries: 0,
  });
}

const REQUEST = { model: 'test', messages: [{ role: 'user' as const, content: 'hi' }] };

describe('the timeout covers the body, not just the connection', () => {
  it('aborts a response whose body never completes', async () => {
    const started = Date.now();

    const error = await provider('headers-then-hang')
      .chat(REQUEST)
      .catch((e) => e);

    expect(error).toBeInstanceOf(AIError);
    expect(error.code).toBe('timeout');
    // The regression is unboundedness: assert it finished near the budget.
    expect(Date.now() - started).toBeLessThan(3_000);
  }, 10_000);

  it('still returns a normal response well inside the budget', async () => {
    const result = await provider('ok').chat(REQUEST);

    expect(result.text).toBe('hi');
  });
});

describe('a body that dies mid-stream is a transport failure', () => {
  it('reports a truncated body as network, not malformed_response', async () => {
    // Retryable: the endpoint never finished saying what it meant. A genuine
    // syntax error is a different thing and must not be retried.
    const error = await provider('truncated')
      .chat(REQUEST)
      .catch((e) => e);

    expect(error).toBeInstanceOf(AIError);
    expect(error.code).toBe('network');
  });

  it('still reports a complete non-JSON body as malformed_response', async () => {
    const error = await provider('not-json')
      .chat(REQUEST)
      .catch((e) => e);

    expect(error).toBeInstanceOf(AIError);
    expect(error.code).toBe('malformed_response');
  });

  it('classifies a JSON syntax error as not-transport', () => {
    expect(isBodyTransportFailure(new SyntaxError('Unexpected token <'))).toBe(false);
  });

  it('classifies a socket failure as transport', () => {
    const err = new TypeError('terminated');
    (err as { cause?: unknown }).cause = { code: 'UND_ERR_SOCKET' };

    expect(isBodyTransportFailure(err)).toBe(true);
  });
});

describe('no error carries the endpoint or the key', () => {
  it.each(['headers-then-hang', 'truncated', 'not-json'])('%s', async (route) => {
    const error = await provider(route)
      .chat(REQUEST)
      .catch((e) => e);

    const serialized = `${error.message} ${JSON.stringify(error.cause ?? null)}`;
    expect(serialized).not.toContain('test-key');
    expect(serialized).not.toContain('127.0.0.1');
  });
});
