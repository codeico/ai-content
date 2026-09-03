import { describe, expect, it } from 'vitest';

import {
  PROFILE_LONG_MAX_LENGTH,
  PROFILE_SHORT_MAX_LENGTH,
  WORKSPACE_PROFILE_FIELDS,
  isWorkspaceProfileEmpty,
  validateWorkspaceProfile,
} from '../packages/shared/src/workspace/profile.ts';

const EMPTY = {
  niche: null,
  description: null,
  target_audience: null,
  tone: null,
  writing_style: null,
  content_goals: null,
  restrictions: null,
};

describe('validateWorkspaceProfile', () => {
  it('accepts an entirely empty submission as an all-null profile', () => {
    const result = validateWorkspaceProfile({});
    expect(result).toEqual({ success: true, data: EMPTY });
  });

  it('treats blank and whitespace-only strings as not set', () => {
    const result = validateWorkspaceProfile({ niche: '', tone: '   ', restrictions: '\n\t' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.niche).toBeNull();
      expect(result.data.tone).toBeNull();
      expect(result.data.restrictions).toBeNull();
    }
  });

  it('trims surrounding whitespace on present values', () => {
    const result = validateWorkspaceProfile({ niche: '  home cooking  ' });
    expect(result.success && result.data.niche).toBe('home cooking');
  });

  it('accepts every field at its maximum length', () => {
    const result = validateWorkspaceProfile({
      niche: 'n'.repeat(PROFILE_SHORT_MAX_LENGTH),
      description: 'd'.repeat(PROFILE_LONG_MAX_LENGTH),
      target_audience: 'a'.repeat(PROFILE_LONG_MAX_LENGTH),
      tone: 't'.repeat(PROFILE_LONG_MAX_LENGTH),
      writing_style: 'w'.repeat(PROFILE_LONG_MAX_LENGTH),
      content_goals: 'g'.repeat(PROFILE_LONG_MAX_LENGTH),
      restrictions: 'r'.repeat(PROFILE_LONG_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it('rejects niche one character over the short cap with a field message', () => {
    const result = validateWorkspaceProfile({ niche: 'n'.repeat(PROFILE_SHORT_MAX_LENGTH + 1) });
    expect(result).toEqual({
      success: false,
      fieldErrors: { niche: `Niche must be at most ${PROFILE_SHORT_MAX_LENGTH} characters.` },
    });
  });

  it('rejects a long field one character over the long cap', () => {
    const result = validateWorkspaceProfile({
      restrictions: 'r'.repeat(PROFILE_LONG_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.restrictions).toMatch(/at most 1000 characters/);
      expect(Object.keys(result.fieldErrors)).toEqual(['restrictions']);
    }
  });

  it('does not count trimmed whitespace toward the cap', () => {
    const result = validateWorkspaceProfile({
      niche: `   ${'n'.repeat(PROFILE_SHORT_MAX_LENGTH)}   `,
    });
    expect(result.success).toBe(true);
  });

  it('reports one message per field and every failing field', () => {
    const result = validateWorkspaceProfile({
      niche: 'n'.repeat(PROFILE_SHORT_MAX_LENGTH + 1),
      tone: 't'.repeat(PROFILE_LONG_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(['niche', 'tone']);
    }
  });

  it('rejects non-string values instead of coercing them', () => {
    const result = validateWorkspaceProfile({ niche: 42 });
    expect(result.success).toBe(false);
  });

  it('strips unknown keys so nothing but profile fields can reach the repository', () => {
    const result = validateWorkspaceProfile({
      niche: 'x',
      workspace_id: '00000000-0000-0000-0000-000000000000',
      id: 'evil',
      owner_id: 'evil',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual([...WORKSPACE_PROFILE_FIELDS].sort());
      expect('workspace_id' in result.data).toBe(false);
    }
  });

  it('exposes the field list in form order with all seven fields', () => {
    expect(WORKSPACE_PROFILE_FIELDS).toEqual([
      'niche',
      'description',
      'target_audience',
      'tone',
      'writing_style',
      'content_goals',
      'restrictions',
    ]);
  });
});

describe('isWorkspaceProfileEmpty', () => {
  it('is true for the all-null profile', () => {
    expect(isWorkspaceProfileEmpty(EMPTY)).toBe(true);
  });

  it('is false when any single field is set', () => {
    expect(isWorkspaceProfileEmpty({ ...EMPTY, restrictions: 'no politics' })).toBe(false);
  });
});
