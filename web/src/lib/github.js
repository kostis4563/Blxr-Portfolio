const PROXY = '/api/github/contributions'

const MIRROR = 'https://github-contributions-api.jogruber.de/v4'

const ROLLING = 'last'

const CACHE_PREFIX = 'blxr:gh:'
const CACHE_VERSION = 1

const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function levelize(days) {
  const busy = days.filter((d) => d.count > 0).map((d) => d.count)
  if (!busy.length) return days.map((d) => ({ ...d, level: 0 }))

  const distinct = [...new Set(busy)].sort((a, b) => a - b)

  if (distinct.length === 1) {
    return days.map((d) => ({ ...d, level: d.count > 0 ? 3 : 0 }))
  }

  const sorted = [...busy].sort((a, b) => a - b)
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]

  const cuts = [...new Set([at(0.25), at(0.5), at(0.75)])]

  return days.map((d) => {
    if (d.count <= 0) return { ...d, level: 0 }
    let level = 1
    for (const cut of cuts) if (d.count > cut) level++
    return { ...d, level: Math.min(4, level) }
  })
}

const cacheKey = (username, year) => `${CACHE_PREFIX}${CACHE_VERSION}:${username}:${String(year)}`

function storage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function readCache(username, year = ROLLING) {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(cacheKey(username, year))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.days) || !parsed.days.length) return null
    if (Date.now() - parsed.at > CACHE_MAX_AGE_MS) return null
    const days = levelize(parsed.days.map(([date, count]) => ({ date, count })))
    return { days, total: parsed.total ?? 0, at: parsed.at, stale: true }
  } catch {

    return null
  }
}

function writeCache(username, year, { days, total }) {
  const store = storage()
  if (!store || !days.length) return
  try {
    store.setItem(
      cacheKey(username, year),
      JSON.stringify({ at: Date.now(), total, days: days.map((d) => [d.date, d.count]) }),
    )
  } catch {
  }
}

function todayIso() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function normalize(json, year) {

  const cutoff = todayIso()
  const days = (json?.contributions ?? [])
    .filter((d) => d?.date && d.date <= cutoff)
    .map((d) => ({
      date: d.date,
      count: Number(d.count) || 0,
    }))
  const total =
    year === ROLLING
      ? (json?.total?.lastYear ?? 0)
      : (json?.total?.[year] ?? json?.total?.lastYear ?? 0)
  return { days, total }
}

async function get(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchContributions(username, { year = ROLLING, signal } = {}) {
  const user = encodeURIComponent(username)

  const y = String(year)

  let json
  let source = 'proxy'
  try {
    json = await get(`${PROXY}?user=${user}&y=${encodeURIComponent(y)}`, signal)
  } catch (err) {

    if (err?.name === 'AbortError') throw err
    json = await get(`${MIRROR}/${user}?y=${encodeURIComponent(y)}`, signal)
    source = 'mirror'
  }

  const { days, total } = normalize(json, y)
  writeCache(username, y, { days, total })
  return { days: levelize(days), total, source }
}
