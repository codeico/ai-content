import { describe, expect, it } from 'vitest';

import {
  PASSWORD_MIN_LENGTH,
  validateCredentials,
} from '../packages/shared/src/auth/credentials.ts';

const valid = { email: 'user@example.com', password: 'correct-horse' };

describe('validateCredentials', () => {
  it('accepts a well-formed email and password', () => {
    const result = validateCredentials(valid);

    expect(result).toEqual({ success: true, data: valid });
  });

  it('trims surrounding whitespace from the email', () => {
    const result = validateCredentials({ ...valid, email: '  user@example.com  ' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.email).toBe('user@example.com');
  });

  it('rejects a malformed email', () => {
    const result = validateCredentials({ ...valid, email: 'not-an-email' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.email).toBeDefined();
  });

  it('rejects a missing email', () => {
    const result = validateCredentials({ password: valid.password });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.email).toBeDefined();
  });

  it('rejects a password shorter than the minimum', () => {
    const result = validateCredentials({ ...valid, password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1) });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.password).toContain(String(PASSWORD_MIN_LENGTH));
  });

  it('accepts a password exactly at the minimum length', () => {
    // Boundary: an off-by-one here would lock out otherwise valid passwords.
    const result = validateCredentials({ ...valid, password: 'a'.repeat(PASSWORD_MIN_LENGTH) });

    expect(result.success).toBe(true);
  });

  it('does not silently trim the password', () => {
    // Trimming would alter the user's actual secret and cause a confusing
    // "invalid credentials" on a later sign-in attempt.
    const padded = `  ${'x'.repeat(PASSWORD_MIN_LENGTH)}  `;
    const result = validateCredentials({ ...valid, password: padded });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.password).toBe(padded);
  });

  it('reports both fields when both are invalid', () => {
    const result = validateCredentials({ email: 'bad', password: 'short' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.email).toBeDefined();
    expect(result.fieldErrors.password).toBeDefined();
  });

  it('never echoes the submitted password in an error message', () => {
    const result = validateCredentials({ email: 'bad', password: 'hunter2' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(JSON.stringify(result.fieldErrors)).not.toContain('hunter2');
  });

  it('rejects non-string input instead of coercing it', () => {
    // FormData.get() returns null for a missing field and File for an upload;
    // neither may be treated as a credential.
    expect(validateCredentials({ email: null, password: null }).success).toBe(false);
    expect(validateCredentials({ email: 123, password: 456 }).success).toBe(false);
  });
});
