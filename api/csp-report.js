// =============================================================================
// /api/csp-report — CSP violation report endpoint
// =============================================================================
// 브라우저가 Content-Security-Policy-Report-Only 위반 시 이 endpoint로 POST.
// Vercel function logs(vercel logs --follow)에서 위반 흐름 확인.
// 추후 enforced CSP로 promote할 때 baseline 좁히는 근거.
// =============================================================================
// 방어: 16KB payload 상한 · Content-Type 화이트리스트 · per-IP rate limit ·
//        log injection 차단 (control char strip + 필드별 길이 캡)
// =============================================================================

const MAX_BODY_BYTES = 16 * 1024;       // 16 KB
const MAX_FIELD_LEN = 500;              // 필드별 로그 길이 캡
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1분
const RATE_LIMIT_MAX = 10;              // IP당 분당 10건

// in-memory rate limit map (Vercel function instance 단위 — instance가 살아있는 동안 유효)
const rateMap = new Map();

function rateLimitHit(ip) {
  if (!ip) return false;
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const arr = rateMap.get(ip) || [];
  const recent = arr.filter((t) => t > cutoff);
  recent.push(now);
  rateMap.set(ip, recent);
  // 메모리 누수 방지 — 1000 IP 넘으면 window 밖의 항목 정리.
  // unique-IP flood로 모두 window 안이면 가장 오래 들어온 키부터 하드 컷.
  if (rateMap.size > 1000) {
    for (const [k, v] of rateMap) {
      const live = v.filter((t) => t > cutoff);
      if (live.length === 0) rateMap.delete(k);
      else rateMap.set(k, live);
    }
    if (rateMap.size > 1000) {
      const excess = rateMap.size - 1000;
      let i = 0;
      for (const k of rateMap.keys()) {
        if (i++ >= excess) break;
        rateMap.delete(k); // Map은 삽입순 — 가장 오래된 키부터 제거
      }
    }
  }
  return recent.length > RATE_LIMIT_MAX;
}

// rate-limit 키는 클라이언트가 위조할 수 없는 값이어야 함.
// XFF의 leftmost hop은 클라이언트가 임의 주입 가능 → 매 요청 회전시키면 우회됨.
// 플랫폼이 주입하는 x-real-ip(또는 XFF의 trailing hop = 가장 가까운 신뢰 프록시)를 사용.
function clientIp(req) {
  const realIp = (req.headers['x-real-ip'] || '').toString().trim();
  if (realIp) return realIp;
  const xff = (req.headers['x-forwarded-for'] || '').toString();
  if (xff) {
    const hops = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return (req.socket?.remoteAddress || '').toString();
}

const ALLOWED_CT = [
  'application/csp-report',
  'application/reports+json',
  'application/json',
];
function contentTypeAllowed(ct) {
  if (!ct) return false;
  const lc = ct.toString().toLowerCase().split(';')[0].trim();
  return ALLOWED_CT.includes(lc);
}

// log injection 차단 — 첫 제어문자(LF/CR/ANSI ESC/NUL 등) 위치에서 잘라냄.
// "directive\nFAKE-LOG-LINE" 같은 시도는 prefix만 남고 뒤쪽 위조 라인은 통째로 소실.
function sanitizeField(v) {
  if (v === undefined || v === null) return v;
  let s = typeof v === 'string' ? v : String(v);
  const m = s.match(/[\x00-\x1f\x7f]/);
  if (m) s = s.slice(0, m.index);
  if (s.length > MAX_FIELD_LEN) s = s.slice(0, MAX_FIELD_LEN) + '…[truncated]';
  return s;
}

async function readJsonBodyWithCap(req) {
  if (req.body && typeof req.body === 'object') return { ok: true, body: req.body };
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) return { ok: false, code: 413 };
    try { return { ok: true, body: JSON.parse(req.body) }; }
    catch { return { ok: true, body: { raw: req.body.slice(0, 500) } }; }
  }
  if (!req || typeof req[Symbol.asyncIterator] !== 'function') return { ok: true, body: {} };
  let total = 0;
  let raw = '';
  for await (const chunk of req) {
    const part = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    total += Buffer.byteLength(part, 'utf8');
    if (total > MAX_BODY_BYTES) return { ok: false, code: 413 };
    raw += part;
  }
  if (!raw) return { ok: true, body: {} };
  try { return { ok: true, body: JSON.parse(raw) }; }
  catch { return { ok: true, body: { raw: raw.slice(0, 500) } }; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Content-Type 화이트리스트
  if (!contentTypeAllowed(req.headers['content-type'])) {
    return res.status(415).end();
  }

  // per-IP rate limit
  const ip = clientIp(req);
  if (rateLimitHit(ip)) {
    return res.status(429).end();
  }

  // payload 16KB 상한
  const bodyResult = await readJsonBodyWithCap(req);
  if (!bodyResult.ok) return res.status(bodyResult.code).end();

  try {
    const body = bodyResult.body;
    // CSP Level 2 (`csp-report` 키) + CSP Level 3 Reporting API (배열/단일)
    const reports = Array.isArray(body) ? body : [body];
    for (const r of reports) {
      const v = (r && (r['csp-report'] || r.body || r)) || {};
      const summary = {
        directive: sanitizeField(v['violated-directive'] || v.effectiveDirective),
        blocked: sanitizeField(v['blocked-uri'] || v.blockedURL),
        source: sanitizeField(v['source-file'] || v.sourceFile),
        // line-number는 항상 숫자여야 함. 숫자면 그대로, 아니면 sanitize로
        // 길이 캡·제어문자 제거(로그 인젝션 차단)를 거치게 함.
        line: Number.isFinite(Number(v['line-number'] ?? v.lineNumber))
          ? Number(v['line-number'] ?? v.lineNumber)
          : sanitizeField(v['line-number'] ?? v.lineNumber),
        document: sanitizeField(v['document-uri'] || v.documentURL),
      };
      console.log('[csp]', JSON.stringify(summary));
    }
  } catch (e) {
    console.error('[csp] parse error', sanitizeField(e?.message));
  }

  res.status(204).end();
}
