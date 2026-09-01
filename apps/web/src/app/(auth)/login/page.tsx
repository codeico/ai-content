import type { Metadata } from 'next';

import { signIn } from '@/app/(auth)/actions';
import { CredentialForm } from '@/app/(auth)/credential-form';

export const metadata: Metadata = {
  title: 'Sign in — AI Content',
};

export default function LoginPage() {
  return (
    <CredentialForm
      action={signIn}
      title="Sign in"
      submitLabel="Sign in"
      pendingLabel="Signing in…"
      footer={{ prompt: 'No account?', linkLabel: 'Create one', href: '/signup' }}
    />
  );
}
