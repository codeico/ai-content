'use client';

import { ConfirmDelete } from '@/components/confirm-delete';

interface DeleteContentButtonProps {
  action: () => Promise<void>;
  title: string;
}

export function DeleteContentButton({ action, title }: DeleteContentButtonProps) {
  return (
    <ConfirmDelete
      action={action}
      label="Delete content"
      subject={title}
      consequence="This cannot be undone."
    />
  );
}
