'use client';

import {
  PROFILE_LONG_MAX_LENGTH,
  PROFILE_SHORT_MAX_LENGTH,
  type WorkspaceProfileInput,
} from '@ai-content/shared/workspace/profile';
import { useActionState } from 'react';

import type { WorkspaceProfileFormState } from '@/app/app/workspace-actions';
import { AutoGrowTextarea } from '@/components/auto-grow-textarea';
import { Button, Field, Input, Notice } from '@/components/ui';

interface EditProfileFormProps {
  action: (
    state: WorkspaceProfileFormState,
    formData: FormData,
  ) => Promise<WorkspaceProfileFormState>;
  current: WorkspaceProfileInput;
}

/** Long-text fields, in render order. Niche is the one short field and sits first. */
const LONG_FIELDS: {
  name: Exclude<keyof WorkspaceProfileInput, 'niche'>;
  label: string;
  hint: string;
}[] = [
  {
    name: 'description',
    label: 'Description',
    hint: 'A short summary a new teammate could read.',
  },
  { name: 'target_audience', label: 'Target audience', hint: 'Who the posts are for.' },
  { name: 'tone', label: 'Tone', hint: 'How it should sound, e.g. warm and direct.' },
  {
    name: 'writing_style',
    label: 'Writing style',
    hint: 'Sentence length, emoji, hashtags, language.',
  },
  { name: 'content_goals', label: 'Content goals', hint: 'What the posts should achieve.' },
  { name: 'restrictions', label: 'Restrictions', hint: 'Topics, words, or claims to avoid.' },
];

/**
 * The workspace's editorial identity. Every field is optional; blank input is
 * stored as null by the shared schema. Bound to the workspace id by the page
 * via `.bind`, so the id never travels as client-editable form input.
 */
export function EditProfileForm({ action, current }: EditProfileFormProps) {
  const [state, formAction, isPending] = useActionState<WorkspaceProfileFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex min-w-0 flex-col gap-4">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.saved ? <Notice tone="success">Profile saved.</Notice> : null}

      <Field
        id="profile-niche"
        label="Niche"
        hint="What this account is about, in a few words."
        error={state.fieldErrors?.niche}
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="niche"
            type="text"
            maxLength={PROFILE_SHORT_MAX_LENGTH}
            defaultValue={current.niche ?? ''}
            enterKeyHint="next"
          />
        )}
      </Field>

      {LONG_FIELDS.map((field) => (
        <Field
          key={field.name}
          id={`profile-${field.name}`}
          label={field.label}
          hint={field.hint}
          error={state.fieldErrors?.[field.name]}
        >
          {(a11y) => (
            <AutoGrowTextarea
              {...a11y}
              name={field.name}
              maxLength={PROFILE_LONG_MAX_LENGTH}
              defaultValue={current[field.name] ?? ''}
              rows={2}
            />
          )}
        </Field>
      ))}

      {/*
        Seven fields put Save at 1483px, off-screen at load and reachable only
        by scrolling past every textarea. It sticks to the bottom instead, the
        way a native form keeps its commit action in reach, and clears the tab
        bar and the home indicator.
      */}
      <div className="pb-safe sticky bottom-0 -mx-4 mt-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}
