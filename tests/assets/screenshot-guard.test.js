// @vitest-environment jsdom
// =============================================================================
// screenshot-guard.test.js — unit tests for assets/screenshot-guard.js
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../../assets/screenshot-guard.js'),
  'utf8'
);

function runGuard() {
  new Function(SRC)();
}

describe('screenshot-guard', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    delete window.__isAdmin;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects ssg-styles into <head>', () => {
    runGuard();
    expect(document.getElementById('ssg-styles')).not.toBeNull();
  });

  it('does not inject styles twice if re-run', () => {
    runGuard();
    runGuard();
    expect(document.querySelectorAll('#ssg-styles').length).toBe(1);
  });

  describe('keydown blocking', () => {
    it('blocks F12', () => {
      runGuard();
      const ev = new KeyboardEvent('keydown', {
        key: 'F12',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('blocks Ctrl+P (print)', () => {
      runGuard();
      const ev = new KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('blocks Ctrl+S (save)', () => {
      runGuard();
      const ev = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('blocks Ctrl+U (view source)', () => {
      runGuard();
      const ev = new KeyboardEvent('keydown', {
        key: 'u',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('blocks Ctrl+Shift+I (devtools)', () => {
      runGuard();
      const ev = new KeyboardEvent('keydown', {
        key: 'i',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('allows F12 when body.is-admin', () => {
      document.body.className = 'is-admin';
      runGuard();
      const ev = new KeyboardEvent('keydown', {
        key: 'F12',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    });

    it('Ctrl+A is blocked ONLY inside [data-no-screenshot]', () => {
      runGuard();
      document.body.innerHTML =
        '<div id="protected" data-no-screenshot><span id="p-inner">x</span></div>' +
        '<div id="free"><span id="f-inner">x</span></div>';
      const ev1 = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.getElementById('p-inner').dispatchEvent(ev1);
      expect(ev1.defaultPrevented).toBe(true);

      const ev2 = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.getElementById('f-inner').dispatchEvent(ev2);
      expect(ev2.defaultPrevented).toBe(false);
    });
  });

  describe('PrintScreen handling', () => {
    it('clears clipboard on PrintScreen keyup', () => {
      const writeText = vi.fn().mockResolvedValue();
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
      runGuard();
      const ev = new KeyboardEvent('keyup', {
        key: 'PrintScreen',
        bubbles: true,
      });
      document.dispatchEvent(ev);
      expect(writeText).toHaveBeenCalledWith('');
    });
  });

  describe('contextmenu / dragstart inside protected zone', () => {
    it('blocks contextmenu inside [data-no-screenshot]', () => {
      runGuard();
      document.body.innerHTML =
        '<div data-no-screenshot><span id="x">cv</span></div>';
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      document.getElementById('x').dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('allows contextmenu outside protected zone', () => {
      runGuard();
      document.body.innerHTML = '<span id="x">cv</span>';
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      document.getElementById('x').dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    });

    it('blocks dragstart inside [data-no-screenshot]', () => {
      runGuard();
      document.body.innerHTML =
        '<div data-no-screenshot><span id="x">cv</span></div>';
      const ev = new Event('dragstart', { bubbles: true, cancelable: true });
      document.getElementById('x').dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });
  });

  describe('visibility / blur cloaking', () => {
    it('adds ssg-cloaked on visibilitychange when hidden, with protected element present', () => {
      runGuard();
      document.body.innerHTML = '<div data-no-screenshot>secret</div>';
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(document.body.classList.contains('ssg-cloaked')).toBe(true);
    });

    it('does NOT cloak when no protected zone present', () => {
      runGuard();
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(document.body.classList.contains('ssg-cloaked')).toBe(false);
    });

    it('window blur cloaks, focus uncloaks', () => {
      runGuard();
      document.body.innerHTML = '<div data-no-screenshot>x</div>';
      window.dispatchEvent(new Event('blur'));
      expect(document.body.classList.contains('ssg-cloaked')).toBe(true);
      window.dispatchEvent(new Event('focus'));
      expect(document.body.classList.contains('ssg-cloaked')).toBe(false);
    });

    it('admin is exempt from cloaking', () => {
      document.body.className = 'is-admin';
      runGuard();
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div data-no-screenshot>x</div>'
      );
      window.dispatchEvent(new Event('blur'));
      expect(document.body.classList.contains('ssg-cloaked')).toBe(false);
    });
  });

  describe('copy event in protected zone', () => {
    it('overwrites clipboard payload when copying from protected zone', () => {
      runGuard();
      document.body.innerHTML =
        '<div data-no-screenshot><span id="x">secret text</span></div>';
      // Stub selection to point inside protected zone
      const node = document.getElementById('x').firstChild;
      vi.spyOn(window, 'getSelection').mockReturnValue({
        anchorNode: node,
      });
      const setData = vi.fn();
      const ev = new Event('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'clipboardData', {
        value: { setData },
      });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
      expect(setData).toHaveBeenCalledWith(
        'text/plain',
        expect.stringContaining('보호')
      );
    });
  });
});
