// =============================================================================
// tests/api/content.test.js — unit tests for /api/content.js
// =============================================================================
// Team U1 (5-team parallel unit-test sweep). Focus areas:
//   - ALLOWED_CONTENT_DIRS whitelist (positive + negative)
//   - Path traversal: ../, %2e%2e, absolute paths, null bytes, backslash
//   - GET path validation gap (D2 P0): handler currently lets GET read any
//     file in repo — failing test pins the bug.
//   - Auth: missing / invalid / non-admin / blocked
//   - Oversize body, malformed JSON, method gating
//   - Korean filename UTF-8 roundtrip
//   - GitHub commit failure → 5xx propagation
//   - SHA-less overwrite (D2 P2): blind overwrite race captured as a test
// All Supabase / GitHub calls are mocked via global fetch stub. No real I/O.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ----- helpers --------------------------------------------------------------

// Build a Vercel-shaped req. We support either a pre-parsed `body` object OR a
// raw string body that the handler will iterate via `for await ... of req`.
function makeReq({
  method = 'GET',
  authorization = 'Bearer good-admin-token',
  query = {},
  body = undefined,
  rawBody = undefined,
} = {}) {
  const headers = {};
  if (authorization !== null) headers.authorization = authorization;
  const req = {
    method,
    headers,
    query,
    body,
  };
  // Async-iterable body for readJsonBody() fallback path
  if (rawBody !== undefined && body === undefined) {
    req[Symbol.asyncIterator] = async function* () {
      yield Buffer.from(rawBody, 'utf-8');
    };
  } else if (body === undefined && rawBody === undefined) {
    // Always async-iterable so `for await` doesn't throw on GET (handler
    // skips body read on GET, but PUT tests rely on this path).
    req[Symbol.asyncIterator] = async function* () { /* empty */ };
  }
  return req;
}

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
  };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn((payload) => { res.body = payload; res.ended = true; return res; });
  res.end = vi.fn(() => { res.ended = true; return res; });
  res.setHeader = vi.fn((k, v) => { res.headers[k] = v; });
  return res;
}

// Fluent fetch mock builder. Maps URL substrings to canned responses.
function installFetchMock(routes) {
  const calls = [];
  const fetchImpl = vi.fn(async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    for (const r of routes) {
      if (typeof r.match === 'string' ? u.includes(r.match) : r.match.test(u)) {
        if (r.throws) throw r.throws;
        const status = r.status ?? 200;
        const jsonBody = r.json ?? {};
        const textBody = r.text ?? JSON.stringify(jsonBody);
        return {
          ok: status >= 200 && status < 300,
          status,
          json: async () => (typeof jsonBody === 'function' ? jsonBody(u, init) : jsonBody),
          text: async () => textBody,
        };
      }
    }
    throw new Error(`unmocked fetch: ${u}`);
  });
  vi.stubGlobal('fetch', fetchImpl);
  return { fetchImpl, calls };
}

const ADMIN_USER = { id: 'u-admin-1', email: 'drjang00@gmail.com' };
const ADMIN_ROW = { role: 'admin', blocked_at: null, email: 'drjang00@gmail.com' };
const MEMBER_ROW = { role: 'member', blocked_at: null, email: 'member@test.com' };
const BLOCKED_ADMIN_ROW = { role: 'admin', blocked_at: '2026-01-01', email: 'blocked@test.com' };

// Standard happy-path auth: Supabase /auth/v1/user + /rest/v1/users both succeed.
function adminAuthRoutes(userRow = ADMIN_ROW, user = ADMIN_USER) {
  return [
    { match: '/auth/v1/user', status: 200, json: user },
    { match: '/rest/v1/users?id=eq.', status: 200, json: [userRow] },
  ];
}

// Lazy-load the handler so each test gets a fresh module (env stubs applied).
async function loadHandler() {
  const mod = await import('../../api/content.js');
  return mod.default;
}

// ----- env safety -----------------------------------------------------------

beforeEach(() => {
  // Ensure required envs are set so the handler doesn't short-circuit with 500.
  process.env.GITHUB_CONTENT_PAT = 'test-pat-token';
  process.env.GITHUB_REPO = 'test-owner/test-repo';
  process.env.GITHUB_BRANCH = 'main';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
});

afterEach(() => {
  vi.resetModules();
});

// ============================================================================
// 1. Auth gating
// ============================================================================

