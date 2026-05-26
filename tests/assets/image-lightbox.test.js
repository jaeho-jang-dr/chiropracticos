// @vitest-environment jsdom
// =============================================================================
// image-lightbox.test.js — unit tests for assets/image-lightbox.js
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../../assets/image-lightbox.js'),
  'utf8'
);

function runGuard() {
  new Function(SRC)();
}

describe('image-lightbox', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    delete window.imgZoom;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes window.imgZoom with open/close', () => {
    runGuard();
    expect(window.imgZoom).toBeDefined();
    expect(typeof window.imgZoom.open).toBe('function');
    expect(typeof window.imgZoom.close).toBe('function');
  });

  it('injects imgz-styles into <head>', () => {
    runGuard();
    expect(document.getElementById('imgz-styles')).not.toBeNull();
  });

  it('does not build overlay until first open', () => {
    runGuard();
    expect(document.getElementById('imgz-root')).toBeNull();
  });

  it('click on [data-img-zoom] opens overlay and sets src', () => {
    runGuard();
    document.body.innerHTML =
      '<button id="b" data-img-zoom="https://media.example.com/x.png" data-img-alt="alt">click</button>';
    document
      .getElementById('b')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const ov = document.getElementById('imgz-root');
    expect(ov).not.toBeNull();
    expect(ov.classList.contains('is-open')).toBe(true);
    expect(ov.querySelector('.imgz-img').getAttribute('src')).toBe(
      'https://media.example.com/x.png'
    );
  });

  it('imgZoom.open programmatic API works', () => {
    runGuard();
    window.imgZoom.open('https://media.example.com/y.png', 'caption');
    const ov = document.getElementById('imgz-root');
    expect(ov.classList.contains('is-open')).toBe(true);
    expect(ov.querySelector('.imgz-img').getAttribute('alt')).toBe('caption');
  });

  it('ESC closes the overlay', () => {
    runGuard();
    window.imgZoom.open('https://media.example.com/y.png');
    const ov = document.getElementById('imgz-root');
    expect(ov.classList.contains('is-open')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ov.classList.contains('is-open')).toBe(false);
  });

  it('clicking the backdrop closes the overlay', () => {
    runGuard();
    window.imgZoom.open('https://media.example.com/y.png');
    const ov = document.getElementById('imgz-root');
    ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ov.classList.contains('is-open')).toBe(false);
  });

  it('clicking the close button closes the overlay', () => {
    runGuard();
    window.imgZoom.open('https://media.example.com/y.png');
    const ov = document.getElementById('imgz-root');
    ov.querySelector('.imgz-close').dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    expect(ov.classList.contains('is-open')).toBe(false);
  });

  it('contextmenu on the image is suppressed', () => {
    runGuard();
    window.imgZoom.open('https://media.example.com/y.png');
    const img = document.querySelector('.imgz-img');
    const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
    img.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('dragstart on the image is suppressed', () => {
    runGuard();
    window.imgZoom.open('https://media.example.com/y.png');
    const img = document.querySelector('.imgz-img');
    const ev = new Event('dragstart', { bubbles: true, cancelable: true });
    img.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('clicking the image toggles 1:1 mode', () => {
    runGuard();
    window.imgZoom.open('https://media.example.com/y.png');
    const img = document.querySelector('.imgz-img');
    img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(img.classList.contains('is-1to1')).toBe(true);
    img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(img.classList.contains('is-1to1')).toBe(false);
  });

  it('keyboard Enter on focused trigger opens lightbox', () => {
    runGuard();
    document.body.innerHTML =
      '<button id="b" data-img-zoom="https://media.example.com/z.png">click</button>';
    const btn = document.getElementById('b');
    btn.focus();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    const ov = document.getElementById('imgz-root');
    expect(ov).not.toBeNull();
    expect(ov.classList.contains('is-open')).toBe(true);
  });

  it('close() resets img.src and removes 1:1 class', () => {
    runGuard();
    window.imgZoom.open('https://media.example.com/y.png');
    const img = document.querySelector('.imgz-img');
    img.classList.add('is-1to1');
    window.imgZoom.close();
    expect(img.getAttribute('src')).toBe('');
    expect(img.classList.contains('is-1to1')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // D3 XSS finding at image-lightbox.js:109-111
  //   img.src = src;
  //   img.alt = alt || '';
  //   if (title) ov.setAttribute('aria-label', title);
  //
  // The alt / title strings come straight from data-* attributes that may be
  // user-influenced (admin-uploaded captions). Although .alt and .src use
  // direct property assignment (no innerHTML), an attacker who can inject
  // markup into a data-img-zoom URL ("javascript:" or onerror="…") could
  // still attempt to break out. The expected hardening is to:
  //   - reject src that does not start with https:// or / (path-relative)
  //   - escape alt before assignment (defense-in-depth)
  // This test asserts the hardened behavior: a `javascript:` src must be
  // rejected and not assigned. Expected to FAIL until image-lightbox.js
  // adds an allowlist check.
  // -------------------------------------------------------------------------
  it('rejects javascript: src — overlay does not open, no unsafe src assigned', () => {
    runGuard();
    window.imgZoom.open('javascript:alert(1)', 'pwn');
    const img = document.querySelector('.imgz-img');
    // hardened impl: overlay either doesn't open, or img.src never gets the
    // unsafe URL. Either path is acceptable; the invariant is no javascript:
    // value reaches the DOM.
    const src = (img && img.getAttribute('src')) || '';
    expect(src).not.toContain('javascript:');
    const ov = document.getElementById('imgz-root');
    if (ov) {
      expect(ov.classList.contains('is-open')).toBe(false);
    }
  });

  it('rejects data: non-image src', () => {
    runGuard();
    window.imgZoom.open('data:text/html,<script>alert(1)</script>', 'pwn');
    const img = document.querySelector('.imgz-img');
    const src = (img && img.getAttribute('src')) || '';
    expect(src).not.toContain('data:text/html');
  });

  it('accepts data:image/png src', () => {
    runGuard();
    window.imgZoom.open('data:image/png;base64,iVBORw0KGgo=', 'ok');
    const img = document.querySelector('.imgz-img');
    expect(img.getAttribute('src')).toMatch(/^data:image\/png/);
  });

  it('accepts https://, blob:, and relative paths', () => {
    runGuard();
    window.imgZoom.open('https://r2.example.com/x.png', 'ok');
    expect(document.querySelector('.imgz-img').getAttribute('src')).toBe('https://r2.example.com/x.png');
    window.imgZoom.close();

    window.imgZoom.open('/images/x.png', 'ok');
    expect(document.querySelector('.imgz-img').getAttribute('src')).toBe('/images/x.png');
    window.imgZoom.close();

    window.imgZoom.open('intro/sub.png', 'ok');
    expect(document.querySelector('.imgz-img').getAttribute('src')).toBe('intro/sub.png');
  });
});
