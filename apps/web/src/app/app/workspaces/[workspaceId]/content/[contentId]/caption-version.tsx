'use client';

import type { CaptionStatus } from '@ai-content/shared/content/caption';
import { useActionState } from 'react';

import type { CaptionActionState } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/caption-actions';
import { CopyCaptionButton } from '@/app/app/workspaces/[workspaceId]/content/[contentId]/copy-caption-button';
import { Button, CaptionStatusMark, Notice } from '@/components/ui';

interface CaptionVersionProps {
  action: (state: CaptionActionState, formData: FormData) => Promise<CaptionActionState>;
  caption: {
    id: string;
    version: number;
    body: string;
    status: CaptionStatus;
    model_name: string;
    created_at: string;
  };
  createdLabel: string;
}

/**
 * One generated version. The body is shown whole, pre-wrapped, in the reading
 * size — it is the artefact the user came for, so it is not truncated behind
 * a disclosure. Select is a form so it works without JS and follows the same
 * Server Action gate as everything else.
 */
export function CaptionVersion({ action, caption, createdLabel }: CaptionVersionProps) {
  const [state, formAction, isPending] = useActionState<CaptionActionState, FormData>(action, {});
  const isActive = caption.status === 'active';

  return (
    <li className="border-t border-line py-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13px]">
        <span className="text-ink-faint">
          Version <span className="tabular">{caption.version}</span>
          <span aria-hidden="true"> · </span>
          <span className="tabular">{createdLabel}</span>
        </span>
        <CaptionStatusMark status={caption.status} />
      </div>

      <p className="text-[15px] leading-[1.6] whitespace-pre-wrap break-words">{caption.body}</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span
          className="font-mono text-[12px] text-ink-faint"
          title="Model reported by the AI Router"
        >
          {caption.model_name}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <CopyCaptionButton body={caption.body} />

          {isActive ? null : (
            <form action={formAction} className="flex min-w-0 flex-col gap-2">
              {state.error ? <Notice tone="error">{state.error}</Notice> : null}
              <Button type="submit" variant="quiet" disabled={isPending}>
                {isPending ? 'Selecting…' : 'Use this one'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