describe('auth', () => {
  it('returns 401 when Authorization header is missing', async () => {
    installFetchMock([]); // no auth calls expected
    const handler = await loadHandler();
    const req = makeReq({ authorization: null });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: expect.stringMatching(/no auth/i) });
  });

  it('returns 401 when Supabase rejects the token', async () => {
    installFetchMock([
      { match: '/auth/v1/user', status: 401, json: { error: 'bad jwt' } },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ authorization: 'Bearer expired' }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalid token/);
  });

  it('returns 403 when user row is missing in users table', async () => {
    installFetchMock([
      { match: '/auth/v1/user', status: 200, json: ADMIN_USER },
      { match: '/rest/v1/users?id=eq.', status: 200, json: [] },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/user record missing/i);
  });

  it('returns 403 for non-admin role', async () => {
    installFetchMock(adminAuthRoutes(MEMBER_ROW));
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ query: { path: 'index.html' } }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/not admin/i);
  });

  it('returns 403 for blocked admin', async () => {
    installFetchMock(adminAuthRoutes(BLOCKED_ADMIN_ROW));
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ query: { path: 'index.html' } }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/blocked/i);
  });

  it('returns 500 when GITHUB_CONTENT_PAT is not configured', async () => {
    delete process.env.GITHUB_CONTENT_PAT;
    vi.resetModules();
    installFetchMock([]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/GITHUB_CONTENT_PAT/);
  });

  it('responds 204 to OPTIONS preflight without auth', async () => {
    installFetchMock([]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'OPTIONS', authorization: null }), res);
    expect(res.statusCode).toBe(204);
  });
});

// ============================================================================
// 2. Method gating
// ============================================================================

