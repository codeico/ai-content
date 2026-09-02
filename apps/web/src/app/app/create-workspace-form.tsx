'use client';

import { useActionState } from 'react';

import type { WorkspaceFormState } from '@/app/app/workspace-actions';
import { createWorkspace } from '@/app/app/workspace-actions';
import { Button, Field, Input, Notice } from '@/components/ui';

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
    <form action={formAction} className="flex flex-col gap-4 border-t border-line pt-5">
      <h2 className="font-medium">New workspace</h2>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Field
        id="workspace-name"
        label="Name"
        hint="A niche or brand, for example Trading or Coding."
        error={state.fieldErrors?.name}
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="name"
            type="text"
            required
            autoComplete="off"
            enterKeyHint="done"
          />
        )}
      </Field>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Creating…' : 'Create workspace'}
      </Button>
    </form>
  );
}
