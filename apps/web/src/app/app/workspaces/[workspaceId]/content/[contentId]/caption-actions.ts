'use server';

import { AIError, createAIProvider, type AIProvider } from '@ai-content/ai';
import { CAPTION_BODY_MAX_LENGTH } from '@ai-content/shared/content/caption';
import { loadFutureProviderEnv } from '@ai-content/shared/env';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';

import { buildCaptionMessages, CAPTION_PROMPT_VERSION } from '@/server/ai/caption-prompt';
import {
  CaptionRepositoryError,
  insertNextCaptionVersion,
  isUniqueViolation,
  selectCaptionAsActive,
} from '@/server/repositories/caption-repository';
import { getContentInWorkspace } from '@/server/repositories/content-repository';
import { getProfileForWorkspace } from '@/server/repositories/workspace-profile-repository';
import { getWorkspaceForUser } from '@/server/repositories/workspace-repository';

import { createServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

/**
 * Caption Server Actions. Same gate as content-actions.ts: session re-read
 * server-side, ids arrive via `.bind` (not form input), membership checked via
 * getWorkspaceForUser before any write, RLS underneath with the caller's own
 * client. Captions follow content access (any member), not the owner-only
 * profile — the profile is READ here as prompt input, which members may do.
 *
 * The model call is synchronous inside the action. IMPLEMENTATION_ROADMAP
 * Phase 4 sanctions this ("AI dipanggil manual pada phase ini"); the bound is
 * one caption per click, a short timeout, and a capped output. This is the
 * known migration point to a job when Phase 5 lands — not a surprise.
 */

export interface CaptionActionState {
  error?: string;
  /** True when the failure is configuration, so the UI can say so instead of "try again". */
  notConfigured?: boolean;
}

const NO_ACCESS = 'You do not have access to this workspace.';

/** One caption, no retries beyond the provider's single retry, under §7.4's budget. */
const CAPTION_TIMEOUT_MS = 15_000;
const CAPTION_MAX_OUTPUT_TOKENS = 400;
const CAPTION_TEMPERATURE = 0.8;

/**
 * Maps an AIError to what the user should read. Never the raw message: the
 * provider's messages are already sanitised, but "what happened" belongs to
 * the product, not the transport.
 */
function describeAIError(error: AIError): CaptionActionState {
  switch (error.code) {
    case 'not_configured':
      return {
        notConfigured: true,
        error: 'AI is not configured for this deployment.',
      };
    case 'authentication':
      return {
        error: 'The AI Router rejected the credentials. Check the deployment configuration.',
      };
    case 'rate_limited':
      return { error: 'The AI Router is busy. Wait a moment and try again.' };
    case 'timeout':
      return { error: 'The AI Router took too long. Try again.' };
    case 'network':
      return { error: 'Could not reach the AI Router. Try again.' };
    case 'malformed_response':
      return { error: 'The AI Router returned something unexpected. Try again.' };
    case 'bad_request':
    case 'upstream_error':
      return { error: 'The AI Router could not complete the request. Try again.' };
  }
}

/**
 * Resolved once per action call, never at module load, so pages render with AI
 * unconfigured. Tests replace this via `generateCaptionWith`. One attempt plus
 * one retry at 15s each stays inside a ≤30s worst case per §7.4's tolerance
 * for a manual, single-item call.
 */
function defaultProvider(): { provider: AIProvider; model: string } {
  const { AI_ROUTER_MODEL: model } = loadFutureProviderEnv(process.env);
  const provider = createAIProvider(process.env, { timeoutMs: CAPTION_TIMEOUT_MS, maxRetries: 1 });

  if (!model) {
    throw new AIError('not_configured', 'AI Router is not configured: missing AI_ROUTER_MODEL.');
  }

  return { provider, model };
}

export type ProviderFactory = () => { provider: AIProvider; model: string };

export async function generateCaption(
  workspaceId: string,
  contentId: string,
  _prevState: CaptionActionState,
  _formData: FormData,
): Promise<CaptionActionState> {
  return generateCaptionWith(defaultProvider, workspaceId, contentId);
}

/**
 * The action body, with the provider factory as a parameter so a test can run
 * the real gate (session → membership → content → profile → prompt → chat →
 * insert → refresh) against a fake model. Not exported as a Server Action
 * itself — only the bound `generateCaption` is reachable from the client.
 */
export async function generateCaptionWith(
  resolveProvider: ProviderFactory,
  workspaceId: string,
  contentId: string,
): Promise<CaptionActionState> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  try {
    const supabase = await createServerClient();

    if (!(await getWorkspaceForUser(supabase, workspaceId, user.id))) {
      return { error: NO_ACCESS };
    }

    const [content, profile] = await Promise.all([
      getContentInWorkspace(supabase, workspaceId, contentId),
      getProfileForWorkspace(supabase, workspaceId),
    ]);

    if (!content) {
      return { error: 'Content not found.' };
    }

    // Configuration is checked AFTER authorization so an outsider learns
    // nothing about this deployment's AI setup, and BEFORE the prompt is
    // built so an unconfigured deployment does no work it will throw away.
    const { provider, model } = resolveProvider();

    const messages = buildCaptionMessages({
      content: {
        title: content.title,
        source_type: content.source_type,
        source_url: content.source_url,
      },
      profile,
    });

    const response = await provider.chat({
      model,
      messages,
      temperature: CAPTION_TEMPERATURE,
      maxOutputTokens: CAPTION_MAX_OUTPUT_TOKENS,
    });

    const body = response.text.trim().slice(0, CAPTION_BODY_MAX_LENGTH);

    if (body.length === 0) {
      return { error: 'The AI Router returned an empty caption. Try again.' };
    }

    const caption = {
      body,
      model_name: response.model,
      prompt_version: CAPTION_PROMPT_VERSION,
      created_by: user.id,
    };

    try {
      await insertNextCaptionVersion(supabase, workspaceId, contentId, caption);
    } catch (error) {
      // Two generates raced for the same version number. The model output is
      // good; only the version was taken. One retry re-reads MAX and inserts.
      if (error instanceof CaptionRepositoryError && isUniqueViolation(error.cause)) {
        await insertNextCaptionVersion(supabase, workspaceId, contentId, caption);
      } else {
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof AIError) {
      return describeAIError(error);
    }

    if (error instanceof CaptionRepositoryError) {
      return { error: 'The caption was generated but could not be saved. Try again.' };
    }

    throw error;
  }

  refresh();

  return {};
}

export async function selectCaption(
  workspaceId: string,
  contentId: string,
  captionId: string,
  _prevState: CaptionActionState,
  _formData: FormData,
): Promise<CaptionActionState> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  let selected;

  try {
    const supabase = await createServerClient();

    if (!(await getWorkspaceForUser(supabase, workspaceId, user.id))) {
      return { error: NO_ACCESS };
    }

    selected = await selectCaptionAsActive(supabase, workspaceId, contentId, captionId);
  } catch (error) {
    if (error instanceof CaptionRepositoryError) {
      return { error: 'Unable to select the caption. Please try again.' };
    }

    throw error;
  }

  if (!selected) {
    return { error: 'Caption not found.' };
  }

  refresh();

  return {};
}