describe('method gating', () => {
  it('rejects DELETE with 405', async () => {
    installFetchMock(adminAuthRoutes());
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'DELETE' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects PATCH with 405', async () => {
    installFetchMock(adminAuthRoutes());
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'PATCH' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('accepts PUT for admin writes', async () => {
    installFetchMock([
      ...adminAuthRoutes(),
      {
        match: /api\.github\.com\/repos\/.*\/contents\//,
        status: 200,
        json: {
          content: { path: 'thompson/notes.md', sha: 'new-sha' },
          commit: { sha: 'commit-sha', html_url: 'https://github.com/x/y/commit/abc' },
        },
      },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({
      method: 'PUT',
      body: { path: 'thompson/notes.md', content: 'hello', sha: 'old-sha' },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, path: 'thompson/notes.md' });
  });
});

// ============================================================================
// 3. ALLOWED_CONTENT_DIRS whitelist (PUT)
// ============================================================================

describe('PUT path whitelist', () => {
  const githubOk = {
    match: /api\.github\.com/,
    status: 200,
    json: { content: { path: 'x', sha: 's' }, commit: { sha: 'c' } },
  };

  const allowedPaths = [
    'thompson/notes.md',
    'ak/case01.html',
    'gonstead/img.png',
    'diversified/refs.json',
    'functional_neurology/aff.html',
    'images/x.webp',
    'lectures/2026/handout.md',
    'archive/old.html',
    'intro/welcome.html',
    'assets/main.css',
    'assets/ui.js',
    'index.html',
    'admin.html',
    'chapter06_thompson.html',
  ];

  for (const p of allowedPaths) {
    it(`allows write to ${p}`, async () => {
      installFetchMock([...adminAuthRoutes(), githubOk]);
      const handler = await loadHandler();
      const res = makeRes();
      await handler(makeReq({ method: 'PUT', body: { path: p, content: 'x' } }), res);
      expect(res.statusCode).toBe(200);
    });
  }

  const blockedPaths = [
    '.env',
    '.github/workflows/deploy.yml',
    'api/content.js',
    'api/r2.js',
    'vercel.json',
    'package.json',
    'deploy.sh',
    'supabase/migrations/0001_init.sql',
    'random_dir/file.html',
    'assets/../api/content.js',           // traversal via assets
    'assets/sub/extra.js',                // assets must be 1 level deep
    'assets/main.exe',                    // disallowed extension
    'thompson/script.exe',                // disallowed content extension
    'index.js',                           // root non-html
    'chapter99_unknown.html',             // not matching regex prefix
  ];

  for (const p of blockedPaths) {
    it(`blocks write to ${p}`, async () => {
      installFetchMock(adminAuthRoutes());
      const handler = await loadHandler();
      const res = makeRes();
      await handler(makeReq({ method: 'PUT', body: { path: p, content: 'x' } }), res);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toMatch(/not allowed/i);
    });
  }
});

// ============================================================================
// 4. Path traversal (PUT)
// ============================================================================

describe('PUT path traversal rejection', () => {
  const traversals = [
    '../etc/passwd',
    'thompson/../api/content.js',
    'thompson/./notes.md',                // bare "." segment
    '/etc/passwd',                        // absolute (unix)
    '\\windows\\system32',                // absolute (windows) + backslash
    'thompson\\notes.md',                 // backslash anywhere
    'a'.repeat(501) + '/x.md',            // > 500 chars
    '',                                   // empty
  ];

  for (const p of traversals) {
    it(`rejects traversal: ${JSON.stringify(p).slice(0, 60)}`, async () => {
      installFetchMock(adminAuthRoutes());
      const handler = await loadHandler();
      const res = makeRes();
      await handler(makeReq({ method: 'PUT', body: { path: p, content: 'x' } }), res);
      // Empty path falls through to "path and content required" (400);
      // everything else hits the whitelist gate (403). Both are non-2xx.
      expect([400, 403]).toContain(res.statusCode);
    });
  }

  // SOURCE-CODE GAP (flag for D2): isWritePathAllowed has no explicit null-
  // byte check. A path like "thompson/notes\x00.md" passes the whitelist
  // because the extension regex anchors on `$` and Buffer/encodeURI happily
  // preserve the NUL. This test pins the current (wrong) behaviour as failing
  // so it goes green only after a fix lands.
  it('rejects path containing NUL byte', async () => {
    installFetchMock(adminAuthRoutes());
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({
      method: 'PUT',
      body: { path: 'thompson/notes\x00.md', content: 'x' },
    }), res);
    expect(res.statusCode).toBe(403);
  });

  it('rejects URL-encoded ..%2F (handler should NOT decode and walk up)', async () => {
    // The handler stores path verbatim and uses encodeURI for the GitHub URL,
    // so "..%2Fetc" is treated as a single literal filename — it should fail
    // whitelist because it doesn't sit under an allowed dir or root regex.
    installFetchMock(adminAuthRoutes());
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({
      method: 'PUT',
      body: { path: '..%2Fapi%2Fcontent.js', content: 'x' },
    }), res);
    expect(res.statusCode).toBe(403);
  });
});

// ============================================================================
// 5. GET path validation — D2 P0 BUG
// ============================================================================
// As of 2026-05-26, the handler comment claims "GET은 화이트리스트 무관(읽기
// 전용)" — meaning any admin can GET any file in the repo, including
// `.env.example`, `api/*.js`, `deploy.sh`. That's a real exposure of source
// + infra to anyone holding an admin JWT. This test is INTENTIONALLY written
// as the desired behaviour (GET should be whitelisted too) so it fails today
// and turns green once the fix lands.
// ============================================================================

describe('GET path validation (D2 P0)', () => {
  it('rejects GET of sensitive infra files (api/content.js)', async () => {
    installFetchMock([
      ...adminAuthRoutes(),
      // If the bug exists, the handler will call GitHub. Stub it to a
      // 200 so the test only fails because the handler reached GitHub at all.
      {
        match: /api\.github\.com/,
        status: 200,
        json: { path: 'api/content.js', content: Buffer.from('leak').toString('base64'), sha: 's', size: 4, encoding: 'base64' },
      },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { path: 'api/content.js' } }), res);
    expect(res.statusCode).toBe(403); // EXPECTED post-fix; today it is 200.
  });

  it('rejects GET of .env via deploy.sh', async () => {
    installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, status: 200, json: { path: 'deploy.sh', content: '', sha: 's', size: 0, encoding: 'base64' } },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { path: 'deploy.sh' } }), res);
    expect(res.statusCode).toBe(403);
  });

  it('still returns 400 when GET has no path param', async () => {
    installFetchMock(adminAuthRoutes());
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: {} }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/path required/);
  });

  it('returns 400 if GitHub responds with directory listing', async () => {
    installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, status: 200, json: [{ name: 'a' }, { name: 'b' }] },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { path: 'thompson' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/directory/);
  });

  it('returns file content base64-decoded on successful GET', async () => {
    const original = '안녕하세요 — Thompson 강의 노트';
    const b64 = Buffer.from(original, 'utf-8').toString('base64');
    installFetchMock([
      ...adminAuthRoutes(),
      {
        match: /api\.github\.com/,
        status: 200,
        json: { path: 'thompson/notes.md', content: b64, sha: 'abc', size: original.length, encoding: 'base64' },
      },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { path: 'thompson/notes.md' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.content).toBe(original);
  });
});

