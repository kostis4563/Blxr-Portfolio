import { LINK_RE } from './reviews'
import { CALL_LIMITS, cleanLink, contactProblem } from './call-options'

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

export function bookingProblems({ name, email, note, place = null, contact = '', company = '', link = '' }) {
  const out = {}
  const cleanName = name.trim()
  if (cleanName.length < BOOKING_LIMITS.name.min || !/\p{L}/u.test(cleanName)) out.name = 'Add your name.'
  else if (cleanName.length > BOOKING_LIMITS.name.max) out.name = `Keep it under ${BOOKING_LIMITS.name.max} characters.`
  else if (LINK_RE.test(cleanName)) out.name = 'Just your name, no links.'
  const cleanEmail = email.trim()
  if (!cleanEmail) out.email = 'Add your email so the invite reaches you.'
  else if (cleanEmail.length > BOOKING_LIMITS.email.max || !EMAIL_RE.test(cleanEmail)) out.email = 'That email doesn’t look right.'
  if (note.trim().length > BOOKING_LIMITS.note.max) out.note = `Keep it under ${BOOKING_LIMITS.note.max} characters.`
  const reach = contactProblem(place, contact)
  if (reach) out.contact = reach
  if (company.replace(/\s+/g, ' ').trim().length > CALL_LIMITS.company) out.company = `Keep it under ${CALL_LIMITS.company} characters.`
  if (link.trim() && !cleanLink(link)) out.link = 'That link doesn’t look right.'
  return out
}

export function daysUntil(ms, timeZone, now = Date.now()) {
  return Math.round((Date.parse(dateKey(ms, timeZone)) - Date.parse(dateKey(now, timeZone))) / 86_400_000)
}

export function shortDay(ms, timeZone) {
  const key = dateKey(ms, timeZone)
  return `${formatWeekday(key)} ${Number(key.slice(8))}`
}

export function fullShortDay(ms, timeZone) {
  const key = dateKey(ms, timeZone)
  return `${shortDay(ms, timeZone)} ${formatter('en-GB', { timeZone: 'UTC', month: 'short' }).format(noon(key))}`
}

export function whenWord(ms, timeZone, now = Date.now()) {
  const days = daysUntil(ms, timeZone, now)
  return days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`
}

export function dayPhrase(ms, timeZone, now = Date.now()) {
  const days = daysUntil(ms, timeZone, now)
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 7) return `on ${formatDay(dateKey(ms, timeZone)).split(' ')[0]}`
  return `on ${fullShortDay(ms, timeZone)}`
}

export const EVENT_TITLE = 'Call with Blxr'

export const ALERTS = [
  { minutes: null, label: 'None' },
  { minutes: 0, label: 'At start' },
  { minutes: 5, label: '5 min before' },
  { minutes: 10, label: '10 min before' },
  { minutes: 15, label: '15 min before' },
  { minutes: 30, label: '30 min before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
]

const icsStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

const icsText = (text) => String(text).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&')

const octets = (ch) => {
  const cp = ch.codePointAt(0)
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4
}

function icsFold(line) {
  const out = []
  let chunk = ''
  let size = 0
  for (const ch of line) {
    if (size + octets(ch) > (out.length ? 74 : 75)) {
      out.push(chunk)
      chunk = ''
      size = 0
    }
    chunk += ch
    size += octets(ch)
  }
  out.push(chunk)
  return out.join('\r\n ')
}

export const icsUid = (ics) => /^UID:(.+)$/m.exec(ics || '')?.[1].trim() || null

export function calendarIcs({ uid, start, end, title, notes, location, alert = null, stamp = Date.now() }) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//blxr.net//Book a call//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT']
  lines.push(`UID:${uid}`, `DTSTAMP:${icsStamp(stamp)}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`, `SUMMARY:${icsText(title)}`)
  if (notes) lines.push(`DESCRIPTION:${icsText(notes)}`)
  if (location) lines.push(`LOCATION:${icsText(location)}`, `URL:${location}`)
  lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'SEQUENCE:0')
  if (Number.isInteger(alert) && alert >= 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(title)}`, `TRIGGER:-PT${alert}M`, 'END:VALARM')
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return `${lines.map(icsFold).join('\r\n')}\r\n`
}

const query = (params) =>
  Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')

export const googleCalendarUrl = ({ start, end, title, notes, location }) =>
  `https://calendar.google.com/calendar/render?${query({ action: 'TEMPLATE', text: title, dates: `${icsStamp(start)}/${icsStamp(end)}`, details: notes, location })}`

export const outlookCalendarUrl = ({ start, end, title, notes, location }) =>
  `https://outlook.live.com/calendar/0/action/compose?${query({ rru: 'addevent', subject: title, startdt: new Date(start).toISOString(), enddt: new Date(end).toISOString(), body: notes, location })}`

export function icsFileName(title) {
  const slug = String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return `${slug || 'call-with-blxr'}.ics`
}

const MAIL_DOMAINS = ['gmail.com', 'icloud.com', 'me.com', 'mac.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'proton.me', 'protonmail.com', 'gmx.com', 'aol.com', 'mail.com']

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

export function emailTypo(email) {
  const clean = email.trim()
  const at = clean.lastIndexOf('@')
  if (at < 1) return null
  const domain = clean.slice(at + 1).toLowerCase()
  if (domain.length < 4 || MAIL_DOMAINS.includes(domain)) return null
  const fix = MAIL_DOMAINS.includes(`${domain}.com`) ? `${domain}.com` : MAIL_DOMAINS.find((known) => editDistance(domain, known) === 1)
  return fix ? `${clean.slice(0, at)}@${fix}` : null
}
