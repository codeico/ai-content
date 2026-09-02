import { z } from 'zod';

import { AIError, type AIChatRequest, type AIChatResponse, type AIProvider } from './provider.ts';

/**
 * Generic adapter for any endpoint that implements the OpenAI chat completions
 * contract: POST {baseUrl}/chat/completions with a Bearer token. The vendor
 * behind the URL is irrelevant to this file.
 */

export interface OpenAICompatibleProviderOptions {
  /** e.g. https://router.example/v1 — with or without trailing slash. */
  baseUrl: string;
  apiKey: string;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Extra attempts after the first, for 429/5xx/network only. */
  maxRetries?: number;
  /** Injectable for tests. */
  fetch?: typeof fetch;
}

export const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 1;
const MAX_RETRY_AFTER_MS = 5_000;

/** Strips trailing slashes and a trailing /chat/completions so both configs yield one URL. */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/, '');
}

/** Only the fields this project reads; extra vendor fields are ignored, not modelled. */
const completionSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
        finish_reason: z.string().nullish(),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
});

const RETRYABLE_CODES = new Set(['rate_limited', 'upstream_error', 'network', 'timeout']);

export class OpenAICompatibleProvider implements AIProvider {
  private readonly url: string;
  /** Non-enumerable so JSON.stringify/console.log of the provider never prints the key. */
  private readonly authorization!: () => string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.url = `${normalizeBaseUrl(options.baseUrl)}/chat/completions`;
    const header = `Bearer ${options.apiKey}`;
    Object.defineProperty(this, 'authorization', { value: () => header, enumerable: false });
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.attempt(request);
      } catch (error) {
        const retryable = error instanceof AIError && RETRYABLE_CODES.has(error.code);
        if (!retryable || attempt >= this.maxRetries) {
          throw error;
        }
        await sleep(retryDelayMs(error));
      }
    }
  }

  private async attempt(request: AIChatRequest): Promise<AIChatResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: {
          Authorization: this.authorization(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          ...(request.temperature !== undefined && { temperature: request.temperature }),
          ...(request.maxOutputTokens !== undefined && { max_tokens: request.maxOutputTokens }),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AIError('timeout', `AI request timed out after ${this.timeoutMs}ms.`);
      }
      // Driver errors can embed the request URL but never the headers; the
      // message is still replaced so nothing upstream-shaped reaches callers.
      throw new AIError('network', 'AI request failed to reach the endpoint.', undefined, error);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw httpError(response);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new AIError(
        'malformed_response',
        'AI endpoint returned non-JSON body.',
        response.status,
      );
    }

    const parsed = completionSchema.safeParse(json);
    if (!parsed.success) {
      throw new AIError(
        'malformed_response',
        'AI endpoint returned an unexpected response shape.',
        response.status,
      );
    }

    const choice = parsed.data.choices[0];
    if (!choice) {
      throw new AIError('malformed_response', 'AI endpoint returned no choices.', response.status);
    }
    const usage = parsed.data.usage;

    return {
      text: choice.message.content ?? '',
      model: parsed.data.model ?? request.model,
      ...(choice.finish_reason != null && { finishReason: choice.finish_reason }),
      ...(usage && {
        usage: {
          ...(usage.prompt_tokens !== undefined && { inputTokens: usage.prompt_tokens }),
          ...(usage.completion_tokens !== undefined && { outputTokens: usage.completion_tokens }),
          ...(usage.total_tokens !== undefined && { totalTokens: usage.total_tokens }),
        },
      }),
    };
  }
}

function httpError(response: Response): AIError {
  const { status } = response;
  const retryAfter = response.headers.get('retry-after');
  const cause = retryAfter ? { retryAfter } : undefined;

  if (status === 401 || status === 403) {
    return new AIError('authentication', 'AI endpoint rejected the credentials.', status);
  }
  if (status === 429) {
    return new AIError('rate_limited', 'AI endpoint rate limit reached.', status, cause);
  }
  if (status >= 500) {
    return new AIError(
      'upstream_error',
      `AI endpoint failed with status ${status}.`,
      status,
      cause,
    );
  }
  return new AIError(
    'bad_request',
    `AI endpoint rejected the request with status ${status}.`,
    status,
  );
}

function retryDelayMs(error: AIError): number {
  const retryAfter = (error.cause as { retryAfter?: string } | undefined)?.retryAfter;
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  // Honours a numeric Retry-After only, capped; the HTTP-date form falls back to the default.
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
    : 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