// ============================================================================
// 6. Body parsing (PUT)
// ============================================================================

describe('PUT body parsing', () => {
  it('returns 400 when path is missing', async () => {
    installFetchMock(adminAuthRoutes());
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'PUT', body: { content: 'x' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/path and content required/);
  });

  it('returns 400 when content is not a string', async () => {
    installFetchMock(adminAuthRoutes());
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'PUT', body: { path: 'thompson/x.md', content: 123 } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 (NOT 500) on malformed JSON body', async () => {
    installFetchMock(adminAuthRoutes());
    const handler = await loadHandler();
    const res = makeRes();
    // No `body`, only rawBody — handler will try JSON.parse and fall through.
    await handler(makeReq({ method: 'PUT', rawBody: '{not json' }), res);
    // readJsonBody returns {} on parse error → path missing → 400 not 500.
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/path and content required/);
  });

  // NOTE on oversize bodies: api/content.js has no explicit body-size cap;
  // Vercel's platform default (~4.5 MB on Node functions) is the only gate.
  // We assert the in-handler 500-char path cap (which IS enforced) as the
  // closest available "oversize" rejection unit-testable here.
  it('rejects path strings over 500 chars (oversize path)', async () => {
    installFetchMock(adminAuthRoutes());
    const handler = await loadHandler();
    const res = makeRes();
    const longPath = 'thompson/' + 'a'.repeat(600) + '.md';
    await handler(makeReq({ method: 'PUT', body: { path: longPath, content: 'x' } }), res);
    expect(res.statusCode).toBe(403);
  });

  it('accepts large but valid content bodies (~1 MB)', async () => {
    installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, status: 200, json: { content: { path: 'thompson/x.md', sha: 's' }, commit: { sha: 'c' } } },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    const big = 'x'.repeat(1024 * 1024);
    await handler(makeReq({ method: 'PUT', body: { path: 'thompson/x.md', content: big } }), res);
    expect(res.statusCode).toBe(200);
  });
});

// ============================================================================
// 7. Korean filename / UTF-8 roundtrip
// ============================================================================

describe('UTF-8 Korean handling', () => {
  it('base64-encodes Korean content correctly on PUT', async () => {
    const korean = '톰슨 강의 — 다리 길이 검사 (LLI)';
    const { calls } = installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, status: 200, json: { content: { path: 'thompson/lli.md', sha: 's' }, commit: { sha: 'c' } } },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({
      method: 'PUT',
      body: { path: 'thompson/lli.md', content: korean },
    }), res);
    expect(res.statusCode).toBe(200);
    const ghCall = calls.find(c => c.url.includes('api.github.com'));
    expect(ghCall).toBeDefined();
    const sent = JSON.parse(ghCall.init.body);
    const decoded = Buffer.from(sent.content, 'base64').toString('utf-8');
    expect(decoded).toBe(korean);
  });

  it('round-trips Korean filename in path (URL-encoded once)', async () => {
    const { calls } = installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, status: 200, json: { content: { path: 'thompson/강의노트.md', sha: 's' }, commit: { sha: 'c' } } },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({
      method: 'PUT',
      body: { path: 'thompson/강의노트.md', content: 'hi' },
    }), res);
    expect(res.statusCode).toBe(200);
    const ghCall = calls.find(c => c.url.includes('api.github.com'));
    // encodeURI keeps the slash but percent-encodes Korean chars.
    expect(ghCall.url).toMatch(/thompson\/%[0-9A-F]{2}/i);
  });

  it('decodes Korean content correctly on GET', async () => {
    const korean = '한글 본문 — UTF-8 보존 확인';
    const b64 = Buffer.from(korean, 'utf-8').toString('base64');
    installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, status: 200, json: { path: 'thompson/k.md', content: b64, sha: 's', size: korean.length, encoding: 'base64' } },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { path: 'thompson/k.md' } }), res);
    expect(res.body.content).toBe(korean);
  });

  it('handles base64 with embedded newlines from GitHub', async () => {
    const text = 'line1\nline2\nline3';
    // GitHub returns base64 with \n every 60 chars; simulate that.
    const b64raw = Buffer.from(text, 'utf-8').toString('base64');
    const b64withNewlines = b64raw.match(/.{1,4}/g).join('\n');
    installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, status: 200, json: { path: 'thompson/k.md', content: b64withNewlines, sha: 's', size: text.length, encoding: 'base64' } },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { path: 'thompson/k.md' } }), res);
    expect(res.body.content).toBe(text);
  });
});

