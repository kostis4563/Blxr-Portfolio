import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { REMOVED_REVIEWS, BLOCKED_TERMS } from './moderation.mjs'
import { mailConfigured, sendMail, passwordChangedMail, describeClient } from './mail.mjs'

const PORT = Number(process.env.PORT) || 8899
const HOST = '127.0.0.1'
const UPSTREAM_TIMEOUT_MS = 7000
const CACHE_TTL_MS = 60_000
const CACHE_MAX = 200

const PIPED = [
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.leptons.xyz',
]
const INVIDIOUS = ['https://inv.nadeko.net', 'https://invidious.f5.si', 'https://yewtu.be']

const MIRROR_COOLDOWN_MS = 5 * 60_000
const mirrorDownUntil = new Map()
const mirrorUp = (base) => (mirrorDownUntil.get(base) || 0) <= Date.now()
const markMirrorDown = (base) => mirrorDownUntil.set(base, Date.now() + MIRROR_COOLDOWN_MS)

const ID_RE = /^[A-Za-z0-9_-]{11}$/
const thumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

const CRUFT_RE = /[([]\s*(official\s*(music\s*)?(video|audio|lyric)?|lyrics?|visuali[sz]er|audio|video|m\/?v|hd|hq|4k|8k|explicit|clean|remaster(ed)?|extended|full\s*version|out\s*now)[^)\]]*[)\]]/gi
function cleanTitle(title, uploader) {
  let t = (title || '').trim()
  const up = (uploader || '').replace(/ - Topic$/, '').trim()
  if (up && t.toLowerCase().startsWith(up.toLowerCase() + ' - ')) t = t.slice(up.length + 3).trim()
  t = t.replace(CRUFT_RE, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([)\]])/g, '$1').trim()
  return t || (title || '').trim() || 'Untitled'
}

function idFromUrl(u) {
  if (!u) return null
  const m = String(u).match(/[?&]v=([A-Za-z0-9_-]{11})/) || String(u).match(/\/([A-Za-z0-9_-]{11})$/)
  return m ? m[1] : null
}

function withTimeout(run) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS)
  return Promise.resolve(run(ctrl.signal)).finally(() => clearTimeout(t))
}

async function fromPiped(base, q, limit, filter = 'music_songs') {
  const url = `${base}/search?q=${encodeURIComponent(q)}&filter=${filter}`
  const res = await withTimeout((signal) => fetch(url, { signal, headers: { accept: 'application/json' } }))
  if (!res.ok) throw new Error(`piped ${res.status}`)
  const data = await res.json()
  const items = Array.isArray(data?.items) ? data.items : []
  return items
    .map((it) => {
      const videoId = idFromUrl(it.url)
      if (!videoId || !ID_RE.test(videoId)) return null
      const duration = Number(it.duration) || 0
      if (duration <= 0) return null
      return {
        videoId,
        title: cleanTitle(it.title, it.uploaderName),
        subtitle: (it.uploaderName || '').replace(/ - Topic$/, '').trim(),
        art: thumb(videoId),
        duration,
        views: Number(it.views) > 0 ? Number(it.views) : 0,
      }
    })
    .filter(Boolean)
    .slice(0, limit)
}

async function fromInvidious(base, q, limit) {
  const url = `${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video`
  const res = await withTimeout((signal) => fetch(url, { signal, headers: { accept: 'application/json' } }))
  if (!res.ok) throw new Error(`invidious ${res.status}`)
  const data = await res.json()
  const items = Array.isArray(data) ? data : []
  return items
    .map((it) => {
      const videoId = it.videoId
      if (!videoId || !ID_RE.test(videoId)) return null
      const duration = Number(it.lengthSeconds) || 0
      if (duration <= 0) return null
      return {
        videoId,
        title: cleanTitle(it.title, it.author),
        subtitle: (it.author || '').replace(/ - Topic$/, '').trim(),
        art: thumb(videoId),
        duration,
        views: Number(it.viewCount) > 0 ? Number(it.viewCount) : 0,
      }
    })
    .filter(Boolean)
    .slice(0, limit)
}

async function searchAll(q, limit, filter = 'music_songs') {
  for (const base of PIPED) {
    if (!mirrorUp(base)) continue
    try {
      const items = await fromPiped(base, q, limit, filter)
      if (items.length) return items
    } catch {
      markMirrorDown(base)
    }
  }
  for (const base of INVIDIOUS) {
    if (!mirrorUp(base)) continue
    try {
      const items = await fromInvidious(base, q, limit)
      if (items.length) return items
    } catch {
      markMirrorDown(base)
    }
  }
  return []
}

const cache = new Map()
function cacheGet(key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  cache.delete(key)
  cache.set(key, hit)
  return hit.items
}
function cacheSet(key, items) {
  cache.set(key, { at: Date.now(), items })
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
}

const TOP_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const TOP_RESPONSE_BUDGET_MS = 12_000
const TOP_WARM_KEY = { country: 'us', limit: 10 }
const topCache = new Map()
const topInflight = new Map()
const topKey = (country, limit) => `${country} ${limit}`

const STATE_DIR = process.env.STATE_DIRECTORY || process.env.TMPDIR || '/tmp'
const HISTORY_FILE = path.join(STATE_DIR, 'chart-history.json')
const BASELINE_MIN_AGE_MS = 18 * 60 * 60 * 1000
const SNAPSHOT_INTERVAL_MS = 18 * 60 * 60 * 1000
const MAX_HISTORY_MS = 8 * 24 * 60 * 60 * 1000

let chartHistory = []
try {
  const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'))
  if (Array.isArray(parsed)) chartHistory = parsed
} catch {
}
function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(chartHistory))
  } catch {
  }
}

const rankKey = (name, artist) => `${name}|${artist}`.toLowerCase().replace(/\s+/g, ' ').trim()

function baselineFor(country, now) {
  let best = null
  for (const s of chartHistory) {
    if (s.country !== country || now - s.at < BASELINE_MIN_AGE_MS) continue
    if (!best || s.at < best.at) best = s
  }
  return best
}

function computeMove(baseline, key, currRank) {
  if (!baseline) return null
  const prev = baseline.ranks[key]
  if (!prev) return { dir: 'new' }
  const delta = prev - currRank
  if (delta > 0) return { dir: 'up', delta }
  if (delta < 0) return { dir: 'down', delta: -delta }
  return { dir: 'same' }
}

function recordSnapshot(country, ranks, now) {
  let last = null
  for (const s of chartHistory) if (s.country === country && (!last || s.at > last.at)) last = s
  if (last && now - last.at < SNAPSHOT_INTERVAL_MS) return
  chartHistory.push({ at: now, country, ranks })
  chartHistory = chartHistory.filter((s) => now - s.at <= MAX_HISTORY_MS)
  saveHistory()
}

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length).fill(null)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      try {
        out[idx] = await fn(items[idx])
      } catch {
        out[idx] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return out
}

async function fetchTop(country, limit) {
  const pull = Math.min(25, limit + 8)
  const url = `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/${pull}/songs.json`
  const res = await withTimeout((signal) => fetch(url, { signal, headers: { accept: 'application/json' } }))
  if (!res.ok) throw new Error(`rss ${res.status}`)
  const data = await res.json()
  const songs = (data?.feed?.results || []).map((r) => ({ name: r.name || '', artist: r.artistName || '' })).filter((s) => s.name)

  const now = Date.now()
  const currRanks = {}
  songs.forEach((s, i) => { currRanks[rankKey(s.name, s.artist)] = i + 1 })
  const baseline = baselineFor(country, now)

  const resolved = await mapPool(songs, 4, async (s) => {
    const found = await searchAll(`${s.name} ${s.artist}`.trim(), 1, 'videos')
    if (!found.length) return null
    const key = rankKey(s.name, s.artist)

    return { ...found[0], title: s.name || found[0].title, subtitle: s.artist || found[0].subtitle, move: computeMove(baseline, key, currRanks[key]) }
  })

  const seen = new Set()
  const items = []
  for (const it of resolved) {
    if (!it || seen.has(it.videoId)) continue
    seen.add(it.videoId)
    items.push(it)
    if (items.length >= limit) break
  }
  recordSnapshot(country, currRanks, now)
  return { items, title: data?.feed?.title || 'Top Songs', updated: data?.feed?.updated || null }
}

function refreshTop(country, limit) {
  const key = topKey(country, limit)
  let inflight = topInflight.get(key)
  if (inflight) return inflight
  inflight = fetchTop(country, limit)
    .then((data) => {
      if (data.items.length) topCache.set(key, { at: Date.now(), data })
      return data
    })
    .finally(() => topInflight.delete(key))
  topInflight.set(key, inflight)
  return inflight
}

