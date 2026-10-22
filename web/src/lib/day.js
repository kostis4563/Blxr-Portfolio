export const LIMITS = {
  title: 120,
  note: 2000,
  marks: 400,
}

export const DAY_MINUTES = 1440
export const DEFAULT_START = 9 * 60
export const KEEP_DAYS = 366

export const EVERY_DAY = 127
export const WEEKDAYS = 31
export const WEEKENDS = 96

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const REPEATS = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'custom', label: 'Pick days' },
]

export const TIMINGS = [
  { value: 'any', label: 'Any time' },
  { value: 'set', label: 'At a time' },
]

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const noon = (iso) => new Date(`${iso}T12:00:00Z`)

export function todayIso(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isDate(value) {
  if (!DATE_RE.test(String(value || ''))) return false
  const date = noon(value)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function shiftDay(iso, by) {
  const date = noon(iso)
  date.setUTCDate(date.getUTCDate() + by)
  return date.toISOString().slice(0, 10)
}

export const weekdayOf = (iso) => (noon(iso).getUTCDay() + 6) % 7

export function weekOf(iso) {
  const start = shiftDay(iso, -weekdayOf(iso))
  return Array.from({ length: 7 }, (_, i) => shiftDay(start, i))
}

export const daysBetween = (from, to) => Math.round((noon(to) - noon(from)) / 86400000)

const LONG_DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
const SHORT_DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long' })

export const formatLongDay = (iso) => LONG_DAY.format(noon(iso))
export const formatShortDay = (iso) => SHORT_DAY.format(noon(iso))
export const formatWeekday = (iso) => WEEKDAY.format(noon(iso))
export const dayNumber = (iso) => Number(iso.slice(8, 10))

export function relativeDay(iso, today) {
  const diff = daysBetween(today, iso)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`
}

export function clockOf(minutes) {
  const m = Math.max(0, Math.min(DAY_MINUTES, Math.round(minutes)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function minutesOf(text) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(text ?? ''))
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (minutes > 59) return null
  const value = hours * 60 + minutes
  return value <= DAY_MINUTES ? value : null
}

export function formatClock(minutes, twelve = false) {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hours = Math.floor(m / 60)
  const mins = String(m % 60).padStart(2, '0')
  if (!twelve) return `${String(hours).padStart(2, '0')}:${mins}`
  return `${hours % 12 || 12}:${mins} ${hours < 12 ? 'am' : 'pm'}`
}

export const formatRange = (start, end, twelve = false) =>
  end === null ? formatClock(start, twelve) : `${formatClock(start, twelve)}–${formatClock(end, twelve)}`

const TIME = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?`
const QUICK_RE = new RegExp(String.raw`^${TIME}(?:\s*(?:-|–|—|to)\s*${TIME})?\s+(.+)$`, 'i')

function partsToMinutes(h, m, meridiem) {
  if (h === undefined) return null
  const hours = Number(h)
  const mins = m === undefined ? 0 : Number(m)
  if (mins > 59) return null
  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    return ((hours % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0)) * 60 + mins
  }
  if (hours > 24 || (hours === 24 && mins > 0)) return null
  return hours * 60 + mins
}

export function parseQuick(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return null
  const match = QUICK_RE.exec(raw)
  if (match) {
    const [, h1, m1, mer1, h2, m2, mer2, rest] = match
    const looksLikeTime = m1 !== undefined || mer1 || h2 !== undefined
    let end = partsToMinutes(h2, m2, mer2)
    let start = partsToMinutes(h1, m1, mer1 || mer2)
    if (!mer1 && mer2 && start !== null && end !== null && start >= end) start = partsToMinutes(h1, m1)
    if (end === 0) end = DAY_MINUTES
    if (looksLikeTime && start !== null && start < DAY_MINUTES && (h2 === undefined || end !== null)) {
      return { title: rest.trim().slice(0, LIMITS.title), start, end: end !== null && end > start ? end : null }
    }
  }
  return { title: raw.slice(0, LIMITS.title), start: null, end: null }
}

export const onWeekday = (mask, weekday) => Boolean(mask & (1 << weekday))

export function occursOn(block, iso) {
  if (!block.repeat) return block.day === iso
  return iso >= block.day && onWeekday(block.repeat, weekdayOf(iso)) && !block.skipped.includes(iso)
}

export const doneOn = (block, iso) => block.done.includes(iso)

function byPlan(a, b) {
  const timedA = a.start !== null
  const timedB = b.start !== null
  if (timedA !== timedB) return timedA ? 1 : -1
  if (timedA) return a.start - b.start || (a.end ?? a.start) - (b.end ?? b.start) || a.title.localeCompare(b.title)
  return String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.title.localeCompare(b.title)
}

export const planFor = (blocks, iso) => blocks.filter((block) => occursOn(block, iso)).sort(byPlan)

export function toggleMark(list, iso, on, today = iso) {
  const cutoff = shiftDay(today, -KEEP_DAYS)
  const kept = list.filter((d) => d !== iso && d >= cutoff)
  return (on ? [...kept, iso].sort() : kept).slice(-LIMITS.marks)
}

export function repeatKind(mask) {
  if (!mask) return 'once'
  if (mask === EVERY_DAY) return 'daily'
  if (mask === WEEKDAYS) return 'weekdays'
  return 'custom'
}

export function repeatLabel(mask) {
  if (!mask) return 'Once'
  if (mask === EVERY_DAY) return 'Every day'
  if (mask === WEEKDAYS) return 'Weekdays'
  if (mask === WEEKENDS) return 'Weekends'
  return DAY_NAMES.filter((_, i) => onWeekday(mask, i)).join(', ')
}

export function maskFor(kind, days) {
  if (kind === 'daily') return EVERY_DAY
  if (kind === 'weekdays') return WEEKDAYS
  if (kind === 'custom') return days & EVERY_DAY
  return 0
}

export function formFrom(block) {
  return {
    title: block.title,
    note: block.note,
    timed: block.start !== null,
    start: clockOf(block.start ?? DEFAULT_START),
    end: block.end === null ? '' : clockOf(block.end % DAY_MINUTES),
    repeat: repeatKind(block.repeat),
    days: block.repeat || 1 << weekdayOf(block.day),
  }
}

export function timesOf(form) {
  if (!form.timed) return { start: null, end: null }
  const start = minutesOf(form.start)
  const end = form.end ? minutesOf(form.end) : null
  return { start, end: end === 0 ? DAY_MINUTES : end }
}

export function problemsOf(form) {
  const problems = {}
  const title = form.title.trim()
  if (!title) problems.title = 'Give it a name.'
  else if (title.length > LIMITS.title) problems.title = `Keep it under ${LIMITS.title} characters.`
  if (form.timed) {
    const { start, end } = timesOf(form)
    if (start === null || start >= DAY_MINUTES) problems.time = 'Pick a time.'
    else if (end !== null && end <= start) problems.time = 'It has to end after it starts.'
  }
  if (form.repeat === 'custom' && !maskFor('custom', form.days)) problems.days = 'Pick at least one day.'
  if (form.note.trim().length > LIMITS.note) problems.note = `Keep the note under ${LIMITS.note} characters.`
  return problems
}

export function blockFrom(id, form, { day, base = null }) {
  const repeat = maskFor(form.repeat, form.days)
  const { start, end } = timesOf(form)
  const keepsRoutine = Boolean(repeat && base?.repeat)
  const dropsRoutine = Boolean(!repeat && base?.repeat)
  return {
    id,
    title: form.title.trim(),
    note: form.note.trim(),
    start,
    end,
    day: keepsRoutine ? base.day : day,
    repeat,
    done: dropsRoutine ? (base.done.includes(day) ? [day] : []) : base?.done ?? [],
    skipped: keepsRoutine ? base.skipped : [],
    createdAt: base?.createdAt ?? null,
  }
}

export function fromRow(row) {
  if (!row) return null
  const start = row.starts == null ? null : minutesOf(row.starts)
  return {
    id: row.id,
    title: row.title,
    note: row.note || '',
    start,
    end: start === null || row.ends == null ? null : minutesOf(row.ends),
    day: row.day,
    repeat: Number(row.repeat) || 0,
    done: Array.isArray(row.done) ? row.done : [],
    skipped: Array.isArray(row.skipped) ? row.skipped : [],
    createdAt: row.created_at || null,
  }
}

export function toRow(block) {
  return {
    id: block.id,
    title: block.title.trim(),
    note: block.note.trim(),
    starts: block.start === null ? null : clockOf(block.start),
    ends: block.start === null || block.end === null ? null : clockOf(block.end),
    day: block.day,
    repeat: block.repeat,
    done: block.done,
    skipped: block.skipped,
  }
}
