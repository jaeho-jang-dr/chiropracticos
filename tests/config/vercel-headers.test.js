// =============================================================================
// tests/config/vercel-headers.test.js — pure config validation for vercel.json
// =============================================================================
// We do not invoke Vercel's router; instead we parse vercel.json, locate the
// `headers` rule by source pattern, and compile each pattern into a RegExp
// using path-to-regexp semantics that Vercel inherits. The goal is to lock
// in:
//   * Every chapter HTML page gets X-Robots-Tag + must-revalidate, both with
//     and without the .html suffix (cleanUrls strips it).
//   * Internal pages (admin/debug/editor/viewer/auth-callback) likewise.
//   * /assets/* is immutable for a year.
//   * The catch-all `/(.*)` rule applies the modern security header bundle
//     (X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy,
//     Permissions-Policy, CSP-Report-Only).
//   * CSP-Report-Only points report-uri at /api/csp-report.
// =============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERCEL_JSON_PATH = resolve(__dirname, '..', '..', 'vercel.json');

// ---------------------------------------------------------------------------
// minimal path-to-regexp compiler (only what we need for vercel.json sources)
// ---------------------------------------------------------------------------
// path-to-regexp v6 semantics in a nutshell:
//   :name             → named param matching [^/]+
//   :name(custom)     → named param matching `custom` (raw regex fragment)
//   (custom)          → anonymous capturing group matching `custom`
//   (\\.html)?        → optional group; the leading backslash in JSON means
//                        a literal '.' inside the regex, so it stays as-is.
//
// Vercel anchors at start; we mirror that with ^...$.
// ---------------------------------------------------------------------------

function vercelSourceToRegExp(source) {
  let i = 0;
  let out = '^';
  while (i < source.length) {
    const ch = source[i];
    if (ch === ':') {
      // Read param name.
      i++;
      let name = '';
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        name += source[i++];
      }
      // Optional custom regex (...)
      if (source[i] === '(') {
        const start = ++i;
        let depth = 1;
        while (i < source.length && depth > 0) {
          if (source[i] === '\\' && i + 1 < source.length) { i += 2; continue; }
          if (source[i] === '(') depth++;
          else if (source[i] === ')') {
            depth--;
            if (depth === 0) break;
          }
          i++;
        }
        const custom = source.slice(start, i);
        i++; // consume ')'
        out += '(' + custom + ')';
      } else {
        out += '([^/]+)';
      }
    } else if (ch === '(') {
      // Anonymous group — copy verbatim including parens, then check for ?
      const start = i++;
      let depth = 1;
      while (i < source.length && depth > 0) {
        if (source[i] === '\\' && i + 1 < source.length) { i += 2; continue; }
        if (source[i] === '(') depth++;
        else if (source[i] === ')') {
          depth--;
          if (depth === 0) break;
        }
        i++;
      }
      i++; // consume ')'
      const group = source.slice(start, i);
      out += group;
      if (source[i] === '?') { out += '?'; i++; }
    } else {
      // Escape regex metachars that are NOT already escaped in the source.
      if ('.+*?^$|{}[]'.includes(ch)) {
        out += '\\' + ch;
      } else if (ch === '\\') {
        // Pass-through (e.g. \\. in the JSON becomes \. in regex)
        out += ch + (source[i + 1] ?? '');
        i++;
      } else {
        out += ch;
      }
      i++;
    }
  }
  out += '$';
  return new RegExp(out);
}

// ---------------------------------------------------------------------------
// vercel.json loading
// ---------------------------------------------------------------------------

let cfg;
let rulesBySource;

beforeAll(() => {
  const raw = readFileSync(VERCEL_JSON_PATH, 'utf-8');
  cfg = JSON.parse(raw);
  rulesBySource = new Map(cfg.headers.map((r) => [r.source, r]));
});

function headersFor(source) {
  const rule = rulesBySource.get(source);
  if (!rule) throw new Error(`No rule for source ${source}`);
  return Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
}

