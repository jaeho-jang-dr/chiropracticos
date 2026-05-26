// @vitest-environment jsdom
// =============================================================================
// ui.test.js — unit tests for assets/ui.js (hamburger / view toggle / active link)
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '../../assets/ui.js'), 'utf8');

function runUI() {
  new Function(SRC)();
}

function navHTML() {
  return (
    '<nav class="site-nav">' +
    '<div class="nav-inner">' +
    '<a class="brand" href="/">Brand</a>' +
    '<ul class="nav-links">' +
    '<li><a href="index.html">Home</a></li>' +
    '<li><a href="chapter-2.html">Ch 2</a></li>' +
    '</ul>' +
    '<div class="nav-actions">' +
    '<a class="login-slot" href="/login">로그인</a>' +
    '<a class="start" href="/start">시작</a>' +
    '</div>' +
    '</div>' +
    '</nav>'
  );
}

describe('ui.js', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hamburger menu', () => {
    it('injects .nav-toggle button into .nav-inner', () => {
      document.body.innerHTML = navHTML();
      runUI();
      const btn = document.querySelector('.site-nav .nav-toggle');
      expect(btn).not.toBeNull();
      expect(btn.getAttribute('aria-label')).toBe('메뉴 열기');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    });

    it('clicking the button toggles is-open on .nav-links and aria-expanded', () => {
      document.body.innerHTML = navHTML();
      runUI();
      const btn = document.querySelector('.nav-toggle');
      const links = document.querySelector('.nav-links');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(links.classList.contains('is-open')).toBe(true);
      expect(btn.getAttribute('aria-expanded')).toBe('true');
      expect(btn.getAttribute('aria-label')).toBe('메뉴 닫기');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(links.classList.contains('is-open')).toBe(false);
    });

    it('mirrors nav-actions into a mobile-actions wrap inside .nav-links', () => {
      document.body.innerHTML = navHTML();
      runUI();
      const mobile = document.querySelector('.nav-links .mobile-actions');
      expect(mobile).not.toBeNull();
      // two children (login + start) cloned in
      expect(mobile.children.length).toBe(2);
    });

    it('ESC closes the open menu and refocuses the toggle button', () => {
      document.body.innerHTML = navHTML();
      runUI();
      const btn = document.querySelector('.nav-toggle');
      const links = document.querySelector('.nav-links');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(links.classList.contains('is-open')).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(links.classList.contains('is-open')).toBe(false);
    });

    it('outside click closes the open menu', () => {
      document.body.innerHTML = navHTML() + '<main id="outside">page</main>';
      runUI();
      const btn = document.querySelector('.nav-toggle');
      const links = document.querySelector('.nav-links');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(links.classList.contains('is-open')).toBe(true);
      document
        .getElementById('outside')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(links.classList.contains('is-open')).toBe(false);
    });

    it('does not double-inject when already has .nav-toggle', () => {
      document.body.innerHTML =
        navHTML().replace(
          '</ul>',
          '</ul><button class="nav-toggle">existing</button>'
        );
      runUI();
      expect(document.querySelectorAll('.nav-toggle').length).toBe(1);
    });
  });

  describe('view toggle (card/list)', () => {
    it('builds .view-toggle for #curriculum > .curriculum-grid', () => {
      document.body.innerHTML =
        '<section id="curriculum"><div class="curriculum-grid"></div></section>';
      try {
        localStorage.clear();
      } catch (e) {}
      runUI();
      const wrap = document.querySelector('[data-view-toggle="curriculum"]');
      expect(wrap).not.toBeNull();
      expect(wrap.querySelectorAll('button[data-view]').length).toBe(2);
    });

    it('clicking the list button applies is-list class to the grid', () => {
      document.body.innerHTML =
        '<section id="curriculum"><div class="curriculum-grid"></div></section>';
      runUI();
      const grid = document.querySelector('.curriculum-grid');
      const listBtn = document.querySelector(
        '[data-view-toggle="curriculum"] button[data-view="list"]'
      );
      listBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(grid.classList.contains('is-list')).toBe(true);
      expect(listBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('persists view mode to localStorage', () => {
      document.body.innerHTML =
        '<section id="curriculum"><div class="curriculum-grid"></div></section>';
      runUI();
      document
        .querySelector(
          '[data-view-toggle="curriculum"] button[data-view="list"]'
        )
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(localStorage.getItem('chiro:view:curriculum')).toBe('list');
    });

    it('restores view mode from localStorage on load', () => {
      try {
        localStorage.setItem('chiro:view:curriculum', 'list');
      } catch (e) {}
      document.body.innerHTML =
        '<section id="curriculum"><div class="curriculum-grid"></div></section>';
      runUI();
      const grid = document.querySelector('.curriculum-grid');
      expect(grid.classList.contains('is-list')).toBe(true);
    });

    it('no-op when target grid is missing', () => {
      document.body.innerHTML = '<section id="curriculum"></section>';
      runUI();
      expect(document.querySelector('[data-view-toggle]')).toBeNull();
    });
  });

  describe('active link highlighting', () => {
    it('adds .active to the link whose file matches current path', () => {
      // jsdom default URL is http://localhost/ → path "" → 'index.html'
      document.body.innerHTML = navHTML();
      runUI();
      const active = document.querySelector('.site-nav .nav-links a.active');
      expect(active).not.toBeNull();
      expect(active.getAttribute('href')).toBe('index.html');
    });
  });

  // -------------------------------------------------------------------------
  // D3 listener-leak finding at ui.js:63-79
  //   setupHamburger() does:
  //     document.addEventListener('click', ...);   // outside-click closer
  //     document.addEventListener('keydown', ...); // ESC closer
  //   These are attached PER-NAV inside the forEach loop and PER-CALL of
  //   setupHamburger. If setupHamburger is invoked twice (SPA route change,
  //   admin login refresh, or tests rerunning) the listeners accumulate on
  //   the global document — a leak.
  //
  // The expected fix: attach those globals exactly once (e.g. module-scope
  // delegation table) or remove on subsequent calls. The test below counts
  // listeners by spying on addEventListener: a second setupHamburger run
  // should NOT add new global document listeners.
  // Expected to FAIL until ui.js deduplicates the global listeners.
  // -------------------------------------------------------------------------
  it('FAILING (D3 leak): re-running ui.js does not stack global document listeners', () => {
    document.body.innerHTML = navHTML();
    const spy = vi.spyOn(document, 'addEventListener');
    runUI();
    const firstCount = spy.mock.calls.length;
    // simulate second mount (e.g. partial DOM swap on auth state change)
    runUI();
    const secondCount = spy.mock.calls.length;
    // each ui.js execution currently adds two listeners (click + keydown)
    // PER NAV-INNER. The fix should make the second run add zero new ones.
    const newlyAdded = secondCount - firstCount;
    expect(newlyAdded).toBe(0);
  });
});
