'use client';

import { PASSWORD_MIN_LENGTH } from '@ai-content/shared/auth';
import Link from 'next/link';
import { useActionState } from 'react';

import type { AuthFormState } from '@/app/(auth)/actions';

/**
 * Shared credential form for login and signup.
 *
 * One component rather than two near-identical ones: the pages differ only in
 * their action, labels, and footer link.
 */
interface CredentialFormProps {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  title: string;
  submitLabel: string;
  pendingLabel: string;
  /** Signup needs a "new password" hint; login must not show password rules. */
  passwordHint?: string;
  footer: { prompt: string; linkLabel: string; href: string };
}

export function CredentialForm({
  action,
  title,
  submitLabel,
  pendingLabel,
  passwordHint,
  footer,
}: CredentialFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {/* role="alert" so a screen reader announces the failure without a focus change. */}
        {state.error ? (
          <p role="alert" className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-200">
            {state.error}
          </p>
        ) : null}

        {state.notice ? (
          <p role="status" className="rounded-md bg-emerald-950 px-3 py-2 text-sm text-emerald-200">
            {state.notice}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={state.fieldErrors?.email ? 'email-error' : undefined}
            aria-invalid={state.fieldErrors?.email ? true : undefined}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base outline-none focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400"
          />
          {state.fieldErrors?.email ? (
            <p id="email-error" className="text-sm text-red-300">
              {state.fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            // "new-password" tells a password manager to offer generation on
            // signup; "current-password" tells it to autofill on login.
            autoComplete={passwordHint ? 'new-password' : 'current-password'}
            required
            minLength={passwordHint ? PASSWORD_MIN_LENGTH : undefined}
            aria-describedby={
              state.fieldErrors?.password
                ? 'password-error'
                : passwordHint
                  ? 'password-hint'
                  : undefined
            }
            aria-invalid={state.fieldErrors?.password ? true : undefined}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base outline-none focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400"
          />
          {state.fieldErrors?.password ? (
            <p id="password-error" className="text-sm text-red-300">
              {state.fieldErrors.password}
            </p>
          ) : passwordHint ? (
            <p id="password-hint" className="text-sm text-slate-400">
              {passwordHint}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-60"
        >
          {isPending ? pendingLabel : submitLabel}
        </button>
      </form>

      <p className="text-sm text-slate-400">
        {footer.prompt}{' '}
        <Link href={footer.href} className="underline underline-offset-4 hover:text-slate-200">
          {footer.linkLabel}
        </Link>
      </p>
    </main>
  );
}