// ---------------------------------------------------------------------------
// catch-all security headers
// ---------------------------------------------------------------------------

describe('vercel.json — catch-all /(.*) security headers', () => {
  it('has the catch-all rule', () => {
    expect(rulesBySource.has('/(.*)')).toBe(true);
  });

  it('sets X-Content-Type-Options: nosniff', () => {
    const h = headersFor('/(.*)');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
  });

  it('sets X-Frame-Options: DENY', () => {
    const h = headersFor('/(.*)');
    expect(h['X-Frame-Options']).toBe('DENY');
  });

  it('sets HSTS with 2-year max-age + includeSubDomains + preload', () => {
    const h = headersFor('/(.*)');
    expect(h['Strict-Transport-Security']).toBe(
      'max-age=63072000; includeSubDomains; preload'
    );
  });

  it('sets Referrer-Policy: strict-origin-when-cross-origin', () => {
    const h = headersFor('/(.*)');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('sets Permissions-Policy that disables camera / mic / geolocation / FLoC', () => {
    const h = headersFor('/(.*)');
    const pp = h['Permissions-Policy'];
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=()');
    expect(pp).toContain('interest-cohort=()');
  });

  it('ships a Content-Security-Policy-Report-Only header (not enforced yet)', () => {
    const h = headersFor('/(.*)');
    expect(h['Content-Security-Policy-Report-Only']).toBeTypeOf('string');
    // Should NOT also ship an enforced CSP — we're in Report-Only phase.
    expect(h['Content-Security-Policy']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// CSP-Report-Only contents
// ---------------------------------------------------------------------------

describe('vercel.json — CSP-Report-Only directives', () => {
  let csp;
  beforeAll(() => {
    csp = headersFor('/(.*)')['Content-Security-Policy-Report-Only'];
  });

  it('report-uri points to /api/csp-report', () => {
    expect(csp).toMatch(/report-uri\s+\/api\/csp-report/);
  });

  it('includes report-uri directive (older browsers)', () => {
    // Older Chromium / WebKit pre-Reporting-API rely on report-uri.
    // We assert it is present in the current Report-Only header.
    expect(csp.split(';').some((d) => d.trim().startsWith('report-uri'))).toBe(true);
  });

  it('sets default-src to self', () => {
    expect(csp).toMatch(/default-src\s+'self'/);
  });

  it('blocks framing entirely (frame-ancestors none)', () => {
    expect(csp).toMatch(/frame-ancestors\s+'none'/);
  });

  it('disallows plugin <object> embeds', () => {
    expect(csp).toMatch(/object-src\s+'none'/);
  });

  it('pins base-uri to self (prevent <base> hijack)', () => {
    expect(csp).toMatch(/base-uri\s+'self'/);
  });

  it('whitelists the R2 public bucket for img/media/connect', () => {
    expect(csp).toContain('https://pub-e44b2168eea2482095d15cb22dc4d9b7.r2.dev');
  });

  it('whitelists Supabase wss + https for connect-src', () => {
    expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.supabase\.co/);
    expect(csp).toMatch(/connect-src[^;]*wss:\/\/\*\.supabase\.co/);
  });

  it('whitelists YouTube + Google for frame-src', () => {
    expect(csp).toMatch(/frame-src[^;]*https:\/\/www\.youtube\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/accounts\.google\.com/);
  });
});

// ---------------------------------------------------------------------------
// /assets/* immutable caching
// ---------------------------------------------------------------------------

describe('vercel.json — /assets/(.*) cache-control', () => {
  it('serves assets as public, max-age=31536000, immutable', () => {
    const h = headersFor('/assets/(.*)');
    expect(h['Cache-Control']).toBe('public, max-age=31536000, immutable');
  });

  it('source pattern matches assets/main.css', () => {
    const re = vercelSourceToRegExp('/assets/(.*)');
    expect(re.test('/assets/main.css')).toBe(true);
    expect(re.test('/assets/img/logo.png')).toBe(true);
  });

  it('does NOT match /asset (typo) or /assets (bare)', () => {
    const re = vercelSourceToRegExp('/assets/(.*)');
    expect(re.test('/asset/main.css')).toBe(false);
    expect(re.test('/assets')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// chapter regex — cleanUrls + .html variant
// ---------------------------------------------------------------------------

describe('vercel.json — chapter source pattern (X-Robots-Tag)', () => {
  const CHAPTER_SRC = '/chapter(?!01_introduction|02_functional_neurology|13_soft_tissue):rest((?:_|[a-zA-Z0-9-]).*?)(\\.html)?';
  let re;

  beforeAll(() => {
    re = vercelSourceToRegExp(CHAPTER_SRC);
  });

  it('rule is registered with both Cache-Control + X-Robots-Tag', () => {
    const h = headersFor(CHAPTER_SRC);
    expect(h['Cache-Control']).toBe('public, max-age=0, must-revalidate');
    expect(h['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('does NOT match public chapter01 (introduction)', () => {
    expect(re.test('/chapter01_introduction.html')).toBe(false);
    expect(re.test('/chapter01_introduction')).toBe(false);
  });

  it('does NOT match public chapter02 (functional neurology)', () => {
    expect(re.test('/chapter02_functional_neurology.html')).toBe(false);
    expect(re.test('/chapter02_functional_neurology')).toBe(false);
  });

  it('does NOT match public chapter13 (soft tissue)', () => {
    expect(re.test('/chapter13_soft_tissue.html')).toBe(false);
    expect(re.test('/chapter13_soft_tissue')).toBe(false);
  });

  it('matches other chapters (chapter12, chapter04_diversified)', () => {
    expect(re.test('/chapter12_applied_kinesiology')).toBe(true);
    expect(re.test('/chapter04_diversified.html')).toBe(true);
  });

  it('matches hyphenated private chapter slugs', () => {
    expect(re.test('/chapter-4-gonstead')).toBe(true);
  });

  it('does NOT match bare /chapter', () => {
    expect(re.test('/chapter')).toBe(false);
  });

  it('does NOT match unrelated paths like /api/content', () => {
    expect(re.test('/api/content')).toBe(false);
    expect(re.test('/index.html')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// admin / debug / editor / viewer / auth-callback noindex rule
// ---------------------------------------------------------------------------

describe('vercel.json — internal pages noindex rule', () => {
  const INTERNAL_SRC = '/:p(admin|debug|editor|viewer|auth-callback)(\\.html)?';
  let re;

  beforeAll(() => {
    re = vercelSourceToRegExp(INTERNAL_SRC);
  });

  it('rule sets X-Robots-Tag: noindex, nofollow', () => {
    const h = headersFor(INTERNAL_SRC);
    expect(h['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it.each([
    ['/admin'],
    ['/admin.html'],
    ['/debug'],
    ['/debug.html'],
    ['/editor'],
    ['/editor.html'],
    ['/viewer'],
    ['/viewer.html'],
    ['/auth-callback'],
    ['/auth-callback.html'],
  ])('matches %s', (path) => {
    expect(re.test(path)).toBe(true);
  });

  it.each([
    ['/admins'],
    ['/admin/foo'],
    ['/login'],
    ['/index.html'],
    ['/admin.htm'],
  ])('does NOT match %s', (path) => {
    expect(re.test(path)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// .html catch-all — no caching on HTML
// ---------------------------------------------------------------------------

describe('vercel.json — HTML must-revalidate', () => {
  it('any *.html file gets max-age=0, must-revalidate', () => {
    const h = headersFor('/(.*\\.html)');
    expect(h['Cache-Control']).toBe('public, max-age=0, must-revalidate');
  });

  it('regex matches /index.html and /chapter01.html', () => {
    const re = vercelSourceToRegExp('/(.*\\.html)');
    expect(re.test('/index.html')).toBe(true);
    expect(re.test('/chapter01_introduction.html')).toBe(true);
    expect(re.test('/index.htm')).toBe(false);
    expect(re.test('/index')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// /images/* cache rule
// ---------------------------------------------------------------------------

describe('vercel.json — /images/(.*) cache', () => {
  it('serves images public, max-age=31536000, immutable (1 year)', () => {
    const h = headersFor('/images/(.*)');
    expect(h['Cache-Control']).toBe('public, max-age=31536000, immutable');
  });
});

// ---------------------------------------------------------------------------
// functions config — csp-report has small memory + short maxDuration
// ---------------------------------------------------------------------------

describe('vercel.json — functions config sanity', () => {
  it('api/csp-report.js is tightly resourced', () => {
    expect(cfg.functions['api/csp-report.js']).toEqual({
      maxDuration: 5,
      memory: 128,
    });
  });

  it('cleanUrls is enabled (drops .html in URLs)', () => {
    expect(cfg.cleanUrls).toBe(true);
  });

  it('trailingSlash is disabled', () => {
    expect(cfg.trailingSlash).toBe(false);
  });
});

// ===========================================================================
// Vercel header RESOLUTION model — first-match-wins merge across all rules
// ===========================================================================
// Vercel evaluates EVERY headers rule whose source matches the request path
// and merges the resulting header sets. When two matching rules set the SAME
// header key, the FIRST matching rule (in array order) wins for that key.
// (This mirrors observed behavior: earlier, more-specific rules like
// /assets/(.*) override the catch-all Cache-Control.)
//
// We compile every rule's source once and, for a given served path, compute
// the effective header map. This lets us assert what a real visitor receives —
// which is what the cleanUrls footgun is about: the served path for an
// internal page is the EXTENSIONLESS form, so a `.html`-only source never
// matches and the page silently loses its Cache-Control.
// ---------------------------------------------------------------------------

function effectiveHeaders(path) {
  const merged = {};
  for (const rule of cfg.headers) {
    const re = vercelSourceToRegExp(rule.source);
    if (!re.test(path)) continue;
    for (const { key, value } of rule.headers) {
      // First matching rule wins for a given key.
      if (!(key in merged)) merged[key] = value;
    }
  }
  return merged;
}

describe('vercel.json — header resolution model (sanity)', () => {
  it('chapter clean URL still receives must-revalidate + noindex', () => {
    const h = effectiveHeaders('/chapter04_gonstead');
    expect(h['Cache-Control']).toBe('public, max-age=0, must-revalidate');
    expect(h['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('chapter .html URL also receives must-revalidate + noindex', () => {
    const h = effectiveHeaders('/chapter04_gonstead.html');
    expect(h['Cache-Control']).toBe('public, max-age=0, must-revalidate');
    expect(h['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('public chapters DO NOT receive X-Robots-Tag (indexable)', () => {
    const h1 = effectiveHeaders('/chapter01_introduction');
    const h2 = effectiveHeaders('/chapter02_functional_neurology');
    const h13 = effectiveHeaders('/chapter13_soft_tissue');
    expect(h1['X-Robots-Tag']).toBeUndefined();
    expect(h2['X-Robots-Tag']).toBeUndefined();
    expect(h13['X-Robots-Tag']).toBeUndefined();
  });

  it('/assets/* Cache-Control wins over the catch-all (first-match)', () => {
    const h = effectiveHeaders('/assets/main.css');
    expect(h['Cache-Control']).toBe('public, max-age=31536000, immutable');
  });

  it('every served path still gets the security header bundle from catch-all', () => {
    for (const p of ['/login', '/index', '/chapter04_gonstead', '/assets/main.css']) {
      const h = effectiveHeaders(p);
      expect(h['X-Content-Type-Options']).toBe('nosniff');
      expect(h['X-Frame-Options']).toBe('DENY');
    }
  });

  it('a literal /*.html request gets must-revalidate via the .html catch-all', () => {
    // Direct .html hits still match /(.*\.html) even though cleanUrls 308s them.
    const h = effectiveHeaders('/login.html');
    expect(h['Cache-Control']).toBe('public, max-age=0, must-revalidate');
  });
});

// ===========================================================================
// BUG 1 [low] REGRESSION — cleanUrls strips .html, so the served path for
// internal/landing pages is extensionless. The only Cache-Control rule that
// could apply is /(.*\.html), whose source literally requires ".html" — it
// never matches /login, /signup, /guide, /index, /admin, /editor, /viewer,
// /auth-callback, /archive. The catch-all /(.*) sets no Cache-Control. Net
// effect: these pages are served WITHOUT 'public, max-age=0, must-revalidate'
// and fall back to Vercel's default static CDN caching.
//
// These tests are pinned with it.fails(): they assert the FIXED behavior
// (clean URLs DO get must-revalidate). They pass once the rule source is made
// suffix-optional (or Cache-Control is added to a broader rule).
// ===========================================================================

describe('vercel.json — BUG 1: clean (extensionless) HTML URLs lose must-revalidate', () => {
  const CLEAN_PAGES = [
    '/login',
    '/signup',
    '/guide',
    '/index',
    '/admin',
    '/editor',
    '/viewer',
    '/auth-callback',
    '/archive',
  ];

  // First, DOCUMENT the buggy status quo so the regression is unambiguous:
  // the .html-only rule does NOT match the clean form.
  it('DOCUMENTS current buggy state: /(.*\\.html) does not match clean URLs', () => {
    const re = vercelSourceToRegExp('/(.*\\.html)');
    for (const p of CLEAN_PAGES) {
      expect(re.test(p)).toBe(false);
    }
  });

  it('clean /login is now served WITH must-revalidate Cache-Control (fixed)', () => {
    const h = effectiveHeaders('/login');
    expect(h['Cache-Control']).toBe('public, max-age=0, must-revalidate');
  });

  // The desired post-fix behavior, now passing:
  it.each([
    ['/login'],
    ['/signup'],
    ['/guide'],
    ['/index'],
    ['/admin'],
    ['/editor'],
    ['/viewer'],
    ['/auth-callback'],
    ['/archive'],
  ])('clean URL %s should be served with must-revalidate Cache-Control', (path) => {
    const h = effectiveHeaders(path);
    expect(h['Cache-Control']).toBe('public, max-age=0, must-revalidate');
  });

  it('the bare site root "/" should also get must-revalidate (index)', () => {
    const h = effectiveHeaders('/');
    expect(h['Cache-Control']).toBe('public, max-age=0, must-revalidate');
  });
});

// ===========================================================================
// BUG 2 [low] REGRESSION — debug.html is a PUBLIC (no-auth) page that surfaces
// the Supabase session, current user, public.users row, and sb-* localStorage
// JWT tokens. config.js lists '/debug' + '/debug.html' in PUBLIC_PAGES, so
// auth-guard treats it as not requiring login. A diagnostic page that exposes
// session tokens should be admin-gated, not public.
//
// We load assets/config.js into a sandboxed `window`-ish global and inspect
// the resulting PUBLIC_PAGES / ADMIN_PAGES sets. The pinned tests assert the
// FIXED state (debug NOT public; debug IS admin-gated) and flip green once
// config.js is corrected.
// ===========================================================================

function loadConfig() {
  // config.js assigns onto `window.*`. We give it a fresh fake window each
  // call so test ordering can't leak state, then return that window.
  const src = readFileSync(
    resolve(__dirname, '..', '..', 'assets', 'config.js'),
    'utf-8'
  );
  const win = {};
  // `window` inside the script resolves to our sandbox object.
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', src);
  fn(win);
  return win;
}

describe('config.js — page access classification (Bug 2 context)', () => {
  let win;
  beforeAll(() => {
    win = loadConfig();
  });

  it('PUBLIC_PAGES and ADMIN_PAGES are Sets', () => {
    expect(win.PUBLIC_PAGES).toBeInstanceOf(Set);
    expect(win.ADMIN_PAGES).toBeInstanceOf(Set);
  });

  it('genuinely public pages stay public (login/signup/guide/root)', () => {
    for (const p of ['/', '/login', '/login.html', '/signup', '/guide']) {
      expect(win.PUBLIC_PAGES.has(p)).toBe(true);
    }
  });

  it('admin.html is admin-gated and NOT public', () => {
    expect(win.ADMIN_PAGES.has('/admin')).toBe(true);
    expect(win.ADMIN_PAGES.has('/admin.html')).toBe(true);
    expect(win.PUBLIC_PAGES.has('/admin')).toBe(false);
    expect(win.PUBLIC_PAGES.has('/admin.html')).toBe(false);
  });

  it('no page is simultaneously listed PUBLIC and ADMIN (disjoint sets)', () => {
    const overlap = [...win.ADMIN_PAGES].filter((p) => win.PUBLIC_PAGES.has(p));
    expect(overlap).toEqual([]);
  });
});

describe('config.js — BUG 2: debug page must not be publicly accessible', () => {
  let win;
  beforeAll(() => {
    win = loadConfig();
  });

  // Fixed: debug is no longer public (token-dumping diagnostic now admin-gated).
  it('/debug and /debug.html are no longer in PUBLIC_PAGES (fixed)', () => {
    expect(win.PUBLIC_PAGES.has('/debug')).toBe(false);
    expect(win.PUBLIC_PAGES.has('/debug.html')).toBe(false);
  });

  // Pinned desired state: debug must NOT be public (token-dumping diagnostic).
  it('/debug should NOT be in PUBLIC_PAGES (exposes session JWTs)', () => {
    expect(win.PUBLIC_PAGES.has('/debug')).toBe(false);
  });

  it('/debug.html should NOT be in PUBLIC_PAGES (exposes session JWTs)', () => {
    expect(win.PUBLIC_PAGES.has('/debug.html')).toBe(false);
  });

  it('/debug should be admin-gated (in ADMIN_PAGES) or removed entirely', () => {
    // Acceptable fix: gate behind admin. (Deleting debug.html from prod also
    // satisfies "not public" above; this pin documents the recommended fix.)
    expect(win.ADMIN_PAGES.has('/debug')).toBe(true);
  });
});

// ===========================================================================
// robots.txt — advisory-only noindex is NOT access control (Bug 2 context).
// We assert robots Disallow covers the sensitive internal paths AND that
// vercel.json backs it with X-Robots-Tag noindex — documenting that both are
// SEO-only and cannot substitute for auth gating on /debug.
// ===========================================================================

describe('robots.txt — disallows sensitive internal paths (advisory only)', () => {
  let robots;
  beforeAll(() => {
    robots = readFileSync(
      resolve(__dirname, '..', '..', 'robots.txt'),
      'utf-8'
    );
  });

  it.each([
    ['/debug'],
    ['/admin'],
    ['/editor'],
    ['/viewer'],
    ['/auth-callback'],
    ['/api/'],
  ])('Disallow: %s is present', (path) => {
    expect(robots).toMatch(new RegExp('^Disallow:\\s*' + path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'm'));
  });

  it('debug is covered by vercel.json X-Robots-Tag noindex too', () => {
    const INTERNAL_SRC = '/:p(admin|debug|editor|viewer|auth-callback)(\\.html)?';
    const re = vercelSourceToRegExp(INTERNAL_SRC);
    expect(re.test('/debug')).toBe(true);
    expect(headersFor(INTERNAL_SRC)['X-Robots-Tag']).toBe('noindex, nofollow');
  });
});
