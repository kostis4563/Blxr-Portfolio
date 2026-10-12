import { isTimeZone, zonedTime } from './booking.mjs'

const DAY_MS = 86_400_000
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
const MAX_PERIODS = 50_000

function parseLine(line) {
  let quoted = false
  let i = 0
  for (; i < line.length; i += 1) {
    if (line[i] === '"') quoted = !quoted
    else if (line[i] === ':' && !quoted) break
  }
  if (i >= line.length) return null
  const parts = line.slice(0, i).split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/)
  const params = {}
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=')
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, '')
  }
  return { name: parts[0].toUpperCase(), params, value: line.slice(i + 1) }
}

function cleanZone(tzid) {
  if (!tzid) return null
  if (isTimeZone(tzid)) return tzid
  const tail = /([A-Za-z_]+\/[A-Za-z_+-]+(?:\/[A-Za-z_+-]+)?)$/.exec(tzid)?.[1]
  return tail && isTimeZone(tail) ? tail : null
}

export function parseTime(value, params = {}) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(String(value).trim())
  if (!m) return null
  const allDay = !m[4] || params.VALUE === 'DATE'
  return {
    y: Number(m[1]),
    mo: Number(m[2]),
    d: Number(m[3]),
    h: allDay ? 0 : Number(m[4]),
    mi: allDay ? 0 : Number(m[5]),
    s: allDay ? 0 : Number(m[6]),
    utc: Boolean(m[7]),
    zone: cleanZone(params.TZID),
    allDay,
  }
}

export function parseDuration(value) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(value).trim())
  if (!m) return null
  const ms = ((Number(m[2] || 0) * 7 + Number(m[3] || 0)) * 24 * 3600 + Number(m[4] || 0) * 3600 + Number(m[5] || 0) * 60 + Number(m[6] || 0)) * 1000
  return m[1] === '-' ? -ms : ms
}

const list = (value) => String(value).split(',').map((v) => Number(v.trim())).filter((n) => Number.isInteger(n) && n !== 0)

export function parseRule(value) {
  const raw = {}
  for (const part of String(value).split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0) raw[part.slice(0, eq).trim().toUpperCase()] = part.slice(eq + 1).trim()
  }
  const freq = (raw.FREQ || '').toUpperCase()
  const byday = raw.BYDAY
    ? raw.BYDAY.split(',')
        .map((s) => /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(s.trim()))
        .filter(Boolean)
        .map((m) => ({ n: m[1] ? Number(m[1]) : 0, day: WEEKDAYS.indexOf(m[2].toUpperCase()) }))
    : null
  const wkst = WEEKDAYS.indexOf((raw.WKST || 'MO').toUpperCase())
  return {
    freq: FREQS.includes(freq) ? freq : null,
    interval: Math.max(1, Number.parseInt(raw.INTERVAL, 10) || 1),
    count: raw.COUNT ? Math.max(1, Number.parseInt(raw.COUNT, 10) || 1) : null,
    until: raw.UNTIL ? parseTime(raw.UNTIL) : null,
    byday: byday?.length ? byday : null,
    bymonthday: raw.BYMONTHDAY ? list(raw.BYMONTHDAY) : null,
    bymonth: raw.BYMONTH ? list(raw.BYMONTH).filter((n) => n >= 1 && n <= 12) : null,
    bysetpos: raw.BYSETPOS ? list(raw.BYSETPOS) : null,
    wkst: wkst >= 0 ? wkst : 1,
  }
}

function toEvent(props) {
  const one = (name) => props.find((p) => p.name === name)
  const times = (name) =>
    props
      .filter((p) => p.name === name)
      .flatMap((p) => p.value.split(',').map((v) => parseTime(v, p.params)))
      .filter(Boolean)
  const dtstart = one('DTSTART')
  const start = dtstart ? parseTime(dtstart.value, dtstart.params) : null
  if (!start) return null
  const dtend = one('DTEND')
  const duration = one('DURATION')
  const rrule = one('RRULE')
  const recurrence = one('RECURRENCE-ID')
  return {
    uid: one('UID')?.value.trim() || null,
    start,
    end: dtend ? parseTime(dtend.value, dtend.params) : null,
    duration: duration ? parseDuration(duration.value) : null,
    rrule: rrule ? parseRule(rrule.value) : null,
    rdates: times('RDATE'),
    exdates: times('EXDATE'),
    recurrenceId: recurrence ? parseTime(recurrence.value, recurrence.params) : null,
    transparent: (one('TRANSP')?.value || '').trim().toUpperCase() === 'TRANSPARENT',
    cancelled: (one('STATUS')?.value || '').trim().toUpperCase() === 'CANCELLED',
  }
}

