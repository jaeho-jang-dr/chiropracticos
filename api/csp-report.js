// =============================================================================
// /api/csp-report — CSP violation report endpoint
// =============================================================================
// 브라우저가 Content-Security-Policy-Report-Only 위반 시 이 endpoint로 POST.
// Vercel function logs(vercel logs --follow)에서 위반 흐름 확인.
// 추후 enforced CSP로 promote할 때 baseline 좁히는 근거.
// =============================================================================

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { raw: raw.slice(0, 500) }; }
}

export default async function handler(req, res) {
  // 브라우저 CSP 보고는 항상 POST (application/csp-report 또는 application/reports+json)
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = await readJsonBody(req);

    // 두 형식 모두 처리: CSP Level 2 (`csp-report` 키) + CSP Level 3 Reporting API (배열)
    const reports = Array.isArray(body) ? body : [body];
    for (const r of reports) {
      const v = r['csp-report'] || r.body || r;
      const summary = {
        directive: v['violated-directive'] || v.effectiveDirective,
        blocked: v['blocked-uri'] || v.blockedURL,
        source: v['source-file'] || v.sourceFile,
        line: v['line-number'] || v.lineNumber,
        document: v['document-uri'] || v.documentURL,
      };
      // 길게 안 찍음 — function log 비용·노이즈 통제
      console.log('[csp]', JSON.stringify(summary));
    }
  } catch (e) {
    console.error('[csp] parse error', e?.message);
  }

  // 브라우저는 응답 본문 무시 — 204 빠르게.
  res.status(204).end();
}
