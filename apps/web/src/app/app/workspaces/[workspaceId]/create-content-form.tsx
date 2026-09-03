'use client';

import { useActionState, useEffect, useRef } from 'react';

import type { ContentFormState } from '@/app/app/workspaces/[workspaceId]/content-actions';
import { useSheet } from '@/components/sheet';
import { Button, Field, Input, Notice } from '@/components/ui';

interface CreateContentFormProps {
  action: (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;
}

/** Bound to the workspace id by the page via `.bind`; see RenameWorkspaceForm. */
export function CreateContentForm({ action }: CreateContentFormProps) {
  const [state, formAction, isPending] = useActionState<ContentFormState, FormData>(action, {});
  const { close } = useSheet();
  const submitted = useRef(false);

  if (isPending) {
    submitted.current = true;
  }

  useEffect(() => {
    // A settled action with no error is a success. Checking the state rather
    // than the submit event is the whole point: a rejected title must keep the
    // sheet open so its message can be read.
    if (!submitted.current || isPending) return;
    if (state.error || state.fieldErrors) return;

    submitted.current = false;
    close();
  }, [isPending, state, close]);

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
