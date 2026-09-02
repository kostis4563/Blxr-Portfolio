import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.PORT) || 8899
const HOST = '127.0.0.1'
const UPSTREAM_TIMEOUT_MS = 7000
const CACHE_TTL_MS = 60_000
const CACHE_MAX = 200

const PIPED = [
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.leptons.xyz',
]
const INVIDIOUS = ['https://inv.nadeko.net', 'https://invidious.f5.si', 'https://yewtu.be']

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
    try {
      const items = await fromPiped(base, q, limit, filter)
      if (items.length) return items
    } catch {
    }
  }
  for (const base of INVIDIOUS) {
    try {
      const items = await fromInvidious(base, q, limit)
      if (items.length) return items
    } catch {
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
const topCache = new Map()

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
  const url = `https://rss.applemarketingtools.com/api/v2/${country}/music/most-played/${pull}/songs.json`
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

const GH_TOKEN = process.env.GITHUB_TOKEN || ''
const GH_CACHE_TTL_MS = 30 * 60 * 1000
const GH_CACHE_MAX = 50
const ghCache = new Map()

const GH_USER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/

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

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60',
  })
  res.end(JSON.stringify(body))
}

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

    if (url.pathname === '/api/vitals' && req.method === 'POST') {
      const body = await readJsonBody(req, 1024)
      const list = Array.isArray(body) ? body : body ? [body] : []

      for (const item of list.slice(0, 12)) {
        if (item && typeof item.m === 'string') recordVital(item.m, item.v)
      }
      res.writeHead(204, { 'cache-control': 'no-store' })
      return res.end()
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
      const key = `${country} ${limit}`
      const hit = topCache.get(key)
      if (hit && Date.now() - hit.at < TOP_CACHE_TTL_MS) return json(res, 200, hit.data)
      const data = await fetchTop(country, limit)
      if (data.items.length) topCache.set(key, { at: Date.now(), data })
      return json(res, 200, data)
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
