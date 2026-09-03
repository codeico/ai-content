import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AIError,
  createAIProvider,
  normalizeBaseUrl,
  OpenAICompatibleProvider,
} from '../packages/ai/src/index.ts';

const API_KEY = 'sk-test-SECRET-key-123';
const BASE_URL = 'https://router.example/v1';

const REQUEST = {
  model: 'test-model',
  messages: [
    { role: 'system' as const, content: 'Be brief.' },
    { role: 'user' as const, content: 'Hi' },
  ],
};

const OK_BODY = {
  id: 'x',
  model: 'test-model-2026',
  choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function provider(
  fetchImpl: typeof fetch,
  extra: Partial<ConstructorParameters<typeof OpenAICompatibleProvider>[0]> = {},
) {
  return new OpenAICompatibleProvider({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    fetch: fetchImpl,
    maxRetries: 0,
    ...extra,
  });
}

async function fail(p: Promise<unknown>): Promise<AIError> {
  try {
    await p;
  } catch (error) {
    if (error instanceof AIError) return error;
    throw error;
  }
  throw new Error('expected rejection');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('configuration', () => {
  it.each([
    ['https://r.example/v1', 'https://r.example/v1'],
    ['https://r.example/v1/', 'https://r.example/v1'],
    ['https://r.example/v1///', 'https://r.example/v1'],
    ['https://r.example/v1/chat/completions', 'https://r.example/v1'],
    ['https://r.example/v1/chat/completions/', 'https://r.example/v1'],
    ['  https://r.example  ', 'https://r.example'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeBaseUrl(input)).toBe(expected);
  });

  it('createAIProvider fails with not_configured when base URL is missing', () => {
    const error = expectThrows(() => createAIProvider({ AI_ROUTER_API_KEY: API_KEY }));
    expect(error.code).toBe('not_configured');
    expect(error.message).toContain('AI_ROUTER_BASE_URL');
    expect(error.message).not.toContain(API_KEY);
  });

  it('createAIProvider fails with not_configured when API key is missing', () => {
    const error = expectThrows(() => createAIProvider({ AI_ROUTER_BASE_URL: BASE_URL }));
    expect(error.code).toBe('not_configured');
    expect(error.message).toContain('AI_ROUTER_API_KEY');
  });

  it('createAIProvider fails when both are missing, naming both', () => {
    const error = expectThrows(() => createAIProvider({}));
    expect(error.message).toContain('AI_ROUTER_BASE_URL');
    expect(error.message).toContain('AI_ROUTER_API_KEY');
  });

  it('createAIProvider returns a provider with valid configuration', () => {
    const p = createAIProvider({ AI_ROUTER_BASE_URL: BASE_URL, AI_ROUTER_API_KEY: API_KEY });
    expect(p).toBeInstanceOf(OpenAICompatibleProvider);
  });

  it('createAIProvider refuses to run in a browser environment', () => {
    vi.stubGlobal('window', {});
    const error = expectThrows(() =>
      createAIProvider({ AI_ROUTER_BASE_URL: BASE_URL, AI_ROUTER_API_KEY: API_KEY }),
    );
    expect(error.code).toBe('not_configured');
    expect(error.message).toMatch(/browser/);
  });
});

describe('request', () => {
  it('POSTs to {base}/chat/completions with auth, content-type, model, and messages', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(OK_BODY));

    await provider(fetchMock).chat(REQUEST);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${BASE_URL}/chat/completions`);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'test-model',
      messages: REQUEST.messages,
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not double up the path when base URL already ends in /chat/completions/', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(OK_BODY));
    await provider(fetchMock, { baseUrl: `${BASE_URL}/chat/completions/` }).chat(REQUEST);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE_URL}/chat/completions`);
  });

  it('maps optional temperature and maxOutputTokens, omitting them when absent', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(OK_BODY));

    await provider(fetchMock).chat({ ...REQUEST, temperature: 0.2, maxOutputTokens: 64 });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      temperature: 0.2,
      max_tokens: 64,
    });

    await provider(fetchMock).chat(REQUEST);
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('max_tokens');
  });
});

describe('response', () => {
  it('normalizes text, model, finish reason, and usage', async () => {
    const result = await provider(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(OK_BODY)),
    ).chat(REQUEST);
    expect(result).toEqual({
      text: 'Hello!',
      model: 'test-model-2026',
      finishReason: 'stop',
      usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
    });
  });

  it('tolerates missing usage/finish_reason/model and null content', async () => {
    const body = { choices: [{ message: { content: null } }] };
    const result = await provider(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(body))).chat(
      REQUEST,
    );
    expect(result).toEqual({ text: '', model: 'test-model' });
    expect(result).not.toHaveProperty('usage');
    expect(result).not.toHaveProperty('finishReason');
  });
});

