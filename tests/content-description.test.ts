import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { CONTENT_DESCRIPTION_MAX_LENGTH, validateUpdateContent } from '@ai-content/shared/content';
import { describe, expect, it } from 'vitest';

import { buildCaptionMessages } from '../apps/web/src/server/ai/caption-prompt.ts';

/**
 * The caption prompt could previously see only title, source_type and
 * source_url, while its system prompt forbids inventing facts about the video.
 * Every caption was therefore structurally generic. description is the input
 * only the app can supply, so these pin that it reaches the model, lands in
 * the right message, and stays bounded.
 */
const BASE = { title: 'Garlic noodles', source_type: 'manual', source_url: null };

describe('description reaches the caption prompt', () => {
  it('appears in the user message, never the system message', () => {
    const messages = buildCaptionMessages({
      profile: null,
      content: { ...BASE, description: 'A wok, four cloves of garlic, and no talking.' },
    });

    const system = messages.find((m) => m.role === 'system')!.content;
    const user = messages.find((m) => m.role === 'user')!.content;

    expect(user).toContain('A wok, four cloves of garlic');
    // The system message is the account's standing brief; per-item text must
    // not be able to pose as it.
    expect(system).not.toContain('A wok');
  });

  it('is omitted entirely when the content is not described', () => {
    const user = buildCaptionMessages({
      profile: null,
      content: { ...BASE, description: null },
    }).find((m) => m.role === 'user')!.content;

    expect(user).not.toContain('What it is about');
  });

  it('does not leak into a prompt built for different content', () => {
    const first = buildCaptionMessages({
      profile: null,
      content: { ...BASE, description: 'first item secret' },
    });
    const second = buildCaptionMessages({
      profile: null,
      content: { ...BASE, description: null },
    });

    expect(second.map((m) => m.content).join('\n')).not.toContain('first item secret');
    expect(first.map((m) => m.content).join('\n')).toContain('first item secret');
  });
});

describe('description validation and storage agree', () => {
  it('treats blank as not described rather than an empty string', () => {
    const parsed = validateUpdateContent({ title: 'x', status: 'draft', description: '   ' });
    expect(parsed.success && parsed.data.description).toBeNull();
  });

  it('accepts a description at the limit and rejects one past it', () => {
    const atLimit = 'x'.repeat(CONTENT_DESCRIPTION_MAX_LENGTH);
    expect(
      validateUpdateContent({ title: 'x', status: 'draft', description: atLimit }).success,
    ).toBe(true);

    const tooLong = 'x'.repeat(CONTENT_DESCRIPTION_MAX_LENGTH + 1);
    const rejected = validateUpdateContent({ title: 'x', status: 'draft', description: tooLong });
    expect(rejected.success).toBe(false);
  });

  it('the database CHECK mirrors the shared constant', () => {
    const file = readdirSync(join(process.cwd(), 'supabase/migrations')).find((f) =>
      f.includes('add_content_description'),
    )!;
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations', file), 'utf8');

    expect(sql).toContain(String(CONTENT_DESCRIPTION_MAX_LENGTH));
    // Nullable, so undescribed content needs no backfill.
    expect(sql).toMatch(/description is null or char_length/i);
  });
});
