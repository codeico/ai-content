'use client';

import { CAPTION_BODY_MAX_LENGTH } from '@ai-content/shared/content/caption';
import { useActionState, useState } from 'react';

import type { CaptionActionState } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/caption-actions';
import { Button, Notice, Textarea } from '@/components/ui';

interface EditCaptionFormProps {
  action: (state: CaptionActionState, formData: FormData) => Promise<CaptionActionState>;
  body: string;
  version: number;
}

/**
 * Edit one caption. Saving appends a NEW version rather than changing this
 * one: the database refuses a body change, so a caption that has been chosen
 * cannot drift underneath a schedule, and provenance keeps meaning something.
 *
 * Collapsed by default. The version list is for reading captions; editing is
 * an action you opt into, and an always-open textarea per version would bury
 * the text the user came to read.
 */
export function EditCaptionForm({ action, body, version }: EditCaptionFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<CaptionActionState, FormData>(action, {});

  if (!open) {
    return (
      <Button type="button" variant="quiet" onClick={() => setOpen(true)}>
        Edit
      </Button>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex w-full min-w-0 flex-col gap-3">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <label htmlFor={`caption-body-${version}`} className="text-[14px] text-ink-soft">
        Saving keeps version {version} and adds the edit as a new one.
      </label>

      <Textarea
        id={`caption-body-${version}`}
        name="body"
        rows={6}
        maxLength={CAPTION_BODY_MAX_LENGTH}
        defaultValue={body}
        required
      />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save as new version'}
        </Button>
        <Button type="button" variant="quiet" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
