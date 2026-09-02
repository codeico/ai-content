import { describe, expect, it } from 'vitest';

import {
  CONTENT_TITLE_MAX_LENGTH,
  contentIdSchema,
  validateCreateContent,
  validateUpdateContent,
} from '../packages/shared/src/content/content.ts';

describe('validateCreateContent', () => {
  it('trims and accepts a valid title', () => {
    expect(validateCreateContent({ title: '  Hello  ' })).toEqual({
      success: true,
      data: { title: 'Hello' },
    });
  });

  it('rejects an empty or whitespace-only title', () => {
    for (const title of ['', '   ', undefined, null]) {
      const result = validateCreateContent({ title });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.fieldErrors.title).toBeDefined();
    }
  });

  it('rejects a title over the maximum length', () => {
    const result = validateCreateContent({ title: 'a'.repeat(CONTENT_TITLE_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
    expect(validateCreateContent({ title: 'a'.repeat(CONTENT_TITLE_MAX_LENGTH) }).success).toBe(
      true,
    );
  });
});

describe('validateUpdateContent', () => {
  it.each(['draft', 'ready', 'archived'])('accepts status %s', (status) => {
    expect(validateUpdateContent({ title: 'x', status })).toEqual({
      success: true,
      data: { title: 'x', status },
    });
  });

  it.each(['published', 'processing', 'DRAFT', '', undefined])('rejects status %s', (status) => {
    const result = validateUpdateContent({ title: 'x', status });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.status).toBeDefined();
  });

  it('reports one message per field', () => {
    const result = validateUpdateContent({ title: '', status: 'nope' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(['status', 'title']);
    }
  });
});

describe('contentIdSchema', () => {
  it('accepts a UUID and rejects anything else', () => {
    expect(contentIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
    for (const bad of ['1', 'abc', "' or 1=1 --", '550e8400-e29b-41d4-a716']) {
      expect(contentIdSchema.safeParse(bad).success).toBe(false);
    }
  });
});
