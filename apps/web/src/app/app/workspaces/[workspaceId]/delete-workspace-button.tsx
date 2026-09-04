'use client';

import { ConfirmDelete } from '@/components/confirm-delete';
import { Button } from '@/components/ui';

interface DeleteWorkspaceButtonProps {
  action: () => Promise<void>;
  workspaceName: string;
  /** Everything below cascades from the workspace row; say so before, not after. */
  contentCount: number;
  storedMediaCount: number;
  hasProfile: boolean;
}

export function DeleteWorkspaceButton({
  action,
  workspaceName,
  contentCount,
  storedMediaCount,
  hasProfile,
}: DeleteWorkspaceButtonProps) {
  if (storedMediaCount > 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button type="button" variant="danger" className="w-full" disabled>
          Delete workspace
        </Button>
        <p className="text-[13px] text-ink-faint">
          Remove stored media from {storedMediaCount}{' '}
          {storedMediaCount === 1 ? 'content item' : 'content items'} before deleting this
          workspace.
        </p>
      </div>
    );
  }

  // "All of its content goes with it" was true but incomplete: captions and the
  // AI profile cascade too. An owner deciding whether to delete should see the
  // real extent, not a euphemism.
  const parts: string[] = [];

  if (contentCount > 0) {
    const plural = contentCount !== 1;
    parts.push(`${contentCount} content item${plural ? 's' : ''}`);
    parts.push(`every caption written for ${plural ? 'them' : 'it'}`);
  }

  if (hasProfile) {
    parts.push('the AI profile');
  }

  const consequence =
    parts.length === 0
      ? 'This cannot be undone.'
      : `This also deletes ${listPhrase(parts)}. This cannot be undone.`;

  return (
    <ConfirmDelete
      action={action}
      label="Delete workspace"
      subject={workspaceName}
      consequence={consequence}
    />
  );
}

/** "a", "a and b", "a, b and c" — no trailing comma before "and". */
function listPhrase(parts: string[]): string {
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
