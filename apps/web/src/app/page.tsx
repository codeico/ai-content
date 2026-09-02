import { ButtonLink } from '@/components/ui';

/**
 * Public front door. Stays unauthenticated and renders with no Supabase
 * configured. One message, two actions, nothing to scroll.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
      <p className="font-semibold tracking-[-0.01em]">AI Content</p>

      <div className="flex flex-1 flex-col justify-center gap-8 py-16 md:grid md:grid-cols-12 md:items-end md:gap-6">
        <div className="md:col-span-7">
          <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.02em] sm:text-[44px] md:text-[52px]">
            One place for every niche you post about.
          </h1>
          <p className="mt-5 max-w-[42ch] text-[17px] text-ink-soft">
            Keep each brand or topic in its own workspace and move content from draft to ready
            without mixing them up.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row md:col-span-4 md:col-start-9 md:flex-col md:items-stretch">
          <ButtonLink href="/signup">Create account</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Sign in
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
