'use client';

import { useActionState } from 'react';

import type { CaptionActionState } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/caption-actions';
import { Button, Notice } from '@/components/ui';

interface GenerateCaptionButtonProps {
  action: (state: CaptionActionState, formData: FormData) => Promise<CaptionActionState>;
  hasCaptions: boolean;
}

/**
 * One button, one Server Action. Disabled while pending so a double tap cannot
 * queue two generates; the UNIQUE(content_id, version) constraint is the
 * backstop if two tabs race. The not-configured outcome is rendered as a
 * plain statement, not an error the user could fix by retrying.
 */
export function GenerateCaptionButton({ action, hasCaptions }: GenerateCaptionButtonProps) {
  const [state, formAction, isPending] = useActionState<CaptionActionState, FormData>(action, {});

  return (
    <form action={formAction} className="flex min-w-0 flex-col gap-3">
      {state.error && !state.notConfigured ? <Notice tone="error">{state.error}</Notice> : null}

      {state.notConfigured ? (
        <p role="status" className="text-[14px] text-ink-soft">
          {state.error} Captions will be available once the AI Router is set up.
        </p>
      ) : null}

      <Button
        type="submit"
        variant={hasCaptions ? 'secondary' : 'primary'}
        disabled={isPending || state.notConfigured === true}
        className="w-full sm:w-auto sm:self-start"
      >
        {isPending ? 'Writing…' : hasCaptions ? 'Write another' : 'Write a caption'}
      </Button>
    </form>
  );
}
