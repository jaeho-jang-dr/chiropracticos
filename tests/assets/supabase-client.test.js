// @vitest-environment jsdom
// =============================================================================
// supabase-client.test.js — unit tests for assets/supabase-client.js
// =============================================================================
// Strategy
// --------
// The module under test imports `createClient` from an esm.sh CDN URL. We mock
// that module specifier at the boundary with vi.mock(...) so no real network
// call is ever made. Each test installs its own fake auth/db surface via the
// returned mock client and verifies the contract exposed by supabase-client.js
// (sessionReady, getCurrentUserWithRow, signOut, clearStaleAuth, etc.).
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// -- Mock state shared across module re-imports --------------------------------
// We rebuild a fresh client in each test by calling vi.resetModules() and then
// dynamically importing the module again. The factory below reads from these
// holders so each test can stage its own behaviour.
const state = {
  onAuthStateChange: null,        // callback registered by the module
  session: null,                  // value returned by getSession()
  user: null,                     // value returned by getUser()
  userRow: null,                  // value returned by from('users').select(...)
  userRowError: null,             // error returned by from('users').select(...)
  signOutCalls: 0,
  signInWithOAuthCalls: [],
  signInWithPasswordCalls: [],
  fromCalls: [],
};

function resetState() {
  state.onAuthStateChange = null;
  state.session = null;
  state.user = null;
  state.userRow = null;
  state.userRowError = null;
  state.signOutCalls = 0;
  state.signInWithOAuthCalls = [];
  state.signInWithPasswordCalls = [];
  state.fromCalls = [];
}

