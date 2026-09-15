// Dashboard → Stats. The numbers are the site owner's — the server works out
// whose token it holds and builds everything for that GitHub account.

const CACHE_KEY = 'blxr:ghstats'
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

export class StatsError extends Error {
  constructor(code, status = 0) {
    super(code)
    this.code = code
    this.status = status
  }
}

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function readStatsCache() {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.data?.user?.login || !parsed.data.periods || Date.now() - parsed.at > CACHE_MAX_AGE_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeStatsCache(data) {
  const store = storage()
  if (!store) return
  try {
    store.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }))
  } catch {
    // quota or private mode — the page just refetches next time
  }
}

// Resolves to the stats payload; throws StatsError with one of:
// stats_disabled, rate_limited, offline, failed.
export async function fetchGithubStats({ signal, refresh = false } = {}) {
  let res
  try {
    res = await fetch(`/api/github/stats${refresh ? '?refresh=1' : ''}`, { signal })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new StatsError('offline')
  }
  let body = null
  try {
    body = await res.json()
  } catch {
    // an HTML error page from the edge — treated as a failed call below
  }
  if (!res.ok) {
    const code = typeof body?.error === 'string' ? body.error : ''
    throw new StatsError(['stats_disabled', 'rate_limited'].includes(code) ? code : 'failed', res.status)
  }
  if (!body?.user?.login || !body.periods) throw new StatsError('failed', res.status)
  writeStatsCache(body)
  return body
}

// --- formatting ----------------------------------------------------------------

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('en')

export const formatCount = (n) => (Math.abs(n) >= 10_000 ? compact.format(n) : plain.format(n))
export const formatExact = (n) => plain.format(n)

export function relativeTime(iso, now = Date.now()) {
  const t = Date.parse(iso)
  if (!t) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo} mo ago`
  return `${Math.round(mo / 12)} yr ago`
}

const monthDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const monthYear = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' })

const parseDay = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
export const formatDay = (iso) => (iso ? monthDay.format(parseDay(iso)) : '')
export const formatMonthYear = (iso) => (iso ? monthYear.format(new Date(iso)) : '')
