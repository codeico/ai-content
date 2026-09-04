'use client';

import { useEffect, useRef } from 'react';

import { useSheet } from '@/components/sheet';

/**
 * Closes the surrounding sheet once a Server Action has settled successfully.
 *
 * Extracted because every form in a sheet needs exactly this, and getting it
 * wrong is invisible: closing on the submit event dismisses the sheet on
 * FAILURE too, taking the error message with it, so the user sees the sheet
 * vanish and nothing saved.
 *
 * Outside a sheet `close()` is a no-op, so a form using this still works
 * inline.
 *
 * The "did this component submit" memory lives in an effect keyed on the
 * pending→settled edge, not in a ref written during render: React's compiler
 * rules forbid touching refs in the render body, and the edge is what we
 * actually care about — a form that mounts with a stale success state must
 * not close on first paint.
 */
export function useCloseOnSuccess(
  isPending: boolean,
  state: { error?: string; fieldErrors?: Record<string, unknown> },
): void {
  const { close } = useSheet();
  const wasPending = useRef(false);

  useEffect(() => {
    const settledNow = wasPending.current && !isPending;
    wasPending.current = isPending;

    // Only on the falling edge of a submit this component actually made:
    // closing while pending tears the form down mid-flight, and closing on
    // mount would dismiss a sheet that merely opened with an old state.
    if (!settledNow) return;
    if (state.error || state.fieldErrors) return;

    close();
  }, [isPending, state, close]);
}
