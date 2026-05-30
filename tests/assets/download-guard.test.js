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

    // Regression: contextmenu must be suppressed on a non-allowlisted <video>.
    // The guard attaches a real listener via
    //   v.addEventListener('contextmenu', e => e.preventDefault())
    // (an inline `oncontextmenu` attribute would NOT install a listener in jsdom,
    // and is also blocked under enforced CSP).
    it('suppresses contextmenu on non-allowlisted <video>', () => {
      document.body.innerHTML =
        '<video id="v" src="https://media.example.com/private.mp4"></video>';
      runGuard();
      const v = document.getElementById('v');
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      v.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('leaves controlsList off an allowlisted NotebookLM <video> (lockVideoEl early-returns)', () => {
      document.body.innerHTML =
        '<video id="v" src="https://media.example.com/ch2/02_video_part1.mp4"></video>';
      runGuard();
      const v = document.getElementById('v');
      // lockVideoEl early-returns for allowed assets → no nodownload lock.
      // (Right-click is still caught by the global video matches() handler.)
      expect(v.hasAttribute('controlsList')).toBe(false);
      expect(v.hasAttribute('disablePictureInPicture')).toBe(false);
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

    it('locks a newly added top-level <video> via MutationObserver', async () => {
      runGuard();
      const v = document.createElement('video');
      v.src = 'https://media.example.com/private.mp4';
      document.body.appendChild(v);
      await flushMicrotasks();
      // collect() includes the root node itself, so videos are handled correctly
      expect(v.getAttribute('controlsList')).toContain('nodownload');
    });

    // -----------------------------------------------------------------------
    // BUG #1 [medium] (PINNED with it.fails): normalizeAnchors() uses
    // (root||document).querySelectorAll('a[href]') instead of the collect()
    // helper that videos/images use. querySelectorAll never returns the root
    // node, so when the MutationObserver hands it a node that is ITSELF an
    // <a href> (the canonical pattern for a dynamically injected download link),
    // the anchor is skipped: its personal-asset download attribute is NOT
    // stripped. FIX: normalizeAnchors should use
    //   collect(root, 'a[href]').forEach(...)
    // After the fix, replace `it.fails` with `it`.
    // -----------------------------------------------------------------------
    it(
      'BUG#1: strips download from a dynamically-added top-level personal PDF anchor',
      async () => {
        runGuard();
        const a = document.createElement('a');
        a.setAttribute('href', '/files/leaked.pdf');
        a.setAttribute('download', '');
        a.textContent = 'leak';
        document.body.appendChild(a);
        await flushMicrotasks();
        // descendant-only scan misses the anchor itself → download survives (bug)
        expect(a.hasAttribute('download')).toBe(false);
      }
    );

    // Coverage: for an anonymous user the MutationObserver anonymous-flip path
    // (lockNlmForAnonymous) sweeps the whole document, so a dynamically-added
    // NLM anchor IS stripped via that route — this passes today (not bug #1).
    it('strips a dynamically-added NLM anchor for an anonymous user', async () => {
      document.body.className = 'is-anonymous';
      runGuard();
      const a = document.createElement('a');
      a.setAttribute('href', 'https://media.example.com/ch2/01_podcast_master.m4a');
      a.setAttribute('download', '');
      a.classList.add('allow-download');
      document.body.appendChild(a);
      await flushMicrotasks();
      expect(a.hasAttribute('download')).toBe(false);
      expect(a.classList.contains('allow-download')).toBe(false);
    });

    it('processes a descendant anchor inside a dynamically-added container', async () => {
      runGuard();
      const div = document.createElement('div');
      div.innerHTML =
        '<a id="nested" href="/files/leaked.pdf" download>leak</a>';
      document.body.appendChild(div);
      await flushMicrotasks();
      // descendant anchors are found by querySelectorAll today, so this passes
      expect(document.getElementById('nested').hasAttribute('download')).toBe(false);
    });
  });

  describe('NLM_RE canonical pairing', () => {
    // -----------------------------------------------------------------------
    // BUG #4 [low] (PINNED with it.fails): NLM_RE is
    //   /\/(0[123]_(podcast|video_part[12]))[^\/]*\.(mp4|m4a)(?:[?#]|$)/i
    // which treats the leading index digit and the artifact name as
    // independent, whitelisting non-canonical cross-products such as
    // 03_podcast*, 01_video_part1*, 02_video_part2*. The real convention is
    // fixed pairs: 01_podcast, 02_video_part1, 03_video_part2. FIX:
    //   /\/(01_podcast|02_video_part1|03_video_part2)[^\/]*\.(mp4|m4a)(?:[?#]|$)/i
    // After the fix, replace `it.fails` with `it`.
    // -----------------------------------------------------------------------
    it(
      'BUG#4: does NOT allow-download a non-canonical 03_podcast link',
      () => {
        document.body.innerHTML =
          '<a id="x" href="https://media.example.com/ch2/03_podcast_draft.mp4" download>x</a>';
        runGuard();
        const a = document.getElementById('x');
        expect(a.hasAttribute('download')).toBe(false);
        expect(a.classList.contains('allow-download')).toBe(false);
      }
    );

    it(
      'BUG#4: does NOT allow-download a non-canonical 01_video_part1 link',
      () => {
        document.body.innerHTML =
          '<a id="x" href="https://media.example.com/ch2/01_video_part1.m4a" download>x</a>';
        runGuard();
        const a = document.getElementById('x');
        expect(a.hasAttribute('download')).toBe(false);
        expect(a.classList.contains('allow-download')).toBe(false);
      }
    );

    it(
      'BUG#4: does NOT allow-download a non-canonical 02_podcast draft',
      () => {
        document.body.innerHTML =
          '<a id="x" href="https://media.example.com/ch2/02_podcast_admin.m4a" download>x</a>';
        runGuard();
        const a = document.getElementById('x');
        expect(a.hasAttribute('download')).toBe(false);
      }
    );

    // Canonical names must keep working both before and after the fix.
    it('allow-downloads canonical 03_video_part2 mp4', () => {
      document.body.innerHTML =
        '<a id="ok" href="https://media.example.com/ch2/03_video_part2_outro.mp4">x</a>';
      runGuard();
      const a = document.getElementById('ok');
      expect(a.hasAttribute('download')).toBe(true);
      expect(a.classList.contains('allow-download')).toBe(true);
    });

    it('allow-downloads canonical NLM link carrying a ?v= cache-buster', () => {
      document.body.innerHTML =
        '<a id="ok" href="https://media.example.com/ch2/01_podcast_master.m4a?v=20260530">x</a>';
      runGuard();
      const a = document.getElementById('ok');
      expect(a.hasAttribute('download')).toBe(true);
    });
  });

  describe('global contextmenu — query-string anchors', () => {
    // -----------------------------------------------------------------------
    // BUG #5 [low] (PINNED with it.fails): the global contextmenu handler keys
    // the "block right-click on download links" branch off attribute-SUFFIX
    // selectors a[href$=".pdf"], a[href$=".mp4"], a[href$=".m4a"]. R2 /
    // cache-busted URLs carry ?v=… or #frag, so href="…/textbook.pdf?v=3" ends
    // in "3" and the suffix match fails → right-click is NOT suppressed on the
    // very asset the guard targets. FIX: test the closest anchor's href with
    //   /\.(pdf|docx?|mp4|m4a)(?:[?#]|$)/i
    // After the fix, replace `it.fails` with `it`.
    // -----------------------------------------------------------------------
    it(
      'BUG#5: suppresses contextmenu on a PDF anchor with a ?v= query string',
      () => {
        document.body.innerHTML =
          '<a id="a" href="/files/textbook.pdf?v=3">x</a>';
        runGuard();
        const a = document.getElementById('a');
        const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
        a.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
      }
    );

    it(
      'BUG#5: suppresses contextmenu on an m4a anchor with a #fragment',
      () => {
        document.body.innerHTML =
          '<a id="a" href="https://media.example.com/x.m4a#t=10">x</a>';
        runGuard();
        const a = document.getElementById('a');
        const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
        a.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
      }
    );

    // Coverage: a child node (icon/text span) inside a download anchor — the
    // matches() branch won't fire, only the closest('a') branch can.
    it(
      'BUG#5: suppresses contextmenu on a child span inside a query-string PDF anchor',
      () => {
        document.body.innerHTML =
          '<a id="a" href="/files/textbook.pdf?v=3"><span id="s">download</span></a>';
        runGuard();
        const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
        document.getElementById('s').dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
      }
    );

    // Bare-suffix anchor (no query) must keep being suppressed after the fix.
    it('suppresses contextmenu on a plain .mp4 download anchor (no query)', () => {
      document.body.innerHTML =
        '<a id="a" href="https://media.example.com/private.mp4">x</a>';
      runGuard();
      const a = document.getElementById('a');
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      a.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('does not suppress contextmenu on a plain non-media link', () => {
      document.body.innerHTML = '<a id="a" href="/about.html">x</a>';
      runGuard();
      const a = document.getElementById('a');
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      a.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    });
  });

  describe('coverage: editable fields & admin runtime flip', () => {
    it('does not suppress contextmenu inside a textarea', () => {
      document.body.innerHTML = '<textarea id="t"></textarea>';
      runGuard();
      const t = document.getElementById('t');
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      t.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    });

    it('does not suppress contextmenu when window.__isAdmin is true', () => {
      window.__isAdmin = true;
      document.body.innerHTML = '<img id="i" src="/x.png" />';
      runGuard();
      const img = document.getElementById('i');
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      img.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    });

    it('unlocks media + re-adds download when body flips to is-admin at runtime', async () => {
      document.body.innerHTML =
        '<a id="a" href="/files/textbook.pdf" download>x</a>' +
        '<video id="v" src="https://media.example.com/private.mp4"></video>' +
        '<img id="i" src="/x.png" />';
      runGuard();
      // non-admin first pass locks everything
      expect(document.getElementById('a').hasAttribute('download')).toBe(false);
      expect(document.getElementById('v').getAttribute('controlsList')).toContain('nodownload');
      // now an admin session is established → body class changes
      document.body.classList.add('is-admin');
      await flushMicrotasks();
      const a = document.getElementById('a');
      const v = document.getElementById('v');
      const img = document.getElementById('i');
      expect(a.hasAttribute('download')).toBe(true);
      expect(a.classList.contains('allow-download')).toBe(true);
      expect(v.hasAttribute('controlsList')).toBe(false);
      expect(v.hasAttribute('disablePictureInPicture')).toBe(false);
      expect(img.hasAttribute('draggable')).toBe(false);
    });

    it('removes NLM allow-download when body flips to is-anonymous at runtime', async () => {
      document.body.innerHTML =
        '<a id="ok" href="https://media.example.com/ch2/01_podcast_master.m4a" download>x</a>';
      runGuard();
      const a = document.getElementById('ok');
      // logged-in first pass keeps the NLM allowlist
      expect(a.hasAttribute('download')).toBe(true);
      expect(a.classList.contains('allow-download')).toBe(true);
      // session downgrades to anonymous
      document.body.classList.add('is-anonymous');
      await flushMicrotasks();
      expect(a.hasAttribute('download')).toBe(false);
      expect(a.classList.contains('allow-download')).toBe(false);
    });
  });
});