function warmTop() {
  refreshTop(TOP_WARM_KEY.country, TOP_WARM_KEY.limit).catch(() => {})
}

const HITS_FILE = path.join(STATE_DIR, 'hits.json')
const HITS_SAVE_DEBOUNCE_MS = 30_000
const HITS_RETENTION_DAYS = 90

const HITS_MAX_PATHS_PER_DAY = 500
const HIT_PATH_RE = /^\/[A-Za-z0-9/_-]{0,48}$/

let hits = {}
let hitsDirty = false

try {
  hits = JSON.parse(fs.readFileSync(HITS_FILE, 'utf8'))
} catch {

  hits = {}
}

const today = () => new Date().toISOString().slice(0, 10)

function saveHits() {
  if (!hitsDirty) return
  hitsDirty = false

  const cutoff = new Date(Date.now() - HITS_RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10)
  for (const day of Object.keys(hits)) if (day < cutoff) delete hits[day]
  try {
    fs.writeFileSync(HITS_FILE, JSON.stringify(hits))
  } catch {
  }
}
setInterval(saveHits, HITS_SAVE_DEBOUNCE_MS).unref()

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    saveHits()
    saveVitals()
    saveReviews()
    saveInvites()
    saveSettings()
    process.exit(0)
  })
}

function recordHit(rawPath) {
  const day = today()
  const bucket = (hits[day] ||= {})

  const key =
    HIT_PATH_RE.test(rawPath) && (bucket[rawPath] !== undefined || Object.keys(bucket).length < HITS_MAX_PATHS_PER_DAY)
      ? rawPath
      : 'other'
  bucket[key] = (bucket[key] || 0) + 1
  hitsDirty = true
}

const VITALS_FILE = path.join(STATE_DIR, 'vitals.json')
const VITALS_RETENTION_DAYS = 90

const VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
}

const VITALS_MAX = { LCP: 120_000, INP: 120_000, CLS: 25, FCP: 120_000, TTFB: 120_000 }

let vitals = {}
let vitalsDirty = false

try {
  vitals = JSON.parse(fs.readFileSync(VITALS_FILE, 'utf8'))
} catch {
  vitals = {}
}

function saveVitals() {
  if (!vitalsDirty) return
  vitalsDirty = false
  const cutoff = new Date(Date.now() - VITALS_RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10)
  for (const day of Object.keys(vitals)) if (day < cutoff) delete vitals[day]
  try {
    fs.writeFileSync(VITALS_FILE, JSON.stringify(vitals))
  } catch {
  }
}
setInterval(saveVitals, HITS_SAVE_DEBOUNCE_MS).unref()

function recordVital(metric, value) {
  const limits = VITALS_THRESHOLDS[metric]
  if (!limits) return
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > VITALS_MAX[metric]) return

  const day = vitals[today()] ||= {}
  const entry = (day[metric] ||= { n: 0, sum: 0, good: 0, ni: 0, poor: 0, worst: 0 })
  entry.n += 1
  entry.sum += value
  entry[value <= limits.good ? 'good' : value > limits.poor ? 'poor' : 'ni'] += 1
  if (value > entry.worst) entry.worst = value
  vitalsDirty = true
}

function summariseVitals(days) {
  const merged = {}
  for (const day of days) {
    for (const [metric, e] of Object.entries(vitals[day] || {})) {
      const m = (merged[metric] ||= { n: 0, sum: 0, good: 0, ni: 0, poor: 0, worst: 0 })
      m.n += e.n
      m.sum += e.sum
      m.good += e.good
      m.ni += e.ni
      m.poor += e.poor
      if (e.worst > m.worst) m.worst = e.worst
    }
  }
  const round = (metric, v) => (metric === 'CLS' ? Math.round(v * 1000) / 1000 : Math.round(v))
  const out = {}
  for (const [metric, m] of Object.entries(merged)) {
    if (!m.n) continue
    out[metric] = {
      samples: m.n,
      mean: round(metric, m.sum / m.n),
      worst: round(metric, m.worst),
      good: m.good,
      needsImprovement: m.ni,
      poor: m.poor,
      goodShare: Math.round((m.good / m.n) * 100) / 100,
      pass: m.good / m.n >= 0.75,
    }
  }
  return out
}

function readJsonBody(req, limit = 512) {
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        req.destroy()
        resolve(null)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolve(null)
      }
    })
    req.on('error', () => resolve(null))
  })
}

const REVIEWS_FILE = path.join(STATE_DIR, 'reviews.json')
const REVIEWS_MAX = 1000
const REVIEW_LIMITS = { name: [2, 40], role: [0, 60], text: [20, 600] }
const REVIEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000
const REVIEW_COOKIE = 'blxr_rv'
const REVIEW_EDIT_WINDOW_MS = 15 * 60 * 1000
const REVIEW_OWNER_KEY = process.env.REVIEW_OWNER_KEY || ''
const PANEL_COOKIE = 'blxr_panel'
const PANEL_SESSION_MS = 12 * 60 * 60 * 1000
const PANEL_LOGIN_MAX_FAILS = 5
const PANEL_LOCKOUT_MS = 15 * 60 * 1000
const SETTINGS_FILE = path.join(STATE_DIR, 'review-settings.json')
const INVITES_FILE = path.join(STATE_DIR, 'review-invites.json')
const INVITE_TTL_MS = 4 * 24 * 60 * 60 * 1000
const INVITE_SWEEP_MS = 60 * 60 * 1000
const INVITE_DEFAULT_TEXT = 'Rated without leaving a written review.'
const REVIEW_TOKEN_RE = /^[a-f0-9]{32}$/
const REVIEW_GLOBAL_WINDOW_MS = 60 * 60 * 1000
const REVIEW_GLOBAL_MAX = 30
const REVIEW_SALT = process.env.REVIEW_SALT || 'blxr-reviews'
const REVIEW_ID_RE = /^[a-z0-9]{8}$/
const REVIEW_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

const REVIEW_LINK_RE = /https?:\/\/|www\.|\S+\.(?:com|net|org|io|gg|xyz|me|app|dev|co)(?=[\s/,.;:!?)]|$)/i
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028-\u202E\uFEFF]/g

const foldTerm = (s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const SETTINGS_DEFAULT = { paused: false, approval: false, blockedTerms: [] }
let settings = { ...SETTINGS_DEFAULT }
let settingsDirty = false
try {
  const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
  if (parsed && typeof parsed === 'object') settings = normalizeSettings(parsed)
} catch {
}
function normalizeSettings(input) {
  return {
    paused: input.paused === true,
    approval: input.approval === true,
    blockedTerms: Array.isArray(input.blockedTerms)
      ? [...new Set(input.blockedTerms.map((t) => cleanLine(t).slice(0, 60)).filter(Boolean))].slice(0, 200)
      : [],
  }
}
function saveSettings() {
  if (!settingsDirty) return
  settingsDirty = false
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings))
  } catch {
  }
}
setInterval(saveSettings, HITS_SAVE_DEBOUNCE_MS).unref()

const blockedTerms = () => [...BLOCKED_TERMS, ...settings.blockedTerms].map(foldTerm).filter(Boolean)

let reviews = []
let reviewsDirty = false

const isReviewRecord = (r) =>
  r &&
  typeof r === 'object' &&
  REVIEW_ID_RE.test(r.id) &&
  typeof r.name === 'string' &&
  typeof r.text === 'string' &&
  Number.isInteger(r.rating) &&
  r.rating >= 1 &&
  r.rating <= 5 &&
  typeof r.at === 'string' &&
  !Number.isNaN(Date.parse(r.at))

try {
  const parsed = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'))
  if (Array.isArray(parsed)) reviews = parsed.filter(isReviewRecord)
} catch {
  reviews = []
}
{
  const kept = reviews.filter((r) => !REMOVED_REVIEWS.has(r.id))
  if (kept.length !== reviews.length) {
    console.log(`reviews: removed ${reviews.length - kept.length} via moderation.mjs`)
    reviews = kept
    reviewsDirty = true
  }
}

const SUBMITTER_KEYS = ['ipHash', 'deviceHash', 'cookieHash']

function saveReviews() {
  if (!reviewsDirty) return
  reviewsDirty = false
  const cutoff = Date.now() - REVIEW_WINDOW_MS
  for (const r of reviews) {
    if (Date.parse(r.at) >= cutoff) continue
    for (const key of SUBMITTER_KEYS) delete r[key]
  }
  try {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews))
  } catch {
  }
}
setInterval(saveReviews, HITS_SAVE_DEBOUNCE_MS).unref()

