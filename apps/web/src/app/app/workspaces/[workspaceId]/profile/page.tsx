import {
  canManageWorkspace,
  workspaceIdSchema,
  type WorkspaceRole,
} from '@ai-content/shared/workspace';
import {
  isWorkspaceProfileEmpty,
  WORKSPACE_PROFILE_FIELDS,
  type WorkspaceProfileInput,
} from '@ai-content/shared/workspace/profile';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { updateWorkspaceProfile } from '@/app/app/workspace-actions';
import { EditProfileForm } from '@/app/app/workspaces/[workspaceId]/profile/edit-profile-form';
import { EmptyState, PageHeader } from '@/components/ui';
import { getProfileForWorkspace } from '@/server/repositories/workspace-profile-repository';
import { getWorkspaceForUser } from '@/server/repositories/workspace-repository';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

interface WorkspaceProfilePageProps {
  params: Promise<{ workspaceId: string }>;
}

export const metadata: Metadata = { title: 'Profile' };

const EMPTY_PROFILE: WorkspaceProfileInput = {
  niche: null,
  description: null,
  target_audience: null,
  tone: null,
  writing_style: null,
  content_goals: null,
  restrictions: null,
};

/** Same labels as the form, so the read-only view and the editor agree. */
const FIELD_LABEL: Record<keyof WorkspaceProfileInput, string> = {
  niche: 'Niche',
  description: 'Description',
  target_audience: 'Target audience',
  tone: 'Tone',
  writing_style: 'Writing style',
  content_goals: 'Content goals',
  restrictions: 'Restrictions',
};

/**
 * Workspace AI profile: the owner edits it, members read it. Single column;
 * the form is the page. Nothing reads the profile for generation yet.
 */
export default async function WorkspaceProfilePage({ params }: WorkspaceProfilePageProps) {
  const { workspaceId } = await params;

  // A route param is untrusted input. A malformed id (not a UUID) cannot be a
  // real workspace, so reject it before it ever reaches a database query.
  const idResult = workspaceIdSchema.safeParse(workspaceId);

  if (!idResult.success) {
    notFound();
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createServerClient();

  // Both reads are independently scoped by RLS — workspace_profiles has its
  // own membership predicate — so they overlap instead of costing two round
  // trips in series (~120ms each against the remote database).
  const [workspace, profile] = await Promise.all([
    getWorkspaceForUser(supabase, idResult.data, user.id),
    getProfileForWorkspace(supabase, idResult.data),
  ]);

  // null for both "missing" and "not a member": a 404 never confirms existence.
  // Still decided before anything renders; the profile is discarded unread
  // when the workspace is not visible.
  if (!workspace) {
    notFound();
  }

  // The membership column is `text` in the database; anything other than
  // 'owner' degrades to the least privileged role rather than widening access.
  const role: WorkspaceRole = workspace.role === 'owner' ? 'owner' : 'member';
  const canManage = canManageWorkspace(role);
  const boundUpdateProfile = updateWorkspaceProfile.bind(null, workspace.id);

  const setFields = profile
    ? WORKSPACE_PROFILE_FIELDS.filter((field) => profile[field] !== null)
    : [];

  return (
    <div className="rise max-w-[640px]">
      <PageHeader
        eyebrow={
          <Link href={`/app/workspaces/${workspace.id}`} className="hover:text-ink">
            {workspace.name}
          </Link>
        }
        title="Profile"
        meta={role === 'owner' ? 'Owner' : 'Member'}
      />

      <p className="mb-8 text-[15px] text-ink-soft">
        What this workspace is about and how it should sound. Later AI features read this instead of
        guessing.
      </p>

      {canManage ? (
        <EditProfileForm action={boundUpdateProfile} current={profile ?? EMPTY_PROFILE} />
      ) : !profile || isWorkspaceProfileEmpty(profile) ? (
        <EmptyState
          title="No profile yet"
          body="The owner has not described this workspace yet. AI features will use this once it is filled in."
        />
      ) : (
        <dl className="border-t border-line">
          {setFields.map((field) => (
            <div key={field} className="border-b border-line py-4">
              <dt className="text-[13px] font-medium text-ink-soft">{FIELD_LABEL[field]}</dt>
              <dd className="mt-1 text-[15px] whitespace-pre-line break-words">{profile[field]}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
