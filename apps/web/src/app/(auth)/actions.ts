'use server';

import { validateCredentials, type CredentialFieldErrors } from '@ai-content/shared/auth';
import { redirect } from 'next/navigation';

import { createServerClient } from '@/lib/supabase/server';

/**
 * Authentication Server Actions.
 *
 * Passwords exist only as a local variable passed straight to Supabase Auth.
 * They are never logged, returned, persisted, or included in an error.
 */

export interface AuthFormState {
  /** Message shown above the form. */
  error?: string;
  /** Per-field validation messages. */
  fieldErrors?: CredentialFieldErrors;
  /** Non-error outcome, e.g. awaiting email confirmation. */
  notice?: string;
}

/**
 * Reads credentials from submitted form data.
 *
 * Server-side validation is the real check. The browser's `required` and
 * `type="email"` attributes are a convenience and are not trusted here.
 */
function readCredentials(formData: FormData) {
  return validateCredentials({
    email: formData.get('email'),
    password: formData.get('password'),
  });
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = readCredentials(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately generic: the raw provider message can distinguish "already
    // registered" from other failures, which leaks whether an address has an
    // account here.
    return { error: 'Unable to create account. Please check your details and try again.' };
  }

  // Signup does not always produce a session. When the project requires email
  // confirmation, Supabase returns a user with no session, so redirecting to the
  // protected area would bounce straight back to login.
  if (!data.session) {
    return { notice: 'Check your email to confirm your account, then sign in.' };
  }

  redirect('/app');
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = readCredentials(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // One message for both "no such user" and "wrong password", so the form
    // cannot be used to enumerate registered addresses.
    return { error: 'Invalid email or password.' };
  }

  redirect('/app');
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();

  // Clears the session server-side and expires the auth cookies. Any error here
  // is not surfaced: the user is being sent to a public page regardless.
  await supabase.auth.signOut();

  redirect('/login');
}
