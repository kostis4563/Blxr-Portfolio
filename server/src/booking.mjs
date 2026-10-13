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

export const REPEATS = ['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly']
export const SCHEDULE_LIMITS = { hours: 42, blocks: 200, except: 100, label: 60 }
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const BLOCK_ID_RE = /^[a-z0-9]{6,24}$/

const keyDate = (key) => {
  const m = KEY_RE.exec(key || '')
  if (!m) return null
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return date.getUTCDate() === Number(m[3]) && date.getUTCMonth() === Number(m[2]) - 1 ? date : null
}

export const isDayKey = (key) => typeof key === 'string' && Boolean(keyDate(key))

const shiftKey = (key, days) => {
  const d = keyDate(key)
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function occursOn(block, key) {
  const day = keyDate(key)
  const anchor = keyDate(block.date)
  if (!day || !anchor || key < block.date) return false
  if (block.until && key > block.until) return false
  if (block.except?.includes(key)) return false
  const weekday = day.getUTCDay()
  switch (block.repeat) {
    case 'daily':
      return true
    case 'weekdays':
      return weekday >= 1 && weekday <= 5
    case 'weekly':
      return weekday === anchor.getUTCDay()
    case 'biweekly':
      return weekday === anchor.getUTCDay() && Math.round((day - anchor) / 86_400_000 / 7) % 2 === 0
    case 'monthly':
      return day.getUTCDate() === anchor.getUTCDate()
    default:
      return key === block.date
  }
}

export function blockRanges(blocks, { from, to, timeZone }) {
  const out = []
  if (!blocks?.length) return out
  const last = dayKey(to, timeZone)
  for (let key = dayKey(from, timeZone); key <= last; key = shiftKey(key, 1)) {
    const [y, m, d] = key.split('-').map(Number)
    for (const block of blocks) {
      if (!occursOn(block, key)) continue
      const start = zonedTime(y, m, d, block.start ?? 0, timeZone)
      const end = zonedTime(y, m, d, block.end ?? 24 * 60, timeZone)
      if (end > from && start < to) out.push([start, end])
    }
  }
  return out.sort((a, b) => a[0] - b[0])
}

const minuteOf = (value) => (Number.isInteger(value) && value >= 0 && value <= 24 * 60 && value % 5 === 0 ? value : null)

function cleanLabel(value) {
  return String(value ?? '')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SCHEDULE_LIMITS.label)
}

export function cleanSchedule(input, { today, makeId }) {
  const fields = new Set()
  const hours = []
  if (!Array.isArray(input?.hours) || input.hours.length > SCHEDULE_LIMITS.hours) fields.add('hours')
  else {
    for (const w of input.hours) {
      const start = minuteOf(w?.start)
      const end = minuteOf(w?.end)
      if (!Number.isInteger(w?.day) || w.day < 0 || w.day > 6 || start === null || end === null || start >= end) fields.add('hours')
      else hours.push({ day: w.day, start, end })
    }
  }

  const blocks = []
  if (!Array.isArray(input?.blocks) || input.blocks.length > SCHEDULE_LIMITS.blocks) fields.add('blocks')
  else {
    const seen = new Set()
    for (const b of input.blocks) {
      const allDay = b?.start === null && b?.end === null
      const start = allDay ? null : minuteOf(b?.start)
      const end = allDay ? null : minuteOf(b?.end)
      const repeat = REPEATS.includes(b?.repeat) ? b.repeat : null
      const until = b?.until === null || b?.until === undefined || b?.until === '' ? null : b.until
      const except = Array.isArray(b?.except) ? b.except : []
      const ok =
        isDayKey(b?.date) &&
        repeat &&
        (allDay || (start !== null && end !== null && start < end)) &&
        (until === null || (isDayKey(until) && until >= b.date)) &&
        except.length <= SCHEDULE_LIMITS.except &&
        except.every(isDayKey)
      if (!ok) {
        fields.add('blocks')
        continue
      }
      let id = typeof b.id === 'string' && BLOCK_ID_RE.test(b.id) ? b.id : makeId()
      while (seen.has(id)) id = makeId()
      seen.add(id)
      const last = repeat === 'none' ? b.date : until
      if (last && last < today) continue
      blocks.push({
        id,
        date: b.date,
        start,
        end,
        repeat,
        until: repeat === 'none' ? null : until,
        except: repeat === 'none' ? [] : [...new Set(except.filter((k) => k >= today))].sort(),
        label: cleanLabel(b.label),
      })
    }
  }

  if (input?.paused !== undefined && typeof input.paused !== 'boolean') fields.add('paused')
  if (fields.size) return { error: 'invalid', fields: [...fields] }
  hours.sort((a, b) => a.day - b.day || a.start - b.start || a.end - b.end)
  return { schedule: { hours, blocks, paused: input.paused === true } }
}

