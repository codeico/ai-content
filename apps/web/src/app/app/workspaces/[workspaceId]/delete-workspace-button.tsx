'use client';

import { ConfirmDelete } from '@/components/confirm-delete';

interface DeleteWorkspaceButtonProps {
  action: () => Promise<void>;
  workspaceName: string;
}

export function DeleteWorkspaceButton({ action, workspaceName }: DeleteWorkspaceButtonProps) {
  return (
    <ConfirmDelete
      action={action}
      label="Delete workspace"
      subject={workspaceName}
      consequence="All of its content goes with it. This cannot be undone."
    />
  );
}
