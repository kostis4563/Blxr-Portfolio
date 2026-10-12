import { LINK_RE } from './reviews'

export const BOOKING_LIMITS = { name: { min: 2, max: 80 }, email: { max: 254 }, note: { max: 1000 } }
export const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z0-9-]{2,}$/i

const pad = (n) => String(n).padStart(2, '0')

export function visitorTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function timeZoneList(current) {
  let list = []
  try {
    list = Intl.supportedValuesOf('timeZone')
  } catch {
    list = []
  }
  return list.includes(current) ? list : [current, ...list]
}

export function prefersTwelveHour() {
  try {
    return /h1[12]/.test(new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle || '')
  } catch {
    return false
  }
}

const formatters = new Map()
function formatter(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options)
    formatters.set(key, f)
  }
  return f
}

export function dateKey(ms, timeZone) {
  const parts = {}
  for (const { type, value } of formatter('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(ms))) {
    parts[type] = value
  }
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function groupByDay(slots, timeZone) {
  const days = new Map()
  for (const iso of slots) {
    const ms = Date.parse(iso)
    if (!Number.isFinite(ms)) continue
    const key = dateKey(ms, timeZone)
    if (!days.has(key)) days.set(key, [])
    days.get(key).push(ms)
  }
  for (const list of days.values()) list.sort((a, b) => a - b)
  return days
}

export const monthOf = (key) => key.slice(0, 7)

export function shiftMonth(month, by) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

export function monthGrid(month) {
  const [y, m] = month.split('-').map(Number)
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= length; d += 1) cells.push(`${month}-${pad(d)}`)
  while (cells.length % 7) cells.push(null)
  return cells
}

const noon = (key) => new Date(`${key}T12:00:00Z`)

export const WEEKDAYS = Array.from({ length: 7 }, (_, i) => formatter('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(noon(`2024-01-0${i + 1}`)))

export const formatMonth = (month) => formatter('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(noon(`${month}-01`))

export const formatDay = (key) => formatter('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(noon(key))

export const formatWeekday = (key) => formatter('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(noon(key))

export const formatTime = (ms, timeZone, twelveHour = false) =>
  formatter('en-GB', { timeZone, hour: twelveHour ? 'numeric' : '2-digit', minute: '2-digit', hourCycle: twelveHour ? 'h12' : 'h23' }).format(new Date(ms))

export function formatZone(timeZone, at = Date.now()) {
  const city = timeZone.split('/').pop().replace(/_/g, ' ')
  let offset = ''
  try {
    offset = formatter('en-GB', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(new Date(at)).find((p) => p.type === 'timeZoneName')?.value || ''
  } catch {
    offset = ''
  }
  return offset && offset !== city ? `${city} (${offset})` : city
}

export function bookingProblems({ name, email, note }) {
  const out = {}
  const cleanName = name.trim()
  if (cleanName.length < BOOKING_LIMITS.name.min || !/\p{L}/u.test(cleanName)) out.name = 'Add your name.'
  else if (cleanName.length > BOOKING_LIMITS.name.max) out.name = `Keep it under ${BOOKING_LIMITS.name.max} characters.`
  else if (LINK_RE.test(cleanName)) out.name = 'Just your name, no links.'
  const cleanEmail = email.trim()
  if (!cleanEmail) out.email = 'Add your email so the invite reaches you.'
  else if (cleanEmail.length > BOOKING_LIMITS.email.max || !EMAIL_RE.test(cleanEmail)) out.email = 'That email doesn’t look right.'
  if (note.trim().length > BOOKING_LIMITS.note.max) out.note = `Keep it under ${BOOKING_LIMITS.note.max} characters.`
  return out
}
