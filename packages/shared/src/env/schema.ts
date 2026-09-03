/**
 * Environment variable schemas.
 *
 * Variables are split into two groups because they have different lifetimes:
 *
 * - Runtime variables are needed by the application as it exists today.
 * - Future provider variables belong to capabilities that are specified in the
 *   architecture but not yet implemented (AI analysis, publishing, queue, storage).
 *
 * Keeping them separate is what allows `npm run dev` and `npm run build` to work
 * on a machine that has not configured, for example, an AI Router endpoint yet.
 * See TECHNICAL_ARCHITECTURE.md §48 for the full variable catalogue.
 */
import { z } from 'zod';

/** A non-empty string, rejecting whitespace-only values that pass a bare min(1). */
const requiredString = z.string().trim().min(1);

/**
 * Variables required for the application to serve requests.
 *
 * Phase 0 does not connect to Supabase, but these are the values the web app
 * will read first, so they are validated as one unit.
 */
export const runtimeEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: requiredString.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredString,
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

/**
 * Server-only secrets.
 *
 * Deliberately excluded from `runtimeEnvSchema` so that browser-facing code can
 * never validate — and therefore never accidentally import — a server secret.
 */
export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: requiredString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Credentials for providers that later phases will introduce.
 *
 * Every field is optional at load time. A feature that needs one of these must
 * assert it at the point of use, so an unconfigured provider degrades that one
 * feature instead of preventing the whole application from booting.
 *
 * The AI backend is addressed as a configurable, OpenAI-compatible AI Router.
 * The base URL is validated as a URL when present, so a typo is caught at
 * configuration time rather than on the first request. All values are
 * server-only: none carries a `NEXT_PUBLIC_` prefix, so none reaches a
 * browser bundle.
 *
 * AI_ROUTER_MODEL names the model the application asks the router for. It is
 * configuration, not code: no model id is hardcoded anywhere (AI_ARCHITECTURE
 * "Model handling"), and the same build can run against different models per
 * environment. Missing model = AI not configured, same as a missing key.
 */
export const futureProviderEnvSchema = z.object({
  // http(s) only. `z.url()` alone accepts ftp://, file:// and similar, which
  // would pass configuration validation and then fail at request time as an
  // opaque network error — the misleading failure this validation exists to
  // prevent. A wrong scheme is a configuration fault, so it is caught here.
  AI_ROUTER_BASE_URL: requiredString
    .url()
    .refine(
      (value) => /^https?:\/\//i.test(value),
      'AI_ROUTER_BASE_URL must be an http:// or https:// URL.',
    )
    .optional(),
  AI_ROUTER_API_KEY: requiredString.optional(),
  AI_ROUTER_MODEL: requiredString.optional(),
});

export type FutureProviderEnv = z.infer<typeof futureProviderEnvSchema>;
