'use client';

import { ConfirmDelete } from '@/components/confirm-delete';

interface DeleteContentButtonProps {
  action: () => Promise<void>;
  title: string;
  /** Captions cascade with the content row; the user is told before, not after. */
  captionCount: number;
}

export function DeleteContentButton({ action, title, captionCount }: DeleteContentButtonProps) {
  // The captions FK is ON DELETE CASCADE, so deleting content destroys every
  // version written for it — including the selected one. "This cannot be
  // undone" is true but says nothing about what is actually lost.
  const consequence =
    captionCount === 0
      ? 'This cannot be undone.'
      : `This also deletes ${captionCount} caption${captionCount === 1 ? '' : 's'} written for it. This cannot be undone.`;

  return (
    <ConfirmDelete
      action={action}
      label="Delete content"
      subject={title}
      consequence={consequence}
    />
  );
}
