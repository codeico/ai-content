'use client';

import { Button } from '@/components/ui';

/** Route-level error boundary for the app area. Browser-default error UI never shows. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rise flex flex-col gap-4 border-t border-line pt-8">
      <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Something went wrong</h1>
      <p className="max-w-[46ch] text-[15px] text-ink-soft">
        We could not load this page. Check your connection and try again.
      </p>
      <Button type="button" variant="secondary" onClick={reset} className="w-full sm:w-auto">
        Try again
      </Button>
    </div>
  );
}
