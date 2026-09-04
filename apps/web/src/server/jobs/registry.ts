import type { JobType } from '@ai-content/shared/jobs';

import type { JobHandler } from './handler.ts';
import { proofHandler } from './proof-handler.ts';

/**
 * Every job type the worker can execute, keyed by type. The compiler enforces
 * that this is total over JobType: adding a type to JOB_TYPES without a
 * handler here is a type error, which is the point — a type with no handler
 * is a row that can only fail.
 */
const HANDLERS: { readonly [T in JobType]: JobHandler<T> } = {
  proof: proofHandler,
};

/**
 * Resolve a handler for a claimed row. Returns undefined for a type string
 * the database allowed (the column is plain text) but the application does
 * not know — the worker fails such a job with 'unknown_type', not retryable,
 * because no amount of retrying will register a handler.
 */
export function handlerFor(type: string): JobHandler | undefined {
  if (!Object.hasOwn(HANDLERS, type)) {
    return undefined;
  }

  return HANDLERS[type as JobType];
}
