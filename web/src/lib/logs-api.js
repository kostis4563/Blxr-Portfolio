import { currentSession } from './supabase'

const ENDPOINT = '/api/logs'

export const LEVELS = ['error', 'warn', 'info']
export const SOURCES = ['server', 'api', 'client', 'upstream', 'github', 'auth', 'reviews', 'mail']

export const SOURCE_LABEL = {
  server: 'Server',
  api: 'API',
  client: 'Browser',
  upstream: 'Upstream',
  github: 'GitHub',
  auth: 'Auth',
  reviews: 'Reviews',
  mail: 'Mail',
}

export const RANGES = [
  { id: '1h', label: '1h', ms: 3_600_000 },
  { id: '24h', label: '24h', ms: 86_400_000 },
  { id: '7d', label: '7d', ms: 7 * 86_400_000 },
  { id: 'all', label: 'All', ms: 0 },
]
export const STATUS_CLASSES = ['4xx', '5xx']

export const EMPTY_FILTER = { q: '', levels: [], sources: [], range: 'all', status: '' }
export const normalizeFilter = (f = {}) => ({
  q: typeof f.q === 'string' ? f.q : '',
  levels: Array.isArray(f.levels) ? f.levels.filter((l) => LEVELS.includes(l)) : [],
  sources: Array.isArray(f.sources) ? f.sources.filter((s) => SOURCES.includes(s)) : [],
  range: RANGES.some((r) => r.id === f.range) ? f.range : 'all',
  status: STATUS_CLASSES.includes(f.status) ? f.status : '',
})

const sameList = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
export const sameFilter = (a, b) =>
  a.q.trim() === b.q.trim() && sameList(a.levels, b.levels) && sameList(a.sources, b.sources) && a.range === b.range && a.status === b.status

export const isEmptyFilter = (f) => sameFilter(f, EMPTY_FILTER)

export const toggleIn = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

export const BUILTIN_TABS = [
  { id: 'all', label: 'All', filter: {} },
  { id: 'errors', label: 'Errors', filter: { levels: ['error'] } },
  { id: 'api', label: 'API', filter: { sources: ['api'] } },
  { id: 'browser', label: 'Browser', filter: { sources: ['client'] } },
  { id: 'server', label: 'Server', filter: { sources: ['server', 'upstream', 'github', 'mail'] } },
  { id: 'auth', label: 'Auth', filter: { sources: ['auth'] } },
  { id: 'reviews', label: 'Reviews', filter: { sources: ['reviews'] } },
  { id: 'system', label: 'System', system: true },
]

const SAVED_KEY = 'blxr:logs:tabs'
const SAVED_MAX = 12

export function readSavedTabs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((t) => t && typeof t.id === 'string' && /^t[a-z0-9]{4,}$/.test(t.id) && typeof t.label === 'string')
      .slice(0, SAVED_MAX)
      .map((t) => ({ id: t.id, label: t.label.slice(0, 24), filter: normalizeFilter(t.filter), saved: true }))
  } catch {
    return []
  }
}

export function writeSavedTabs(tabs) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(tabs.map(({ id, label, filter }) => ({ id, label, filter }))))
  } catch {
  }
}

export const newTabId = () => `t${Math.random().toString(36).slice(2, 8)}`

export function describeFilter(f) {
  const parts = []
  if (f.levels.length) parts.push(f.levels.map((l) => ({ error: 'errors', warn: 'warnings', info: 'info' })[l]).join(' + '))
  if (f.sources.length) parts.push(f.sources.map((s) => SOURCE_LABEL[s]).join(', '))
  if (f.status) parts.push(`${f.status} answers`)
  if (f.range !== 'all') parts.push(`last ${f.range}`)
  if (f.q.trim()) parts.push(`“${f.q.trim()}”`)
  return parts.length ? parts.join(' · ') : 'everything'
}

export class LogsError extends Error {
  constructor(code, status = 0) {
    super(code)
    this.code = code
    this.status = status
  }
}

function headers() {
  const token = currentSession()?.access_token
  return token ? { authorization: `Bearer ${token}` } : {}
}

async function request(query, { method = 'GET', signal } = {}) {
  let res
  try {
    res = await fetch(`${ENDPOINT}${query ? `?${query}` : ''}`, { method, headers: headers(), cache: 'no-store', signal })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new LogsError('offline')
  }
  let body = null
  try {
    body = await res.json()
  } catch {
  }
  if (!res.ok) throw new LogsError(typeof body?.error === 'string' ? body.error : 'failed', res.status)
  return body
}

export function fetchLogs(filter = EMPTY_FILTER, { limit = 200, before, signal } = {}) {
  const f = normalizeFilter(filter)
  const params = new URLSearchParams()
  if (f.levels.length) params.set('levels', f.levels.join(','))
  if (f.sources.length) params.set('sources', f.sources.join(','))
  if (f.q.trim()) params.set('q', f.q.trim())
  if (f.status) params.set('status', f.status)
  const range = RANGES.find((r) => r.id === f.range)
  if (range?.ms) params.set('since', String(Date.now() - range.ms))
  params.set('limit', String(limit))
  if (before) params.set('before', String(before))
  return request(params.toString(), { signal })
}

export function clearLogs({ signal } = {}) {
  return request('', { method: 'DELETE', signal })
}

const timeFmt = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
const dayFmt = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' })
const fullFmt = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

export const formatTime = (iso) => timeFmt.format(new Date(iso))
export const formatFull = (iso) => fullFmt.format(new Date(iso))

export function dayLabel(iso, now = new Date()) {
  const d = new Date(iso)
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(now) - start(d)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return dayFmt.format(d)
}

export const dayKey = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function formatUptime(seconds) {
  const s = Math.max(0, Math.round(seconds))
  const d = Math.floor(s / 86_400)
  const h = Math.floor((s % 86_400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}

export function formatBytes(n) {
  if (n === null || n === undefined) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function relativeTime(iso, now = Date.now()) {
  const t = Date.parse(iso)
  if (!t) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

export function lineOf(e) {
  const when = e.at.replace('T', ' ').slice(0, 19)
  const where = e.path ? ` ${e.method ? `${e.method} ` : ''}${e.path}` : ''
  const times = e.count > 1 ? ` (×${e.count})` : ''
  return `${when}  ${e.level.toUpperCase().padEnd(5)}  ${e.source.padEnd(8)}  ${e.message}${where}${times}`
}
