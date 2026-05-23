// =============================================================================
// /api/content — GitHub Contents API 프록시 (admin 전용)
// =============================================================================
// GET ?path=...      → { path, content, sha, size, encoding }
// PUT body { path, content, sha, message } → commit & return new sha
// =============================================================================
// Auth: Supabase access_token in Authorization header → role='admin'
// Env:  GITHUB_CONTENT_PAT (fine-grained, repo=chiropracticos, contents=Read+Write)
//       GITHUB_REPO        ("jaeho-jang-dr/chiropracticos")
//       GITHUB_BRANCH      (default "main")
//       SUPABASE_URL, SUPABASE_ANON_KEY
// =============================================================================

const REPO = process.env.GITHUB_REPO || 'jaeho-jang-dr/chiropracticos';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const PAT = process.env.GITHUB_CONTENT_PAT;

// PUT 경로 화이트리스트 — PAT 탈취 시에도 .github/, .env, api/, vercel.json,
// package.json, deploy.sh, supabase/migrations/ 등 인프라 파일 변조 차단.
// 콘텐츠/자산 경로만 허용. GET은 화이트리스트 무관(읽기 전용).
const ALLOWED_CONTENT_DIRS = new Set([
  'thompson', 'ak', 'gonstead', 'diversified', 'cox', 'logan', 'sot',
  'cbp', 'activator', 'toggle_recoil', 'functional_neurology',
  'intro', 'lectures', 'archive', 'images',
]);

function isWritePathAllowed(path) {
  if (!path || typeof path !== 'string') return false;
  if (path.length > 500) return false;
  if (/^[/\\]/.test(path)) return false;        // 절대경로 차단
  if (path.includes('\\')) return false;         // 백슬래시 차단
  const parts = path.split('/');
  if (parts.some(p => !p || p === '.' || p === '..')) return false;

  // 루트 파일: 사전 정의된 HTML만
  if (parts.length === 1) {
    return /^(index|archive|guide|login|signup|admin|debug|editor|viewer|auth-callback|chapter\d{2}_[a-z_]+)\.html$/i.test(parts[0]);
  }

  // assets/*.{js,css,json}
  if (parts[0] === 'assets' && parts.length === 2) {
    return /^[a-zA-Z0-9_\-]+\.(js|css|json)$/.test(parts[1]);
  }

  // 기법/콘텐츠 디렉터리 하위
  if (ALLOWED_CONTENT_DIRS.has(parts[0])) {
    const last = parts[parts.length - 1];
    return /\.(html|md|json|png|jpe?g|webp|gif|svg|txt|vtt)$/i.test(last);
  }

  return false;
}

async function verifyAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, code: 401, error: 'no auth token' };
  const userResp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userResp.ok) return { ok: false, code: 401, error: 'invalid token' };
  const user = await userResp.json();
  const rolResp = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=role,blocked_at,email`,
    { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  );
  const rows = await rolResp.json();
  if (!rows?.[0]) return { ok: false, code: 403, error: 'user record missing' };
  if (rows[0].blocked_at) return { ok: false, code: 403, error: 'blocked' };
  if (rows[0].role !== 'admin') return { ok: false, code: 403, error: 'not admin' };
  return { ok: true, user: rows[0], userId: user.id };
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

const GH = (path) => `https://api.github.com/repos/${REPO}/contents/${encodeURI(path)}`;

const GH_HEADERS = {
  'Authorization': `Bearer ${PAT}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'chiropracticos-admin',
};

function b64encode(s) {
  // Node's Buffer is fine on Vercel Node runtime
  return Buffer.from(s, 'utf-8').toString('base64');
}
function b64decode(b) {
  return Buffer.from(b, 'base64').toString('utf-8');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!PAT) return res.status(500).json({ error: 'GITHUB_CONTENT_PAT not configured' });

  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

  try {
    if (req.method === 'GET') {
      const path = (req.query.path || '').toString();
      if (!path) return res.status(400).json({ error: 'path required' });
      const r = await fetch(`${GH(path)}?ref=${BRANCH}`, { headers: GH_HEADERS });
      if (!r.ok) {
        const t = await r.text();
        return res.status(r.status).json({ error: `github ${r.status}`, detail: t.slice(0, 300) });
      }
      const json = await r.json();
      if (Array.isArray(json)) return res.status(400).json({ error: 'path is a directory, list not supported' });
      const content = b64decode((json.content || '').replace(/\n/g, ''));
      return res.status(200).json({
        path: json.path,
        content,
        sha: json.sha,
        size: json.size,
        encoding: json.encoding,
        html_url: json.html_url,
      });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readJsonBody(req);
      const { path, content, sha, message } = body;
      if (!path || typeof content !== 'string') return res.status(400).json({ error: 'path and content required' });
      if (!isWritePathAllowed(path)) {
        console.warn('[api/content] PUT blocked by whitelist', { path, admin: auth.user.email });
        return res.status(403).json({ error: 'path not allowed for write', path });
      }
      const commitMsg = (message && message.trim()) || `admin edit: ${path}`;
      const author = {
        name: auth.user.email?.split('@')[0] || 'admin',
        email: auth.user.email || 'admin@chiropractic-kr.local',
      };
      const r = await fetch(GH(path), {
        method: 'PUT',
        headers: { ...GH_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: commitMsg,
          content: b64encode(content),
          sha: sha || undefined,
          branch: BRANCH,
          committer: author,
          author,
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        return res.status(r.status).json({ error: `github ${r.status}`, detail: t.slice(0, 300) });
      }
      const json = await r.json();
      return res.status(200).json({
        ok: true,
        path: json.content?.path,
        sha: json.content?.sha,
        commit: json.commit?.sha,
        commit_url: json.commit?.html_url,
      });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('[api/content]', e);
    return res.status(500).json({ error: e.message || 'content op failed' });
  }
}
