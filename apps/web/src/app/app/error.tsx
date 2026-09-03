'use client';

import { Button } from '@/components/ui';

/**
 * Route-level error boundary for the app area. Browser-default error UI never
 * shows.
 *
 * This also catches a Server Action whose transport failed — a dropped
 * connection mid-submit throws inside React's fetchServerAction, which no
 * useActionState can intercept. Verified by failing fetch during a rename:
 * the page lands here, nothing was written, and Try again restores the screen
 * with the form intact.
 *
 * The wording deliberately does NOT promise that the submit was discarded.
 * From here a transport failure (request never reached the server) is
 * indistinguishable from a crash after a successful write, and claiming the
 * stronger of the two would be a lie in the second case. "Check before trying
 * again" is honest in both.
 */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rise flex flex-col gap-4 border-t border-line pt-8">
      <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Something went wrong</h1>
      <p className="max-w-[46ch] text-[15px] text-ink-soft">
        This page could not load, or the last thing you submitted did not go through. Check your
        connection, then try again — the page will show you where things stand.
      </p>
      <Button type="button" variant="secondary" onClick={reset} className="w-full sm:w-auto">
        Try again
      </Button>
    </div>
  );
}
