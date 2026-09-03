import type { AIChatMessage } from '@ai-content/ai';
import type { WorkspaceProfileInput } from '@ai-content/shared/workspace/profile';

/**
 * Caption prompt construction.
 *
 * Lives above `@ai-content/ai` on purpose (docs/AI_ARCHITECTURE.md, "Where
 * prompt construction belongs"): the router knows the wire format and nothing
 * about workspaces. This module knows workspaces and produces plain messages.
 *
 * The prompt is assembled from stored configuration — the workspace profile —
 * never from hardcoded editorial text (MASTER_PRODUCT_SPEC §17). Fields the
 * owner has not filled in are omitted rather than replaced with invented
 * defaults, so an empty profile yields an honest, generic caption instead of
 * one that pretends to know the account.
 */

/**
 * Bump when the wording or structure of the prompt changes in a way that could
 * change output. Stored on every caption row so two versions can be compared
 * and a regression traced to the prompt that produced it (CODING_RULES §25).
 */
export const CAPTION_PROMPT_VERSION = 'caption-v1';

/** The subset of a content row the prompt reads. Kept narrow so tests need no full row. */
export interface CaptionContentInput {
  title: string;
  source_type: string;
  source_url: string | null;
}

export interface CaptionPromptInput {
  profile: WorkspaceProfileInput | null;
  content: CaptionContentInput;
}

/** Profile fields in the order they are presented to the model, with their labels. */
const PROFILE_LINES: readonly [keyof WorkspaceProfileInput, string][] = [
  ['niche', 'Niche'],
  ['description', 'About the account'],
  ['target_audience', 'Audience'],
  ['tone', 'Tone'],
  ['writing_style', 'Writing style'],
  ['content_goals', 'Goals'],
  ['restrictions', 'Never do this'],
];

const SYSTEM_BASE = [
  'You write Instagram captions for one specific account.',
  'Reply with the caption text only: no preamble, no quotation marks, no labels, no markdown, no JSON.',
  'Write in the language the account brief uses. If the brief is empty, write in the language of the content title.',
  'Do not invent facts about the video that the brief and title do not support.',
].join(' ');

/**
 * Builds the system + user messages for one caption.
 *
 * Deterministic: same input, same messages. No date, no randomness, nothing
 * read from the environment. The model name is deliberately absent — the
 * caller supplies it to the provider (docs/AI_ARCHITECTURE.md "Model handling").
 */
export function buildCaptionMessages(input: CaptionPromptInput): AIChatMessage[] {
  const brief = describeProfile(input.profile);

  const system = brief
    ? `${SYSTEM_BASE}\n\nAccount brief:\n${brief}`
    : `${SYSTEM_BASE}\n\nAccount brief: none provided. Keep the caption neutral and short.`;

  const contentLines = [
    `Title: ${input.content.title}`,
    `Source type: ${input.content.source_type}`,
  ];

  if (input.content.source_url) {
    contentLines.push(`Source link: ${input.content.source_url}`);
  }

  const user = `Write one caption for this content.\n\n${contentLines.join('\n')}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** One "Label: value" line per filled field; null when nothing is filled. */
export function describeProfile(profile: WorkspaceProfileInput | null): string | null {
  if (!profile) {
    return null;
  }

  const lines = PROFILE_LINES.flatMap(([field, label]) => {
    const value = profile[field];
    return value ? [`${label}: ${value}`] : [];
  });

  return lines.length > 0 ? lines.join('\n') : null;
}
