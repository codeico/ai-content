'use client';

import { CONTENT_SOURCE_TYPES, type ContentSourceType } from '@ai-content/shared/content';
import { useActionState } from 'react';

import type { ContentSourceFormState } from '@/app/app/workspaces/[workspaceId]/content-actions';
import { useCloseOnSuccess } from '@/components/use-close-on-success';
import { Button, Field, Input, Notice, SOURCE_TYPE_LABEL, Select } from '@/components/ui';

interface EditSourceFormProps {
  action: (state: ContentSourceFormState, formData: FormData) => Promise<ContentSourceFormState>;
  current: {
    source_type: ContentSourceType;
    source_url: string | null;
    external_id: string | null;
  };
}

/**
 * Where the content came from and what we hold of it. Separate from
 * EditContentForm so a bad link never blocks a title edit, and so the Server
 * Action behind it stays narrow. Bound to ids by the page via `.bind`.
 */
export function EditSourceForm({ action, current }: EditSourceFormProps) {
  const [state, formAction, isPending] = useActionState<ContentSourceFormState, FormData>(
    action,
    {},
  );

  useCloseOnSuccess(isPending, state);

  return (
    <form action={formAction} className="flex min-w-0 flex-col gap-4">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Field
        id="source-type"
        label="Source type"
        hint="A label only; nothing is fetched."
        error={state.fieldErrors?.source_type}
      >
        {(a11y) => (
          <Select {...a11y} name="source_type" defaultValue={current.source_type}>
            {CONTENT_SOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {SOURCE_TYPE_LABEL[type]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        id="source-url"
        label="Link"
        hint="Optional. The original link, starting with https://"
        error={state.fieldErrors?.source_url}
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="source_url"
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={current.source_url ?? ''}
            enterKeyHint="next"
          />
        )}
      </Field>

      <Field
        id="external-id"
        label="Platform ID"
        hint="Optional. The item's identifier on its platform, if you know it."
        error={state.fieldErrors?.external_id}
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="external_id"
            type="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={current.external_id ?? ''}
            enterKeyHint="next"
          />
        )}
      </Field>

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto sm:self-start">
        {isPending ? 'Saving…' : 'Save source'}
      </Button>
    </form>
  );
}