function newReviewId() {
  for (;;) {
    let id = ''
    for (const b of crypto.randomBytes(8)) id += REVIEW_ID_ALPHABET[b % REVIEW_ID_ALPHABET.length]
    if (!REMOVED_REVIEWS.has(id) && !reviews.some((r) => r.id === id)) return id
  }
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  const forwarded = typeof xff === 'string' ? xff.split(',').pop().trim() : ''
  return forwarded || req.socket.remoteAddress || ''
}

const hashToken = (kind, value) =>
  crypto.createHash('sha256').update(`${REVIEW_SALT}:${kind}:${value}`).digest('hex').slice(0, 16)

function cookieToken(req) {
  const header = req.headers.cookie
  if (typeof header !== 'string') return null
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === REVIEW_COOKIE) {
      const value = rest.join('=').trim()
      return REVIEW_TOKEN_RE.test(value) ? value : null
    }
  }
  return null
}

const deviceToken = (body) =>
  typeof body?.device === 'string' && REVIEW_TOKEN_RE.test(body.device) ? body.device : null

const publicReview = ({ id, name, role, rating, text, at, editedAt, auto, pinned, reply, pending }) => ({
  id,
  name,
  role,
  rating,
  text,
  at,
  ...(editedAt ? { editedAt } : {}),
  ...(auto ? { auto: true } : {}),
  ...(pinned ? { pinned: true } : {}),
  ...(reply ? { reply } : {}),
  ...(pending ? { pending: true } : {}),
})

const panelReview = (r) => {
  const out = { ...r }
  for (const key of SUBMITTER_KEYS) delete out[key]
  return out
}

const isVisible = (r) => !r.hidden && !r.pending

const panelSessions = new Map()
const panelFails = new Map()

function panelSession(req) {
  const header = req.headers.cookie
  if (typeof header !== 'string') return null
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name !== PANEL_COOKIE) continue
    const token = rest.join('=').trim()
    const expires = panelSessions.get(token)
    if (!expires) return null
    if (expires <= Date.now()) {
      panelSessions.delete(token)
      return null
    }
    return token
  }
  return null
}

const panelCookie = (token, maxAge) =>
  `${PANEL_COOKIE}=${token}; Path=/api/reviews; Max-Age=${maxAge}; HttpOnly; SameSite=Strict`

function panelStats(now) {
  const visible = reviews.filter(isVisible)
  const week = now - 7 * 86_400_000
  const month = now - 30 * 86_400_000
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sum = 0
  for (const r of visible) {
    distribution[r.rating] += 1
    sum += r.rating
  }
  return {
    total: reviews.length,
    visible: visible.length,
    hidden: reviews.filter((r) => r.hidden && !r.pending).length,
    pending: reviews.filter((r) => r.pending).length,
    pinned: reviews.filter((r) => r.pinned).length,
    auto: reviews.filter((r) => r.auto).length,
    invited: reviews.filter((r) => r.invited).length,
    average: visible.length ? Math.round((sum / visible.length) * 10) / 10 : 0,
    distribution,
    lastWeek: reviews.filter((r) => Date.parse(r.at) >= week).length,
    lastMonth: reviews.filter((r) => Date.parse(r.at) >= month).length,
    invitesPending: invites.filter((i) => inviteStatus(i, now) === 'pending').length,
  }
}

let invites = []
let invitesDirty = false

const isInviteRecord = (i) =>
  i &&
  typeof i === 'object' &&
  REVIEW_TOKEN_RE.test(i.token) &&
  typeof i.name === 'string' &&
  typeof i.createdAt === 'string' &&
  typeof i.expiresAt === 'string'

try {
  const parsed = JSON.parse(fs.readFileSync(INVITES_FILE, 'utf8'))
  if (Array.isArray(parsed)) invites = parsed.filter(isInviteRecord)
} catch {
  invites = []
}

function saveInvites() {
  if (!invitesDirty) return
  invitesDirty = false
  try {
    fs.writeFileSync(INVITES_FILE, JSON.stringify(invites))
  } catch {
  }
}
setInterval(saveInvites, HITS_SAVE_DEBOUNCE_MS).unref()

const inviteStatus = (invite, now) =>
  invite.reviewId ? (invite.auto ? 'auto' : 'used') : Date.parse(invite.expiresAt) <= now ? 'expired' : 'pending'

const publicInvite = (invite, now) => ({
  name: invite.name,
  role: invite.role,
  rating: Number.isInteger(invite.rating) && invite.rating >= 1 && invite.rating <= 5 ? invite.rating : 5,
  text: invite.text || INVITE_DEFAULT_TEXT,
  status: inviteStatus(invite, now),
  expiresAt: invite.expiresAt,
})

const ownerInvite = (invite, now) => ({ ...invite, status: inviteStatus(invite, now) })

function keyMatches(given) {
  if (!REVIEW_OWNER_KEY || typeof given !== 'string') return false
  const a = Buffer.from(given)
  const b = Buffer.from(REVIEW_OWNER_KEY)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const isOwner = (req) => Boolean(panelSession(req)) || keyMatches(req.headers['x-review-key'])

function sweepInvites() {
  const now = Date.now()
  for (const invite of invites) {
    if (invite.reviewId || Date.parse(invite.expiresAt) > now) continue
    if (reviews.length >= REVIEWS_MAX) break
    const record = {
      id: newReviewId(),
      name: invite.name,
      role: invite.role || '',
      rating: Number.isInteger(invite.rating) && invite.rating >= 1 && invite.rating <= 5 ? invite.rating : 5,
      text: invite.text || INVITE_DEFAULT_TEXT,
      at: new Date(now).toISOString(),
      auto: true,
    }
    reviews.push(record)
    invite.reviewId = record.id
    invite.auto = true
    reviewsDirty = true
    invitesDirty = true
  }
}

function cleanLine(value) {
  if (typeof value !== 'string') return ''
  return value.replace(CONTROL_RE, '').replace(/\s+/g, ' ').trim()
}

function cleanBlock(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(CONTROL_RE, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const withinLimits = (s, [min, max]) => s.length >= min && s.length <= max
const isBlocked = (s) => {
  const folded = foldTerm(s)
  return blockedTerms().some((term) => folded.includes(term))
}

function validateReview(body) {
  const name = cleanLine(body?.name)
  const role = cleanLine(body?.role)
  const text = cleanBlock(body?.text)
  const rating = Number(body?.rating)

  const fields = []
  if (!withinLimits(name, REVIEW_LIMITS.name) || !/\p{L}/u.test(name)) fields.push('name')
  if (!withinLimits(role, REVIEW_LIMITS.role)) fields.push('role')
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fields.push('rating')
  if (!withinLimits(text, REVIEW_LIMITS.text)) fields.push('text')
  if (fields.length) return { error: 'invalid', fields }

  if ([name, role, text].some((s) => REVIEW_LINK_RE.test(s))) return { error: 'link', fields: ['text'] }
  if (isBlocked(`${name}\n${role}\n${text}`)) return { error: 'blocked', fields: ['text'] }

  return { review: { name, role, rating, text } }
}

function reviewRateLimit(submitter, now) {
  let lastSeen = 0
  let recentGlobal = 0
  for (const r of reviews) {
    const at = Date.parse(r.at)
    const same = SUBMITTER_KEYS.some((key) => submitter[key] && r[key] === submitter[key])
    if (same && at > lastSeen) lastSeen = at
    if (now - at < REVIEW_GLOBAL_WINDOW_MS) recentGlobal += 1
  }
  if (lastSeen && now - lastSeen < REVIEW_WINDOW_MS) {
    return { error: 'rate_limited', retryAfter: Math.ceil((REVIEW_WINDOW_MS - (now - lastSeen)) / 1000) }
  }
  if (recentGlobal >= REVIEW_GLOBAL_MAX) return { error: 'busy', retryAfter: 600 }
  if (reviews.length >= REVIEWS_MAX) return { error: 'full', retryAfter: 86_400 }
  return null
}

const GH_TOKEN = process.env.GITHUB_TOKEN || ''
const GH_CACHE_TTL_MS = 30 * 60 * 1000
const GH_CACHE_MAX = 50
const ghCache = new Map()

const GH_USER_RE = /^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$/

function ghRange(year, now) {
  if (year === 'last') {
    const from = new Date(now)
    from.setUTCFullYear(from.getUTCFullYear() - 1)
    from.setUTCDate(from.getUTCDate() + 1)
    return { from, to: now }
  }
  const from = new Date(Date.UTC(Number(year), 0, 1))
  const end = new Date(Date.UTC(Number(year), 11, 31, 23, 59, 59))
  return { from, to: end > now ? now : end }
}

const GH_QUERY = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`

async function ghFromGraphql(user, year, now) {
  const { from, to } = ghRange(year, now)
  const body = JSON.stringify({
    query: GH_QUERY,
    variables: { login: user, from: from.toISOString(), to: to.toISOString() },
  })

  const json = await withTimeout(async (signal) => {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${GH_TOKEN}`,
        'content-type': 'application/json',
        'user-agent': 'blxr.net',
      },
      body,
      signal,
    })
    if (!res.ok) throw new Error(`github ${res.status}`)
    return res.json()
  })

  const calendar = json?.data?.user?.contributionsCollection?.contributionCalendar
  if (!calendar) throw new Error('github: no calendar')

  const contributions = []
  for (const week of calendar.weeks || []) {
    for (const day of week.contributionDays || []) {
      contributions.push({ date: day.date, count: day.contributionCount || 0 })
    }
  }
  if (!contributions.length) throw new Error('github: empty calendar')

  const key = year === 'last' ? 'lastYear' : year
  return { contributions, total: { [key]: calendar.totalContributions || 0 } }
}

