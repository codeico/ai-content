import { describe, expect, it } from 'vitest';

import {
  CONTENT_EXTERNAL_ID_MAX_LENGTH,
  CONTENT_SOURCE_TYPES,
  CONTENT_SOURCE_URL_MAX_LENGTH,
  MEDIA_STATUSES,
  validateUpdateContentSource,
} from '../packages/shared/src/content/content.ts';

const valid = {
  source_type: 'tiktok',
  source_url: 'https://www.tiktok.com/@someone/video/123',
  external_id: '123',
  media_status: 'external_only',
};

describe('validateUpdateContentSource', () => {
  it('accepts a complete source and preserves the values', () => {
    const result = validateUpdateContentSource(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(valid);
    }
  });

  it.each(CONTENT_SOURCE_TYPES)('accepts source type %s', (source_type) => {
    expect(validateUpdateContentSource({ ...valid, source_type }).success).toBe(true);
  });

  it.each(['TikTok', 'facebook', '', undefined, null, 42, 'tiktok;drop table'])(
    'rejects unknown source type %p with a field error',
    (source_type) => {
      const result = validateUpdateContentSource({ ...valid, source_type });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors.source_type).toBeDefined();
        expect(Object.keys(result.fieldErrors)).toEqual(['source_type']);
      }
    },
  );

  it.each(MEDIA_STATUSES)('accepts media status %s at the schema layer', (media_status) => {
    // `available` is refused by the Server Action as a transition, not by Zod,
    // so a row already marked available can still have its link edited.
    expect(validateUpdateContentSource({ ...valid, media_status }).success).toBe(true);
  });

  it.each(['AVAILABLE', 'processing', 'temporary', 'deleted', '', undefined])(
    'rejects unknown media status %p',
    (media_status) => {
      const result = validateUpdateContentSource({ ...valid, media_status });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.fieldErrors.media_status).toBeDefined();
    },
  );

  describe('source_url', () => {
    it('normalises an empty or whitespace link to null', () => {
      for (const source_url of ['', '   ']) {
        const result = validateUpdateContentSource({ ...valid, source_url });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.source_url).toBeNull();
      }
    });

    it('accepts http and https and canonicalises scheme and host', () => {
      const result = validateUpdateContentSource({
        ...valid,
        source_url: 'HTTPS://Example.COM/Path',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.source_url).toBe('https://example.com/Path');

      expect(
        validateUpdateContentSource({ ...valid, source_url: 'http://example.com' }).success,
      ).toBe(true);
    });

    it.each([
      'javascript:alert(1)',
      'data:text/html;base64,AA==',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://example.com/x',
      '//evil.example.com/x',
      'example.com/video',
      'https://',
      'https://[::1',
      'not a url',
    ])('rejects %s: only http(s) links may be stored', (source_url) => {
      const result = validateUpdateContentSource({ ...valid, source_url });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors.source_url).toBe('Enter a full link starting with https://');
      }
    });

    it('rejects a link over the maximum length', () => {
      const tooLong = 'https://example.com/' + 'x'.repeat(CONTENT_SOURCE_URL_MAX_LENGTH);
      const result = validateUpdateContentSource({ ...valid, source_url: tooLong });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.fieldErrors.source_url).toBe('Link is too long.');
    });
  });

  describe('external_id', () => {
    it('normalises an empty identifier to null and trims a real one', () => {
      const empty = validateUpdateContentSource({ ...valid, external_id: '  ' });
      expect(empty.success).toBe(true);
      if (empty.success) expect(empty.data.external_id).toBeNull();

      const padded = validateUpdateContentSource({ ...valid, external_id: '  abc  ' });
      expect(padded.success).toBe(true);
      if (padded.success) expect(padded.data.external_id).toBe('abc');
    });

    it('rejects an identifier over the maximum length', () => {
      const result = validateUpdateContentSource({
        ...valid,
        external_id: 'x'.repeat(CONTENT_EXTERNAL_ID_MAX_LENGTH + 1),
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.fieldErrors.external_id).toBe('Identifier is too long.');
    });
  });

  it('reports one message per field and covers every field when all are bad', () => {
    const result = validateUpdateContentSource({
      source_type: 'nope',
      source_url: 'javascript:1',
      external_id: 'x'.repeat(CONTENT_EXTERNAL_ID_MAX_LENGTH + 1),
      media_status: 'nope',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // This is the pin that catches a hard-coded field allow-list.
      expect(Object.keys(result.fieldErrors).sort()).toEqual(
        ['external_id', 'media_status', 'source_type', 'source_url'].sort(),
      );
    }
  });

  it('strips keys that are not part of the source, including ids and storage fields', () => {
    const result = validateUpdateContentSource({
      ...valid,
      id: 'evil',
      workspace_id: 'evil',
      storage_provider: 'r2',
      storage_key: 'somewhere',
      title: 'smuggled',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual(
        ['external_id', 'media_status', 'source_type', 'source_url'].sort(),
      );
    }
  });
});
