import { vi } from 'vitest';

import type { Database } from '../../packages/database/src/types/database.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A recording, chainable stand-in for a PostgREST query builder.
 *
 * Real `@supabase/supabase-js` query builders are thenable: `await
 * supabase.from(...).select(...).eq(...)` works without an explicit
 * `.then()` call because the final chained object itself resolves to
 * `{ data, error }`. This mock reproduces that shape and records every
 * method call so tests can assert *which filters were applied* — the actual
 * authorization behavior — not just the final return value.
 */
export class MockQueryBuilder implements PromiseLike<{ data: unknown; error: unknown }> {
  public readonly calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: { data: unknown; error: unknown }) {}

  private record(method: string, args: unknown[]): this {
    this.calls.push({ method, args });
    return this;
  }

  select(...args: unknown[]): this {
    return this.record('select', args);
  }

  eq(...args: unknown[]): this {
    return this.record('eq', args);
  }

  in(...args: unknown[]): this {
    return this.record('in', args);
  }

  order(...args: unknown[]): this {
    return this.record('order', args);
  }

  insert(...args: unknown[]): this {
    return this.record('insert', args);
  }

  update(...args: unknown[]): this {
    return this.record('update', args);
  }

  delete(...args: unknown[]): this {
    return this.record('delete', args);
  }

  maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    this.record('maybeSingle', []);
    return Promise.resolve(this.result);
  }

  single(): Promise<{ data: unknown; error: unknown }> {
    this.record('single', []);
    return Promise.resolve(this.result);
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

/** Builds a mock Supabase client that returns one builder per table name. */
export function createMockClient(builders: Record<string, MockQueryBuilder>): {
  client: SupabaseClient<Database>;
  from: ReturnType<typeof vi.fn>;
} {
  const from = vi.fn((table: string) => {
    const builder = builders[table];
    if (!builder) {
      throw new Error(`Test did not configure a builder for table "${table}"`);
    }
    return builder;
  });

  return { client: { from } as unknown as SupabaseClient<Database>, from };
}