async function ghFromMirror(user, year) {
  const url = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(user)}?y=${encodeURIComponent(year)}`
  const json = await withTimeout(async (signal) => {
    const res = await fetch(url, { headers: { 'user-agent': 'blxr.net' }, signal })
    if (!res.ok) throw new Error(`mirror ${res.status}`)
    return res.json()
  })
  const contributions = Array.isArray(json?.contributions) ? json.contributions : []
  if (!contributions.length) throw new Error('mirror: empty calendar')

  return { contributions, total: json.total || {} }
}

async function fetchContributions(user, year) {
  const now = new Date()
  if (GH_TOKEN) {
    try {
      return await ghFromGraphql(user, year, now)
    } catch {
    }
  }
  return ghFromMirror(user, year)
}

// Developer stats: what the dashboard's Stats page shows. Always the account
// that owns GITHUB_TOKEN (GraphQL `viewer`), so there is nothing to look up
// and no way to point the route at someone else. Public data only.
//
// Three rounds of GraphQL: the profile and this year's calendar; then, one
// alias per contribution year, every repository the login committed to
// (own, other people's, organisations'); then the default-branch history of
// each of those repositories filtered to this author, which carries per-
// commit lines and files changed. Commits are bucketed by day, so the page
// can slice the same numbers by today / week / month / year / all time.
const GH_API = (process.env.GITHUB_API || 'https://api.github.com').replace(/\/$/, '')
const GH_STATS_TTL_MS = 60 * 60 * 1000
const GH_STATS_REFRESH_MIN_MS = 2 * 60 * 1000
const GH_STATS_CACHE_MAX = 100
const GH_STATS_TIMEOUT_MS = 25_000
const GH_STATS_YEARS = 12 // contribution years scanned for repositories
const GH_STATS_REPOS = 120 // repositories scanned for history
const GH_STATS_BATCH = 5 // repositories per history query
const GH_STATS_PAGE = 100 // commits per repository per query
const GH_STATS_PAGES_PER_REPO = 20 // 2,000 commits per repository
const GH_STATS_MAX_PAGES = 90 // ~9,000 commits per build
const GH_STATS_MONTHS = 120 // months of history returned
const ghStatsCache = new Map() // login -> { at, data }
const ghStatsInflight = new Map() // login -> promise
let ghOwner = null // { login, at } — the token's own account

const GH_STATS_USER_QUERY = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    id login name avatarUrl url createdAt bio company location
    followers { totalCount }
    following { totalCount }
    pullRequests { totalCount }
    issues { totalCount }
    starredRepositories { totalCount }
    repositories(first: 100, ownerAffiliations: [OWNER], isFork: false) {
      totalCount
      nodes { stargazerCount forkCount }
    }
    contributionsCollection(from: $from, to: $to) {
      contributionYears
      totalCommitContributions totalPullRequestContributions totalIssueContributions totalPullRequestReviewContributions restrictedContributionsCount
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    }
  }
}`

const GH_STATS_YEAR_FIELDS = `totalCommitContributions restrictedContributionsCount
  commitContributionsByRepository(maxRepositories: 100) {
    repository {
      nameWithOwner name url isPrivate isFork isArchived stargazerCount pushedAt
      owner { login avatarUrl __typename }
      primaryLanguage { name color }
      defaultBranchRef { name }
    }
    contributions { totalCount }
  }`

const GH_STATS_HISTORY_FIELDS = `pageInfo { hasNextPage endCursor }
  nodes { committedDate additions deletions changedFilesIfAvailable }`

class GhError extends Error {
  constructor(code, status) {
    super(code)
    this.code = code
    this.status = status
  }
}

async function ghGraphql(query, variables) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), GH_STATS_TIMEOUT_MS)
  let res
  try {
    res = await fetch(`${GH_API}/graphql`, {
      method: 'POST',
      headers: { authorization: `Bearer ${GH_TOKEN}`, 'content-type': 'application/json', 'user-agent': 'blxr.net' },
      body: JSON.stringify({ query, variables }),
      signal: ctrl.signal,
    })
  } catch {
    throw new GhError('github_failed', 502)
  } finally {
    clearTimeout(t)
  }
  if (res.status === 401) throw new GhError('stats_disabled', 503)
  if (res.status === 403 || res.status === 429) throw new GhError('rate_limited', 429)
  if (!res.ok) throw new GhError('github_failed', 502)
  const json = await res.json()
  if ((json?.errors || []).some((e) => e?.type === 'RATE_LIMITED')) throw new GhError('rate_limited', 429)
  return json
}

const isoDay = (d) => d.toISOString().slice(0, 10)
const dayKey = (iso) => String(iso).slice(0, 10)
// Sunday-start week containing the day, as an ISO date.
function weekOf(day) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return isoDay(d)
}
const daysAgo = (now, n) => {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - n)
  return isoDay(d)
}
const emptyBucket = () => ({ c: 0, a: 0, d: 0, f: 0 })
const add = (b, c) => {
  b.c += 1
  b.a += c.additions || 0
  b.d += c.deletions || 0
  b.f += c.changedFilesIfAvailable || 0
}

function streaks(days, today) {
  let longest = 0
  let run = 0
  let runStart = null
  let longestFrom = null
  let longestTo = null
  for (const day of days) {
    if (day.count > 0) {
      if (!run) runStart = day.date
      run += 1
      if (run > longest) {
        longest = run
        longestFrom = runStart
        longestTo = day.date
      }
    } else {
      run = 0
    }
  }
  // Today counts as part of the streak even before its first commit lands.
  let current = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) current += 1
    else if (i === days.length - 1 && days[i].date === today) continue
    else break
  }
  return { current, longest, longestFrom, longestTo }
}

// Every repository the login committed to, across its contribution years.
async function ghContributedRepos(login, years) {
  const parts = years.map((y) => `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") { ${GH_STATS_YEAR_FIELDS} }`)
  const json = await ghGraphql(`query($login: String!) { user(login: $login) { ${parts.join('\n')} } }`, { login })
  const user = json?.data?.user || {}
  const repos = new Map()
  let commitsAllYears = 0
  let restricted = 0
  for (const y of years) {
    const col = user[`y${y}`]
    if (!col) continue
    commitsAllYears += col.totalCommitContributions || 0
    restricted += col.restrictedContributionsCount || 0
    for (const entry of col.commitContributionsByRepository || []) {
      const r = entry?.repository
      if (!r?.nameWithOwner) continue
      const cur = repos.get(r.nameWithOwner) || {
        fullName: r.nameWithOwner,
        name: r.name,
        url: r.url,
        private: Boolean(r.isPrivate),
        owner: r.owner?.login || r.nameWithOwner.split('/')[0],
        ownerAvatar: r.owner?.avatarUrl || null,
        ownerType: r.owner?.__typename === 'Organization' ? 'org' : 'user',
        stars: r.stargazerCount || 0,
        fork: Boolean(r.isFork),
        archived: Boolean(r.isArchived),
        pushedAt: r.pushedAt || null,
        language: r.primaryLanguage?.name || null,
        languageColor: r.primaryLanguage?.color || null,
        branch: r.defaultBranchRef?.name || null,
        contributions: 0,
      }
      cur.contributions += entry.contributions?.totalCount || 0
      repos.set(r.nameWithOwner, cur)
    }
  }
  return { repos: [...repos.values()], commitsAllYears, restricted }
}

