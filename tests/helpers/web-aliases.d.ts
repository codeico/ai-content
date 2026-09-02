/**
 * The root tsconfig (which type-checks tests/) has no `@/*` path mapping; only
 * apps/web/tsconfig.json does. Any test that imports a Server Action therefore
 * drags in `@/...` specifiers that `tsc -p tsconfig.json` cannot resolve.
 *
 * These ambient declarations bind each `@/` specifier the actions use to the
 * real module through the workspace symlink, so types flow through unchanged.
 * Runtime resolution is separate: vitest has no alias either, so the action
 * test binds the same specifiers with vi.mock.
 *
 * Preferred long-term fix (outside tests/): add `"paths": { "@/*":
 * ["./apps/web/src/*"] }` to the root tsconfig and a matching `resolve.alias`
 * to vitest.config.ts, then delete this file.
 */
declare module '@/lib/supabase/server' {
  export * from '@ai-content/web/src/lib/supabase/server.ts';
}

declare module '@/server/repositories/content-repository' {
  export * from '@ai-content/web/src/server/repositories/content-repository.ts';
}

declare module '@/server/repositories/workspace-repository' {
  export * from '@ai-content/web/src/server/repositories/workspace-repository.ts';
}
