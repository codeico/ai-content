import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offline' };

/**
 * Shown by the service worker when a navigation fails.
 *
 * Static on purpose: it must be cacheable at install time, so it cannot read
 * cookies or touch the database. It says what happened and nothing else - a
 * fake shell with empty lists would look like the user lost their data.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center gap-4 px-6">
      <h1 className="text-[22px] font-semibold tracking-[-0.01em]">You are offline</h1>
      <p className="text-[15px] leading-[1.6] text-ink-soft">
        This app needs a connection to load your workspaces. Nothing you saved has been lost.
      </p>
      <p className="text-[14px] text-ink-faint">Reconnect and the page will load normally.</p>
    </main>
  );
}