// ============================================================================
// 8. GitHub failure propagation
// ============================================================================

describe('GitHub error propagation', () => {
  it('propagates 404 from GitHub on GET', async () => {
    installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, status: 404, text: '{"message":"Not Found"}' },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { path: 'thompson/missing.md' } }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/github 404/);
  });

  it('propagates 409 sha-conflict from GitHub on PUT', async () => {
    installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, status: 409, text: '{"message":"sha conflict"}' },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({
      method: 'PUT',
      body: { path: 'thompson/x.md', content: 'y', sha: 'stale-sha' },
    }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toMatch(/github 409/);
  });

  it('propagates 5xx from GitHub on PUT', async () => {
    installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, status: 502, text: 'bad gateway' },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({
      method: 'PUT',
      body: { path: 'thompson/x.md', content: 'y' },
    }), res);
    expect(res.statusCode).toBe(502);
  });

  it('returns 500 when GitHub fetch throws (network error)', async () => {
    installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, throws: new Error('ECONNRESET') },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { path: 'thompson/x.md' } }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/ECONNRESET|content op failed/);
  });
});

// ============================================================================
// 9. SHA-less overwrite — D2 P2 race
// ============================================================================
// GitHub's Contents API: omitting `sha` on PUT to an EXISTING file would fail
// with 422 ("sha wasn't supplied"). BUT — if the handler accepts a PUT with
// no sha, it blindly creates a new file or fails depending on existence,
// leaving the door open to a TOCTOU race when two admins edit the same file.
// This test pins the current behaviour: handler currently forwards `undefined`
// sha to GitHub and trusts GitHub to reject — we surface that as a known risk.
// ============================================================================

describe('SHA-less PUT (D2 P2 race)', () => {
  it('forwards undefined sha to GitHub when caller omits it', async () => {
    const { calls } = installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, status: 200, json: { content: { path: 'thompson/x.md', sha: 's' }, commit: { sha: 'c' } } },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({
      method: 'PUT',
      body: { path: 'thompson/x.md', content: 'hi' }, // no sha
    }), res);
    expect(res.statusCode).toBe(200);
    const ghCall = calls.find(c => c.url.includes('api.github.com') && c.init.method === 'PUT');
    const sent = JSON.parse(ghCall.init.body);
    // Current behaviour: sha key is absent (or undefined → stripped by stringify).
    expect(sent.sha).toBeUndefined();
  });

  it.fails('rejects PUT with no sha when overwriting an existing file', async () => {
    // Desired post-fix behaviour: handler should require `sha` on every PUT
    // and force a HEAD/GET first if missing, to prevent blind overwrites.
    installFetchMock(adminAuthRoutes());
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({
      method: 'PUT',
      body: { path: 'thompson/notes.md', content: 'overwrite' }, // no sha
    }), res);
    expect(res.statusCode).toBe(400); // EXPECTED post-fix; today reaches GitHub.
  });

  it('propagates GitHub 422 when sha is wrong for existing file', async () => {
    installFetchMock([
      ...adminAuthRoutes(),
      { match: /api\.github\.com/, status: 422, text: '{"message":"sha is incorrect"}' },
    ]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({
      method: 'PUT',
      body: { path: 'thompson/notes.md', content: 'x', sha: 'wrong' },
    }), res);
    expect(res.statusCode).toBe(422);
  });
});

// ============================================================================
// 10. Cache-Control header
// ============================================================================

describe('response headers', () => {
  it('always sets Cache-Control: no-store', async () => {
    installFetchMock([]);
    const handler = await loadHandler();
    const res = makeRes();
    await handler(makeReq({ method: 'OPTIONS', authorization: null }), res);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
});
