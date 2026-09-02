'use client';

interface DeleteWorkspaceButtonProps {
  action: () => Promise<void>;
  workspaceName: string;
}

/**
 * Delete button with a native confirmation prompt.
 *
 * `window.confirm` is enough for Phase 2's "keep it simple" mandate
 * (docs/PHASE_2_PROMPT.md §20); a custom dialog is a UI polish item, not a
 * security control — the actual authorization happens server-side in the
 * bound `deleteWorkspace` action regardless of what this button does.
 */
export function DeleteWorkspaceButton({ action, workspaceName }: DeleteWorkspaceButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Delete "${workspaceName}"? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-900 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-950"
      >
        Delete workspace
      </button>
    </form>
  );
}
