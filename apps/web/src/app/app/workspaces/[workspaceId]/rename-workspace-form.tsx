'use client';

import { useActionState } from 'react';

import type { WorkspaceFormState } from '@/app/app/workspace-actions';

interface RenameWorkspaceFormProps {
  action: (state: WorkspaceFormState, formData: FormData) => Promise<WorkspaceFormState>;
  currentName: string;
}

/**
 * Rename form for the workspace detail page.
 *
 * The Server Action itself is bound to the workspace id in the page (a
 * Server Component), via `.bind(null, workspaceId)` — the documented Next.js
 * pattern for passing an extra argument to an action invoked from a client
 * form. That argument travels in the encrypted action reference, not as
 * client-editable form input, so it cannot be tampered with the way a hidden
 * `<input>` could be.
 */
export function RenameWorkspaceForm({ action, currentName }: RenameWorkspaceFormProps) {
  const [state, formAction, isPending] = useActionState<WorkspaceFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? (
        <p role="alert" className="text-sm text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="rename-workspace-name" className="sr-only">
            Workspace name
          </label>
          <input
            id="rename-workspace-name"
            name="name"
            type="text"
            defaultValue={currentName}
            required
            aria-describedby={state.fieldErrors?.name ? 'rename-workspace-name-error' : undefined}
            aria-invalid={state.fieldErrors?.name ? true : undefined}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base outline-none focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400"
          />
          {state.fieldErrors?.name ? (
            <p id="rename-workspace-name-error" className="text-sm text-red-300">
              {state.fieldErrors.name}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-950 disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save name'}
        </button>
      </div>
    </form>
  );
}
