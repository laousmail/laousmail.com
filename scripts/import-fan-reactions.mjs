#!/usr/bin/env node
/**
 * Import Instagram / TikTok comment exports into fan-reactions/reactions.json
 *
 * Usage:
 *   node scripts/import-fan-reactions.mjs --input fan-reactions/source/instagram-export.csv
 *   node scripts/import-fan-reactions.mjs --input export.json --platform tiktok --merge
 *   node scripts/import-fan-reactions.mjs --input export.csv --prefer-local-avatars
 *
 * Does not scrape platforms. Does not invent comments.
 * By default keeps remote profileImageUrl from the export (may expire).
 * Pass --prefer-local-avatars to use avatars/<username>.* when present
 * (only after you have permission to host those images).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const defaultOut = path.join(root, 'fan-reactions', 'reactions.json')
const avatarsDir = path.join(root, 'avatars')

const { values } = parseArgs({
  options: {
    input: { type: 'string', short: 'i' },
    output: { type: 'string', short: 'o', default: defaultOut },
    platform: { type: 'string', short: 'p' },
    merge: { type: 'boolean', default: false },
    'prefer-local-avatars': { type: 'boolean', default: false },
    'min-chars': { type: 'string', default: '1' },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
})

if (values.help || !values.input) {
  console.log(`Import fan reactions into a curated JSON dataset.

Required:
  --input, -i   Path to CSV or JSON export

Optional:
  --output, -o  Destination (default: fan-reactions/reactions.json)
  --platform    Force platform: instagram | tiktok
  --merge       Merge into existing output by id (keeps manual featured / edits)
  --prefer-local-avatars
                Use avatars/<username>.* when a local file exists
  --min-chars   Skip comments shorter than N chars (default 1)
`)
  process.exit(values.help ? 0 : 1)
}

const ALIASES = {
  id: ['id', 'comment_id', 'commentid', 'cid'],
  username: ['username', 'user_name', 'user', 'handle', 'unique_id', 'uniqueid', 'nickname'],
  displayName: ['displayname', 'display_name', 'author', 'name', 'nickname', 'fullname'],
  commentText: ['commenttext', 'comment_text', 'text', 'comment', 'content', 'body', 'message'],
  profileImageUrl: [
    'profileimageurl',
    'profile_image_url',
    'avatar_url',
    'avatar',
    'profile_pic_url',
    'profilepicurl',
    'user_avatar',
  ],
  postUrl: ['posturl', 'post_url', 'url', 'permalink', 'link', 'video_url', 'share_url'],
  createdAt: ['createdat', 'created_at', 'create_time', 'timestamp', 'date', 'time'],
  platform: ['platform', 'source', 'network'],
  featured: ['featured', 'is_featured', 'pin', 'is_pinned'],
  likes: ['likes', 'like_count', 'digg_count', 'heart', 'hearts'],
}

function normKey(k) {
  return String(k || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function pick(row, keys) {
  const map = {}
  for (const [k, v] of Object.entries(row)) map[normKey(k)] = v
  for (const key of keys) {
    const nk = normKey(key)
    if (map[nk] != null && String(map[nk]).trim() !== '') return String(map[nk]).trim()
  }
  return ''
}

function parseCsv(text) {
  const rows = []
  let i = 0
  const len = text.length
  let field = ''
  let row = []
  let inQuotes = false
  while (i < len) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      if (row.some((cell) => cell.length)) rows.push(row)
      row = []
      i += 1
      continue
    }
    field += c
    i += 1
  }
  if (field.length || row.length) {
    row.push(field)
    if (row.some((cell) => cell.length)) rows.push(row)
  }
  if (!rows.length) return []
  const headers = rows[0]
  return rows.slice(1).map((cells) => {
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? ''
    })
    return obj
  })
}

function isHttps(url) {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

function safePostUrl(url) {
  if (!url) return null
  if (!isHttps(url)) return null
  try {
    const u = new URL(url)
    if (!/(instagram\.com|tiktok\.com|vm\.tiktok\.com)$/i.test(u.hostname.replace(/^www\./, ''))) {
      // allow www. variants
      const host = u.hostname.replace(/^www\./, '')
      if (!['instagram.com', 'tiktok.com', 'vm.tiktok.com'].includes(host)) return null
    }
    return u.toString()
  } catch {
    return null
  }
}

function safeImage(url) {
  if (!url) return null
  if (url.startsWith('avatars/') && /\.(jpe?g|png|webp|gif)$/i.test(url)) return url
  if (isHttps(url)) return url
  return null
}

function findLocalAvatar(username) {
  if (!username || !fs.existsSync(avatarsDir)) return null
  const safe = username.replace(/[^a-zA-Z0-9._-]+/g, '_')
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '.gif']) {
    const p = path.join(avatarsDir, safe + ext)
    if (fs.existsSync(p)) return `avatars/${safe}${ext}`
  }
  return null
}

function toIso(value) {
  if (!value) return null
  if (/^\d+$/.test(value)) {
    const n = Number(value)
    const ms = n < 1e12 ? n * 1000 : n
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function detectPlatform(forced, row, filename) {
  if (forced === 'instagram' || forced === 'tiktok') return forced
  const fromRow = pick(row, ALIASES.platform).toLowerCase()
  if (fromRow.includes('tiktok')) return 'tiktok'
  if (fromRow.includes('instagram') || fromRow.includes('ig')) return 'instagram'
  const base = path.basename(filename).toLowerCase()
  if (base.includes('tiktok')) return 'tiktok'
  return 'instagram'
}

function normalizeRow(row, opts, filePath) {
  const username = pick(row, ALIASES.username).replace(/^@/, '')
  let commentText = pick(row, ALIASES.commentText)
  commentText = commentText.replace(/\s+/g, ' ').trim()
  if (!username || !commentText) return null
  if (commentText.length < opts.minChars) return null

  const id =
    pick(row, ALIASES.id) ||
    `gen-${username}-${Buffer.from(commentText).toString('base64url').slice(0, 16)}`

  const platform = detectPlatform(opts.platform, row, filePath)
  let profileImageUrl = safeImage(pick(row, ALIASES.profileImageUrl))
  if (opts.preferLocal) {
    const local = findLocalAvatar(username)
    if (local) profileImageUrl = local
  }

  const featuredRaw = pick(row, ALIASES.featured).toLowerCase()
  const likes = Number(pick(row, ALIASES.likes) || 0) || 0
  const featured =
    featuredRaw === 'true' || featuredRaw === '1' || featuredRaw === 'yes' || likes >= 5

  return {
    id,
    platform,
    username,
    displayName: pick(row, ALIASES.displayName) || null,
    profileImageUrl,
    commentText: commentText.slice(0, 500),
    postUrl: safePostUrl(pick(row, ALIASES.postUrl)),
    createdAt: toIso(pick(row, ALIASES.createdAt)),
    featured,
  }
}

function loadRecords(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const trimmed = raw.replace(/^\uFEFF/, '')
  if (filePath.endsWith('.json')) {
    const data = JSON.parse(trimmed)
    if (Array.isArray(data)) return data
    if (Array.isArray(data.reactions)) return data.reactions
    if (Array.isArray(data.comments)) return data.comments
    throw new Error('JSON must be an array, or { reactions|comments: [] }')
  }
  return parseCsv(trimmed)
}

const inputPath = path.resolve(values.input)
if (!fs.existsSync(inputPath)) {
  console.error('Input not found:', inputPath)
  process.exit(1)
}

const opts = {
  platform: values.platform || '',
  preferLocal: values['prefer-local-avatars'],
  minChars: Math.max(1, Number(values['min-chars']) || 1),
}

const rows = loadRecords(inputPath)
const imported = []
const seen = new Set()
for (const row of rows) {
  const item = normalizeRow(row, opts, inputPath)
  if (!item) continue
  if (seen.has(item.id)) continue
  seen.add(item.id)
  imported.push(item)
}

let existing = { version: 1, reactions: [] }
const outPath = path.resolve(values.output)
if (values.merge && fs.existsSync(outPath)) {
  existing = JSON.parse(fs.readFileSync(outPath, 'utf8'))
  if (!Array.isArray(existing.reactions)) existing.reactions = []
}

const byId = new Map()
if (values.merge) {
  for (const r of existing.reactions) byId.set(r.id, r)
}

for (const item of imported) {
  if (values.merge && byId.has(item.id)) {
    const prev = byId.get(item.id)
    // Keep manual featured / display edits; refresh text/media from import when present
    byId.set(item.id, {
      ...item,
      featured: prev.featured || item.featured,
      displayName: prev.displayName || item.displayName,
      profileImageUrl: prev.profileImageUrl || item.profileImageUrl,
      postUrl: prev.postUrl || item.postUrl,
    })
  } else {
    byId.set(item.id, item)
  }
}

const reactions = [...byId.values()]

// Auto-feature longer / earlier curated picks only when nothing is featured yet
if (!reactions.some((r) => r.featured)) {
  const ranked = [...reactions].sort((a, b) => (b.commentText?.length || 0) - (a.commentText?.length || 0))
  ranked.slice(0, Math.min(8, ranked.length)).forEach((r) => {
    r.featured = true
  })
}

const dataset = {
  version: 1,
  updatedAt: new Date().toISOString(),
  notes:
    'Curated for public display. Edit featured, reorder, or remove entries here. Keep raw exports in fan-reactions/source/.',
  reactions,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2) + '\n')
console.log(`Wrote ${reactions.length} reactions → ${path.relative(root, outPath)}`)
console.log(`Featured: ${reactions.filter((r) => r.featured).length}`)