// Default-branch commits by this author for a batch of repositories; keeps
// paging each until it runs dry or the caps are hit.
async function ghHistories(userId, repos, onCommit) {
  const cursors = new Map(repos.map((r) => [r.fullName, { after: null, pages: 0 }]))
  let pending = repos.filter((r) => r.branch)
  let pagesUsed = 0
  let truncated = false
  while (pending.length && pagesUsed < GH_STATS_MAX_PAGES) {
    const batch = pending.slice(0, GH_STATS_BATCH)
    const parts = batch.map((r, i) => {
      const [owner, name] = r.fullName.split('/')
      const after = cursors.get(r.fullName).after
      return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { defaultBranchRef { target { ... on Commit {
        history(first: ${GH_STATS_PAGE}, author: { id: $uid }${after ? `, after: ${JSON.stringify(after)}` : ''}) { ${GH_STATS_HISTORY_FIELDS} } } } } }`
    })
    const json = await ghGraphql(`query($uid: ID!) { ${parts.join('\n')} }`, { uid: userId })
    pagesUsed += batch.length
    const next = []
    batch.forEach((r, i) => {
      const history = json?.data?.[`r${i}`]?.defaultBranchRef?.target?.history
      const state = cursors.get(r.fullName)
      state.pages += 1
      for (const c of history?.nodes || []) if (c?.committedDate) onCommit(r, c)
      if (history?.pageInfo?.hasNextPage) {
        if (state.pages >= GH_STATS_PAGES_PER_REPO) truncated = true
        else {
          state.after = history.pageInfo.endCursor
          next.push(r)
        }
      }
    })
    pending = [...pending.slice(GH_STATS_BATCH), ...next]
  }
  if (pending.length) truncated = true
  return { truncated, pagesUsed }
}

async function buildGithubStats(login) {
  const now = new Date()
  const from = new Date(now)
  from.setUTCFullYear(from.getUTCFullYear() - 1)
  from.setUTCDate(from.getUTCDate() + 1)
  const today = isoDay(now)

  const first = await ghGraphql(GH_STATS_USER_QUERY, { login, from: from.toISOString(), to: now.toISOString() })
  const user = first?.data?.user
  if (!user) {
    const notFound = (first?.errors || []).some((e) => e?.type === 'NOT_FOUND')
    throw new GhError(notFound ? 'not_found' : 'github_failed', notFound ? 404 : 502)
  }
  const canonical = user.login || login
  const cc = user.contributionsCollection || {}

  // Calendar (past year) → active days, busiest day, streaks.
  const calendarDays = []
  for (const week of cc.contributionCalendar?.weeks || []) {
    for (const day of week.contributionDays || []) {
      if (day?.date && day.date <= today) calendarDays.push({ date: day.date, count: day.contributionCount || 0 })
    }
  }
  calendarDays.sort((a, b) => (a.date < b.date ? -1 : 1))

  const years = (cc.contributionYears || []).slice().sort((a, b) => b - a).slice(0, GH_STATS_YEARS)
  const { repos, commitsAllYears, restricted } = years.length
    ? await ghContributedRepos(canonical, years)
    : { repos: [], commitsAllYears: 0, restricted: 0 }
  repos.sort((a, b) => b.contributions - a.contributions)
  const scanned = repos.slice(0, GH_STATS_REPOS)

  // Aggregation targets.
  const byDay = new Map() // 'YYYY-MM-DD' -> bucket
  const perRepo = new Map() // fullName -> bucket + first/last
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0)) // [weekday][hour], UTC
  const bounds = {
    today: { since: today, repos: new Set() },
    week: { since: daysAgo(now, 6), repos: new Set() },
    month: { since: daysAgo(now, 29), repos: new Set() },
    year: { since: daysAgo(now, 364), repos: new Set() },
    all: { since: '0000-00-00', repos: new Set() },
  }
  const periods = Object.fromEntries(Object.keys(bounds).map((k) => [k, emptyBucket()]))

  const onCommit = (repo, c) => {
    const day = dayKey(c.committedDate)
    if (day > today) return
    let bucket = byDay.get(day)
    if (!bucket) byDay.set(day, (bucket = emptyBucket()))
    add(bucket, c)
    let mine = perRepo.get(repo.fullName)
    if (!mine) perRepo.set(repo.fullName, (mine = { ...emptyBucket(), first: day, last: day }))
    add(mine, c)
    if (day < mine.first) mine.first = day
    if (day > mine.last) mine.last = day
    const when = new Date(c.committedDate)
    grid[when.getUTCDay()][when.getUTCHours()] += 1
    for (const [k, b] of Object.entries(bounds)) {
      if (day >= b.since) {
        add(periods[k], c)
        b.repos.add(repo.fullName)
      }
    }
  }
  const { truncated, pagesUsed } = await ghHistories(user.id, scanned, onCommit)
  for (const [k, b] of Object.entries(bounds)) periods[k].repos = b.repos.size

  // Series: 30 days, 52 weeks, up to GH_STATS_MONTHS months.
  const daily = []
  for (let i = 29; i >= 0; i--) {
    const date = daysAgo(now, i)
    daily.push({ date, ...(byDay.get(date) || emptyBucket()) })
  }
  const weekly = new Map()
  const monthly = new Map()
  for (const [day, b] of byDay) {
    const w = weekOf(day)
    const m = day.slice(0, 7)
    const wb = weekly.get(w) || emptyBucket()
    const mb = monthly.get(m) || emptyBucket()
    for (const k of ['c', 'a', 'd', 'f']) {
      wb[k] += b[k]
      mb[k] += b[k]
    }
    weekly.set(w, wb)
    monthly.set(m, mb)
  }
  const weeks = []
  const thisWeek = weekOf(today)
  for (let i = 51; i >= 0; i--) {
    const d = new Date(`${thisWeek}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - i * 7)
    const week = isoDay(d)
    weeks.push({ week, ...(weekly.get(week) || emptyBucket()) })
  }
  const months = []
  const firstMonth = [...monthly.keys()].sort()[0] || today.slice(0, 7)
  const cursor = new Date(`${firstMonth}-01T00:00:00Z`)
  const end = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
  while (cursor <= end) {
    const month = cursor.toISOString().slice(0, 7)
    months.push({ month, ...(monthly.get(month) || emptyBucket()) })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  // Owners (you, other people, organisations) and languages, weighted by
  // your commits.
  const owners = new Map()
  const languages = new Map()
  const repoRows = []
  for (const r of scanned) {
    const mine = perRepo.get(r.fullName)
    if (!mine) continue
    repoRows.push({
      fullName: r.fullName, name: r.name, url: r.url, owner: r.owner, ownerType: r.ownerType, stars: r.stars, private: r.private,
      language: r.language, languageColor: r.languageColor, fork: r.fork, archived: r.archived,
      commits: mine.c, additions: mine.a, deletions: mine.d, files: mine.f, first: mine.first, last: mine.last,
    })
    const o = owners.get(r.owner) || { login: r.owner, avatar: r.ownerAvatar, type: r.owner.toLowerCase() === canonical.toLowerCase() ? 'self' : r.ownerType, repos: 0, ...emptyBucket() }
    o.repos += 1
    for (const k of ['c', 'a', 'd', 'f']) o[k] += mine[k]
    // Split kept so the public view can drop the private part of an owner.
    if (r.private) o.private = true
    else {
      o.public = o.public || { repos: 0, ...emptyBucket() }
      o.public.repos += 1
      for (const k of ['c', 'a', 'd', 'f']) o.public[k] += mine[k]
    }
    owners.set(r.owner, o)
    if (r.language) {
      const l = languages.get(r.language) || { name: r.language, color: r.languageColor, commits: 0 }
      l.commits += mine.c
      languages.set(r.language, l)
    }
  }
  repoRows.sort((a, b) => b.commits - a.commits)
  const langTotal = [...languages.values()].reduce((s, l) => s + l.commits, 0)

  return {
    user: {
      login: canonical,
      name: user.name || '',
      avatar: user.avatarUrl || null,
      url: user.url || `https://github.com/${canonical}`,
      createdAt: user.createdAt || null,
      bio: user.bio || '',
      company: user.company || '',
      location: user.location || '',
      followers: user.followers?.totalCount || 0,
      following: user.following?.totalCount || 0,
    },
    periods,
    daily,
    weekly: weeks,
    monthly: months.slice(-GH_STATS_MONTHS),
    grid,
    calendar: {
      from: isoDay(from),
      to: today,
      contributions: cc.contributionCalendar?.totalContributions || 0,
      commits: cc.totalCommitContributions || 0,
      pullRequests: cc.totalPullRequestContributions || 0,
      issues: cc.totalIssueContributions || 0,
      reviews: cc.totalPullRequestReviewContributions || 0,
      restricted: cc.restrictedContributionsCount || 0,
      activeDays: calendarDays.filter((d) => d.count > 0).length,
      busiestDay: calendarDays.reduce((best, d) => (d.count > (best?.count || 0) ? d : best), null),
      streak: streaks(calendarDays, today),
    },
    general: {
      pullRequests: user.pullRequests?.totalCount || 0,
      issues: user.issues?.totalCount || 0,
      starred: user.starredRepositories?.totalCount || 0,
      ownRepos: user.repositories?.totalCount || 0,
      stars: (user.repositories?.nodes || []).reduce((s, r) => s + (r?.stargazerCount || 0), 0),
      forks: (user.repositories?.nodes || []).reduce((s, r) => s + (r?.forkCount || 0), 0),
      commitsAllYears,
      restricted,
      years: years.length,
      firstYear: years.length ? Math.min(...years) : null,
    },
    repos: repoRows,
    owners: [...owners.values()].sort((a, b) => b.c - a.c),
    access: { owner: true },
    languages: [...languages.values()].sort((a, b) => b.commits - a.commits).map((l) => ({ ...l, share: langTotal ? l.commits / langTotal : 0 })),
    coverage: {
      reposFound: repos.length,
      reposScanned: scanned.length,
      reposWithCommits: repoRows.length,
      privateRepos: repoRows.filter((r) => r.private).length,
      privateSkipped: restricted,
      pages: pagesUsed,
      truncated,
    },
    fetchedAt: now.toISOString(),
  }
}

// The account behind GITHUB_TOKEN, re-checked daily: its login plus every
// email GitHub knows for it (the public one from GraphQL, the rest from
// /user/emails when the token may read them), so a signed-in dashboard user
// can be recognised as the owner.
async function githubOwner() {
  if (ghOwner && Date.now() - ghOwner.at < 24 * 60 * 60 * 1000) return ghOwner
  const json = await ghGraphql('{ viewer { login email } }', {})
  const login = json?.data?.viewer?.login
  if (!login) throw new GhError('stats_disabled', 503)
  const emails = new Set()
  if (json.data.viewer.email) emails.add(json.data.viewer.email.toLowerCase())
  try {
    const res = await withTimeout((signal) =>
      fetch(`${GH_API}/user/emails`, { signal, headers: { authorization: `Bearer ${GH_TOKEN}`, 'user-agent': 'blxr.net', accept: 'application/vnd.github+json' } }),
    )
    if (res.ok) for (const e of await res.json()) if (e?.verified && typeof e.email === 'string') emails.add(e.email.toLowerCase())
  } catch {
    // no email permission on the token — the public email and STATS_OWNER_EMAIL still work
  }
  if (STATS_OWNER_EMAIL) emails.add(STATS_OWNER_EMAIL)
  ghOwner = { login, emails, at: Date.now() }
  return ghOwner
}

// Optional extra way to be recognised as the owner: the email of the
// dashboard account, for when the GitHub account's emails are all private.
const STATS_OWNER_EMAIL = (process.env.STATS_OWNER_EMAIL || '').trim().toLowerCase()

// True when the caller's Supabase session belongs to the token's GitHub
// account — same login on a linked GitHub identity, or a matching email.
async function isStatsOwner(req, owner) {
  if (!req.headers.authorization) return false
  let user = null
  try {
    user = await supabaseUser(req)
  } catch {
    return false
  }
  if (!user) return false
  if (user.email && owner.emails.has(user.email.toLowerCase())) return true
  for (const id of user.identities || []) {
    const login = id?.provider === 'github' ? id.identity_data?.user_name || id.identity_data?.preferred_username : null
    if (typeof login === 'string' && login.toLowerCase() === owner.login.toLowerCase()) return true
  }
  return false
}

// The public view of the stats: private repositories keep their numbers but
// lose their names, links and owners (other people's organisations are not
// this site's to reveal). Public repositories owned by you stay as they are.
function redactStats(data, owner) {
  const self = owner.login.toLowerCase()
  const repos = data.repos.map((r) => (r.private ? {
    ...r,
    fullName: null, name: null, url: null, stars: 0,
    owner: r.owner.toLowerCase() === self ? r.owner : null,
    ownerType: r.owner.toLowerCase() === self ? r.ownerType : 'private',
  } : r))
  const owners = []
  let hidden = null
  for (const o of data.owners) {
    if (o.type === 'self' || !o.private) { owners.push(o); continue }
    if (o.public) owners.push({ ...o, ...o.public, private: false })
    const priv = o.public ? { repos: o.repos - o.public.repos, c: o.c - o.public.c, a: o.a - o.public.a, d: o.d - o.public.d, f: o.f - o.public.f } : o
    hidden = hidden || { login: null, avatar: null, type: 'private', repos: 0, c: 0, a: 0, d: 0, f: 0 }
    for (const k of ['repos', 'c', 'a', 'd', 'f']) hidden[k] += priv[k]
  }
  if (hidden) owners.push(hidden)
  owners.sort((a, b) => b.c - a.c)
  return { ...data, repos, owners: owners.map(({ public: _p, ...o }) => o), access: { owner: false } }
}

async function githubStats(refresh) {
  const { login } = await githubOwner()
  const key = login.toLowerCase()
  const hit = ghStatsCache.get(key)
  if (hit) {
    const age = Date.now() - hit.at
    if (age < GH_STATS_TTL_MS && !(refresh && age >= GH_STATS_REFRESH_MIN_MS)) return hit.data
  }
  let job = ghStatsInflight.get(key)
  if (!job) {
    job = buildGithubStats(login)
      .then((data) => {
        ghStatsCache.delete(key)
        ghStatsCache.set(key, { at: Date.now(), data })
        if (ghStatsCache.size > GH_STATS_CACHE_MAX) ghStatsCache.delete(ghStatsCache.keys().next().value)
        return data
      })
      .finally(() => ghStatsInflight.delete(key))
    ghStatsInflight.set(key, job)
  }
  return job
}

// Account mail: the client asks for a "password changed" notice after Supabase
// accepts the new password. The bearer token is checked against Supabase's
// /user endpoint, so only the account owner can trigger mail to that address,
// and at most once per PASSWORD_MAIL_INTERVAL_MS per account.
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || ''
// Secret (service-role) key, only needed for account deletion. Never sent to clients.
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || ''
const PASSWORD_MAIL_INTERVAL_MS = 10 * 60_000
const passwordMailAt = new Map() // user id -> last send

async function supabaseUser(req) {
  const auth = req.headers.authorization
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null
  const res = await withTimeout((signal) =>
    fetch(`${SUPABASE_URL}/auth/v1/user`, {
      signal,
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` },
    }),
  )
  if (!res.ok) return null
  const user = await res.json()
  return typeof user?.id === 'string' && typeof user?.email === 'string' ? user : null
}

function json(res, status, body, headers) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60',
    ...headers,
  })
  res.end(JSON.stringify(body))
}

const NO_STORE = { 'cache-control': 'no-store' }

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}`)

    if (url.pathname === '/api/hit') {
      if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
      const body = await readJsonBody(req)
      if (body && typeof body.path === 'string') recordHit(body.path)
      res.writeHead(204, { 'cache-control': 'no-store' })
      return res.end()
    }

    if (url.pathname === '/api/mail/password-changed') {
      if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' }, NO_STORE)
      if (!mailConfigured() || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return json(res, 503, { error: 'mail_disabled' }, NO_STORE)
      const user = await supabaseUser(req)
      if (!user) return json(res, 401, { error: 'unauthorized' }, NO_STORE)
      const now = Date.now()
      if (now - (passwordMailAt.get(user.id) || 0) < PASSWORD_MAIL_INTERVAL_MS) {
        return json(res, 429, { error: 'too_soon' }, NO_STORE)
      }
      passwordMailAt.set(user.id, now)
      for (const [id, at] of passwordMailAt) if (now - at >= PASSWORD_MAIL_INTERVAL_MS) passwordMailAt.delete(id)
      const mail = passwordChangedMail({ email: user.email, client: describeClient(req.headers['user-agent']), at: new Date(now) })
      try {
        await withTimeout((signal) => sendMail({ to: user.email, ...mail }, { signal }))
      } catch {
        passwordMailAt.delete(user.id)
        return json(res, 502, { error: 'mail_failed' }, NO_STORE)
      }
      res.writeHead(204, NO_STORE)
      return res.end()
    }

    // Settings → Danger zone. The bearer token proves who is asking; the
    // admin call then removes that user and every session they have.
    if (url.pathname === '/api/account/delete') {
      if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' }, NO_STORE)
      if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SECRET_KEY) return json(res, 503, { error: 'delete_disabled' }, NO_STORE)
      const user = await supabaseUser(req)
      if (!user) return json(res, 401, { error: 'unauthorized' }, NO_STORE)
      let ok = false
      try {
        const del = await withTimeout((signal) =>
          fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
            method: 'DELETE',
            signal,
            headers: { apikey: SUPABASE_SECRET_KEY, authorization: `Bearer ${SUPABASE_SECRET_KEY}` },
          }),
        )
        ok = del.ok
      } catch {
        ok = false
      }
      if (!ok) return json(res, 502, { error: 'delete_failed' }, NO_STORE)
      res.writeHead(204, NO_STORE)
      return res.end()
    }

    if (url.pathname === '/api/vitals' && req.method === 'POST') {
      const body = await readJsonBody(req, 1024)
      const list = Array.isArray(body) ? body : body ? [body] : []

      for (const item of list.slice(0, 12)) {
        if (item && typeof item.m === 'string') recordVital(item.m, item.v)
      }
      res.writeHead(204, { 'cache-control': 'no-store' })
      return res.end()
    }

    if (url.pathname === '/api/reviews') {
      if (req.method === 'GET') {
        const cookie = cookieToken(req)
        const mine = cookie ? hashToken('cookie', cookie) : null
        const items = reviews
          .filter((r) => isVisible(r) || (r.pending && mine && r.cookieHash === mine))
          .map(publicReview)
          .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        return json(res, 200, { items, total: items.length }, NO_STORE)
      }
      if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' }, NO_STORE)

      const body = await readJsonBody(req, 4096)
      if (!body || typeof body !== 'object') return json(res, 400, { error: 'invalid', fields: [] }, NO_STORE)

      const checked = validateReview(body)
      if (checked.error) return json(res, 400, checked, NO_STORE)
      if (settings.paused) return json(res, 503, { error: 'paused', retryAfter: 3600 }, { ...NO_STORE, 'retry-after': '3600' })

      const now = Date.now()
      const at = new Date(now).toISOString()

      if (typeof body.website === 'string' && body.website.trim()) {
        return json(res, 201, { item: { id: newReviewId(), ...checked.review, at } }, NO_STORE)
      }

      const cookie = cookieToken(req)
      const device = deviceToken(body)
      const submitter = {
        ipHash: hashToken('ip', clientIp(req)),
        deviceHash: device ? hashToken('device', device) : null,
        cookieHash: cookie ? hashToken('cookie', cookie) : null,
      }

      const inviteToken = typeof body.invite === 'string' && REVIEW_TOKEN_RE.test(body.invite) ? body.invite : null
      const invite = inviteToken ? invites.find((i) => i.token === inviteToken) : null
      if (inviteToken && (!invite || inviteStatus(invite, now) !== 'pending')) {
        return json(res, 410, { error: invite ? `invite_${inviteStatus(invite, now)}` : 'invite_not_found' }, NO_STORE)
      }

      const limited = invite ? null : reviewRateLimit(submitter, now)
      if (limited) {
        const status = limited.error === 'full' ? 503 : 429
        return json(res, status, limited, { ...NO_STORE, 'retry-after': String(limited.retryAfter) })
      }

      const issued = cookie || crypto.randomBytes(16).toString('hex')
      if (!cookie) submitter.cookieHash = hashToken('cookie', issued)
      const record = { id: newReviewId(), ...checked.review, at, ...submitter }
      if (!record.deviceHash) delete record.deviceHash
      if (invite) {
        invite.reviewId = record.id
        invitesDirty = true
        record.invited = true
      } else if (settings.approval) {
        record.hidden = true
        record.pending = true
      }
      reviews.push(record)
      reviewsDirty = true
      return json(res, 201, { item: publicReview(record) }, {
        ...NO_STORE,
        'set-cookie': `${REVIEW_COOKIE}=${issued}; Path=/api/reviews; Max-Age=${Math.ceil(REVIEW_WINDOW_MS / 1000)}; HttpOnly; SameSite=Strict`,
      })
    }

    const editMatch = /^\/api\/reviews\/([a-z0-9]{8})$/.exec(url.pathname)
    if (editMatch) {
      if (req.method !== 'PATCH') return json(res, 405, { error: 'method_not_allowed' }, NO_STORE)
      const record = reviews.find((r) => r.id === editMatch[1])
      if (!record) return json(res, 404, { error: 'not_found' }, NO_STORE)

      const body = await readJsonBody(req, 4096)
      if (!body || typeof body !== 'object') return json(res, 400, { error: 'invalid', fields: [] }, NO_STORE)

      const cookie = cookieToken(req)
      const device = deviceToken(body)
      const owns =
        (cookie && record.cookieHash && record.cookieHash === hashToken('cookie', cookie)) ||
        (device && record.deviceHash && record.deviceHash === hashToken('device', device))
      if (!owns) return json(res, 403, { error: 'not_yours' }, NO_STORE)
      if (Date.now() - Date.parse(record.at) > REVIEW_EDIT_WINDOW_MS) return json(res, 403, { error: 'edit_window' }, NO_STORE)

      const checked = validateReview(body)
      if (checked.error) return json(res, 400, checked, NO_STORE)

      Object.assign(record, checked.review, { editedAt: new Date().toISOString() })
      reviewsDirty = true
      return json(res, 200, { item: publicReview(record) }, NO_STORE)
    }

    if (url.pathname === '/api/reviews/panel/login') {
      if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' }, NO_STORE)
      if (!REVIEW_OWNER_KEY) return json(res, 503, { error: 'panel_disabled' }, NO_STORE)
      const now = Date.now()
      const ipHash = hashToken('panel', clientIp(req))
      const fails = panelFails.get(ipHash)
      if (fails && fails.count >= PANEL_LOGIN_MAX_FAILS && now - fails.at < PANEL_LOCKOUT_MS) {
        const retryAfter = Math.ceil((PANEL_LOCKOUT_MS - (now - fails.at)) / 1000)
        return json(res, 429, { error: 'locked', retryAfter }, { ...NO_STORE, 'retry-after': String(retryAfter) })
      }
      const body = await readJsonBody(req, 1024)
      if (typeof body?.password !== 'string' || body.password.length < 16 || !keyMatches(body.password)) {
        const next = fails && now - fails.at < PANEL_LOCKOUT_MS ? { count: fails.count + 1, at: now } : { count: 1, at: now }
        panelFails.set(ipHash, next)
        return json(res, 401, { error: 'wrong_password', attemptsLeft: Math.max(0, PANEL_LOGIN_MAX_FAILS - next.count) }, NO_STORE)
      }
      panelFails.delete(ipHash)
      const token = crypto.randomBytes(24).toString('hex')
      panelSessions.set(token, now + PANEL_SESSION_MS)
      for (const [t, exp] of panelSessions) if (exp <= now) panelSessions.delete(t)
      res.writeHead(204, { ...NO_STORE, 'set-cookie': panelCookie(token, Math.ceil(PANEL_SESSION_MS / 1000)) })
      return res.end()
    }

    if (url.pathname === '/api/reviews/panel/logout') {
      if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' }, NO_STORE)
      const token = panelSession(req)
      if (token) panelSessions.delete(token)
      res.writeHead(204, { ...NO_STORE, 'set-cookie': panelCookie('', 0) })
      return res.end()
    }

    if (url.pathname === '/api/reviews/panel/session') {
      if (!isOwner(req)) return json(res, 401, { error: 'unauthorized' }, NO_STORE)
      res.writeHead(204, NO_STORE)
      return res.end()
    }

    const panelMatch = /^\/api\/reviews\/panel(?:\/(reviews|settings)(?:\/([a-z0-9]{8}))?)?$/.exec(url.pathname)
    if (panelMatch) {
      if (!isOwner(req)) return json(res, 401, { error: 'unauthorized' }, NO_STORE)
      const [, section, id] = panelMatch
      const now = Date.now()

      if (!section) {
        if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' }, NO_STORE)
        return json(res, 200, {
          reviews: reviews.map(panelReview).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
          invites: invites.map((i) => ownerInvite(i, now)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
          settings,
          stats: panelStats(now),
        }, NO_STORE)
      }

      if (section === 'settings') {
        if (req.method !== 'PUT') return json(res, 405, { error: 'method_not_allowed' }, NO_STORE)
        const body = await readJsonBody(req, 16_384)
        if (!body || typeof body !== 'object') return json(res, 400, { error: 'invalid', fields: [] }, NO_STORE)
        settings = normalizeSettings({ ...settings, ...body })
        settingsDirty = true
        return json(res, 200, { settings }, NO_STORE)
      }

      if (!id) return json(res, 405, { error: 'method_not_allowed' }, NO_STORE)
      const index = reviews.findIndex((r) => r.id === id)
      if (index < 0) return json(res, 404, { error: 'not_found' }, NO_STORE)
      const record = reviews[index]

      if (req.method === 'DELETE') {
        reviews.splice(index, 1)
        reviewsDirty = true
        res.writeHead(204, NO_STORE)
        return res.end()
      }

      if (req.method !== 'PATCH') return json(res, 405, { error: 'method_not_allowed' }, NO_STORE)
      const body = await readJsonBody(req, 4096)
      if (!body || typeof body !== 'object') return json(res, 400, { error: 'invalid', fields: [] }, NO_STORE)

      if ('name' in body || 'role' in body || 'rating' in body || 'text' in body) {
        const checked = validateReview({ ...record, ...body })
        if (checked.error) return json(res, 400, checked, NO_STORE)
        Object.assign(record, checked.review, { editedAt: new Date(now).toISOString() })
      }
      if ('hidden' in body) record.hidden = body.hidden === true
      if ('pinned' in body) record.pinned = body.pinned === true
      if ('pending' in body && body.pending === false) {
        record.pending = false
        record.hidden = false
      }
      if ('reply' in body) {
        const text = cleanBlock(body.reply)
        if (!text) delete record.reply
        else if (text.length > REVIEW_LIMITS.text[1] || REVIEW_LINK_RE.test(text)) return json(res, 400, { error: 'invalid', fields: ['reply'] }, NO_STORE)
        else record.reply = { text, at: new Date(now).toISOString() }
      }
      for (const key of ['hidden', 'pinned', 'pending']) if (record[key] === false) delete record[key]
      reviewsDirty = true
      return json(res, 200, { item: panelReview(record) }, NO_STORE)
    }

    const inviteMatch = /^\/api\/reviews\/invites(?:\/([a-f0-9]{32}))?$/.exec(url.pathname)
    if (inviteMatch) {
      const token = inviteMatch[1]
      const now = Date.now()

      if (req.method === 'GET' && token) {
        const invite = invites.find((i) => i.token === token)
        if (!invite) return json(res, 404, { error: 'not_found' }, NO_STORE)
        return json(res, 200, { invite: publicInvite(invite, now) }, NO_STORE)
      }

      if (!isOwner(req)) return json(res, REVIEW_OWNER_KEY ? 403 : 404, { error: REVIEW_OWNER_KEY ? 'forbidden' : 'not_found' }, NO_STORE)

      if (req.method === 'GET') {
        const list = invites.map((i) => ownerInvite(i, now)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        return json(res, 200, { items: list }, NO_STORE)
      }

      if (req.method === 'DELETE' && token) {
        const index = invites.findIndex((i) => i.token === token)
        if (index < 0) return json(res, 404, { error: 'not_found' }, NO_STORE)
        if (invites[index].reviewId) return json(res, 409, { error: 'already_used' }, NO_STORE)
        invites.splice(index, 1)
        invitesDirty = true
        res.writeHead(204, NO_STORE)
        return res.end()
      }

      if (req.method === 'POST' && !token) {
        const body = await readJsonBody(req, 4096)
        const name = cleanLine(body?.name)
        const role = cleanLine(body?.role)
        const text = cleanBlock(body?.text)
        const fields = []
        if (!withinLimits(name, REVIEW_LIMITS.name) || !/\p{L}/u.test(name)) fields.push('name')
        if (!withinLimits(role, REVIEW_LIMITS.role)) fields.push('role')
        if (text && !withinLimits(text, REVIEW_LIMITS.text)) fields.push('text')
        if (fields.length) return json(res, 400, { error: 'invalid', fields }, NO_STORE)
        if ([name, role, text].some((v) => REVIEW_LINK_RE.test(v))) return json(res, 400, { error: 'link', fields: ['text'] }, NO_STORE)

        const rating = Number(body?.rating)
        const days = Number(body?.days)
        const invite = {
          token: crypto.randomBytes(16).toString('hex'),
          name,
          role,
          text,
          rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 5,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + (Number.isInteger(days) && days >= 1 && days <= 30 ? days * 86_400_000 : INVITE_TTL_MS)).toISOString(),
          reviewId: null,
          auto: false,
        }
        invites.push(invite)
        invitesDirty = true
        return json(res, 201, { invite: ownerInvite(invite, now) }, NO_STORE)
      }

      return json(res, 405, { error: 'method_not_allowed' }, NO_STORE)
    }

    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })

    if (url.pathname === '/api/vitals') {
      const window = Math.min(VITALS_RETENTION_DAYS, Math.max(1, Number(url.searchParams.get('days')) || 7))
      const from = new Date(Date.now() - (window - 1) * 86_400_000).toISOString().slice(0, 10)
      const days = Object.keys(vitals).filter((day) => day >= from).sort()
      return json(res, 200, { window, days: days.length, metrics: summariseVitals(days) })
    }

    if (url.pathname === '/api/hits') {
      const days = Object.keys(hits).sort()
      const total = days.reduce(
        (sum, day) => sum + Object.values(hits[day]).reduce((a, b) => a + b, 0),
        0,
      )
      return json(res, 200, { total, today: hits[today()] || {}, days: days.length })
    }

    if (url.pathname === '/api/music/health') return json(res, 200, { ok: true, source: 'youtube' })

    if (url.pathname === '/api/music/top') {
      const country = ((url.searchParams.get('country') || 'us').toLowerCase().replace(/[^a-z]/g, '') || 'us').slice(0, 2)
      const limit = Math.min(15, Math.max(1, Number(url.searchParams.get('limit')) || 10))
      const hit = topCache.get(topKey(country, limit))
      if (hit && Date.now() - hit.at < TOP_CACHE_TTL_MS) return json(res, 200, hit.data)

      const refresh = refreshTop(country, limit)
      if (hit) {
        refresh.catch(() => {})
        return json(res, 200, hit.data)
      }
      let timer
      const budget = new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), TOP_RESPONSE_BUDGET_MS)
      })
      try {
        const data = await Promise.race([refresh, budget])
        if (data) return json(res, 200, data)
        refresh.catch(() => {})
        res.writeHead(503, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'retry-after': '15',
        })
        return res.end(JSON.stringify({ error: 'warming' }))
      } finally {
        clearTimeout(timer)
      }
    }

    if (url.pathname === '/api/music/search') {
      const q = (url.searchParams.get('q') || '').trim().slice(0, 120)
      const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit')) || 12))
      if (q.length < 2) return json(res, 200, { items: [] })

      const key = `${q} ${limit}`
      const cached = cacheGet(key)
      if (cached) return json(res, 200, { items: cached })

      const items = await searchAll(q, limit, 'videos')
      if (items.length) cacheSet(key, items)
      return json(res, 200, { items })
    }

    // Dashboard → Stats: the token owner's own GitHub activity. Public data,
    // cached an hour, and a refresh only recomputes every couple of minutes,
    // so it can stay open like the contribution route.
    if (url.pathname === '/api/github/stats') {
      if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' }, NO_STORE)
      if (!GH_TOKEN) return json(res, 503, { error: 'stats_disabled' }, NO_STORE)
      try {
        const data = await githubStats(url.searchParams.get('refresh') === '1')
        const owner = await githubOwner()
        return json(res, 200, (await isStatsOwner(req, owner)) ? data : redactStats(data, owner), NO_STORE)
      } catch (err) {
        if (err instanceof GhError) return json(res, err.status, { error: err.code }, NO_STORE)
        return json(res, 502, { error: 'github_failed' }, NO_STORE)
      }
    }

    if (url.pathname === '/api/github/contributions') {
      const user = (url.searchParams.get('user') || '').trim()
      if (!GH_USER_RE.test(user)) return json(res, 400, { error: 'bad_user' })

      const rawYear = (url.searchParams.get('y') || 'last').trim()
      const nowYear = new Date().getUTCFullYear()
      const asYear = Number(rawYear)
      const year =
        rawYear === 'last'
          ? 'last'
          : /^\d{4}$/.test(rawYear) && asYear >= 2008 && asYear <= nowYear
            ? rawYear
            : null

      if (!year) return json(res, 400, { error: 'bad_year' })

      const key = `${user} ${year}`
      const hit = ghCache.get(key)
      if (hit && Date.now() - hit.at < GH_CACHE_TTL_MS) return json(res, 200, hit.data)

      const data = await fetchContributions(user, year)
      ghCache.set(key, { at: Date.now(), data })
      if (ghCache.size > GH_CACHE_MAX) ghCache.delete(ghCache.keys().next().value)
      return json(res, 200, data)
    }

    return json(res, 404, { error: 'not_found' })
  } catch {
    return json(res, 502, { error: 'upstream_failed' })
  }
})

server.listen(PORT, HOST, () => {

  console.log(`blxr music search proxy on http://${HOST}:${PORT}`)
})

warmTop()
setInterval(warmTop, TOP_CACHE_TTL_MS - 10 * 60_000).unref()

sweepInvites()
setInterval(sweepInvites, INVITE_SWEEP_MS).unref()
