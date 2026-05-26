// =============================================================================
// vitest.config.js — shared test runner config for chiropractic-kr
// =============================================================================
// - Default environment: node (matches Vercel Functions runtime for api/*.js).
// - Files that need DOM can opt in with a top-of-file pragma:
//       // @vitest-environment jsdom
// - Globals enabled so tests can use describe/it/expect/vi without imports.
// - Coverage targets the production code we ship (api/, assets/), not content,
//   tmp scratch dirs, or lecture archives.
// =============================================================================

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [],
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    exclude: [
      'node_modules/**',
      'tmp_*/**',
      'lectures/**',
      'archive/**',
      '**/*.bak',
    ],
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['api/**/*.js', 'assets/**/*.js'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'tmp_*/**',
        'lectures/**',
        'archive/**',
        'activator/**',
        'ak/**',
        'cbp/**',
        'cox/**',
        'diversified/**',
        'functional_neurology/**',
        'gonstead/**',
        'intro/**',
        'logan/**',
        'sot/**',
        'thompson/**',
        'toggle_recoil/**',
        'images/**',
        'public/**',
        '**/*.config.js',
        '**/*.bak',
      ],
    },
  },
});
