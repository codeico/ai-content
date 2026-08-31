/**
 * Environment loading and validation.
 *
 * Validation is performed on demand rather than at module load. Importing this
 * module must never throw, because Next.js evaluates imports during `build`,
 * and a Phase 0 build is required to succeed without any provider credentials.
 */
import type { z } from 'zod';

import {
  futureProviderEnvSchema,
  runtimeEnvSchema,
  serverEnvSchema,
  type FutureProviderEnv,
  type RuntimeEnv,
  type ServerEnv,
} from './schema.ts';

/** A read-only view of a process environment. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Raised when required environment variables are missing or malformed. */
export class EnvValidationError extends Error {
  /** Names of the variables that failed validation. */
  public readonly variables: readonly string[];

  constructor(scope: string, issues: readonly z.core.$ZodIssue[]) {
    const details = issues
      .map((issue) => {
        const name = issue.path.join('.') || '(root)';
        return `  ${name}: ${issue.message}`;
      })
      .join('\n');

    // The variable names and Zod's messages are safe to surface; the offending
    // values are deliberately never included so secrets cannot leak into logs.
    super(`Invalid ${scope} environment configuration:\n${details}`);

    this.name = 'EnvValidationError';
    this.variables = issues.map((issue) => issue.path.join('.'));
  }
}

function parseOrThrow<T>(scope: string, schema: z.ZodType<T>, source: EnvSource): T {
  const result = schema.safeParse(source);

  if (!result.success) {
    throw new EnvValidationError(scope, result.error.issues);
  }

  return result.data;
}

/**
 * Validates the variables the application needs in order to serve requests.
 *
 * @throws {EnvValidationError} when a required variable is missing or malformed.
 */
export function loadRuntimeEnv(source: EnvSource = process.env): RuntimeEnv {
  return parseOrThrow('runtime', runtimeEnvSchema, source);
}

/**
 * Validates server-only secrets.
 *
 * Must only be called from server-side code. Never call this from a component
 * or module that can be included in a browser bundle.
 *
 * @throws {EnvValidationError} when a required secret is missing or malformed.
 */
export function loadServerEnv(source: EnvSource = process.env): ServerEnv {
  return parseOrThrow('server', serverEnvSchema, source);
}

/**
 * Reads credentials for providers introduced by later phases.
 *
 * Absent values are returned as `undefined` rather than raising, so that an
 * unconfigured future provider cannot block local development.
 */
export function loadFutureProviderEnv(source: EnvSource = process.env): FutureProviderEnv {
  return parseOrThrow('future provider', futureProviderEnvSchema, source);
}

/**
 * Reports whether the required runtime variables are present and valid.
 *
 * Intended for diagnostics and for UI that wants to show configuration state
 * without crashing when configuration is incomplete.
 */
export function isRuntimeEnvConfigured(source: EnvSource = process.env): boolean {
  return runtimeEnvSchema.safeParse(source).success;
}
