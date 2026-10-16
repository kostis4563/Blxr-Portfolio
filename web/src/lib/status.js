export const STATUS_INTRO =
  'Live checks of blxr.net and its API. The server tries both every few minutes and keeps 90 days of history.'

export const POLL_MS = 60_000
export const MOBILE_DAYS = 30
export const PARTIAL_FLOOR = 0.95

const STATES = new Set(['up', 'down', 'unknown'])
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MINUTE = 60_000

export class StatusError extends Error {
  constructor(code, status = 0) {
    super(code)
    this.code = code
    this.status = status
  }
}

const text = (value, max = 120) => (typeof value === 'string' ? value.slice(0, max) : null)
const count = (value) => (Number.isFinite(value) && value >= 0 ? value : 0)
const maybeNumber = (value) => (Number.isFinite(value) ? value : null)
const isTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value))

function cleanDay(raw) {
  if (!raw || !DAY_RE.test(raw.day)) return null
  const checks = count(raw.checks)
  return { day: raw.day, checks, up: Math.min(count(raw.up), checks), ms: maybeNumber(raw.ms) }
}

function cleanService(raw) {
  if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  return {
    id: raw.id,
    name: text(raw.name),
    host: text(raw.host) || '',
    link: typeof raw.link === 'string' && /^https:\/\//.test(raw.link) ? raw.link : null,
    state: STATES.has(raw.state) ? raw.state : 'unknown',
    since: isTime(raw.since) ? raw.since : null,
    ms: maybeNumber(raw.ms),
    code: text(raw.code, 32),
    uptime: maybeNumber(raw.uptime),
    avgMs: maybeNumber(raw.avgMs),
    days: Array.isArray(raw.days) ? raw.days.map(cleanDay).filter(Boolean) : [],
  }
}

function cleanIncident(raw) {
  if (!raw || typeof raw.service !== 'string' || !isTime(raw.start)) return null
  return {
    service: raw.service,
    name: text(raw.name) || raw.service,
    start: raw.start,
    end: isTime(raw.end) ? raw.end : null,
    code: text(raw.code, 32),
  }
}

export function cleanStatus(data) {
  return {
    checkedAt: isTime(data?.checkedAt) ? data.checkedAt : null,
    every: count(data?.every) || 300,
    services: Array.isArray(data?.services) ? data.services.map(cleanService).filter(Boolean) : [],
    incidents: Array.isArray(data?.incidents) ? data.incidents.map(cleanIncident).filter(Boolean) : [],
  }
}

export async function fetchStatus({ signal } = {}) {
  let res
  try {
    res = await fetch('/api/status', { signal, headers: { accept: 'application/json' } })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new StatusError('offline')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new StatusError(typeof data?.error === 'string' ? data.error : `http_${res.status}`, res.status)
  return cleanStatus(data)
}

export function overallOf(services) {
  const known = services.filter((s) => s.state !== 'unknown')
  if (!known.length) return { tone: 'unknown', label: 'Checking…' }
  const down = known.filter((s) => s.state === 'down')
  if (!down.length) return { tone: 'up', label: 'All systems operational' }
  if (down.length === known.length) return { tone: 'down', label: 'Everything is down' }
  if (down.length === 1) return { tone: 'partial', label: `${down[0].name} is down` }
  return { tone: 'partial', label: `${down.length} services are down` }
}

export function dayTone(day) {
  if (!day || !day.checks) return 'none'
  if (day.up === day.checks) return 'up'
  return day.up / day.checks >= PARTIAL_FLOOR ? 'partial' : 'down'
}

export function formatUptime(ratio) {
  if (!Number.isFinite(ratio)) return '—'
  if (ratio >= 1) return '100%'
  return `${(Math.floor(ratio * 10_000) / 100).toFixed(2)}%`
}

export function describeCode(code) {
  if (!code) return ''
  if (code === 'timeout') return 'Timed out'
  if (code === 'unreachable') return 'Could not connect'
  const http = /^http_(\d{3})$/.exec(code)
  return http ? `HTTP ${http[1]}` : code
}

export function formatSpan(ms) {
  if (!Number.isFinite(ms) || ms < MINUTE) return 'under a minute'
  const minutes = Math.round(ms / MINUTE)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`
  const days = Math.floor(hours / 24)
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`
}

export function formatMs(ms) {
  if (!Number.isFinite(ms)) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
}

export function dayLabel(day, style = 'short') {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: style === 'short' ? 'short' : 'long',
      day: 'numeric',
      ...(style === 'short' ? {} : { year: 'numeric' }),
      timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00Z`))
  } catch {
    return day
  }
}

export function describeDay(day, everySeconds) {
  const tone = dayTone(day)
  if (tone === 'none') return 'No data'
  if (tone === 'up') return day.ms == null ? '100% up' : `100% up · ${formatMs(day.ms)} avg`
  const downFor = (day.checks - day.up) * everySeconds * 1000
  return `${formatUptime(day.up / day.checks)} up · about ${formatSpan(downFor)} down`
}

export function stripSummary(days) {
  const rough = days.filter((d) => dayTone(d) === 'partial' || dayTone(d) === 'down')
  const checks = days.reduce((n, d) => n + d.checks, 0)
  const up = days.reduce((n, d) => n + d.up, 0)
  const total = checks ? `${formatUptime(up / checks)} up over ${days.length} days.` : `No checks in the last ${days.length} days yet.`
  if (!rough.length) return checks ? `${total} No downtime.` : total
  const listed = rough.slice(-5).map((d) => `${dayLabel(d.day)} (${formatUptime(d.up / d.checks)})`)
  return `${total} ${rough.length === 1 ? 'One day' : `${rough.length} days`} with downtime: ${listed.join(', ')}${rough.length > 5 ? ', and more' : ''}.`
}
