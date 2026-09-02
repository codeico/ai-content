'use client';

import { useActionState } from 'react';

import type { ContentFormState } from '@/app/app/workspaces/[workspaceId]/content-actions';

interface CreateContentFormProps {
  action: (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;
}

/** Bound to the workspace id by the page via `.bind` — see RenameWorkspaceForm. */
export function CreateContentForm({ action }: CreateContentFormProps) {
  const [state, formAction, isPending] = useActionState<ContentFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? (
        <p role="alert" className="text-sm text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="content-title" className="sr-only">
            Title
          </label>
          <input
            id="content-title"
            name="title"
            type="text"
            placeholder="Content title"
            required
            aria-describedby={state.fieldErrors?.title ? 'content-title-error' : undefined}
            aria-invalid={state.fieldErrors?.title ? true : undefined}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base outline-none focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400"
          />
          {state.fieldErrors?.title ? (
            <p id="content-title-error" className="text-sm text-red-300">
              {state.fieldErrors.title}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-950 disabled:opacity-60"
        >
          {isPending ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  );
}
