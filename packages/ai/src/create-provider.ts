import { EnvValidationError, loadFutureProviderEnv, type EnvSource } from '@ai-content/shared/env';

import { OpenAICompatibleProvider } from './openai-compatible-provider.ts';
import { AIError, type AIProvider } from './provider.ts';

/** Per-call tuning a caller may pass; credentials never come this way. */
export interface CreateAIProviderOptions {
  /** Per-attempt timeout in ms. */
  timeoutMs?: number;
  /** Extra attempts after the first, for 429/5xx/network only. */
  maxRetries?: number;
}

/**
 * Builds the application's AIProvider from server-only environment.
 *
 * Called lazily at the point of use, never at module load, so unrelated pages
 * (login/workspace/content) still render with AI unconfigured. Same browser
 * guard as createSupabaseAdminClient: defence in depth on top of the env
 * variables having no NEXT_PUBLIC_ prefix.
 */
export function createAIProvider(
  source: EnvSource = process.env,
  options: CreateAIProviderOptions = {},
): AIProvider {
  if (typeof (globalThis as { window?: unknown }).window !== 'undefined') {
    throw new AIError(
      'not_configured',
      'The AI provider cannot be created in a browser environment; it is server-only.',
    );
  }

  // A malformed value (e.g. a typo'd base URL) is a configuration fault in the
  // same class as a missing one, so it surfaces as not_configured rather than
  // escaping as an unexpected error every caller would have to know about.
  // The underlying issues are kept on `cause` for logs, never in the message.
  let baseUrl: string | undefined;
  let apiKey: string | undefined;

  try {
    ({ AI_ROUTER_BASE_URL: baseUrl, AI_ROUTER_API_KEY: apiKey } = loadFutureProviderEnv(source));
  } catch (error) {
    if (error instanceof EnvValidationError) {
      throw new AIError('not_configured', 'AI Router configuration is invalid.', undefined, error);
    }

    throw error;
  }

  if (!baseUrl || !apiKey) {
    const missing = [!baseUrl && 'AI_ROUTER_BASE_URL', !apiKey && 'AI_ROUTER_API_KEY'].filter(
      Boolean,
    );
    throw new AIError(
      'not_configured',
      `AI Router is not configured: missing ${missing.join(', ')}.`,
    );
  }

  return new OpenAICompatibleProvider({ baseUrl, apiKey, ...options });
}
