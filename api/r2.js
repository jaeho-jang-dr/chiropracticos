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
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function publicUrl(key) {
  return PUB_BASE ? `${PUB_BASE}/${key}` : null;
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
      const keys = body.keys && Array.isArray(body.keys) ? body.keys : (req.query.key ? [req.query.key.toString()] : []);
      if (!keys.length) return res.status(400).json({ error: 'no keys provided' });
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
      const key = (body.key || '').toString().trim();
      const contentType = (body.contentType || 'application/octet-stream').toString();
      if (!key) return res.status(400).json({ error: 'key required' });
      // soft-block path traversal
      if (key.includes('..') || key.startsWith('/')) return res.status(400).json({ error: 'invalid key' });
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
        { expiresIn: 3600 }
      );
      return res.status(200).json({ url, key, public_url: publicUrl(key), expires_in: 3600 });
    }

    // ---------- PRESIGN GET (admin private read) ----------
    if (op === 'presign-get') {
      const body = await readJsonBody(req);
      const key = (body.key || req.query.key || '').toString();
      if (!key) return res.status(400).json({ error: 'key required' });
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
      const from = (body.from || '').toString();
      const to = (body.to || '').toString();
      if (!from || !to) return res.status(400).json({ error: 'from/to required' });
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
    console.error('[api/r2]', op, e);
    return res.status(500).json({ error: e.message || 'r2 op failed', code: e.Code || e.name });
  }
}
