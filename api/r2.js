// =============================================================================
// /api/r2 — R2 객체 관리 (admin 전용)
// =============================================================================
// op=list           GET    objects under prefix
// op=delete         DELETE objects (single or batch)
// op=presign-upload POST   presigned PUT URL for direct browser upload (browser → R2)
// op=presign-get    POST   presigned GET URL (private read of R2 object)
// op=copy           POST   copy/rename within bucket
// =============================================================================
// Auth: Supabase access_token in Authorization header → user must have role='admin'
// Env:  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE
//       SUPABASE_URL, SUPABASE_ANON_KEY  (no SERVICE ROLE — verify via REST + RLS)
// =============================================================================

import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET;
const PUB_BASE = (process.env.R2_PUBLIC_BASE || '').replace(/\/$/, '');

async function verifyAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, code: 401, error: 'no auth token' };

  // 1) Supabase user from JWT
  const userResp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userResp.ok) return { ok: false, code: 401, error: 'invalid token' };
  const user = await userResp.json();

  // 2) role from public.users via RLS-aware REST
  const rolResp = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=role,blocked_at`,
    { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  );
  const rows = await rolResp.json();
  if (!rows?.[0]) return { ok: false, code: 403, error: 'user record missing' };
  if (rows[0].blocked_at) return { ok: false, code: 403, error: 'blocked' };
  if (rows[0].role !== 'admin') return { ok: false, code: 403, error: 'not admin' };
  return { ok: true, user, userId: user.id };
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  // 일부 테스트 mock / 단순 객체는 async-iterable이 아닐 수 있음 → 방어
  if (!req || typeof req[Symbol.asyncIterator] !== 'function') return {};
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function publicUrl(key) {
  return PUB_BASE ? `${PUB_BASE}/${key}` : null;
}

// R2 키 검증 — 모든 op에 동일 적용 (presign-upload, presign-get, delete, copy)
// 차단: 빈 문자열, 비문자열, ../traversal, 절대경로, 백슬래시, null-byte,
//        제어문자, URL-encoded traversal(%2e%2e, %2f), 과도하게 긴 키.
const MAX_KEY_LEN = 1024;
function validateKey(k) {
  if (k === undefined || k === null) return { ok: false, error: 'key required' };
  if (typeof k !== 'string') return { ok: false, error: 'key must be string' };
  const key = k.trim();
  if (!key) return { ok: false, error: 'key required' };
  if (key.length > MAX_KEY_LEN) return { ok: false, error: 'key too long' };
  if (key.startsWith('/') || key.startsWith('\\')) return { ok: false, error: 'invalid key: absolute path' };
  if (key.includes('\\')) return { ok: false, error: 'invalid key: backslash' };
  if (key.includes('\0')) return { ok: false, error: 'invalid key: null byte' };
  if (/[\x00-\x1f\x7f]/.test(key)) return { ok: false, error: 'invalid key: control char' };
  // raw traversal — 세그먼트 단위 체크
  const parts = key.split('/');
  if (parts.some((p) => p === '..' || p === '.')) return { ok: false, error: 'invalid key: traversal' };
  // URL-encoded traversal/슬래시 우회
  let decoded;
  try { decoded = decodeURIComponent(key); } catch { return { ok: false, error: 'invalid key: bad encoding' }; }
  if (decoded !== key) {
    if (decoded.includes('..') || decoded.startsWith('/') || decoded.includes('\\') || decoded.includes('\0')) {
      return { ok: false, error: 'invalid key: encoded traversal' };
    }
    const dparts = decoded.split('/');
    if (dparts.some((p) => p === '..' || p === '.')) return { ok: false, error: 'invalid key: encoded traversal' };
  }
  return { ok: true, key };
}

// 여러 키를 한 번에 검증 (DELETE batch 등)
const MAX_BATCH_KEYS = 1000; // S3 한도
function validateKeys(keys) {
  if (!Array.isArray(keys)) return { ok: false, error: 'keys must be array' };
  if (keys.length === 0) return { ok: false, error: 'no keys provided' };
  if (keys.length > MAX_BATCH_KEYS) return { ok: false, error: `too many keys (max ${MAX_BATCH_KEYS})` };
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    const v = validateKey(keys[i]);
    if (!v.ok) return { ok: false, error: `keys[${i}]: ${v.error}` };
    out.push(v.key);
  }
  return { ok: true, keys: out };
}

export default async function handler(req, res) {
  // CORS — same origin, but be explicit
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

  const op = (req.query.op || '').toString();

  try {
    // ---------- LIST ----------
    if (op === 'list' || (req.method === 'GET' && !op)) {
      const prefix = (req.query.prefix || '').toString();
      const cont = (req.query.continuation || '').toString();
      const r = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: cont || undefined,
        Delimiter: req.query.delimiter ? '/' : undefined,
      }));
      return res.status(200).json({
        objects: (r.Contents || []).map((o) => ({
          key: o.Key,
          size: o.Size,
          etag: o.ETag,
          last_modified: o.LastModified,
          public_url: publicUrl(o.Key),
        })),
        common_prefixes: (r.CommonPrefixes || []).map((p) => p.Prefix),
        is_truncated: !!r.IsTruncated,
        next_continuation: r.NextContinuationToken || null,
      });
    }

    // ---------- DELETE (single via ?key= or batch via body.keys) ----------
    if (op === 'delete' || req.method === 'DELETE') {
      const body = await readJsonBody(req);
      const rawKeys = body.keys && Array.isArray(body.keys)
        ? body.keys
        : (req.query.key ? [req.query.key.toString()] : []);
      if (!rawKeys.length) return res.status(400).json({ error: 'no keys provided' });
      const v = validateKeys(rawKeys);
      if (!v.ok) return res.status(400).json({ error: v.error });
      const keys = v.keys;
      if (keys.length === 1) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: keys[0] }));
        return res.status(200).json({ ok: true, deleted: keys });
      }
      const r = await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: keys.map((k) => ({ Key: k })), Quiet: true },
      }));
      return res.status(200).json({ ok: true, deleted: keys, errors: r.Errors || [] });
    }

    // ---------- PRESIGN UPLOAD (browser PUT directly to R2) ----------
    if (op === 'presign-upload') {
      const body = await readJsonBody(req);
      const v = validateKey(body.key);
      if (!v.ok) return res.status(400).json({ error: v.error });
      const key = v.key;
      const contentType = (body.contentType || 'application/octet-stream').toString();
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
        { expiresIn: 3600 }
      );
      return res.status(200).json({ url, key, public_url: publicUrl(key), expires_in: 3600 });
    }

    // ---------- PRESIGN GET (admin private read) ----------
    // body 전용 — 쿼리스트링 key 허용 시 leaked URL 재생 공격 surface
    if (op === 'presign-get') {
      const body = await readJsonBody(req);
      const v = validateKey(body.key);
      if (!v.ok) return res.status(400).json({ error: v.error });
      const key = v.key;
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: key }),
        { expiresIn: 600 }
      );
      return res.status(200).json({ url, key, expires_in: 600 });
    }

    // ---------- COPY / RENAME ----------
    if (op === 'copy' || op === 'rename') {
      const body = await readJsonBody(req);
      const vf = validateKey(body.from);
      if (!vf.ok) return res.status(400).json({ error: `from: ${vf.error}` });
      const vt = validateKey(body.to);
      if (!vt.ok) return res.status(400).json({ error: `to: ${vt.error}` });
      const from = vf.key;
      const to = vt.key;
      await s3.send(new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `/${BUCKET}/${encodeURIComponent(from)}`,
        Key: to,
      }));
      if (op === 'rename') {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: from }));
      }
      return res.status(200).json({ ok: true, from, to });
    }

    return res.status(400).json({ error: 'unknown op', op });
  } catch (e) {
    // 내부 상세는 로그에만, 클라이언트에는 generic 메시지
    console.error('[api/r2]', op, e);
    return res.status(500).json({ error: 'r2 op failed' });
  }
}
