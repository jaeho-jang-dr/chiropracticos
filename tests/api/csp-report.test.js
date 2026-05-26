// =============================================================================
// tests/api/csp-report.test.js — unit tests for api/csp-report.js
// =============================================================================
// Covers happy paths (CSP Level 2 + Reporting API formats), method gating,
// log-sink field preservation, and log-injection sanitization. Also includes
// FAILING tests that capture D2-flagged hardening gaps (size limit + per-IP
// rate limiting + Content-Type gating) so we can drive remediation.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../../api/csp-report.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeReq({ method = 'POST', body, headers = {}, rawChunks } = {}) {
  // If rawChunks is provided we expose an async iterator (simulating the
  // streaming case where req.body is undefined and handler must consume it).
  const baseHeaders = { 'content-type': 'application/json', ...headers };
  const req = {
    method,
    headers: baseHeaders,
    body,
  };
  if (rawChunks !== undefined) {
    req.body = undefined;
    req[Symbol.asyncIterator] = async function* () {
      for (const c of rawChunks) yield typeof c === 'string' ? c : c;
    };
  }
  return req;
}

function makeRes() {
  const res = {
    statusCode: 0,
    ended: false,
    _payload: undefined,
    status(code) { this.statusCode = code; return this; },
    end(payload) { this.ended = true; this._payload = payload; return this; },
    json(payload) { this._payload = payload; this.ended = true; return this; },
    setHeader: vi.fn(),
  };
  return res;
}

// Captures console.log lines for assertion. Returns the array of joined args.
function captureConsole() {
  const logs = [];
  const errs = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  });
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    errs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  });
  return { logs, errs, logSpy, errSpy };
}

// ---------------------------------------------------------------------------
// method gating
// ---------------------------------------------------------------------------

