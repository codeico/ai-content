'use client';

import { useState } from 'react';

import { Button } from '@/components/ui';

interface ConfirmDeleteProps {
  action: () => Promise<void>;
  /** e.g. "Delete workspace" */
  label: string;
  /** What is about to be removed; shown in the confirmation line. */
  subject: string;
  consequence: string;
}

/**
 * Two-step inline delete. Replaces window.confirm so the confirmation is
 * styled, keyboard-reachable, and never clipped by a mobile viewport.
 * Authorization still happens server-side in the bound action.
 */
export function ConfirmDelete({ action, label, subject, consequence }: ConfirmDeleteProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="danger" className="w-full" onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-surface bg-danger-soft p-4">
      <p className="text-[14px] text-danger">
        Delete <span className="font-medium break-words">{subject}</span>? {consequence}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)} autoFocus>
          Cancel
        </Button>
        <Button type="submit" className="bg-danger text-surface hover:bg-danger/90">
          Delete
        </Button>
      </div>
    </form>
  );
}
