// @vitest-environment jsdom
// =============================================================================
// download-guard.test.js — unit tests for assets/download-guard.js
// =============================================================================
// The guard is an IIFE that runs on load. We re-execute it inside a freshly
// reset DOM per test by reading the source once and evaluating it via Function.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../../assets/download-guard.js'),
  'utf8'
);

function runGuard() {
  // Evaluate inside the current jsdom global scope.
  new Function(SRC)();
}

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('download-guard', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    // ensure no stale admin flag
    delete window.__isAdmin;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('NotebookLM allowlist', () => {
    it('keeps download attribute on NotebookLM podcast m4a (01_podcast*)', () => {
      document.body.innerHTML =
        '<a id="ok" href="https://media.example.com/ch2/01_podcast_master.m4a" download>x</a>';
      runGuard();
      const a = document.getElementById('ok');
      expect(a.hasAttribute('download')).toBe(true);
      expect(a.classList.contains('allow-download')).toBe(true);
    });

    it('keeps download attribute on NotebookLM video mp4 (02_video_part1)', () => {
      document.body.innerHTML =
        '<a id="ok" href="https://media.example.com/ch3/02_video_part1_intro.mp4">x</a>';
      runGuard();
      const a = document.getElementById('ok');
      expect(a.hasAttribute('download')).toBe(true);
      expect(a.classList.contains('allow-download')).toBe(true);
    });

    it('strips download attribute from arbitrary personal mp4', () => {
      document.body.innerHTML =
        '<a id="bad" href="https://media.example.com/private.mp4" download>x</a>';
      runGuard();
      const a = document.getElementById('bad');
      expect(a.hasAttribute('download')).toBe(false);
    });

    it('strips download attribute from PDF link', () => {
      document.body.innerHTML =
        '<a id="bad" href="/files/textbook.pdf" download>x</a>';
      runGuard();
      const a = document.getElementById('bad');
      expect(a.hasAttribute('download')).toBe(false);
    });

    it('strips download attribute from DOCX link', () => {
      document.body.innerHTML =
        '<a id="bad" href="/files/handout.docx" download>x</a>';
      runGuard();
      const a = document.getElementById('bad');
      expect(a.hasAttribute('download')).toBe(false);
    });

    it('blocks NotebookLM allowlist when body has is-anonymous', () => {
      document.body.className = 'is-anonymous';
      document.body.innerHTML =
        '<a id="ok" href="https://media.example.com/ch2/01_podcast_master.m4a" download>x</a>';
      runGuard();
      const a = document.getElementById('ok');
      expect(a.hasAttribute('download')).toBe(false);
      expect(a.classList.contains('allow-download')).toBe(false);
    });
  });

  describe('video lockdown', () => {
    it('sets controlsList=nodownload on non-allowlisted video', () => {
      document.body.innerHTML =
        '<video id="v" src="https://media.example.com/private.mp4"></video>';
      runGuard();
      const v = document.getElementById('v');
      expect(v.getAttribute('controlsList')).toContain('nodownload');
      expect(v.hasAttribute('disablePictureInPicture')).toBe(true);
    });

    it('leaves allowlisted NotebookLM video unlocked', () => {
      document.body.innerHTML =
        '<video id="v" src="https://media.example.com/ch2/02_video_part1.mp4"></video>';
      runGuard();
      const v = document.getElementById('v');
      expect(v.hasAttribute('controlsList')).toBe(false);
    });

    // D3 finding: setting `oncontextmenu` via setAttribute does NOT install a
    // real listener in jsdom (CSP-unsafe in many envs) — must use addEventListener.
    // Expected to FAIL until download-guard.js:56 is rewritten with
    // v.addEventListener('contextmenu', e => e.preventDefault()).
    it('FAILING (D3 bug): video contextmenu is actually suppressed', () => {
      document.body.innerHTML =
        '<video id="v" src="https://media.example.com/private.mp4"></video>';
      runGuard();
      const v = document.getElementById('v');
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      v.dispatchEvent(ev);
      // setAttribute('oncontextmenu', 'return false') does NOT install a
      // listener in jsdom — defaultPrevented stays false. The fix is to use
      // v.addEventListener('contextmenu', e => e.preventDefault()).
      expect(ev.defaultPrevented).toBe(true);
    });
  });

  describe('image lockdown', () => {
    it('sets draggable=false on images', () => {
      document.body.innerHTML = '<img id="i" src="/x.png" />';
      runGuard();
      expect(document.getElementById('i').getAttribute('draggable')).toBe(
        'false'
      );
    });

    it('preventDefault on dragstart', () => {
      document.body.innerHTML = '<img id="i" src="/x.png" />';
      runGuard();
      const img = document.getElementById('i');
      const ev = new Event('dragstart', { bubbles: true, cancelable: true });
      img.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });
  });

  describe('global contextmenu suppression', () => {
    it('prevents contextmenu on a non-allowlisted PDF anchor', () => {
      document.body.innerHTML = '<a id="a" href="/x.pdf">x</a>';
      runGuard();
      const a = document.getElementById('a');
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      a.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('allows contextmenu inside .allow-download container', () => {
      document.body.innerHTML =
        '<a id="a" class="allow-download" href="https://media.example.com/ch2/01_podcast_master.m4a">x</a>';
      runGuard();
      const a = document.getElementById('a');
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      a.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    });

    it('does not suppress when body.is-admin', () => {
      document.body.className = 'is-admin';
      document.body.innerHTML = '<img id="i" src="/x.png" />';
      runGuard();
      const img = document.getElementById('i');
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      img.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    });
  });

  describe('admin mode', () => {
    it('does not strip download attrs when body.is-admin at load time', () => {
      document.body.className = 'is-admin';
      document.body.innerHTML =
        '<a id="a" href="/files/textbook.pdf" download>x</a>';
      runGuard();
      // admin path calls unlockAllForAdmin which re-adds download to all media
      const a = document.getElementById('a');
      expect(a.hasAttribute('download')).toBe(true);
    });
  });

  describe('blob/data URL handling', () => {
    it('strips download from blob: URLs (not an NLM allowlist match)', () => {
      document.body.innerHTML =
        '<a id="a" href="blob:https://x.test/abc" download>x</a>';
      runGuard();
      expect(document.getElementById('a').hasAttribute('download')).toBe(false);
    });

    it('strips download from data: URLs', () => {
      document.body.innerHTML =
        '<a id="a" href="data:application/pdf;base64,JVBERi0=" download>x</a>';
      runGuard();
      expect(document.getElementById('a').hasAttribute('download')).toBe(false);
    });
  });

  describe('dynamic node addition', () => {
    it('locks newly added image via MutationObserver', async () => {
      runGuard();
      const img = document.createElement('img');
      img.src = '/new.png';
      document.body.appendChild(img);
      await flushMicrotasks();
      expect(img.getAttribute('draggable')).toBe('false');
    });
  });
});
