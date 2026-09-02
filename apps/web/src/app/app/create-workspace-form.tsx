'use client';

import { useActionState } from 'react';

import type { WorkspaceFormState } from '@/app/app/workspace-actions';
import { createWorkspace } from '@/app/app/workspace-actions';

/**
 * Create-workspace form.
 *
 * A Client Component only because `useActionState` needs the hook; the
 * action itself still runs entirely on the server.
 */
export function CreateWorkspaceForm() {
  const [state, formAction, isPending] = useActionState<WorkspaceFormState, FormData>(
    createWorkspace,
    {},
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-5"
    >
      <h2 className="text-sm font-medium text-slate-300">Create a workspace</h2>

      {state.error ? (
        <p role="alert" className="text-sm text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="workspace-name" className="sr-only">
            Workspace name
          </label>
          <input
            id="workspace-name"
            name="name"
            type="text"
            placeholder="Workspace name"
            required
            aria-describedby={state.fieldErrors?.name ? 'workspace-name-error' : undefined}
            aria-invalid={state.fieldErrors?.name ? true : undefined}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base outline-none focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400"
          />
          {state.fieldErrors?.name ? (
            <p id="workspace-name-error" className="text-sm text-red-300">
              {state.fieldErrors.name}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-950 disabled:opacity-60"
        >
          {isPending ? 'Creating…' : 'Create workspace'}
        </button>
      </div>
    </form>
  );
}
