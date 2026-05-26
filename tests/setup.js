// =============================================================================
// tests/setup.js — global setup for all vitest suites
// =============================================================================
// Keeps environment hermetic: no real Supabase / GitHub / R2 calls. Each test
// installs its own vi.mock for fetch / external SDKs. We only seed the env
// vars that api/* modules read at import time so they don't crash on undefined.
// =============================================================================

import { afterEach, vi } from 'vitest';

// Seed env BEFORE any module under test is imported. Vitest evaluates this
// setup file before importing test files, so these are visible to api/*.
process.env.GITHUB_CONTENT_PAT ??= 'test-pat-token';
process.env.GITHUB_REPO ??= 'test-owner/test-repo';
process.env.GITHUB_BRANCH ??= 'main';
process.env.SUPABASE_URL ??= 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key';

// Reset all mocks between tests so a stub in test A doesn't leak into test B.
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