vi.mock('https://esm.sh/@supabase/supabase-js@2', () => {
  const createClient = vi.fn((url, key, opts) => {
    const client = {
      __url: url,
      __key: key,
      __opts: opts,
      auth: {
        onAuthStateChange: vi.fn((cb) => {
          state.onAuthStateChange = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        getSession: vi.fn(async () => ({ data: { session: state.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })),
        signOut: vi.fn(async () => { state.signOutCalls++; return { error: null }; }),
        signInWithOAuth: vi.fn(async (args) => {
          state.signInWithOAuthCalls.push(args);
          return { data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?...' }, error: null };
        }),
        signInWithPassword: vi.fn(async (args) => {
          state.signInWithPasswordCalls.push(args);
          return { data: { session: state.session, user: state.user }, error: null };
        }),
      },
      from: vi.fn((table) => {
        state.fromCalls.push(table);
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          single: vi.fn(async () => ({ data: state.userRow, error: state.userRowError })),
        };
        return chain;
      }),
    };
    return client;
  });
  return { createClient };
});

// -- Helpers -------------------------------------------------------------------
// Stand up the globals supabase-client.js reads from window/localStorage before
// each fresh import.
function installWindowConfig() {
  window.SUPABASE_URL = 'https://test.supabase.co';
  window.SUPABASE_ANON_KEY = 'test-anon-key';
}

async function importFresh() {
  // location stubbing must happen before each fresh import — the module reads
  // location.hash / location.search at top level to decide OAuth-callback mode.
  vi.resetModules();
  return await import('../../assets/supabase-client.js');
}

// -- Suite ---------------------------------------------------------------------
describe('supabase-client.js', () => {
  beforeEach(() => {
    resetState();
    installWindowConfig();
    // jsdom localStorage is real and persists across tests in same realm —
    // wipe it so clearStaleAuth tests are deterministic.
    localStorage.clear();
    sessionStorage.clear();
    // Stub alert because module shows alert() when config missing.
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('singleton: the supabase client instance is the same across imports', async () => {
    const mod1 = await import('../../assets/supabase-client.js');
    const mod2 = await import('../../assets/supabase-client.js');
    expect(mod1.supabase).toBe(mod2.supabase);
  });

  it('getCurrentUserWithRow returns { is_admin-like role, access_level } shape', async () => {
    // Fresh module so resetModules + state setup are honoured for this case.
    state.user = { id: 'u-1', email: 'drjang00@gmail.com' };
    state.userRow = {
      role: 'admin',
      access_level: 'full',
      blocked_at: null,
      full_name: '장재호',
      email: 'drjang00@gmail.com',
    };
    const mod = await importFresh();
    // Drive sessionReady: simulate INITIAL_SESSION with a live session.
    state.session = { access_token: 'tkn', user: state.user };
    state.onAuthStateChange?.('INITIAL_SESSION', state.session);

    const { user, row } = await mod.getCurrentUserWithRow();
    expect(user).toEqual(state.user);
    expect(row).toMatchObject({ role: 'admin', access_level: 'full' });
    // shape check — these are the keys auth-guard.js relies on
    expect(row).toHaveProperty('role');
    expect(row).toHaveProperty('access_level');
    expect(row).toHaveProperty('blocked_at');
  });

  it('Korean field roundtrip: display_name with 한글 is preserved unmodified', async () => {
    const koreanName = '장재호 박사';
    state.user = { id: 'u-han', email: 'han@example.com' };
    state.userRow = {
      role: 'user',
      access_level: 'full',
      blocked_at: null,
      full_name: koreanName,
      email: 'han@example.com',
    };
    const mod = await importFresh();
    state.session = { user: state.user };
    state.onAuthStateChange?.('INITIAL_SESSION', state.session);

    const { row } = await mod.getCurrentUserWithRow();
    expect(row.full_name).toBe(koreanName);
    // round-trip through JSON (Supabase serializes over the wire) and verify
    // codepoints survive — guards against any accidental Buffer/Latin1 path.
    expect(JSON.parse(JSON.stringify(row)).full_name).toBe(koreanName);
    expect([...row.full_name].length).toBeGreaterThan(0);
  });

  it('graceful failure when offline: getCurrentUserWithRow does not throw', async () => {
    state.user = { id: 'u-2', email: 'offline@example.com' };
    // Simulate a network error from the db layer — supabase typically returns
    // { data: null, error: { message: 'Failed to fetch', code: 'NETWORK' } }.
    state.userRow = null;
    state.userRowError = { message: 'Failed to fetch', code: 'NETWORK' };
    const mod = await importFresh();
    state.session = { user: state.user };
    state.onAuthStateChange?.('INITIAL_SESSION', state.session);

    // 일시적 조회 실패는 row:null + error를 함께 반환해야 함 — 호출자가
    // "확정 거부"와 "판단 불가"를 구분할 수 있도록(승인 대기벽 오인 방지).
    await expect(mod.getCurrentUserWithRow(1)).resolves.toEqual({
      user: state.user,
      row: null,
      error: state.userRowError,
    });
  });

  it('graceful failure when offline: getSession rejection does not crash module load', async () => {
    // Even if getSession itself rejects, sessionReady should settle (via timeout
    // fallback) and not surface as an unhandled rejection. We can't easily test
    // the unhandled-rejection path inside Promise; instead assert getCurrentUser
    // does not throw when the session is null.
    state.session = null;
    const mod = await importFresh();
    state.onAuthStateChange?.('INITIAL_SESSION', null);
    await expect(mod.getCurrentUser()).resolves.toBeNull();
  });

  it('clearStaleAuth removes sb-* and supabase keys from localStorage + sessionStorage', async () => {
    localStorage.setItem('sb-access-token', 'a');
    localStorage.setItem('sb-refresh-token', 'b');
    localStorage.setItem('supabase.auth.token', 'c');
    localStorage.setItem('unrelated-key', 'keep');
    sessionStorage.setItem('sb-temp', 'x');
    sessionStorage.setItem('keep-me', 'y');

    const mod = await importFresh();
    const removed = mod.clearStaleAuth();
    expect(removed).toBeGreaterThanOrEqual(3);
    expect(localStorage.getItem('sb-access-token')).toBeNull();
    expect(localStorage.getItem('supabase.auth.token')).toBeNull();
    expect(localStorage.getItem('unrelated-key')).toBe('keep');
    expect(sessionStorage.getItem('sb-temp')).toBeNull();
    expect(sessionStorage.getItem('keep-me')).toBe('y');
  });

  it('Profile cache invalidation on auth state change: a new SIGNED_IN triggers a new users-table read', async () => {
    state.user = { id: 'u-1', email: 'one@example.com' };
    state.userRow = { role: 'user', access_level: 'full', blocked_at: null, email: 'one@example.com' };
    const mod = await importFresh();
    state.session = { user: state.user };
    state.onAuthStateChange?.('SIGNED_IN', state.session);

    await mod.getCurrentUserWithRow();
    const firstCallCount = state.fromCalls.filter((t) => t === 'users').length;
    expect(firstCallCount).toBeGreaterThanOrEqual(1);

    // Simulate auth state change to a new user; a subsequent profile fetch
    // must hit the users table again (i.e., not return a stale cached row).
    state.user = { id: 'u-2', email: 'two@example.com' };
    state.userRow = { role: 'admin', access_level: 'full', blocked_at: null, email: 'two@example.com' };
    state.onAuthStateChange?.('SIGNED_IN', { user: state.user });

    const { row } = await mod.getCurrentUserWithRow();
    expect(row.email).toBe('two@example.com');
    const secondCallCount = state.fromCalls.filter((t) => t === 'users').length;
    expect(secondCallCount).toBeGreaterThan(firstCallCount);
  });

  it('signInWithGoogle: passes redirectTo built from current origin + safe next path', async () => {
    const mod = await importFresh();
    await mod.signInWithGoogle('/chapter01_introduction');
    expect(state.signInWithOAuthCalls).toHaveLength(1);
    const args = state.signInWithOAuthCalls[0];
    expect(args.provider).toBe('google');
    expect(args.options.redirectTo).toMatch(/\/chapter01_introduction$/);
    // open-redirect defense — protocol-relative or external must be normalised.
    state.signInWithOAuthCalls.length = 0;
    await mod.signInWithGoogle('//evil.com/steal');
    expect(state.signInWithOAuthCalls[0].options.redirectTo).toMatch(/\/$/);
  });

  it('signOut delegates to supabase.auth.signOut and clears stale local keys', async () => {
    localStorage.setItem('sb-access-token', 'foo');
    const mod = await importFresh();
    // signOut sets location.href = "/" — jsdom allows assignment, but to avoid
    // navigating we replace the descriptor.
    const originalHref = window.location.href;
    delete window.location;
    window.location = { ...new URL(originalHref), assign: vi.fn(), replace: vi.fn(), href: originalHref };
    Object.defineProperty(window.location, 'href', { set: vi.fn(), get: () => originalHref });

    await mod.signOut();
    expect(state.signOutCalls).toBeGreaterThanOrEqual(1);
    expect(localStorage.getItem('sb-access-token')).toBeNull();
  });
});