describe('csp-report — method gating', () => {
  beforeEach(() => { captureConsole(); });

  it('returns 405 for GET', async () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.ended).toBe(true);
  });

  it('returns 405 for PUT', async () => {
    const req = makeReq({ method: 'PUT', body: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 405 for DELETE', async () => {
    const req = makeReq({ method: 'DELETE' });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 405 for OPTIONS (no CORS preflight handling here)', async () => {
    const req = makeReq({ method: 'OPTIONS' });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// happy path: CSP Level 2 (legacy `report-uri` payload, key = "csp-report")
// ---------------------------------------------------------------------------

describe('csp-report — CSP Level 2 (report-uri) payload', () => {
  it('accepts a single classic csp-report body and logs summary', async () => {
    const { logs } = captureConsole();
    const body = {
      'csp-report': {
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.example.com/x.js',
        'source-file': 'https://chiropractic-kr.vercel.app/chapter01_introduction.html',
        'line-number': 42,
        'document-uri': 'https://chiropractic-kr.vercel.app/chapter01_introduction.html',
      },
    };
    const req = makeReq({ body });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(204);
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain('[csp]');
    // All key fields preserved in JSON summary
    expect(logs[0]).toContain('"directive":"script-src"');
    expect(logs[0]).toContain('"blocked":"https://evil.example.com/x.js"');
    expect(logs[0]).toContain('"source":"https://chiropractic-kr.vercel.app/chapter01_introduction.html"');
    expect(logs[0]).toContain('"line":42');
    expect(logs[0]).toContain('"document":"https://chiropractic-kr.vercel.app/chapter01_introduction.html"');
  });

  it('handles streaming body (req.body undefined, async iterator chunks)', async () => {
    const { logs } = captureConsole();
    const payload = JSON.stringify({
      'csp-report': {
        'violated-directive': 'img-src',
        'blocked-uri': 'data:image/png;base64,iVBOR',
        'source-file': 'inline',
      },
    });
    // Split into 2 chunks to exercise the for-await loop
    const req = makeReq({ rawChunks: [payload.slice(0, 20), payload.slice(20)] });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(204);
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain('"directive":"img-src"');
    expect(logs[0]).toContain('"blocked":"data:image/png;base64,iVBOR"');
  });

  it('does not crash when body is empty (no chunks)', async () => {
    const { errs } = captureConsole();
    const req = makeReq({ rawChunks: [] });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(errs).toHaveLength(0);
  });

  it('records raw slice when body is invalid JSON', async () => {
    const { logs } = captureConsole();
    const req = makeReq({ rawChunks: ['this is not json at all'] });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    // Falls into the {raw: ...} branch — directive will be undefined.
    expect(logs.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// happy path: CSP Level 3 / Reporting API (array of {type, body, ...})
// ---------------------------------------------------------------------------

describe('csp-report — CSP Level 3 (Reporting API) payload', () => {
  it('accepts the array-of-reports format and logs each summary', async () => {
    const { logs } = captureConsole();
    const body = [
      {
        type: 'csp-violation',
        age: 12,
        url: 'https://chiropractic-kr.vercel.app/admin.html',
        body: {
          effectiveDirective: 'connect-src',
          blockedURL: 'https://untrusted.example.com/api',
          sourceFile: 'https://chiropractic-kr.vercel.app/admin.js',
          lineNumber: 7,
          documentURL: 'https://chiropractic-kr.vercel.app/admin.html',
        },
      },
      {
        type: 'csp-violation',
        body: {
          effectiveDirective: 'font-src',
          blockedURL: 'https://fonts.evil.com/woff2',
          sourceFile: 'https://chiropractic-kr.vercel.app/assets/main.css',
        },
      },
    ];
    const req = makeReq({ body });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(204);
    expect(logs.length).toBe(2);
    expect(logs[0]).toContain('"directive":"connect-src"');
    expect(logs[0]).toContain('"blocked":"https://untrusted.example.com/api"');
    expect(logs[1]).toContain('"directive":"font-src"');
  });

  it('handles single Reporting API style object (not wrapped in array)', async () => {
    const { logs } = captureConsole();
    const body = {
      type: 'csp-violation',
      body: {
        effectiveDirective: 'frame-src',
        blockedURL: 'https://evil-iframe.com',
        sourceFile: 'https://chiropractic-kr.vercel.app/chapter12.html',
      },
    };
    const req = makeReq({ body });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain('"directive":"frame-src"');
    expect(logs[0]).toContain('"blocked":"https://evil-iframe.com"');
  });
});

// ---------------------------------------------------------------------------
// log injection sanitization
// ---------------------------------------------------------------------------

describe('csp-report — log injection hardening', () => {
  // These tests document the EXPECTED behavior after sanitization is added.
  // They will currently FAIL — that is intentional. Console.log will dump
  // raw control characters via JSON.stringify (which escapes \n but leaves
  // ANSI  intact in some terminals), so we need explicit stripping.

  it('strips newline characters from logged directive', async () => {
    const { logs } = captureConsole();
    const body = {
      'csp-report': {
        'violated-directive': 'script-src\nFAKE-LOG-LINE injected',
        'blocked-uri': 'https://x.com',
      },
    };
    const req = makeReq({ body });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(logs.length).toBe(1);
    // After sanitization: no raw \n in the directive field.
    // JSON.stringify escapes \n as \\n in the JSON output — but we want the
    // value itself to be stripped before logging so downstream log parsers
    // (which may unescape) can't be fooled.
    expect(logs[0]).not.toContain('FAKE-LOG-LINE injected');
  });

  it('strips ANSI escape sequences from logged values', async () => {
    const { logs } = captureConsole();
    const body = {
      'csp-report': {
        'violated-directive': 'script-src',
        'blocked-uri': '[31mRED ALERT[0m https://evil.com',
      },
    };
    const req = makeReq({ body });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(logs.length).toBe(1);
    // After sanitization, the escape byte should not appear in the log line.
    expect(logs[0]).not.toMatch(/\[/);
  });

  it('strips carriage returns (CRLF injection vector)', async () => {
    const { logs } = captureConsole();
    const body = {
      'csp-report': {
        'violated-directive': 'script-src\r\n[csp] {"directive":"forged"}',
        'blocked-uri': 'https://x.com',
      },
    };
    const req = makeReq({ body });
    const res = makeRes();
    await handler(req, res);
    expect(logs.length).toBe(1);
    expect(logs[0]).not.toContain('forged');
  });

  it('caps individual field length to prevent log flooding', async () => {
    const { logs } = captureConsole();
    const huge = 'A'.repeat(10_000);
    const body = {
      'csp-report': {
        'violated-directive': 'script-src',
        'blocked-uri': `https://evil.com/${huge}`,
      },
    };
    const req = makeReq({ body });
    const res = makeRes();
    await handler(req, res);
    // Expect handler to truncate per-field to e.g. <= 2048 chars.
    expect(logs[0].length).toBeLessThan(4096);
  });
});

// ---------------------------------------------------------------------------
// D2-flagged hardening gaps — these MUST currently fail
// ---------------------------------------------------------------------------

describe('csp-report — D2 gaps (currently failing)', () => {
  it('GAP: rejects oversize payload with 413', async () => {
    captureConsole();
    // Build a ~2 MB JSON string — way past anything legit.
    const huge = 'x'.repeat(2 * 1024 * 1024);
    const body = JSON.stringify({ 'csp-report': { 'blocked-uri': huge } });
    const req = makeReq({ rawChunks: [body] });
    const res = makeRes();
    await handler(req, res);
    // Expected after fix: handler refuses payloads > N bytes (e.g. 64 KB).
    expect(res.statusCode).toBe(413);
  });

  it('GAP: rejects wrong Content-Type with 415', async () => {
    captureConsole();
    const req = makeReq({
      headers: { 'content-type': 'text/plain' },
      body: 'not a csp report at all',
    });
    const res = makeRes();
    await handler(req, res);
    // Browsers send application/csp-report, application/reports+json,
    // or application/json. text/plain should be refused.
    expect(res.statusCode).toBe(415);
  });

  it('GAP: accepts application/csp-report Content-Type', async () => {
    const { logs } = captureConsole();
    const req = makeReq({
      headers: { 'content-type': 'application/csp-report' },
      body: { 'csp-report': { 'violated-directive': 'script-src', 'blocked-uri': 'https://x' } },
    });
    const res = makeRes();
    await handler(req, res);
    // Must NOT 415 — this is the canonical CSP Level 2 mime.
    expect(res.statusCode).toBe(204);
    expect(logs.length).toBe(1);
  });

  it('GAP: accepts application/reports+json Content-Type', async () => {
    const { logs } = captureConsole();
    const req = makeReq({
      headers: { 'content-type': 'application/reports+json' },
      body: [{ type: 'csp-violation', body: { effectiveDirective: 'script-src', blockedURL: 'https://x' } }],
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(logs.length).toBe(1);
  });

  it('GAP: rate-limits by source IP — 11th rapid request returns 429', async () => {
    captureConsole();
    const ip = '203.0.113.42';
    const body = { 'csp-report': { 'violated-directive': 'script-src', 'blocked-uri': 'https://x' } };

    // Hammer the endpoint from one IP. Expectation: after some threshold
    // (e.g. 10 reports / 10s / IP) the handler returns 429.
    let lastStatus = 204;
    for (let i = 0; i < 11; i++) {
      const req = makeReq({
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body,
      });
      const res = makeRes();
      await handler(req, res);
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
  });
});
