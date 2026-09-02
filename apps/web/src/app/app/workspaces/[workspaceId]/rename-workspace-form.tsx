'use client';

import { useActionState } from 'react';

import type { WorkspaceFormState } from '@/app/app/workspace-actions';
import { Button, Field, Input, Notice } from '@/components/ui';

interface RenameWorkspaceFormProps {
  action: (state: WorkspaceFormState, formData: FormData) => Promise<WorkspaceFormState>;
  currentName: string;
}

/**
 * Rename form for the workspace page.
 *
 * The Server Action is bound to the workspace id in the page (a Server
 * Component) via `.bind(null, workspaceId)`. That argument travels in the
 * encrypted action reference, not as client-editable form input.
 */
export function RenameWorkspaceForm({ action, currentName }: RenameWorkspaceFormProps) {
  const [state, formAction, isPending] = useActionState<WorkspaceFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Field id="rename-workspace-name" label="Name" error={state.fieldErrors?.name}>
        {(a11y) => (
          <Input
            {...a11y}
            name="name"
            type="text"
            defaultValue={currentName}
            required
            enterKeyHint="done"
          />
        )}
      </Field>

      <Button type="submit" variant="secondary" disabled={isPending} className="w-full">
        {isPending ? 'Saving…' : 'Save name'}
      </Button>
    </form>
  );
}
