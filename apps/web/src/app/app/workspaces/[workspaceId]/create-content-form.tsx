'use client';

import { useActionState } from 'react';

import type { ContentFormState } from '@/app/app/workspaces/[workspaceId]/content-actions';
import { useCloseOnSuccess } from '@/components/use-close-on-success';
import { Button, Field, Input, Notice } from '@/components/ui';

interface CreateContentFormProps {
  action: (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;
}

/** Bound to the workspace id by the page via `.bind`; see RenameWorkspaceForm. */
export function CreateContentForm({ action }: CreateContentFormProps) {
  const [state, formAction, isPending] = useActionState<ContentFormState, FormData>(action, {});

  useCloseOnSuccess(isPending, state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Field id="content-title" label="Title" error={state.fieldErrors?.title}>
        {(a11y) => (
          <Input
            {...a11y}
            name="title"
            type="text"
            required
            autoComplete="off"
            enterKeyHint="done"
          />
        )}
      </Field>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Creating…' : 'Create draft'}
      </Button>
    </form>
  );
}
