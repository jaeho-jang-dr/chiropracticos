// @vitest-environment jsdom
// =============================================================================
// pdf-viewer.test.js — unit tests for assets/pdf-viewer.js
// =============================================================================
// pdf-viewer.js relies on the browser's native PDF rendering inside an iframe;
// pdfjs-dist is NOT imported by this module. We still mock the module to
// satisfy any future migration path and to guard against accidental imports.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock pdfjs-dist preemptively (the current module does not import it, but
// this future-proofs the test setup).
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 5,
      getPage: vi.fn(() => Promise.resolve({})),
    }),
  })),
  GlobalWorkerOptions: { workerSrc: '' },
}));

const SRC = readFileSync(
  resolve(__dirname, '../../assets/pdf-viewer.js'),
  'utf8'
);

function runGuard() {
  new Function(SRC)();
}

describe('pdf-viewer', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    delete window.__isAdmin;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects stylesheet on load', () => {
    runGuard();
    expect(document.getElementById('pdf-viewer-styles')).not.toBeNull();
  });

  it('does NOT build the overlay until a PDF link is clicked', () => {
    runGuard();
    expect(document.getElementById('pdfv-root')).toBeNull();
  });

  it('intercepts PDF link click and builds overlay', () => {
    runGuard();
    document.body.innerHTML = '<a id="a" href="/files/textbook.pdf">x</a>';
    const a = document.getElementById('a');
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    a.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    const overlay = document.getElementById('pdfv-root');
    expect(overlay).not.toBeNull();
    expect(overlay.classList.contains('is-open')).toBe(true);
  });

  it('sets iframe src with #toolbar=0 fragment to hide download button', () => {
    runGuard();
    document.body.innerHTML = '<a id="a" href="/files/textbook.pdf">x</a>';
    document
      .getElementById('a')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const iframe = document.getElementById('pdfv-frame');
    expect(iframe.src).toContain('#toolbar=0');
    expect(iframe.src).toContain('navpanes=0');
  });

  it('uses link title for modal heading', () => {
    runGuard();
    document.body.innerHTML =
      '<a id="a" href="/files/textbook.pdf" aria-label="신경학 교재">신경학 교재</a>';
    document
      .getElementById('a')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(document.getElementById('pdfv-title').textContent).toBe('신경학 교재');
  });

  it('admin users get default browser behavior (no preventDefault)', () => {
    document.body.className = 'is-admin';
    runGuard();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<a id="a" href="/files/textbook.pdf">x</a>'
    );
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('a').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(document.getElementById('pdfv-root')).toBeNull();
  });

  it('skips PDF interception when link has .allow-download', () => {
    runGuard();
    document.body.innerHTML =
      '<a id="a" class="allow-download" href="/files/textbook.pdf">x</a>';
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('a').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('ESC key closes the open overlay', () => {
    runGuard();
    document.body.innerHTML = '<a id="a" href="/files/textbook.pdf">x</a>';
    document
      .getElementById('a')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const overlay = document.getElementById('pdfv-root');
    expect(overlay.classList.contains('is-open')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay.classList.contains('is-open')).toBe(false);
  });

  it('click on overlay backdrop closes it', () => {
    runGuard();
    document.body.innerHTML = '<a id="a" href="/files/textbook.pdf">x</a>';
    document
      .getElementById('a')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const overlay = document.getElementById('pdfv-root');
    // click directly on overlay (target === ov) should close
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay.classList.contains('is-open')).toBe(false);
  });

  it('contextmenu inside overlay is suppressed', () => {
    runGuard();
    document.body.innerHTML = '<a id="a" href="/files/textbook.pdf">x</a>';
    document
      .getElementById('a')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const overlay = document.getElementById('pdfv-root');
    const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
    overlay.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('DOCX link triggers alert (no overlay)', () => {
    runGuard();
    document.body.innerHTML = '<a id="a" href="/files/handout.docx">x</a>';
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('a').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(alertSpy).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // D3 fragment-collision bug at pdf-viewer.js:78
  //   const fragment = '#toolbar=0&navpanes=0&...';
  //   frame.src = url + (url.indexOf('#') >= 0 ? '' : fragment);
  // If the user-supplied URL already has a fragment (e.g. "/doc.pdf#page=3"),
  // the security fragment is silently skipped — the Chromium PDF toolbar
  // (including the download button) is exposed. Correct behavior should
  // MERGE: e.g. "/doc.pdf#page=3&toolbar=0&navpanes=0...".
  // Expected to FAIL until pdf-viewer.js:78 is rewritten to merge fragments.
  // -------------------------------------------------------------------------
  it('FAILING (D3 fragment collision): URL with existing #fragment still hides toolbar', () => {
    runGuard();
    document.body.innerHTML = '<a id="a" href="/files/textbook.pdf#page=3">x</a>';
    document
      .getElementById('a')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const iframe = document.getElementById('pdfv-frame');
    expect(iframe.src).toContain('toolbar=0');
  });
});
