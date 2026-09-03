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
 */
export function useCloseOnSuccess(
  isPending: boolean,
  state: { error?: string; fieldErrors?: Record<string, unknown> },
): void {
  const { close } = useSheet();
  const submitted = useRef(false);

  if (isPending) {
    submitted.current = true;
  }

  useEffect(() => {
    // Only after a submit this component actually made, and only once the
    // action has settled: closing while pending tears the form down mid-flight.
    if (!submitted.current || isPending) return;
    if (state.error || state.fieldErrors) return;

    submitted.current = false;
    close();
  }, [isPending, state, close]);
}
