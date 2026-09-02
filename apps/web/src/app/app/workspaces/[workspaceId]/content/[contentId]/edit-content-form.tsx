'use client';

import { CONTENT_STATUSES, type ContentStatus } from '@ai-content/shared/content';
import { useActionState } from 'react';

import type { ContentFormState } from '@/app/app/workspaces/[workspaceId]/content-actions';

interface EditContentFormProps {
  action: (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  currentTitle: string;
  currentStatus: ContentStatus;
}

const INPUT_CLASS =
  'rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base outline-none focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400';

export function EditContentForm({ action, currentTitle, currentStatus }: EditContentFormProps) {
  const [state, formAction, isPending] = useActionState<ContentFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? (
        <p role="alert" className="text-sm text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-content-title" className="text-sm text-slate-400">
          Title
        </label>
        <input
          id="edit-content-title"
          name="title"
          type="text"
          defaultValue={currentTitle}
          required
          aria-describedby={state.fieldErrors?.title ? 'edit-content-title-error' : undefined}
          aria-invalid={state.fieldErrors?.title ? true : undefined}
          className={INPUT_CLASS}
        />
        {state.fieldErrors?.title ? (
          <p id="edit-content-title-error" className="text-sm text-red-300">
            {state.fieldErrors.title}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-content-status" className="text-sm text-slate-400">
          Status
        </label>
        <select
          id="edit-content-status"
          name="status"
          defaultValue={currentStatus}
          aria-describedby={state.fieldErrors?.status ? 'edit-content-status-error' : undefined}
          aria-invalid={state.fieldErrors?.status ? true : undefined}
          className={INPUT_CLASS}
        >
          {CONTENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        {state.fieldErrors?.status ? (
          <p id="edit-content-status-error" className="text-sm text-red-300">
            {state.fieldErrors.status}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-slate-100 px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-950 disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
