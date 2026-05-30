// @vitest-environment jsdom
// =============================================================================
// hide-guard.test.js — unit tests for assets/hide-guard.js
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../../assets/hide-guard.js'),
  'utf8'
);

function runGuard() {
  new Function(SRC)();
}

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 5));
}

describe('hide-guard', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    window.SUPABASE_URL = 'https://test.supabase.co';
    window.SUPABASE_ANON_KEY = 'test-anon-key';
    delete window.__hideGuardReload;
    delete window.__hideGuardDisable;
    // 테스트 간 캐시 누수 방지
    try { window.localStorage.clear(); } catch (_) {}
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does nothing when Supabase config missing', () => {
    delete window.SUPABASE_URL;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    runGuard();
    expect(warn).toHaveBeenCalled();
    expect(window.__hideGuardReload).toBeUndefined();
  });

  it('exposes window.__hideGuardReload and __hideGuardDisable after init', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
    );
    runGuard();
    await flushMicrotasks();
    expect(typeof window.__hideGuardReload).toBe('function');
    expect(typeof window.__hideGuardDisable).toBe('function');
  });

  it('hides anchors whose href exactly matches the hidden_assets list', async () => {
    document.body.innerHTML =
      '<a id="bad" href="https://media.example.com/secret.pdf">x</a>' +
      '<a id="ok" href="https://media.example.com/public.pdf">x</a>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { url: 'https://media.example.com/secret.pdf', page_path: null },
          ]),
      })
    );
    runGuard();
    await flushMicrotasks();
    expect(document.getElementById('bad').style.display).toBe('none');
    expect(document.getElementById('ok').style.display).toBe('');
  });

  it('hides via prefix match when stored URL ends with /', async () => {
    document.body.innerHTML =
      '<a id="bad" href="https://media.example.com/legacy/old.pdf">x</a>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { url: 'https://media.example.com/legacy/', page_path: null },
          ]),
      })
    );
    runGuard();
    await flushMicrotasks();
    expect(document.getElementById('bad').style.display).toBe('none');
  });

  it('respects page_path scoping (does not hide on a different page)', async () => {
    // jsdom default URL is http://localhost/ — pagePath will be "/"
    document.body.innerHTML =
      '<a id="x" href="https://media.example.com/secret.pdf">x</a>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              url: 'https://media.example.com/secret.pdf',
              page_path: '/some/other/page.html',
            },
          ]),
      })
    );
    runGuard();
    await flushMicrotasks();
    expect(document.getElementById('x').style.display).toBe('');
  });

  it('hides parent .asset-card when anchor inside matches', async () => {
    document.body.innerHTML =
      '<div class="asset-card" id="card">' +
      '<a href="https://media.example.com/secret.pdf">x</a></div>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { url: 'https://media.example.com/secret.pdf', page_path: null },
          ]),
      })
    );
    runGuard();
    await flushMicrotasks();
    expect(document.getElementById('card').style.display).toBe('none');
  });

  it('hides parent <video> when matching <source> is found', async () => {
    document.body.innerHTML =
      '<video id="v"><source src="https://media.example.com/secret.mp4" /></video>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { url: 'https://media.example.com/secret.mp4', page_path: null },
          ]),
      })
    );
    runGuard();
    await flushMicrotasks();
    expect(document.getElementById('v').style.display).toBe('none');
  });

  it('__hideGuardDisable restores hidden elements', async () => {
    document.body.innerHTML =
      '<a id="bad" href="https://media.example.com/secret.pdf">x</a>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { url: 'https://media.example.com/secret.pdf', page_path: null },
          ]),
      })
    );
    runGuard();
    await flushMicrotasks();
    expect(document.getElementById('bad').style.display).toBe('none');
    window.__hideGuardDisable();
    expect(document.getElementById('bad').style.display).toBe('');
    expect(document.getElementById('bad').dataset.hidden).toBeUndefined();
  });

  it('handles fetch failure gracefully (does not throw)', async () => {
    document.body.innerHTML =
      '<a id="x" href="https://media.example.com/secret.pdf">x</a>';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(() => {
      runGuard();
    }).not.toThrow();
    await flushMicrotasks();
  });

  // -------------------------------------------------------------------------
  // BUG #3 [medium] (PINNED with it.fails): hide-guard FAILS OPEN for a
  // first-time visitor (no localStorage cache) when the Supabase fetch errors.
  // The catch handler sets loaded=true while exactSet/prefixes stay empty, so
  // isHidden() returns false for every URL and applyHide() hides nothing. A
  // network blip / Supabase outage / ad-blocker / RLS error therefore renders
  // every admin-hidden (withdrawn / leaked) asset. FIX: fail CLOSED on a hard
  // fetch error when no cache was seeded — track a wasSeeded flag and do NOT
  // flip loaded=true (so isHidden()/applyHide() do nothing OR hide all
  // candidate media) unless cached data was already present.
  // After the fix, replace `it.fails` with `it`.
  // -------------------------------------------------------------------------
  it(
    'BUG#3: fails CLOSED — hidden asset is not left visible on fetch error with no cache',
    async () => {
      // no localStorage cache seeded (beforeEach clears it)
      document.body.innerHTML =
        '<a id="bad" href="https://media.example.com/withdrawn.pdf">x</a>';
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
      runGuard();
      await flushMicrotasks();
      // A withdrawn asset must NOT remain reachable just because the fetch
      // failed. Fail-closed (hide candidate media until a successful load)
      // is the protective outcome the guard exists to provide.
      expect(document.getElementById('bad').style.display).toBe('none');
    }
  );

  it(
    'BUG#3: a withdrawn asset added AFTER a failed no-cache fetch is still hidden',
    async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
      runGuard();
      await flushMicrotasks();
      // observer-injected withdrawn asset must not silently leak either
      const a = document.createElement('a');
      a.id = 'bad';
      a.setAttribute('href', 'https://media.example.com/withdrawn.pdf');
      document.body.appendChild(a);
      await flushMicrotasks();
      expect(document.getElementById('bad').style.display).toBe('none');
    }
  );

  // Coverage: a CACHED user must KEEP their last-known hide list even when the
  // refresh fetch errors (this path is correct today and must stay correct
  // after the fail-closed fix — only the no-cache path changes).
  it('cached user keeps hidden assets when the refresh fetch errors', async () => {
    window.localStorage.setItem('__hide_guard_cache_v1', JSON.stringify({
      ts: Date.now(),
      exact: ['https://media.example.com/withdrawn.pdf'],
      prefixes: [],
    }));
    document.body.innerHTML =
      '<a id="bad" href="https://media.example.com/withdrawn.pdf">x</a>' +
      '<a id="ok" href="https://media.example.com/public.pdf">x</a>';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    runGuard();
    // synchronous seed from cache hides it before paint
    expect(document.getElementById('bad').style.display).toBe('none');
    await flushMicrotasks();
    // refresh failed, but cached hide list survives → still hidden
    expect(document.getElementById('bad').style.display).toBe('none');
    expect(document.getElementById('ok').style.display).toBe('');
  });

  // -------------------------------------------------------------------------
  // FOUC defense (post-fix): hide-guard seeds exactSet/prefixes from
  // localStorage cache at module load, then applies hide() synchronously
  // BEFORE first paint. Async fetch refreshes and re-caches.
  // -------------------------------------------------------------------------
  it('FOUC defense: hidden anchor invisible synchronously when localStorage cache seeded', () => {
    // 직전 세션의 캐시 — 24h 내
    window.localStorage.setItem('__hide_guard_cache_v1', JSON.stringify({
      ts: Date.now(),
      exact: ['https://media.example.com/secret.pdf'],
      prefixes: [],
    }));
    document.body.innerHTML =
      '<a id="bad" href="https://media.example.com/secret.pdf">x</a>' +
      '<a id="ok" href="https://media.example.com/public.pdf">x</a>';
    // fetch 응답이 안 와도 — 캐시만으로 동기 hide 되어야 함
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    runGuard();
    expect(document.getElementById('bad').style.display).toBe('none');
    expect(document.getElementById('ok').style.display).toBe('');
  });

  it('FOUC defense: expired cache (>24h) is ignored', () => {
    window.localStorage.setItem('__hide_guard_cache_v1', JSON.stringify({
      ts: Date.now() - 25 * 3600 * 1000,
      exact: ['https://media.example.com/secret.pdf'],
      prefixes: [],
    }));
    document.body.innerHTML =
      '<a id="bad" href="https://media.example.com/secret.pdf">x</a>';
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    runGuard();
    expect(document.getElementById('bad').style.display).toBe('');
  });

  it('FOUC defense: successful fetch writes cache for next session', async () => {
    document.body.innerHTML =
      '<a id="bad" href="https://media.example.com/secret.pdf">x</a>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { url: 'https://media.example.com/secret.pdf', page_path: null },
        ]),
      })
    );
    runGuard();
    await flushMicrotasks();
    const raw = window.localStorage.getItem('__hide_guard_cache_v1');
    expect(raw).toBeTruthy();
    const cached = JSON.parse(raw);
    expect(cached.exact).toContain('https://media.example.com/secret.pdf');
    expect(typeof cached.ts).toBe('number');
  });
});
