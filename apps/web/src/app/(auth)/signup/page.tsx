import { PASSWORD_MIN_LENGTH } from '@ai-content/shared/auth';
import type { Metadata } from 'next';

import { signUp } from '@/app/(auth)/actions';
import { CredentialForm } from '@/app/(auth)/credential-form';

export const metadata: Metadata = {
  title: 'Create account — AI Content',
};

export default function SignupPage() {
  return (
    <CredentialForm
      action={signUp}
      title="Create account"
      submitLabel="Create account"
      pendingLabel="Creating account…"
      passwordHint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
      footer={{ prompt: 'Already have an account?', linkLabel: 'Sign in', href: '/login' }}
    />
  );
}
