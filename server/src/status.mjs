import { readState, writeState } from './state.mjs'

export const STATUS_DAYS = 90
export const STATUS_INTERVAL_MS = 5 * 60_000
export const STATUS_RETRY_MS = 15_000
export const STATUS_TIMEOUT_MS = 10_000
export const STATUS_INCIDENTS_SHOWN = 20
const INCIDENTS_KEPT = 200
const DAY_MS = 86_400_000
const USER_AGENT = 'blxr-status/1.0 (+https://blxr.net/status)'
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const STATES = new Set(['up', 'down'])

export function statusTargets(siteUrl) {
  const site = String(siteUrl || 'https://blxr.net').replace(/\/$/, '')
  const host = new URL(site).host
  return [
    { id: 'website', name: 'Website', host, link: site, url: `${site}/site.webmanifest` },
    { id: 'api', name: 'API', host: `${host}/api`, link: null, url: `${site}/api/music/health` },
  ]
}

const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10)
const iso = (ms) => new Date(ms).toISOString()
const isIso = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value))
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function probe(url, { fetchImpl = fetch, timeoutMs = STATUS_TIMEOUT_MS } = {}) {
  const started = performance.now()
  try {
    const res = await fetchImpl(url, {
      redirect: 'manual',
      cache: 'no-store',
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const ms = Math.max(0, Math.round(performance.now() - started))
    res.body?.cancel().catch(() => {})
    const ok = res.status >= 200 && res.status < 400
    return { ok, ms, code: ok ? null : `http_${res.status}` }
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
    return { ok: false, ms: null, code: timedOut ? 'timeout' : 'unreachable' }
  }
}

const isBucket = (b) => Array.isArray(b) && b.length === 3 && b.every((n) => Number.isFinite(n) && n >= 0) && b[1] <= b[0]

function cleanService(raw) {
  if (!raw || typeof raw !== 'object') return null
  const days = {}
  if (raw.days && typeof raw.days === 'object') {
    for (const [day, bucket] of Object.entries(raw.days)) if (DAY_RE.test(day) && isBucket(bucket)) days[day] = bucket
  }
  const last = raw.last && typeof raw.last === 'object' && isIso(raw.last.at)
    ? {
        at: raw.last.at,
        ok: raw.last.ok === true,
        ms: Number.isFinite(raw.last.ms) ? raw.last.ms : null,
        code: typeof raw.last.code === 'string' ? raw.last.code.slice(0, 32) : null,
      }
    : null
  return {
    state: STATES.has(raw.state) ? raw.state : 'unknown',
    since: isIso(raw.since) ? raw.since : null,
    last,
    days,
  }
}

const isIncident = (i) =>
  i && typeof i === 'object' && typeof i.service === 'string' && isIso(i.start) && (i.end === null || isIso(i.end))

function cleanData(parsed, ids) {
  const data = { checkedAt: null, services: {}, incidents: [] }
  if (!parsed || typeof parsed !== 'object') return data
  if (isIso(parsed.checkedAt)) data.checkedAt = parsed.checkedAt
  for (const id of ids) {
    const service = cleanService(parsed.services?.[id])
    if (service) data.services[id] = service
  }
  if (Array.isArray(parsed.incidents)) {
    data.incidents = parsed.incidents
      .filter((i) => isIncident(i) && ids.has(i.service))
      .map((i) => ({ service: i.service, start: i.start, end: i.end, code: typeof i.code === 'string' ? i.code.slice(0, 32) : null }))
      .slice(-INCIDENTS_KEPT)
  }
  return data
}

export function lastDays(now, count = STATUS_DAYS) {
  const days = []
  for (let i = count - 1; i >= 0; i--) days.push(dayOf(now - i * DAY_MS))
  return days
}

export function createMonitor({
  file,
  targets,
  fetchImpl = fetch,
  clock = Date.now,
  intervalMs = STATUS_INTERVAL_MS,
  retryMs = STATUS_RETRY_MS,
  timeoutMs = STATUS_TIMEOUT_MS,
  onChange = () => {},
}) {
  const ids = new Set(targets.map((t) => t.id))
  const data = cleanData(file ? readState(file) : undefined, ids)
  let dirty = false
  let running = null
  let timer = null

  function prune(now) {
    const cutoff = dayOf(now - (STATUS_DAYS - 1) * DAY_MS)
    for (const service of Object.values(data.services)) {
      for (const day of Object.keys(service.days)) if (day < cutoff) delete service.days[day]
    }
    const oldest = now - STATUS_DAYS * DAY_MS
    data.incidents = data.incidents.filter((i) => i.end === null || Date.parse(i.end) >= oldest).slice(-INCIDENTS_KEPT)
  }

  function apply(target, result, at) {
    const service = (data.services[target.id] ||= { state: 'unknown', since: null, last: null, days: {} })
    const bucket = (service.days[dayOf(at)] ||= [0, 0, 0])
    bucket[0] += 1
    if (result.ok) {
      bucket[1] += 1
      bucket[2] += result.ms
    }
    service.last = { at: iso(at), ok: result.ok, ms: result.ms, code: result.code }

    const next = result.ok ? 'up' : 'down'
    if (next === service.state) return
    const previous = service.state
    service.state = next
    service.since = iso(at)
    if (next === 'down') {
      data.incidents.push({ service: target.id, start: iso(at), end: null, code: result.code })
    } else {
      const open = data.incidents.findLast((i) => i.service === target.id && i.end === null)
      if (open) open.end = iso(at)
    }
    onChange(target, previous, next, result)
  }

  async function check(target) {
    const first = await probe(target.url, { fetchImpl, timeoutMs })
    if (first.ok || retryMs < 0) return first
    if (retryMs > 0) await wait(retryMs)
    return probe(target.url, { fetchImpl, timeoutMs })
  }

  function checkAll() {
    if (running) return running
    running = (async () => {
      const results = await Promise.all(targets.map(async (target) => [target, await check(target)]))
      const at = clock()
      for (const [target, result] of results) apply(target, result, at)
      data.checkedAt = iso(at)
      prune(at)
      dirty = true
      save()
    })().finally(() => {
      running = null
    })
    return running
  }

  function save() {
    if (!dirty || !file) return
    dirty = false
    if (!writeState(file, data)) dirty = true
  }

  function start() {
    if (timer) return
    checkAll().catch(() => {})
    timer = setInterval(() => checkAll().catch(() => {}), intervalMs)
    timer.unref?.()
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  function view(now = clock()) {
    const window = lastDays(now)
    const recent = new Set(window.slice(-7))
    const names = new Map(targets.map((t) => [t.id, t.name]))
    const services = targets.map((target) => {
      const service = data.services[target.id]
      let checks = 0
      let up = 0
      let weekUp = 0
      let weekMs = 0
      const days = window.map((day) => {
        const [dayChecks, dayUp, dayMs] = service?.days[day] || [0, 0, 0]
        checks += dayChecks
        up += dayUp
        if (recent.has(day)) {
          weekUp += dayUp
          weekMs += dayMs
        }
        return { day, checks: dayChecks, up: dayUp, ms: dayUp ? Math.round(dayMs / dayUp) : null }
      })
      const last = service?.last
      return {
        id: target.id,
        name: target.name,
        host: target.host,
        link: target.link,
        state: service?.state ?? 'unknown',
        since: service?.since ?? null,
        ms: last?.ok ? last.ms : null,
        code: last && !last.ok ? last.code : null,
        uptime: checks ? Math.round((up / checks) * 1e6) / 1e6 : null,
        avgMs: weekUp ? Math.round(weekMs / weekUp) : null,
        days,
      }
    })
    const incidents = data.incidents
      .slice(-STATUS_INCIDENTS_SHOWN)
      .reverse()
      .map((i) => ({ service: i.service, name: names.get(i.service), start: i.start, end: i.end, code: i.code }))
    return { checkedAt: data.checkedAt, every: Math.round(intervalMs / 1000), days: STATUS_DAYS, services, incidents }
  }

  return { checkAll, save, start, stop, view }
}
