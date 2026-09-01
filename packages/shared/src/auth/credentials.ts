/**
 * Credential validation.
 *
 * Shared so the same rules run in the browser (fast feedback) and in the Server
 * Action (the boundary that actually matters). Browser validation is a
 * convenience; the server never trusts it.
 */
import { z } from 'zod';

/**
 * Minimum password length.
 *
 * Matches Supabase Auth's own default. Keeping them equal means a password this
 * schema accepts is not then rejected by the provider with a less helpful message.
 */
export const PASSWORD_MIN_LENGTH = 8;

export const credentialsSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  password: z
    .string()
    .min(1, 'Password is required.')
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
});

export type Credentials = z.infer<typeof credentialsSchema>;

/** Field-level messages, keyed by field name. */
export type CredentialFieldErrors = Partial<Record<keyof Credentials, string>>;

/**
 * Validates raw form input.
 *
 * Takes `unknown` because the input is untrusted `FormData` — the caller has no
 * type guarantee to hand over.
 *
 * Returns a result rather than throwing: invalid credentials are an expected
 * outcome of a form submission, not an exceptional condition.
 */
export function validateCredentials(
  input: unknown,
): { success: true; data: Credentials } | { success: false; fieldErrors: CredentialFieldErrors } {
  const result = credentialsSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const fieldErrors: CredentialFieldErrors = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0];

    // First message per field only: showing every failed rule at once is noise.
    if ((field === 'email' || field === 'password') && fieldErrors[field] === undefined) {
      fieldErrors[field] = issue.message;
    }
  }

  return { success: false, fieldErrors };
}