describe('errors', () => {
  it.each([
    [401, 'authentication'],
    [403, 'authentication'],
    [429, 'rate_limited'],
    [400, 'bad_request'],
    [404, 'bad_request'],
    [500, 'upstream_error'],
    [503, 'upstream_error'],
  ] as const)('maps HTTP %i to %s', async (status, code) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"error":{"message":"nope"}}', { status }));
    const error = await fail(provider(fetchMock).chat(REQUEST));
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.message).not.toContain('nope');
  });

  it('maps malformed JSON to malformed_response', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<html>', { status: 200 }));
    expect((await fail(provider(fetchMock).chat(REQUEST))).code).toBe('malformed_response');
  });

  it('maps a 200 with the wrong shape to malformed_response', async () => {
    for (const body of [{}, { choices: [] }, { choices: [{ message: {} }] }, 'str']) {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(body));
      expect((await fail(provider(fetchMock).chat(REQUEST))).code).toBe('malformed_response');
    }
  });

  it('maps a fetch rejection to network and strips the URL and socket details from cause', async () => {
    const driverError = new TypeError('fetch failed');
    (driverError as Error & { cause?: unknown }).cause = {
      code: 'ECONNREFUSED',
      address: '127.0.0.1',
      port: 11434,
      message: 'connect ECONNREFUSED 127.0.0.1:11434 https://ai.example.test/v1/chat/completions',
    };
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(driverError);
    const error = await fail(provider(fetchMock).chat(REQUEST));
    expect(error.code).toBe('network');
    expect(error.cause).toEqual({ name: 'TypeError', code: 'ECONNREFUSED' });
    expect(JSON.stringify(error.cause)).not.toContain('ai.example.test');
    expect(JSON.stringify(error.cause)).not.toContain('127.0.0.1');
    expect(error.message).not.toContain('ai.example.test');
  });

  it('aborts and maps to timeout when the endpoint hangs', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const pending = fail(provider(fetchMock, { timeoutMs: 1000 }).chat(REQUEST));
    await vi.advanceTimersByTimeAsync(1000);
    const error = await pending;
    expect(error.code).toBe('timeout');
    expect(error.message).toContain('1000ms');
  });
});

describe('retry', () => {
  it('retries once on 5xx then succeeds', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(jsonResponse(OK_BODY));
    const pending = provider(fetchMock, { maxRetries: 1 }).chat(REQUEST);
    await vi.runAllTimersAsync();
    expect((await pending).text).toBe('Hello!');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('honours a small numeric Retry-After on 429 and gives up after the budget', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '2' } }));
    const pending = fail(provider(fetchMock, { maxRetries: 1 }).chat(REQUEST));
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).code).toBe('rate_limited');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403])('never retries %i', async (status) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }));
    await fail(provider(fetchMock, { maxRetries: 3 }).chat(REQUEST));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never retries malformed responses', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}));
    await fail(provider(fetchMock, { maxRetries: 3 }).chat(REQUEST));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('security', () => {
  it('never puts the API key or Authorization header in any error, including serialized form', async () => {
    const scenarios: Array<() => Response | Promise<Response>> = [
      () => new Response('leak? ' + API_KEY, { status: 401 }),
      () => new Response('', { status: 500 }),
      () => new Response('not json', { status: 200 }),
      () => jsonResponse({}),
      () => Promise.reject(new TypeError(`fetch failed for Bearer ${API_KEY}`)),
    ];
    for (const scenario of scenarios) {
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => scenario());
      const error = await fail(provider(fetchMock).chat(REQUEST));
      const serialized = `${error.message}${error.stack ?? ''}${JSON.stringify({ ...error })}`;
      expect(serialized).not.toContain(API_KEY);
      expect(serialized).not.toMatch(/authorization/i);
    }
  });

  it('never puts the API key in a successful response or exposes headers/config on the provider', async () => {
    const p = provider(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(OK_BODY)));
    const result = await p.chat(REQUEST);
    expect(JSON.stringify(result)).not.toContain(API_KEY);
    expect(Object.keys(result).sort()).toEqual(['finishReason', 'model', 'text', 'usage']);
    // The provider object's enumerable surface must not offer the key or a headers bag.
    expect(Object.keys(p)).not.toContain('headers');
    expect(JSON.stringify(p)).not.toContain(API_KEY);
  });
});

function expectThrows(fn: () => unknown): AIError {
  try {
    fn();
  } catch (error) {
    if (error instanceof AIError) return error;
    throw error;
  }
  throw new Error('expected throw');
}
