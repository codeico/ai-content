'use client';

import { PASSWORD_MIN_LENGTH } from '@ai-content/shared/auth';
import Link from 'next/link';
import { useActionState } from 'react';

import type { AuthFormState } from '@/app/(auth)/actions';
import { Button, Field, Input, Notice } from '@/components/ui';

/**
 * Shared credential form for login and signup.
 *
 * One component rather than two near-identical ones: the pages differ only in
 * their action, labels, and footer link.
 */
interface CredentialFormProps {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  title: string;
  lede: string;
  submitLabel: string;
  pendingLabel: string;
  /** Signup needs a "new password" hint; login must not show password rules. */
  passwordHint?: string;
  footer: { prompt: string; linkLabel: string; href: string };
}

export function CredentialForm({
  action,
  title,
  lede,
  submitLabel,
  pendingLabel,
  passwordHint,
  footer,
}: CredentialFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <div className="rise flex flex-col gap-8">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
        <p className="mt-2 text-[15px] text-ink-soft">{lede}</p>
      </div>

      <form action={formAction} className="flex flex-col gap-5" noValidate>
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        {state.notice ? <Notice tone="success">{state.notice}</Notice> : null}

        <Field id="email" label="Email" error={state.fieldErrors?.email}>
          {(a11y) => (
            <Input
              {...a11y}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              required
            />
          )}
        </Field>

        <Field
          id="password"
          label="Password"
          error={state.fieldErrors?.password}
          hint={passwordHint}
        >
          {(a11y) => (
            <Input
              {...a11y}
              name="password"
              type="password"
              // "new-password" tells a password manager to offer generation on
              // signup; "current-password" tells it to autofill on login.
              autoComplete={passwordHint ? 'new-password' : 'current-password'}
              minLength={passwordHint ? PASSWORD_MIN_LENGTH : undefined}
              enterKeyHint="go"
              required
            />
          )}
        </Field>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </form>

      <p className="text-[14px] text-ink-soft">
        {footer.prompt}{' '}
        <Link href={footer.href} className="font-medium text-ink underline underline-offset-4">
          {footer.linkLabel}
        </Link>
      </p>
    </div>
  );
}
