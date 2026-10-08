/**
 * LAOUSMAIL public comments API
 * GET  /        → { comments: [...] }
 * POST /        → { ok: true, comment }
 * OPTIONS /     → CORS
 *
 * Storage: Cloudflare KV (COMMENTS)
 * No secrets in the frontend — this Worker is the only writer.
 */

const ALLOWED_ORIGINS = new Set([
  'https://laousmail.com',
  'http://laousmail.com',
  'https://www.laousmail.com',
  'http://www.laousmail.com',
  'https://laousmail.github.io',
  'http://127.0.0.1:8765',
  'http://localhost:8765',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
])

const MAX_COMMENTS = 200
const MAX_TEXT = 160
const MAX_HANDLE = 24
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 8

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://laousmail.com'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 && data.comments ? 'public, max-age=15' : 'no-store',
      ...corsHeaders(origin),
    },
  })
}

function normalizeHandle(value) {
  const raw = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .slice(0, MAX_HANDLE)
  if (!raw) return '@fan'
  return raw.startsWith('@') ? raw : `@${raw}`
}

function sanitizeText(value) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, MAX_TEXT)
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function readList(env) {
  const raw = await env.COMMENTS.get('list', 'json')
  return Array.isArray(raw) ? raw : []
}

async function writeList(env, list) {
  await env.COMMENTS.put('list', JSON.stringify(list.slice(0, MAX_COMMENTS)))
}

async function rateLimit(env, ip) {
  const key = `rate:${ip || 'unknown'}`
  const now = Date.now()
  const current = (await env.COMMENTS.get(key, 'json')) || { t: now, n: 0 }
  if (now - current.t > RATE_WINDOW_MS) {
    current.t = now
    current.n = 0
  }
  current.n += 1
  await env.COMMENTS.put(key, JSON.stringify(current), { expirationTtl: 120 })
  return current.n <= RATE_MAX
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (url.pathname !== '/' && url.pathname !== '/comments') {
      return json({ error: 'not_found' }, 404, origin)
    }

    if (request.method === 'GET') {
      const comments = await readList(env)
      return json({ comments }, 200, origin)
    }

    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, origin)
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
    if (!(await rateLimit(env, ip))) {
      return json({ error: 'rate_limited' }, 429, origin)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'invalid_json' }, 400, origin)
    }

    // Honeypot — bots fill this; humans leave it empty
    if (body?.website || body?.hp) {
      return json({ ok: true, ignored: true }, 200, origin)
    }

    const text = sanitizeText(body?.text)
    if (!text || text.length < 2) {
      return json({ error: 'empty_comment' }, 400, origin)
    }

    const handle = normalizeHandle(body?.handle)
    const comment = {
      id: crypto.randomUUID(),
      handle,
      text,
      heart: true,
      source: 'site',
      ts: Date.now(),
    }

    const list = await readList(env)
    list.unshift(comment)
    await writeList(env, list)

    // Soft IP fingerprint for moderation (not stored raw)
    try {
      const ipHash = await sha256Hex(`${ip}:${comment.ts}`)
      await env.COMMENTS.put(`meta:${comment.id}`, JSON.stringify({ ipHash, ts: comment.ts }), {
        expirationTtl: 60 * 60 * 24 * 90,
      })
    } catch {
      /* ignore meta failures */
    }

    return json({ ok: true, comment }, 201, origin)
  },
}
