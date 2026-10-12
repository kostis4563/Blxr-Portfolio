const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const HOURS_RE = /^([a-z]{3})(?:-([a-z]{3}))?\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/
const MINUTE_MS = 60_000

export function parseHours(spec) {
  const windows = []
  const parts = String(spec || '').toLowerCase().split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  for (const part of parts) {
    const m = HOURS_RE.exec(part)
    if (!m) return null
    const from = DAY_NAMES.indexOf(m[1])
    const to = m[2] ? DAY_NAMES.indexOf(m[2]) : from
    if (from < 0 || to < 0 || Number(m[4]) > 59 || Number(m[6]) > 59) return null
    const start = Number(m[3]) * 60 + Number(m[4])
    const end = Number(m[5]) * 60 + Number(m[6])
    if (start >= end || end > 24 * 60) return null
    for (let day = from; ; day = (day + 1) % 7) {
      windows.push({ day, start, end })
      if (day === to) break
    }
  }
  return windows.length ? windows : null
}

const DEFAULT_CALENDARS = ['calls', 'calendar', 'home', 'personal', 'work']

export function pickCalendar(calendars, name) {
  if (name) return calendars.find((c) => c.name.toLowerCase() === name.toLowerCase()) || null
  for (const fallback of DEFAULT_CALENDARS) {
    const found = calendars.find((c) => c.name.toLowerCase() === fallback)
    if (found) return found
  }
  return calendars[0] || null
}

export function isTimeZone(value) {
  if (typeof value !== 'string' || !value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const formatters = new Map()
function formatter(timeZone) {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    formatters.set(timeZone, f)
  }
  return f
}

export function zoneParts(ms, timeZone) {
  const out = {}
  for (const { type, value } of formatter(timeZone).formatToParts(new Date(ms))) {
    if (type !== 'literal') out[type] = Number(value)
  }
  out.hour %= 24
  return out
}

const offsetAt = (ms, timeZone) => {
  const p = zoneParts(ms, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000
}

export function zonedTime(year, month, day, minutes, timeZone) {
  const wall = Date.UTC(year, month - 1, day, 0, minutes)
  const first = wall - offsetAt(wall, timeZone)
  return wall - offsetAt(first, timeZone)
}

const pad = (n) => String(n).padStart(2, '0')

export function dayKey(ms, timeZone) {
  const p = zoneParts(ms, timeZone)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

export function openSlots({ now, windows, timeZone, minutes, step = minutes, notice = 0, days, busy = [], booked = [], maxPerDay = 0 }) {
  const length = minutes * MINUTE_MS
  const earliest = now + notice * MINUTE_MS
  const today = zoneParts(now, timeZone)
  const perDay = new Map()
  for (const at of booked) {
    const key = dayKey(at, timeZone)
    perDay.set(key, (perDay.get(key) || 0) + 1)
  }

  const found = new Set()
  for (let i = 0; i < days; i += 1) {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + i))
    const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    if (maxPerDay && (perDay.get(`${y}-${pad(m)}-${pad(d)}`) || 0) >= maxPerDay) continue
    for (const w of windows) {
      if (w.day !== date.getUTCDay()) continue
      const close = zonedTime(y, m, d, w.end, timeZone)
      for (let t = w.start; t < w.end; t += step) {
        const start = zonedTime(y, m, d, t, timeZone)
        const end = start + length
        if (end > close) break
        if (start < earliest) continue
        if (busy.some(([a, b]) => a < end && b > start)) continue
        found.add(start)
      }
    }
  }
  return [...found].sort((a, b) => a - b)
}
