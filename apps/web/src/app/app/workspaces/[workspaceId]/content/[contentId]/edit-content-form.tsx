'use client';

import { CONTENT_STATUSES, type ContentStatus } from '@ai-content/shared/content';
import { useActionState } from 'react';

import type { ContentFormState } from '@/app/app/workspaces/[workspaceId]/content-actions';
import { Button, Field, Input, Notice, STATUS_LABEL, Select } from '@/components/ui';

interface EditContentFormProps {
  action: (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  currentTitle: string;
  currentStatus: ContentStatus;
}

export function EditContentForm({ action, currentTitle, currentStatus }: EditContentFormProps) {
  const [state, formAction, isPending] = useActionState<ContentFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Field id="edit-content-title" label="Title" error={state.fieldErrors?.title}>
        {(a11y) => (
          <Input
            {...a11y}
            name="title"
            type="text"
            defaultValue={currentTitle}
            required
            enterKeyHint="done"
          />
        )}
      </Field>

      <Field
        id="edit-content-status"
        label="Status"
        hint="Draft while you work on it, ready when it is done, archived to keep it out of the way."
        error={state.fieldErrors?.status}
      >
        {(a11y) => (
          <Select {...a11y} name="status" defaultValue={currentStatus}>
            {CONTENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto sm:self-start">
        {isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
