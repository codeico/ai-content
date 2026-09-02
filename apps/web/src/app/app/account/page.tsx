import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { signOut } from '@/app/(auth)/actions';
import { Button, PageHeader } from '@/components/ui';

import { getAuthenticatedUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="rise">
      <PageHeader title="Account" />

      <dl className="border-t border-line">
        <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-8">
          <dt className="text-[13px] text-ink-faint sm:w-32 sm:shrink-0">Signed in as</dt>
          <dd className="text-[15px] break-all">{user.email}</dd>
        </div>
      </dl>

      <div className="mt-8 border-t border-line pt-6">
        <form action={signOut}>
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
