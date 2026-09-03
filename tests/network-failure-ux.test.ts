import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * What a user sees when the connection drops mid-submit.
 *
 * Verified in the browser by failing window.fetch during a workspace rename.
 * A Server Action whose transport fails throws inside React's
 * fetchServerAction - BEFORE the request reaches the server - so no
 * useActionState can catch it and no `catch` in the action ever runs. React
 * routes it to the nearest error boundary.
 *
 * Measured: the page lands on the boundary, the rename was not applied, and
 * Try again restores the screen with the workspace name intact. So the app
 * degrades correctly; what needed fixing was what the boundary SAYS.
 */
const BOUNDARY = readFileSync(join(process.cwd(), 'apps/web/src/app/app/error.tsx'), 'utf8');
const WORKSPACE_ACTIONS = readFileSync(
  join(process.cwd(), 'apps/web/src/app/app/workspace-actions.ts'),
  'utf8',
);

describe('the boundary offers a way out', () => {
  it('gives the user a retry rather than a dead end', () => {
    expect(BOUNDARY).toMatch(/onClick=\{reset\}/);
    expect(BOUNDARY).toMatch(/Try again/);
  });

  it('mentions the connection, which is the usual cause', () => {
    expect(BOUNDARY).toMatch(/connection/i);
  });
});

describe('the boundary covers a failed submit, not just a failed load', () => {
  it('names both cases', () => {
    // "We could not load this page" is wrong when the user just pressed Save:
    // the page HAD loaded, and the submit is what died.
    expect(BOUNDARY).toMatch(/could not load/i);
    expect(BOUNDARY).toMatch(/did not go through/i);
  });

  it('does not claim nothing was saved', () => {
    // A transport failure and a crash after a successful write are
    // indistinguishable from here. Promising the stronger one would be a lie
    // in the second case.
    expect(BOUNDARY).not.toMatch(/Nothing was saved/i);
  });
});

describe('the server side already handles its own failures', () => {
  it('maps repository errors to a readable message', () => {
    // These paths are reached when the request DOES arrive and the database
    // fails; they never involve the boundary.
    expect(WORKSPACE_ACTIONS).toMatch(/Unable to rename workspace\. Please try again\./);
    expect(WORKSPACE_ACTIONS).toMatch(/Unable to create workspace\. Please try again\./);
  });

  it('rethrows anything it cannot describe', () => {
    // Swallowing an unknown error would hide a real defect behind a friendly
    // message and leave the user retrying something that cannot succeed.
    // Counted, not just matched: the file has several catch blocks, so a
    // single removed rethrow slips past an existence check.
    const catches = WORKSPACE_ACTIONS.match(/\} catch \(error\) \{/g)?.length ?? 0;
    const rethrows = WORKSPACE_ACTIONS.match(/^\s*throw error;$/gm)?.length ?? 0;

    expect(catches).toBeGreaterThan(0);
    expect(rethrows).toBe(catches);
  });
});
