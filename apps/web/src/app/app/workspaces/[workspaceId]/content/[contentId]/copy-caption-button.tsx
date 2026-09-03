'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui';

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Copies one caption body to the clipboard.
 *
 * The caption exists to be pasted into Instagram by hand, and selecting text
 * inside a paragraph on a phone is genuinely awkward — so the artefact needs a
 * one-tap way out of the app.
 *
 * The Clipboard API needs a secure context and a user gesture; both hold here,
 * but a browser may still refuse. A refusal says so plainly rather than
 * claiming success, because a silent lie costs the user the caption.
 */
export function CopyCaptionButton({ body }: { body: string }) {
  const [state, setState] = useState<CopyState>('idle');

  // Reset so the control does not sit on a stale "Copied" after the user has
  // moved on. Cleared on unmount to avoid setting state on a gone component.
  useEffect(() => {
    if (state === 'idle') {
      return;
    }

    const timer = setTimeout(() => setState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  // The announcement lives in its own status region, not on the button.
  // aria-live on the control makes the control's NAME the live region, so a
  // screen reader hears a button being renamed, and on failure the button
  // loses its identity entirely ("Press and hold to copy" is not a name).
  // The button keeps one stable name; the outcome is announced beside it.
  const status =
    state === 'copied'
      ? 'Caption copied to the clipboard.'
      : state === 'failed'
        ? 'Could not copy. Select the text and copy it manually.'
        : '';

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Button type="button" variant="quiet" onClick={copy}>
        Copy
      </Button>

      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>

      {state === 'idle' ? null : (
        <span aria-hidden="true" className="text-[12px] text-ink-faint">
          {state === 'copied' ? 'Copied' : 'Press and hold'}
        </span>
      )}
    </span>
  );
}
