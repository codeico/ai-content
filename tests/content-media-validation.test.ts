import { describe, expect, it } from 'vitest';

import {
  CONTENT_MEDIA_MAX_BYTES,
  CONTENT_MEDIA_TYPES,
  validateContentMediaFile,
} from '../packages/shared/src/content/content.ts';

const valid = {
  name: 'launch-cut.mp4',
  type: 'video/mp4',
  size: 12_345_678,
};

describe('validateContentMediaFile', () => {
  it.each([
    ['video/mp4', 'mp4'],
    ['video/quicktime', 'mov'],
  ] as const)('accepts %s and derives the canonical %s extension', (type, extension) => {
    const result = validateContentMediaFile({ ...valid, type });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ type, size: valid.size, extension });
    }
  });

  it('does not trust the filename extension', () => {
    const result = validateContentMediaFile({
      name: 'malware.exe',
      type: 'video/mp4',
      size: valid.size,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.extension).toBe('mp4');
  });

  it.each([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/octet-stream',
    'text/html',
    '',
    undefined,
    null,
  ])('rejects unsupported content type %p', (type) => {
    const result = validateContentMediaFile({ ...valid, type });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.type).toBe('Choose an MP4 or MOV video.');
    }
  });

  it('accepts the exact byte limit', () => {
    expect(validateContentMediaFile({ ...valid, size: CONTENT_MEDIA_MAX_BYTES }).success).toBe(
      true,
    );
  });

  it('rejects one byte over the limit', () => {
    const result = validateContentMediaFile({ ...valid, size: CONTENT_MEDIA_MAX_BYTES + 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.size).toBe('Video must be 50 MB or smaller.');
    }
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '12', undefined, null])(
    'rejects invalid size %p',
    (size) => {
      const result = validateContentMediaFile({ ...valid, size });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.fieldErrors.size).toBeDefined();
    },
  );

  it('strips filename and caller-supplied extension from the result', () => {
    const result = validateContentMediaFile({ ...valid, extension: 'exe' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual(['extension', 'size', 'type']);
      expect(result.data.extension).toBe('mp4');
    }
  });

  it('keeps the public MIME list exact and small', () => {
    expect(CONTENT_MEDIA_TYPES).toEqual(['video/mp4', 'video/quicktime']);
  });
});
