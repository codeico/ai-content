'use client';

interface DeleteContentButtonProps {
  action: () => Promise<void>;
  title: string;
}

/** Native confirm, same as DeleteWorkspaceButton; authorization is server-side. */
export function DeleteContentButton({ action, title }: DeleteContentButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-900 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-950"
      >
        Delete content
      </button>
    </form>
  );
}
