import { z } from 'zod';

/** A read-only view of variables visible to runtime configuration. */
export type BrowserEnvSource = Readonly<Record<string, string | undefined>>;

const requiredString = z.string().trim().min(1);

/**
 * The only environment variable names a browser bundle may contain. Keep this
 * schema in its own module: importing the combined server env barrel once
 * caused every server-secret NAME (not value) to be emitted in a client chunk.
 */
export const browserRuntimeEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: requiredString.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredString,
});

export type BrowserRuntimeEnv = z.infer<typeof browserRuntimeEnvSchema>;

/** Browser-safe validation error. It includes variable names, never values. */
export class BrowserEnvValidationError extends Error {
  public readonly variables: readonly string[];

  constructor(issues: readonly z.core.$ZodIssue[]) {
    const details = issues
      .map((issue) => {
        const name = issue.path.join('.') || '(root)';
        return `  ${name}: ${issue.message}`;
      })
      .join('\n');

    super(`Invalid runtime environment configuration:\n${details}`);
    this.name = 'EnvValidationError';
    this.variables = issues.map((issue) => issue.path.join('.'));
  }
}

export function loadBrowserRuntimeEnv(source: BrowserEnvSource = process.env): BrowserRuntimeEnv {
  const result = browserRuntimeEnvSchema.safeParse(source);

  if (!result.success) {
    throw new BrowserEnvValidationError(result.error.issues);
  }

  return result.data;
}

export function isBrowserRuntimeEnvConfigured(source: BrowserEnvSource = process.env): boolean {
  return browserRuntimeEnvSchema.safeParse(source).success;
}
