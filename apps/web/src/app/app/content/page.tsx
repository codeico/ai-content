import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Chevron, EmptyState, PageHeader, SOURCE_TYPE_LABEL, StatusMark } from '@/components/ui';
import { getAuthenticatedUser, createServerClient } from '@/lib/supabase/server';
import { listAllContentForUser } from '@/server/repositories/content-repository';

export const metadata: Metadata = { title: 'Content' };

export const dynamic = 'force-dynamic';

/**
 * Every content row the user can reach, newest first, across all workspaces.
 *
 * This exists because Content had no top-level entry: it was reachable only by
 * opening a workspace first, which is the wrong shape for the thing people
 * actually come here to do. The workspace name rides on each row so the list
 * stays scannable without grouping, which would fragment a short list.
 */
export default async function ContentPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createServerClient();
  const items = await listAllContentForUser(supabase);

  return (
    <div className="screen-in">
      <PageHeader
        title="Content"
        meta={
          items.length === 0
            ? 'Nothing yet'
            : `${items.length} item${items.length === 1 ? '' : 's'} / most recent first`
        }
      />

      <section aria-labelledby="all-content-heading" className="min-w-0">
        <h2 id="all-content-heading" className="sr-only">
          All content
        </h2>

        {items.length === 0 ? (
          <EmptyState
            title="Nothing in progress"
            body="Content you add in any workspace shows up here."
          />
        ) : (
          <ul className="border-t border-line">
            {items.map((item) => (
              <li key={item.id} className="border-b border-line">
                <Link
                  href={`/app/workspaces/${item.workspace_id}/content/${item.id}`}
                  className="cell -mx-2 flex items-center justify-between gap-3 rounded-control px-2 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-medium">{item.title}</span>
                    <span className="block truncate text-[13px] text-ink-faint">
                      {item.workspace_name}
                      {item.source_type !== 'other' ? (
                        <>
                          <span aria-hidden> / </span>
                          {SOURCE_TYPE_LABEL[item.source_type]}
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <StatusMark status={item.status} />
                    <Chevron />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
