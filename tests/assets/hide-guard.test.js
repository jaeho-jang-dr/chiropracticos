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

  it('handles fetch failure gracefully (does not throw, leaves loaded=true)', async () => {
    document.body.innerHTML =
      '<a id="x" href="https://media.example.com/secret.pdf">x</a>';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    runGuard();
    await flushMicrotasks();
    expect(document.getElementById('x').style.display).toBe('');
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
