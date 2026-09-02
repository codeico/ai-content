import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-5">
      <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Page not found</h1>
      <p className="text-[15px] text-ink-soft">
        This page does not exist or you do not have access to it.
      </p>
      <ButtonLink href="/app" variant="secondary" className="self-start">
        Back to workspaces
      </ButtonLink>
    </main>
  );
}
