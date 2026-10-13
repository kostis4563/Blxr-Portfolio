import { formatTime, formatWeekday } from './booking'

export const DAY_MINUTES = 24 * 60
export const TIME_STEP = 15
export const LABEL_MAX = 60
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const REPEATS = ['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly']

const pad = (n) => String(n).padStart(2, '0')
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function keyDate(key) {
  const m = KEY_RE.exec(key || '')
  if (!m) return null
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return date.getUTCDate() === Number(m[3]) && date.getUTCMonth() === Number(m[2]) - 1 ? date : null
}

export const isDayKey = (key) => typeof key === 'string' && Boolean(keyDate(key))

export const weekdayOf = (key) => keyDate(key).getUTCDay()

export function shiftDay(key, days) {
  const d = keyDate(key)
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export const daysBetween = (from, to) => Math.round((keyDate(to) - keyDate(from)) / 86_400_000)

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

export const isOver = (block, today) => (block.repeat === 'none' ? block.date : block.until || '9999-12-31') < today

export const isAllDay = (block) => block.start === null

const longWeekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long' })
const shortMonth = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short' })

export const weekdayName = (day) => longWeekday.format(new Date(Date.UTC(2024, 0, 7 + day, 12)))
export const weekdayShort = (day) => weekdayName(day).slice(0, 3)

export const dayLabel = (key) => `${formatWeekday(key)} ${Number(key.slice(8))} ${shortMonth.format(keyDate(key))}`
export const dateLabel = (key) => `${Number(key.slice(8))} ${shortMonth.format(keyDate(key))}`

function ordinal(n) {
  const tail = n % 100
  if (tail >= 11 && tail <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`
}

export function repeatLabel(repeat, date) {
  const weekday = weekdayName(weekdayOf(date))
  switch (repeat) {
    case 'daily':
      return 'Every day'
    case 'weekdays':
      return 'Every weekday'
    case 'weekly':
      return `Every ${weekday}`
    case 'biweekly':
      return `Every other ${weekday}`
    case 'monthly':
      return `Monthly on the ${ordinal(Number(date.slice(8)))}`
    default:
      return 'Never'
  }
}

export function minuteLabel(minutes, twelve = false) {
  if (minutes >= DAY_MINUTES) return twelve ? '12:00 am' : '24:00'
  return formatTime(Date.UTC(2024, 0, 1, 0, minutes), 'UTC', twelve)
}

export const rangeLabel = (start, end, twelve = false) => (start === null ? 'All day' : `${minuteLabel(start, twelve)} – ${minuteLabel(end, twelve)}`)

export function blockWhen(block, twelve = false) {
  const range = rangeLabel(block.start, block.end, twelve)
  if (block.repeat === 'none') return `${dayLabel(block.date)} · ${range}`
  if (block.repeat === 'daily' && block.until) return `${dateLabel(block.date)} – ${dateLabel(block.until)} · ${range}`
  const until = block.until ? ` · until ${dateLabel(block.until)}` : ''
  return `${repeatLabel(block.repeat, block.date)} · ${range}${until}`
}

export const timeOptions = (from = 0, to = DAY_MINUTES) => Array.from({ length: Math.floor((to - from) / TIME_STEP) + 1 }, (_, i) => from + i * TIME_STEP)

export function minutesIn(ms, timeZone) {
  const [h, m] = formatTime(ms, timeZone).split(':').map(Number)
  return h * 60 + m
}

const span = (block) => (block.start === null ? [0, DAY_MINUTES] : [block.start, block.end])

export function freeMinutes(windows, blocks) {
  let free = 0
  for (const w of windows) {
    const cuts = blocks
      .map(span)
      .filter(([a, b]) => a < w.end && b > w.start)
      .map(([a, b]) => [Math.max(a, w.start), Math.min(b, w.end)])
      .sort((x, y) => x[0] - y[0])
    let at = w.start
    for (const [a, b] of cuts) {
      if (a > at) free += a - at
      at = Math.max(at, b)
    }
    if (at < w.end) free += w.end - at
  }
  return free
}

export const overlaps = (block, start, end) => {
  const [a, b] = span(block)
  return a < end && b > start
}

export function clashingRanges(windows) {
  const out = new Set()
  windows.forEach((w, i) => {
    if (windows.some((o, j) => j !== i && o.start < w.end && o.end > w.start)) out.add(i)
  })
  return out
}

export function newBlockId() {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
