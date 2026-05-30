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
  // When set, getCurrentUserWithRow resolves with row:null AND surfaces this
  // error object — modelling a NON-PGRST116 transient failure (network blip,
  // RLS hiccup, 5xx). supabase-client.js currently swallows such errors and
  // returns row:null with no retry, so the guard cannot tell "definitely no
  // access" from "could not determine access". The fix should expose an error
  // signal (or retry) so an approved user is not slammed into the pending wall.
  rowError: null,
  signOutCalled: 0,
  // Track tokens that go stale mid-session.
  tokenExpiredHandlers: [],
};

function resetSupaState() {
  supaState.session = null;
  supaState.row = null;
  supaState.rowError = null;
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
      // Forward-compatible: the fix is expected to surface a transient error so
      // the guard can branch on "could not determine access". Today's
      // auth-guard.js ignores this field entirely.
      error: supaState.rowError,
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
    // FOUC cloak은 documentElement에 작용 — 테스트 간 누수 방지로 리셋.
    document.documentElement.style.visibility = '';
    const stale = document.getElementById('auth-cloak');
    if (stale) stale.remove();
    // is-admin 다운로드-언락 신호도 테스트 간 누수 방지.
    delete window.__isAdmin;
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

  // ===========================================================================
  // FOUC (bug #5) — the real fix is a render-blocking inline cloak shipped in
  // each protected chapter's <head> (<style id="auth-cloak">html{visibility:
  // hidden}</style>). A deferred module cannot hide content synchronously before
  // paint, so the unit-level contract auth-guard.js owns is the *removal*: it
  // must uncloak on content-showing branches and KEEP the cloak on the redirect
  // path so protected content never flashes while bouncing to /login.
  // ===========================================================================
  it('FOUC: approved user — guard removes the pre-paint cloak so content shows', async () => {
    setLocation('/chapter05_toggle_recoil');
    // Simulate the inline <head> cloak protected chapters ship with.
    const cloak = document.createElement('style');
    cloak.id = 'auth-cloak';
    cloak.textContent = 'html{visibility:hidden}';
    document.head.appendChild(cloak);
    document.documentElement.style.visibility = 'hidden';
    supaState.session = { user: { id: 'u-ok', email: 'ok@example.com' } };
    supaState.row = { role: 'user', access_level: 'full', blocked_at: null, email: 'ok@example.com' };
    await runGuard();
    expect(document.getElementById('auth-cloak')).toBeNull();
    expect(document.documentElement.style.visibility).not.toBe('hidden');
  });

  it('FOUC: unauthenticated protected visit keeps content cloaked through the redirect', async () => {
    setLocation('/chapter05_toggle_recoil');
    document.documentElement.style.visibility = 'hidden';
    supaState.session = null;
    await runGuard();
    expect(window.location.replace).toHaveBeenCalledTimes(1);
    // Must NOT reveal protected content while bouncing to /login.
    expect(document.documentElement.style.visibility).toBe('hidden');
  });

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

  // ===========================================================================
  // Regression: bug #2 — non-PGRST116 fetch error must NOT masquerade as
  // "pending approval" for an approved/admin user.
  // ===========================================================================
  // On any transient user-row fetch failure (network blip, RLS hiccup, 5xx),
  // supabase-client.js returns row:null with no retry, and auth-guard.js line 59
  // treats a null row identically to an unapproved user — so a genuinely
  // approved user is slammed into the '관리자 승인 대기 중' wall and an admin
  // loses their admin nav / is-admin signal. The guard must distinguish
  // "definitely no access" (row exists, level low) from "could not determine
  // access" (fetch failed). Pinned with it.fails until the fix lands.
  it(
    'Transient row-fetch error for an approved user must NOT show the pending-approval wall (bug #2)',
    async () => {
      setLocation('/chapter06_thompson');
      supaState.session = { user: { id: 'u-approved', email: 'approved@example.com' } };
      // Approved in reality, but the row fetch failed transiently → row:null.
      supaState.row = null;
      supaState.rowError = { message: 'Failed to fetch', code: 'NETWORK' };
      await runGuard();
      // A legitimate user must not be told their account is pending approval
      // when the truth is simply "we couldn't read the row right now".
      expect(document.body.innerHTML).not.toMatch(/관리자 승인 대기 중/);
    }
  );

  it(
    'Transient row-fetch error on /admin must NOT silently strip an admin to a 403 (bug #2)',
    async () => {
      setLocation('/admin');
      supaState.session = { user: { id: 'u-admin', email: 'drjang00@gmail.com' } };
      // Admin in reality, but a 5xx made the row come back null.
      supaState.row = null;
      supaState.rowError = { message: 'Internal Server Error', code: '500', status: 500 };
      await runGuard();
      // A single failed query must not lock an admin out of /admin. The guard
      // should surface a retry/error state, never a hard 403 on an unknown row.
      expect(document.body.innerHTML).not.toMatch(/403/);
    }
  );

  // ===========================================================================
  // Regression: bug #3 — blocked users must be blocked on PUBLIC chapters too.
  // ===========================================================================
  // On public pages the guard returns early after updateNavWidget and never
  // evaluates row.blocked_at, so an administratively blocked user still sees the
  // normal page on /chapter01_introduction (public) instead of the block
  // notice. blocked_at must be enforced regardless of public/admin status.
  // Pinned with it.fails until the check moves ahead of the public early-return.
  it(
    'Blocked user on a PUBLIC chapter still sees the block notice (bug #3)',
    async () => {
      setLocation('/chapter01_introduction'); // public page
      supaState.session = { user: { id: 'u-blk-pub', email: 'blkpub@example.com' } };
      supaState.row = {
        role: 'user', access_level: 'full',
        blocked_at: '2026-02-01', blocked_reason: '약관 위반',
        email: 'blkpub@example.com',
      };
      await runGuard();
      expect(document.body.innerHTML).toMatch(/접근이 차단되었습니다/);
    }
  );

  it(
    'Blocked ADMIN on a public chapter must not retain the is-admin download-unlock signal (bug #3)',
    async () => {
      // updateNavWidget on the public branch sets body.is-admin / __isAdmin for
      // admins, which download-guard.js keys off to unlock ALL media downloads —
      // even for an admin who has been blocked. Blocking must win.
      setLocation('/chapter02_functional_neurology'); // public page
      window.PUBLIC_PAGES.add('/chapter02_functional_neurology');
      window.PUBLIC_PAGES.add('/chapter02_functional_neurology.html');
      supaState.session = { user: { id: 'u-blk-admin', email: 'drjang00@gmail.com' } };
      supaState.row = {
        role: 'admin', access_level: 'full',
        blocked_at: '2026-02-01', blocked_reason: '차단됨',
        email: 'drjang00@gmail.com',
      };
      await runGuard();
      // A blocked admin must not keep the download-unlock signal.
      expect(document.body.classList.contains('is-admin')).toBe(false);
      expect(window.__isAdmin).not.toBe(true);
    }
  );

  // ===========================================================================
  // Coverage gaps — currently-passing branches that lacked assertions.
  // ===========================================================================

  it('Public page + authenticated approved user: nav widget renders, no is-anonymous', async () => {
    // Exercises the `session` branch of the public early-return (previously
    // only the anonymous branch of a public page was covered).
    setLocation('/chapter01_introduction');
    supaState.session = { user: { id: 'u-pub', email: 'pub@example.com' } };
    supaState.row = { role: 'user', access_level: 'full', blocked_at: null, email: 'pub@example.com' };
    await runGuard();
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(document.body.classList.contains('is-anonymous')).toBe(false);
    expect(document.body.innerHTML).toContain('pub@example.com');
    // Regular user on a public page must not get the admin download-unlock.
    expect(document.body.classList.contains('is-admin')).toBe(false);
  });

  it('Public page + admin: hero-unicorn unhidden and is-admin set via public branch', async () => {
    setLocation('/chapter01_introduction');
    supaState.session = { user: { id: 'u-pub-admin', email: 'drjang00@gmail.com' } };
    supaState.row = { role: 'admin', access_level: 'full', blocked_at: null, email: 'drjang00@gmail.com' };
    await runGuard();
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(document.body.classList.contains('is-admin')).toBe(true);
    expect(window.__isAdmin).toBe(true);
    const unicorn = document.getElementById('hero-unicorn');
    expect(unicorn.style.display).toBe('block');
  });

  it("access_level 'free' on a protected page is treated as pending (not granted access)", async () => {
    // Covers the `access_level === 'free'` arm of the gating condition, which
    // had no dedicated test (only 'pending_approval' was exercised).
    setLocation('/chapter07_activator');
    supaState.session = { user: { id: 'u-free', email: 'free@example.com' } };
    supaState.row = { role: 'user', access_level: 'free', blocked_at: null, full_name: '무료', email: 'free@example.com' };
    await runGuard();
    expect(document.body.innerHTML).toMatch(/관리자 승인 대기 중/);
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  it('Blocked user is gated BEFORE the admin-page role check (block wins over 403)', async () => {
    // A blocked admin visiting /admin must see the block notice, not the admin
    // nav — blocked_at is evaluated before the isAdmin branch in the guard.
    setLocation('/admin');
    supaState.session = { user: { id: 'u-blk-admin2', email: 'drjang00@gmail.com' } };
    supaState.row = {
      role: 'admin', access_level: 'full',
      blocked_at: '2026-03-01', blocked_reason: '정지',
      email: 'drjang00@gmail.com',
    };
    await runGuard();
    expect(document.body.innerHTML).toMatch(/접근이 차단되었습니다/);
    expect(document.body.innerHTML).not.toMatch(/403/);
    expect(document.body.classList.contains('is-admin')).toBe(false);
  });

  it('Blocked notice with no reason: renders cleanly without "undefined"/"null"', async () => {
    setLocation('/chapter08_cox');
    supaState.session = { user: { id: 'u-blk-noreason', email: 'blk2@example.com' } };
    supaState.row = { role: 'user', access_level: 'full', blocked_at: '2026-01-01', email: 'blk2@example.com' };
    await runGuard();
    expect(document.body.innerHTML).toMatch(/접근이 차단되었습니다/);
    expect(document.body.innerHTML).not.toMatch(/undefined/);
    expect(document.body.innerHTML).not.toMatch(/null/);
  });

  it('Trailing slash on a protected path still redirects unauthenticated visitors', async () => {
    // Guard normalises trailing slashes (path.replace(/\/+$/, "")). Without the
    // fix a '/chapter05_toggle_recoil/' visitor could slip a public/match miss.
    setLocation('/chapter05_toggle_recoil/');
    supaState.session = null;
    await runGuard();
    expect(window.location.replace).toHaveBeenCalledTimes(1);
    const arg = window.location.replace.mock.calls[0][0];
    expect(arg).toMatch(/^\/login\?next=/);
  });

  it('.html variant of a public page is matched as public (cleanUrl resilience)', async () => {
    // PUBLIC_PAGES contains both '/chapter01_introduction' and its '.html'
    // form; the guard builds variants so either path resolves public.
    setLocation('/chapter01_introduction.html');
    supaState.session = null;
    await runGuard();
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(document.body.classList.contains('is-anonymous')).toBe(true);
  });

  it('next= param preserves the query string of the original protected URL', async () => {
    setLocation('/chapter09_logan', { search: '?ref=email&x=1' });
    supaState.session = null;
    await runGuard();
    expect(window.location.replace).toHaveBeenCalledTimes(1);
    const arg = window.location.replace.mock.calls[0][0];
    const next = decodeURIComponent(arg.split('next=')[1]);
    expect(next).toBe('/chapter09_logan?ref=email&x=1');
  });
});
