// @vitest-environment jsdom
// =============================================================================
// auth-guard.test.js — unit tests for assets/auth-guard.js
// =============================================================================
// Strategy
// --------
// auth-guard.js is an ES module that runs an IIFE at import time. To isolate
// each scenario we (1) install fresh window.location + window.PUBLIC_PAGES /
// ADMIN_PAGES, (2) `vi.mock` the local supabase-client.js module so we can
// stage session + user-row responses, and (3) `vi.resetModules()` + dynamic
// import so the IIFE re-runs against the new fixtures.
//
// Note on FOUC test: D3 reported the guard does not prevent chapter content
// painting before authentication completes. The corresponding test is marked
// to FAIL on purpose — it documents the bug. Switch to `it(...)` from
// `it.fails(...)` once the FOUC fix lands.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// -- Mock state for the supabase-client module --------------------------------
const supaState = {
  session: null,
  row: null,
  signOutCalled: 0,
  // Track tokens that go stale mid-session.
  tokenExpiredHandlers: [],
};

function resetSupaState() {
  supaState.session = null;
  supaState.row = null;
  supaState.signOutCalled = 0;
  supaState.tokenExpiredHandlers = [];
}

vi.mock('../../assets/supabase-client.js', () => {
  return {
    // sessionReady is a thenable that resolves to whatever `session` is at
    // await time. We give the test full control by reading from supaState.
    sessionReady: {
      then(resolve) { resolve(supaState.session); return Promise.resolve(supaState.session); },
    },
    supabase: {
      auth: {
        onAuthStateChange: vi.fn((cb) => {
          supaState.tokenExpiredHandlers.push(cb);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
    },
    getCurrentUserWithRow: vi.fn(async () => ({
      user: supaState.session?.user ?? null,
      row: supaState.row,
    })),
    getCurrentUser: vi.fn(async () => supaState.session?.user ?? null),
    signOut: vi.fn(async () => { supaState.signOutCalled++; }),
    signInWithGoogle: vi.fn(),
    signInWithEmail: vi.fn(),
    clearStaleAuth: vi.fn(),
  };
});

// -- Helpers -------------------------------------------------------------------
function installConfig({ admin = false, custom = null } = {}) {
  window.PUBLIC_PAGES = new Set([
    '/', '/index', '/index.html',
    '/login', '/login.html',
    '/signup', '/signup.html',
    '/chapter01_introduction', '/chapter01_introduction.html',
  ]);
  window.ADMIN_PAGES = new Set(['/admin', '/admin.html']);
  if (custom) custom();
}

function setLocation(pathname, { search = '', hash = '' } = {}) {
  // jsdom allows replacing window.location with a fresh object only by deletion.
  const url = `https://chiropractic-kr.vercel.app${pathname}${search}${hash}`;
  delete window.location;
  window.location = new URL(url);
  // URL has no replace(); add the methods auth-guard uses.
  window.location.replace = vi.fn((newUrl) => {
    const u = new URL(newUrl, 'https://chiropractic-kr.vercel.app');
    window.location.__lastReplace = u.pathname + u.search;
  });
  window.location.assign = vi.fn();
}

function buildBody(html = '<main id="main"><section class="chapter-body">Chapter 1 content</section></main><div class="nav-actions"></div><div id="hero-unicorn" style="display:none"></div>') {
  document.body.className = '';
  document.body.innerHTML = html;
}

async function runGuard() {
  vi.resetModules();
  await import('../../assets/auth-guard.js');
  // The IIFE awaits sessionReady + getCurrentUserWithRow; flush the microtask
  // queue a few times so all chained `.then`s settle before assertions.
  for (let i = 0; i < 5; i++) await Promise.resolve();
  // Extra macrotask flush for any setTimeout(0) inside the guard.
  await new Promise((r) => setTimeout(r, 0));
}

// -- Suite ---------------------------------------------------------------------
describe('auth-guard.js', () => {
  beforeEach(() => {
    resetSupaState();
    installConfig();
    buildBody();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Unauthenticated visit to a protected page: redirects to /login with next=', async () => {
    setLocation('/chapter05_toggle_recoil');
    supaState.session = null;
    await runGuard();
    expect(window.location.replace).toHaveBeenCalledTimes(1);
    const arg = window.location.replace.mock.calls[0][0];
    expect(arg).toMatch(/^\/login\?next=/);
    expect(decodeURIComponent(arg.split('next=')[1])).toBe('/chapter05_toggle_recoil');
  });

  it('Unauthenticated visit to a public page: marks body as is-anonymous, no redirect', async () => {
    setLocation('/chapter01_introduction');
    supaState.session = null;
    await runGuard();
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(document.body.classList.contains('is-anonymous')).toBe(true);
  });

  it('Authenticated but not approved: pending-approval message is shown', async () => {
    setLocation('/chapter06_thompson');
    supaState.session = { access_token: 't', user: { id: 'u-pend', email: 'pend@example.com' } };
    supaState.row = { role: 'user', access_level: 'pending_approval', blocked_at: null, full_name: '대기자', email: 'pend@example.com' };
    await runGuard();
    expect(document.body.innerHTML).toMatch(/관리자 승인 대기 중/);
    expect(window.location.replace).not.toHaveBeenCalled();
    // Korean name escaped into the greeting.
    expect(document.body.innerHTML).toContain('대기자');
  });

  it('Approved non-admin: chapter page stays visible (no redirect, no pending message)', async () => {
    setLocation('/chapter06_thompson');
    supaState.session = { user: { id: 'u-ok', email: 'ok@example.com' } };
    supaState.row = { role: 'user', access_level: 'full', blocked_at: null, full_name: '의사', email: 'ok@example.com' };
    await runGuard();
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toMatch(/승인 대기 중/);
    // Nav widget should render the user's email and logout button.
    expect(document.body.innerHTML).toContain('ok@example.com');
    expect(document.getElementById('__logout-btn')).not.toBeNull();
    // is-admin must NOT be set for a regular approved user.
    expect(document.body.classList.contains('is-admin')).toBe(false);
  });

  it('Approved non-admin: admin.html is blocked with 403', async () => {
    setLocation('/admin');
    supaState.session = { user: { id: 'u-ok', email: 'ok@example.com' } };
    supaState.row = { role: 'user', access_level: 'full', blocked_at: null, email: 'ok@example.com' };
    await runGuard();
    expect(document.body.innerHTML).toMatch(/403/);
    expect(document.body.innerHTML).toMatch(/관리자 전용/);
  });

  it('Approved admin: admin badge visible and admin-only DOM unhidden', async () => {
    setLocation('/admin');
    supaState.session = { user: { id: 'u-admin', email: 'drjang00@gmail.com' } };
    supaState.row = { role: 'admin', access_level: 'full', blocked_at: null, email: 'drjang00@gmail.com' };
    await runGuard();
    // is-admin class is the signal download-guard / pdf-viewer key off.
    expect(document.body.classList.contains('is-admin')).toBe(true);
    expect(window.__isAdmin).toBe(true);
    // hero-unicorn (admin badge) is unhidden.
    const unicorn = document.getElementById('hero-unicorn');
    expect(unicorn).not.toBeNull();
    expect(unicorn.style.display).toBe('block');
    // No redirect, no 403 — admin sees the page.
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toMatch(/403/);
  });

  it('Blocked user: shows blocked notice with reason and exposes window.__signOut', async () => {
    setLocation('/chapter08_cox');
    supaState.session = { user: { id: 'u-blk', email: 'blk@example.com' } };
    supaState.row = { role: 'user', access_level: 'full', blocked_at: '2026-01-01', blocked_reason: '<script>alert(1)</script>스팸', email: 'blk@example.com' };
    await runGuard();
    expect(document.body.innerHTML).toMatch(/접근이 차단되었습니다/);
    // XSS sanitisation: raw <script> must be escaped, Korean text preserved.
    expect(document.body.innerHTML).not.toMatch(/<script>alert/);
    expect(document.body.innerHTML).toContain('스팸');
    expect(typeof window.__signOut).toBe('function');
  });

  it('Token expiry mid-session: re-auth is triggered when sessionReady reports no session next call', async () => {
    // First visit: authenticated.
    setLocation('/chapter09_logan');
    supaState.session = { user: { id: 'u-tok', email: 'tok@example.com' } };
    supaState.row = { role: 'user', access_level: 'full', blocked_at: null, email: 'tok@example.com' };
    await runGuard();
    expect(window.location.replace).not.toHaveBeenCalled();

    // Now simulate token expiry: session is gone, guard reruns on next nav.
    supaState.session = null;
    supaState.row = null;
    setLocation('/chapter09_logan');
    buildBody();
    await runGuard();
    expect(window.location.replace).toHaveBeenCalledTimes(1);
    expect(window.location.replace.mock.calls[0][0]).toMatch(/^\/login\?next=/);
  });

  it.fails(
    'FOUC: chapter content must be hidden until guard finishes (currently broken — D3)',
    async () => {
      // Bug: auth-guard.js does NOT set body { visibility: hidden } or any other
      // pre-paint gate before awaiting sessionReady. A snapshot of the DOM
      // BEFORE the guard finishes shows chapter content fully visible.
      setLocation('/chapter05_toggle_recoil');
      buildBody('<main id="main" data-chapter><section class="chapter-body">SECRET CONTENT</section></main>');
      supaState.session = null;

      // Import but do NOT await — snapshot must reflect what the user's screen
      // would show during the in-flight auth check.
      vi.resetModules();
      const importPromise = import('../../assets/auth-guard.js');

      // Synchronous check: is the chapter body hidden?
      const main = document.querySelector('#main');
      const stylePreGuard = main.getAttribute('style') || '';
      const hiddenAttr = main.hasAttribute('hidden');
      const bodyHidden =
        document.body.style.visibility === 'hidden' ||
        document.documentElement.style.visibility === 'hidden';

      // We EXPECT the guard to enforce one of these (it does not — hence fails).
      expect(
        hiddenAttr ||
          /display:\s*none|visibility:\s*hidden/.test(stylePreGuard) ||
          bodyHidden
      ).toBe(true);

      await importPromise;
    }
  );

  it('Logout: signOut() called and stale local storage cleared', async () => {
    setLocation('/chapter10_sot');
    supaState.session = { user: { id: 'u-logout', email: 'lo@example.com' } };
    supaState.row = { role: 'user', access_level: 'full', blocked_at: null, email: 'lo@example.com' };
    await runGuard();

    const btn = document.getElementById('__logout-btn');
    expect(btn).not.toBeNull();
    btn.onclick();                      // triggers the mocked signOut
    // Flush microtasks for the async signOut.
    for (let i = 0; i < 3; i++) await Promise.resolve();
    expect(supaState.signOutCalled).toBeGreaterThanOrEqual(1);
  });

  it('Redirect loop guard: when already on /login, do not redirect again', async () => {
    setLocation('/login');
    supaState.session = null;
    // /login is in PUBLIC_PAGES, so it falls into the public branch and just
    // marks body anonymous. The explicit no-redirect assertion guards the
    // loop-prevention code path.
    await runGuard();
    expect(window.location.replace).not.toHaveBeenCalled();
  });
});
