import { describe, expect, it } from 'vitest';

import {
  canManageWorkspace,
  validateWorkspaceName,
  workspaceIdSchema,
  WORKSPACE_NAME_MAX_LENGTH,
} from '../packages/shared/src/workspace/workspace.ts';

describe('validateWorkspaceName', () => {
  it('accepts a well-formed name', () => {
    const result = validateWorkspaceName({ name: 'Coding' });

    expect(result).toEqual({ success: true, data: { name: 'Coding' } });
  });

  it('trims surrounding whitespace', () => {
    const result = validateWorkspaceName({ name: '  Trading  ' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe('Trading');
  });

  it('rejects an empty name', () => {
    const result = validateWorkspaceName({ name: '' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.name).toBeDefined();
  });

  it('rejects a whitespace-only name', () => {
    // A bare min(1) on an untrimmed string would let this through; trim()
    // must run before the length check.
    const result = validateWorkspaceName({ name: '   ' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.name).toBeDefined();
  });

  it('rejects a missing name', () => {
    const result = validateWorkspaceName({});

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.name).toBeDefined();
  });

  it('accepts a name exactly at the maximum length', () => {
    // Boundary: an off-by-one here would reject an otherwise valid name.
    const result = validateWorkspaceName({ name: 'a'.repeat(WORKSPACE_NAME_MAX_LENGTH) });

    expect(result.success).toBe(true);
  });

  it('rejects a name one character over the maximum length', () => {
    const result = validateWorkspaceName({ name: 'a'.repeat(WORKSPACE_NAME_MAX_LENGTH + 1) });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.name).toContain(String(WORKSPACE_NAME_MAX_LENGTH));
  });

  it('rejects non-string input instead of coercing it', () => {
    // FormData.get() returns null for a missing field and File for an upload;
    // neither may be treated as a workspace name.
    expect(validateWorkspaceName({ name: null }).success).toBe(false);
    expect(validateWorkspaceName({ name: 42 }).success).toBe(false);
  });
});

describe('workspaceIdSchema', () => {
  it('accepts a well-formed UUID', () => {
    expect(workspaceIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('rejects a non-UUID route parameter', () => {
    // The route param is attacker-controlled input; a value like this must
    // never reach a database query as if it were a real id.
    expect(workspaceIdSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(workspaceIdSchema.safeParse('').success).toBe(false);
    expect(workspaceIdSchema.safeParse('1 OR 1=1').success).toBe(false);
  });
});

describe('canManageWorkspace', () => {
  it('allows the owner role to manage the workspace', () => {
    expect(canManageWorkspace('owner')).toBe(true);
  });

  it('does not allow the member role to manage the workspace', () => {
    expect(canManageWorkspace('member')).toBe(false);
  });
});
