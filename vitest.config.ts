import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Phase 0 tests cover pure logic in the workspace packages. Application
    // component tests arrive with the features that need them.
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