export const CALL_PLACES = {
  facetime: { label: 'FaceTime', contact: 'link' },
  meet: { label: 'Google Meet', contact: 'link' },
  zoom: { label: 'Zoom', contact: 'link' },
  teams: { label: 'Microsoft Teams', contact: 'link' },
  discord: { label: 'Discord', contact: 'handle' },
  whatsapp: { label: 'WhatsApp', contact: 'phone' },
  phone: { label: 'Phone', contact: 'phone' },
  other: { label: 'Somewhere else', contact: 'place' },
}
export const CALL_MODES = { video: 'Video', voice: 'Voice only' }
export const CALL_LANGS = { en: 'English', el: 'Greek' }
export const CALL_TOPICS = { project: 'A project', job: 'A job or role', collab: 'A collaboration', advice: 'Advice or feedback', chat: 'Just to chat' }
export const CALL_BUDGETS = { small: 'Under €1k', mid: '€1k–5k', large: '€5k–15k', huge: '€15k+', open: 'Not sure yet' }
export const CALL_TIMELINES = { now: 'As soon as possible', month: 'Within a month', later: 'Later on' }
export const CALL_LIMITS = { company: 80, link: 300, phone: 24, place: 80 }

const PHONE_RE = /^\+?[\d\s().-]+$/
const HANDLE_RE = /^@?(?:[a-z0-9_.]{2,32}|[^\s@#:]{2,32}#\d{4})$/i

export function placeOfUrl(url) {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }
  if (host === 'facetime.apple.com') return 'facetime'
  if (host === 'meet.google.com') return 'meet'
  if (host === 'zoom.us' || host.endsWith('.zoom.us')) return 'zoom'
  if (host === 'teams.microsoft.com' || host === 'teams.live.com') return 'teams'
  return null
}

export function cleanLink(value) {
  const raw = String(value ?? '').trim()
  if (!raw || raw.length > CALL_LIMITS.link || /\s/.test(raw)) return null
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !/^[^.]+(\.[^.]+)+$/.test(url.hostname) || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

export function cleanContact(kind, value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (kind === 'link') return text ? cleanLink(text) : ''
  if (!text) return null
  if (kind === 'phone') {
    const digits = text.replace(/\D/g, '').length
    return text.length <= CALL_LIMITS.phone && PHONE_RE.test(text) && digits >= 6 && digits <= 15 ? text : null
  }
  if (kind === 'handle') return HANDLE_RE.test(text) ? text.replace(/^@/, '') : null
  return text.length >= 2 && text.length <= CALL_LIMITS.place ? text : null
}

const pick = (options, value) => (typeof value === 'string' && Object.hasOwn(options, value) ? value : null)

export function cleanCallDetails(body) {
  const fields = []
  const place = pick(CALL_PLACES, body?.place)
  if (body?.place != null && body.place !== '' && !place) fields.push('place')
  const contact = place ? cleanContact(CALL_PLACES[place].contact, body?.contact) : ''
  if (contact === null) fields.push('contact')
  const company = String(body?.company ?? '').replace(/\s+/g, ' ').trim()
  if (company.length > CALL_LIMITS.company) fields.push('company')
  const rawLink = String(body?.link ?? '').trim()
  const link = rawLink ? cleanLink(rawLink) : ''
  if (link === null) fields.push('link')
  const topic = pick(CALL_TOPICS, body?.topic)
  const details = {
    place,
    contact: contact || '',
    mode: place === 'phone' ? 'voice' : pick(CALL_MODES, body?.mode) || 'video',
    lang: pick(CALL_LANGS, body?.lang) || 'en',
    topic,
    budget: topic === 'project' ? pick(CALL_BUDGETS, body?.budget) : null,
    timeline: topic === 'project' ? pick(CALL_TIMELINES, body?.timeline) : null,
    company,
    link: link || '',
  }
  return { details, fields }
}

export function callDetailLines(details) {
  if (!details) return []
  const lines = []
  if (details.place) {
    lines.push(`Where: ${CALL_PLACES[details.place].label}${details.contact ? ` — ${details.contact}` : ''}`)
    lines.push(`How: ${CALL_MODES[details.mode] || CALL_MODES.video}`)
  }
  if (details.lang && details.lang !== 'en') lines.push(`Language: ${CALL_LANGS[details.lang]}`)
  if (details.topic) lines.push(`About: ${CALL_TOPICS[details.topic]}`)
  if (details.budget) lines.push(`Budget: ${CALL_BUDGETS[details.budget]}`)
  if (details.timeline) lines.push(`Start: ${CALL_TIMELINES[details.timeline]}`)
  if (details.company) lines.push(`Company: ${details.company}`)
  if (details.link) lines.push(`Link: ${details.link}`)
  return lines
}

const byLabel = (options, label) => Object.keys(options).find((id) => options[id] === label) || null

export function readCallDetails(lines) {
  const out = { place: null, contact: '', mode: null, lang: 'en', topic: null, budget: null, timeline: null, company: '', link: '' }
  for (const raw of lines) {
    const m = /^(Where|How|Language|About|Budget|Start|Company|Link): (.+)$/.exec(raw.trim())
    if (!m) continue
    const [, key, value] = m
    if (key === 'Where') {
      const [label, ...rest] = value.split(' — ')
      const known = Object.keys(CALL_PLACES).find((id) => CALL_PLACES[id].label === label)
      out.place = known || 'other'
      out.contact = known ? rest.join(' — ') : value
    } else if (key === 'How') out.mode = byLabel(CALL_MODES, value)
    else if (key === 'Language') out.lang = byLabel(CALL_LANGS, value) || 'en'
    else if (key === 'About') out.topic = byLabel(CALL_TOPICS, value)
    else if (key === 'Budget') out.budget = byLabel(CALL_BUDGETS, value)
    else if (key === 'Start') out.timeline = byLabel(CALL_TIMELINES, value)
    else if (key === 'Company') out.company = value
    else out.link = cleanLink(value) || ''
  }
  return out
}

export function callPlan(details, video) {
  const place = details?.place
  const label = place ? CALL_PLACES[place].label : null
  const voice = details?.mode === 'voice' && place !== 'phone' ? ' Voice only, no camera needed.' : ''
  if (!place) return video ? `Join: ${video}` : 'The video link follows by email.'
  if (video && details.contact === video) return `On ${label}, using your link.${voice}`
  if (video) return `Join on ${label}: ${video}${voice}`
  if (CALL_PLACES[place].contact === 'link') return `On ${label}. I’ll email you the link before we talk.${voice}`
  if (place === 'phone') return 'By phone. I’ll call you at the number you gave.'
  if (place === 'other') return `Where you suggested. I’ll confirm the details by email.${voice}`
  return `On ${label}. I’ll call you there.${voice}`
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
