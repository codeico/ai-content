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

  return (
    <Button type="button" variant="quiet" onClick={copy} aria-live="polite">
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Press and hold to copy' : 'Copy'}
    </Button>
  );
}
