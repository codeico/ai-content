import { describe, expect, it } from 'vitest';

import {
  buildCaptionMessages,
  CAPTION_PROMPT_VERSION,
  describeProfile,
} from '../apps/web/src/server/ai/caption-prompt.ts';

const FULL_PROFILE = {
  niche: 'Home cooking for beginners',
  description: 'Short vertical recipe videos.',
  target_audience: 'People short on time.',
  tone: 'Warm and direct',
  writing_style: 'Short sentences, no emoji.',
  content_goals: 'Grow saves.',
  restrictions: 'No nutrition claims.',
};

const EMPTY_PROFILE = {
  niche: null,
  description: null,
  target_audience: null,
  tone: null,
  writing_style: null,
  content_goals: null,
  restrictions: null,
};

const CONTENT = {
  title: 'Five-minute breakfast idea',
  source_type: 'tiktok',
  source_url: 'https://www.tiktok.com/@x/video/1',
};

describe('buildCaptionMessages', () => {
  it('produces exactly one system and one user message, in that order', () => {
    const messages = buildCaptionMessages({ profile: FULL_PROFILE, content: CONTENT });

    expect(messages.map((m) => m.role)).toEqual(['system', 'user']);
  });

  it('puts every filled profile field into the system message', () => {
    const [system] = buildCaptionMessages({ profile: FULL_PROFILE, content: CONTENT });

    for (const value of Object.values(FULL_PROFILE)) {
      expect(system!.content).toContain(value);
    }
  });

  it('puts the content title and source into the user message, not the system message', () => {
    const [system, user] = buildCaptionMessages({ profile: FULL_PROFILE, content: CONTENT });

    expect(user!.content).toContain(CONTENT.title);
    expect(user!.content).toContain(CONTENT.source_url);
    expect(system!.content).not.toContain(CONTENT.title);
  });

  it('omits unset profile fields instead of inventing defaults', () => {
    const partial = { ...EMPTY_PROFILE, tone: 'Dry' };
    const [system] = buildCaptionMessages({ profile: partial, content: CONTENT });

    expect(system!.content).toContain('Tone: Dry');
    expect(system!.content).not.toContain('Niche:');
    expect(system!.content).not.toContain('Audience:');
    expect(system!.content).not.toContain('null');
  });

  it('says so explicitly when there is no profile at all', () => {
    const [withNull] = buildCaptionMessages({ profile: null, content: CONTENT });
    const [withEmpty] = buildCaptionMessages({ profile: EMPTY_PROFILE, content: CONTENT });

    expect(withNull!.content).toContain('none provided');
    // An all-null row and a missing row are the same situation to the model.
    expect(withEmpty!.content).toBe(withNull!.content);
  });

  it('omits the source link line when there is none', () => {
    const [, user] = buildCaptionMessages({
      profile: FULL_PROFILE,
      content: { ...CONTENT, source_url: null },
    });

    expect(user!.content).not.toContain('Source link');
    expect(user!.content).toContain('Source type: tiktok');
  });

  it('asks for plain text and forbids structured output', () => {
    const [system] = buildCaptionMessages({ profile: FULL_PROFILE, content: CONTENT });

    expect(system!.content).toMatch(/no JSON/i);
    expect(system!.content).toMatch(/no markdown/i);
  });

  it('is deterministic', () => {
    const a = buildCaptionMessages({ profile: FULL_PROFILE, content: CONTENT });
    const b = buildCaptionMessages({ profile: FULL_PROFILE, content: CONTENT });

    expect(a).toEqual(b);
  });

  it('names no model: the caller decides that', () => {
    const messages = buildCaptionMessages({ profile: FULL_PROFILE, content: CONTENT });
    const text = messages.map((m) => m.content).join('\n');

    expect(text).not.toMatch(/gpt|claude|llama|gemini|model/i);
  });

  it('keeps a profile with restrictions from being silently dropped', () => {
    // The restrictions field is the one whose loss is most harmful: a caption
    // that violates "never do this" is worse than a generic one.
    const [system] = buildCaptionMessages({
      profile: { ...EMPTY_PROFILE, restrictions: 'No brand names' },
      content: CONTENT,
    });

    expect(system!.content).toContain('Never do this: No brand names');
  });
});

describe('describeProfile', () => {
  it('returns null for a missing or fully empty profile', () => {
    expect(describeProfile(null)).toBeNull();
    expect(describeProfile(EMPTY_PROFILE)).toBeNull();
  });

  it('renders one line per filled field in a fixed order', () => {
    const text = describeProfile({ ...EMPTY_PROFILE, tone: 'Dry', niche: 'Tools' });

    expect(text).toBe('Niche: Tools\nTone: Dry');
  });
});

describe('CAPTION_PROMPT_VERSION', () => {
  it('is a stable non-empty identifier', () => {
    expect(CAPTION_PROMPT_VERSION).toMatch(/^caption-v\d+$/);
  });
});