export function parseEvents(text) {
  const events = []
  let props = null
  let nested = 0
  for (const raw of String(text || '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/)) {
    const line = parseLine(raw)
    if (!line) continue
    const value = line.value.trim().toUpperCase()
    if (line.name === 'BEGIN') {
      if (props) nested += 1
      else if (value === 'VEVENT') props = []
      continue
    }
    if (line.name === 'END' && props) {
      if (nested) nested -= 1
      else if (value === 'VEVENT') {
        const event = toEvent(props)
        if (event) events.push(event)
        props = null
      }
      continue
    }
    if (props && !nested) props.push(line)
  }
  return events
}

export function timeOf(t, timeZone) {
  if (t.utc) return Date.UTC(t.y, t.mo - 1, t.d, t.h, t.mi, t.s)
  return zonedTime(t.y, t.mo, t.d, t.h * 60 + t.mi, t.allDay ? timeZone : t.zone || timeZone) + t.s * 1000
}

function lengthOf(event, start, timeZone) {
  if (event.end) return timeOf(event.end, timeZone) - start
  if (event.duration !== null) return event.duration
  return event.start.allDay ? DAY_MS : 0
}

const civil = (y, mo, d) => new Date(Date.UTC(y, mo - 1, d))
const ymd = (date) => [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
const daysIn = (y, mo) => new Date(Date.UTC(y, mo, 0)).getUTCDate()
const dayNumber = (y, mo, d) => Math.floor(Date.UTC(y, mo - 1, d) / DAY_MS)

function setpos(dates, positions) {
  if (!positions) return dates
  const picked = positions.map((p) => (p > 0 ? dates[p - 1] : dates[dates.length + p])).filter(Boolean)
  return [...new Map(picked.map((date) => [date.join('-'), date])).values()].sort((a, b) => dayNumber(...a) - dayNumber(...b))
}

function monthDays(y, mo, rule, start) {
  const length = daysIn(y, mo)
  let days = rule.bymonthday ? rule.bymonthday.map((n) => (n > 0 ? n : length + n + 1)).filter((n) => n >= 1 && n <= length) : null
  if (rule.byday) {
    const matches = new Set()
    for (const { n, day } of rule.byday) {
      const all = []
      for (let d = 1; d <= length; d += 1) if (civil(y, mo, d).getUTCDay() === day) all.push(d)
      if (!n) all.forEach((d) => matches.add(d))
      else {
        const pick = n > 0 ? all[n - 1] : all[all.length + n]
        if (pick) matches.add(pick)
      }
    }
    days = days ? days.filter((d) => matches.has(d)) : [...matches]
  }
  if (!days) days = start.d <= length ? [start.d] : []
  return [...new Set(days)].sort((a, b) => a - b)
}

function* periods(rule, start, skip) {
  const { freq, interval } = rule
  const inMonth = (date) => !rule.bymonth || rule.bymonth.includes(date.getUTCMonth() + 1)
  if (freq === 'DAILY') {
    for (let i = skip * interval; ; i += interval) {
      const date = civil(start.y, start.mo, start.d + i)
      const [y, mo, d] = ymd(date)
      const ok =
        inMonth(date) &&
        (!rule.byday || rule.byday.some((b) => b.day === date.getUTCDay())) &&
        (!rule.bymonthday || rule.bymonthday.some((n) => n === d || n === d - daysIn(y, mo) - 1))
      yield { first: [y, mo, d], dates: ok ? [[y, mo, d]] : [] }
    }
  }
  if (freq === 'WEEKLY') {
    const first = civil(start.y, start.mo, start.d)
    const weekStart = first.getUTCDate() - ((first.getUTCDay() - rule.wkst + 7) % 7)
    const days = rule.byday ? rule.byday.map((b) => b.day) : [first.getUTCDay()]
    for (let w = skip * interval; ; w += interval) {
      const dates = []
      for (let k = 0; k < 7; k += 1) {
        const date = civil(start.y, start.mo, weekStart + w * 7 + k)
        if (days.includes(date.getUTCDay()) && inMonth(date)) dates.push(ymd(date))
      }
      yield { first: ymd(civil(start.y, start.mo, weekStart + w * 7)), dates: setpos(dates, rule.bysetpos) }
    }
  }
  if (freq === 'MONTHLY') {
    for (let k = 0; ; k += interval) {
      const [y, mo] = ymd(civil(start.y, start.mo + k, 1))
      const dates = !rule.bymonth || rule.bymonth.includes(mo) ? monthDays(y, mo, rule, start).map((d) => [y, mo, d]) : []
      yield { first: [y, mo, 1], dates: setpos(dates, rule.bysetpos) }
    }
  }
  if (freq === 'YEARLY') {
    for (let k = 0; ; k += interval) {
      const y = start.y + k
      const dates = []
      for (const mo of [...(rule.bymonth || [start.mo])].sort((a, b) => a - b)) {
        dates.push(...monthDays(y, mo, rule, start).map((d) => [y, mo, d]))
      }
      yield { first: [y, 1, 1], dates: setpos(dates, rule.bysetpos) }
    }
  }
}

function skipFor(rule, start, from) {
  if (rule.count || !['DAILY', 'WEEKLY'].includes(rule.freq)) return 0
  const span = rule.freq === 'DAILY' ? rule.interval : rule.interval * 7
  const behind = Math.floor(from / DAY_MS) - dayNumber(start.y, start.mo, start.d) - 8
  return behind > 0 ? Math.floor(behind / span) : 0
}

export function instancesOf(event, { from, to, timeZone, overridden = new Set() }) {
  const start = timeOf(event.start, timeZone)
  const length = lengthOf(event, start, timeZone)
  if (length <= 0) return []
  const out = []
  const exact = new Set()
  const days = new Set()
  for (const ex of event.exdates) {
    if (ex.allDay) days.add(`${ex.y}-${ex.mo}-${ex.d}`)
    else exact.add(timeOf(ex, timeZone))
  }
  const keep = (at, y, mo, d) => {
    if (exact.has(at) || days.has(`${y}-${mo}-${d}`) || overridden.has(at)) return
    if (at < to && at + length > from) out.push([at, at + length])
  }

  const t = event.start
  keep(start, t.y, t.mo, t.d)
  for (const r of event.rdates) {
    const at = timeOf(r.allDay && !t.allDay ? { ...r, h: t.h, mi: t.mi, s: t.s, allDay: false, zone: t.zone, utc: t.utc } : r, timeZone)
    if (at !== start) keep(at, r.y, r.mo, r.d)
  }

  const rule = event.rrule
  if (!rule?.freq) return out
  const zone = t.utc ? 'UTC' : t.allDay ? timeZone : t.zone || timeZone
  const minute = t.h * 60 + t.mi
  const until = rule.until ? timeOf(rule.until, timeZone) + (rule.until.allDay ? DAY_MS - 1 : 0) : Infinity
  let count = 1
  let steps = 0
  outer: for (const { first, dates } of periods(rule, t, skipFor(rule, t, from))) {
    if ((steps += 1) > MAX_PERIODS) break
    for (const [y, mo, d] of dates) {
      const at = t.utc ? Date.UTC(y, mo - 1, d, t.h, t.mi, t.s) : zonedTime(y, mo, d, minute, zone) + t.s * 1000
      if (at <= start) continue
      if (at > until || at >= to) break outer
      count += 1
      keep(at, y, mo, d)
      if (rule.count && count >= rule.count) break outer
    }
    const firstAt = Date.UTC(first[0], first[1] - 1, first[2])
    if (firstAt > to + 2 * DAY_MS || firstAt > until + 2 * DAY_MS) break
  }
  return out
}

export function busyFrom(events, { from, to, timeZone }) {
  const groups = new Map()
  events.forEach((event, i) => {
    const key = event.uid || `#${i}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(event)
  })
  const busy = []
  for (const group of groups.values()) {
    const overrides = group.filter((e) => e.recurrenceId)
    const overridden = new Set(overrides.map((e) => timeOf(e.recurrenceId, timeZone)))
    for (const event of group) {
      if (event.transparent || event.cancelled) continue
      const single = event.recurrenceId ? { ...event, rrule: null, rdates: [], exdates: [] } : event
      busy.push(...instancesOf(single, { from, to, timeZone, overridden: event.recurrenceId ? new Set() : overridden }))
    }
  }
  return busy.sort((a, b) => a[0] - b[0])
}

const stampOf = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const escapeText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const quoteParam = (s) => `"${String(s).replace(/["\r\n]/g, '')}"`

function fold(line) {
  const out = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = Buffer.byteLength(ch)
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  out.push(current)
  return out.join('\r\n ')
}

export function eventIcs({ method, uid, stamp, start, end, summary, description, location, url, organizer, attendee, alarmMinutes }) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//blxr.net//Book a call//EN', 'CALSCALE:GREGORIAN']
  if (method) lines.push(`METHOD:${method}`)
  lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stampOf(stamp)}`, `DTSTART:${stampOf(start)}`, `DTEND:${stampOf(end)}`, `SUMMARY:${escapeText(summary)}`)
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`)
  if (location) lines.push(`LOCATION:${escapeText(location)}`)
  if (url) lines.push(`URL:${url}`)
  if (organizer) lines.push(`ORGANIZER;CN=${quoteParam(organizer.name)}:mailto:${organizer.email}`)
  if (attendee) lines.push(`ATTENDEE;CN=${quoteParam(attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee.email}`)
  lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'SEQUENCE:0')
  if (alarmMinutes) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(summary)}`, `TRIGGER:-PT${alarmMinutes}M`, 'END:VALARM')
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}
