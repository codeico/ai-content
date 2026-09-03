import js from '@eslint/js';
import next from 'eslint-config-next';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      // Throwaway database/router probe scripts; gitignored, never shipped.
      '.p6-shots/**',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  // Next.js rules apply to the web application only. `settings` points the
  // plugin at the app directory; without it, running ESLint from the repo root
  // makes it look for `pages/` beside the root config and warn that it is missing.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [next],
    settings: {
      next: {
        rootDir: 'apps/web',
      },
    },
  },

  // `any` is an error rather than a warning: CODING_RULES.md §8 forbids using it
  // to silence type errors, and a warning would not fail `npm run lint`.
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // Must stay last so formatting rules never fight Prettier.
  prettier,
);
