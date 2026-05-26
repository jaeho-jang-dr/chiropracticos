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
  const CHAPTER_SRC = '/chapter:rest((?:_|[a-zA-Z0-9-]).*?)(\\.html)?';
  let re;

  beforeAll(() => {
    re = vercelSourceToRegExp(CHAPTER_SRC);
  });

  it('rule is registered with both Cache-Control + X-Robots-Tag', () => {
    const h = headersFor(CHAPTER_SRC);
    expect(h['Cache-Control']).toBe('public, max-age=0, must-revalidate');
    expect(h['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('matches /chapter01_introduction.html (file URL)', () => {
    expect(re.test('/chapter01_introduction.html')).toBe(true);
  });

  it('matches /chapter01_introduction (cleanUrls)', () => {
    expect(re.test('/chapter01_introduction')).toBe(true);
  });

  it('matches /chapter12_applied_kinesiology', () => {
    expect(re.test('/chapter12_applied_kinesiology')).toBe(true);
  });

  it('matches /chapter04_diversified.html', () => {
    expect(re.test('/chapter04_diversified.html')).toBe(true);
  });

  it('matches hyphenated chapter slugs like /chapter-2-fn', () => {
    expect(re.test('/chapter-2-fn')).toBe(true);
  });

  it('does NOT match bare /chapter', () => {
    // The :rest param is anchored with a charclass `(?:_|[a-zA-Z0-9-])` so
    // the segment after "chapter" must consume at least one character.
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
  it('serves images public, max-age=86400 (1 day)', () => {
    const h = headersFor('/images/(.*)');
    expect(h['Cache-Control']).toBe('public, max-age=86400');
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
