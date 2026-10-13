import {
  parseHours,
  openSlots,
  blockRanges,
  cleanSchedule,
  dayKey,
  zonedTime,
  CALL_PLACES,
  cleanCallDetails,
  callDetailLines,
  readCallDetails,
  callPlan,
} from '../server/src/booking.mjs'

const ZONE = 'Europe/Athens'
const MINUTES = 30
const DAYS = 21
const NOTICE_HOURS = 12
const MAX_PER_DAY = 4
const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const VIDEO = 'https://facetime.apple.com/join#v=1&p=demo'

const schedule = { hours: parseHours('mon-fri 10:00-13:00, mon-fri 14:00-18:00'), blocks: [], paused: false, rev: 0, custom: false }
const calls = []
let seeded = false
let idCount = 0

const makeId = () => `demo${(++idCount).toString(36)}${Date.now().toString(36)}`.slice(0, 24)
const iso = (ms) => new Date(ms).toISOString()
const shiftKey = (key, days) => new Date(Date.parse(`${key}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const weekdayOf = (key) => new Date(`${key}T12:00:00Z`).getUTCDay()

function wall(key, minutes) {
  const [y, m, d] = key.split('-').map(Number)
  return zonedTime(y, m, d, minutes, ZONE)
}

function nextWeekday(key, weekday) {
  let next = key
  while (weekdayOf(next) !== weekday) next = shiftKey(next, 1)
  return next
}

function personalBusy(now) {
  const out = []
  const first = now - (now % DAY_MS)
  for (let i = -1; i < DAYS; i += 1) {
    const day = first + i * DAY_MS
    const seed = Math.round(day / DAY_MS) % 5
    if (seed === 3) out.push([day + 6 * HOUR_MS, day + 16 * HOUR_MS])
    else out.push([day + (8 + seed) * HOUR_MS, day + (9 + seed) * HOUR_MS + HOUR_MS / 2])
  }
  return out
}

function freeSlots(now, { ignorePause = false } = {}) {
  if (schedule.paused && !ignorePause) return []
  return openSlots({
    now,
    windows: schedule.hours,
    timeZone: ZONE,
    minutes: MINUTES,
    notice: NOTICE_HOURS * 60,
    days: DAYS,
    maxPerDay: MAX_PER_DAY,
    busy: [...personalBusy(now), ...calls.map((c) => [c.start, c.end]), ...blockRanges(schedule.blocks, { from: now, to: now + (DAYS + 1) * DAY_MS, timeZone: ZONE })],
    booked: calls.map((c) => c.start),
  })
}

function demoPlace(details) {
  const place = details.place
  const own = place && CALL_PLACES[place].contact === 'link' && details.contact ? details.contact : null
  const video = own || (!place || place === 'facetime' ? VIDEO : null)
  const where = video ? (own ? CALL_PLACES[place].label : VIDEO) : place && place !== 'other' ? CALL_PLACES[place].label : null
  return { video, where }
}

function addCall(start, [name, email, note, timeZone], input = {}) {
  const { details } = cleanCallDetails(input)
  calls.push({
    uid: `${makeId()}@book.blxr.net`,
    start,
    end: start + MINUTES * 60_000,
    name,
    email,
    note,
    timeZone,
    video: demoPlace(details).video,
    ...readCallDetails(callDetailLines(details)),
  })
  return details
}

function seed(now) {
  if (seeded) return
  seeded = true
  const today = dayKey(now, ZONE)
  schedule.blocks = [
    { id: 'demogym0001', date: nextWeekday(today, 2), start: 600, end: 690, repeat: 'weekly', until: null, except: [], label: 'Gym' },
    { id: 'demostudio01', date: nextWeekday(today, 5), start: 900, end: 1080, repeat: 'weekly', until: null, except: [], label: 'Studio afternoon' },
    { id: 'demodentist1', date: shiftKey(today, 3), start: 690, end: 750, repeat: 'none', until: null, except: [], label: 'Dentist' },
    { id: 'demotrip0001', date: shiftKey(today, 15), start: null, end: null, repeat: 'daily', until: shiftKey(today, 18), except: [], label: 'Trip to Crete' },
  ]

  const people = [
    [
      ['Maria Papadaki', 'maria@papadaki.studio', 'Redesign of our studio site. We have a rough sitemap and a few references.', null],
      { place: 'facetime', topic: 'project', budget: 'mid', timeline: 'month', company: 'Papadaki Studio', link: 'papadaki.studio', lang: 'el' },
    ],
    [
      ['Jonas Becker', 'jonas@becker.dev', 'Quick intro, and whether you take on small React audits.', 'Europe/Berlin'],
      { place: 'zoom', contact: 'https://zoom.us/j/84213370012', topic: 'job', company: 'Becker Labs' },
    ],
    [['Elena Rossi', 'elena.rossi@gmail.com', '', 'Europe/Rome'], { place: 'whatsapp', contact: '+39 347 120 4471', mode: 'voice', topic: 'chat' }],
    [
      ['Nikos Georgiou', 'nikos@georgiou.gr', 'Landing page for a café opening in Thessaloniki.', null],
      { place: 'phone', contact: '+30 694 215 8830', topic: 'project', budget: 'small', timeline: 'now', lang: 'el' },
    ],
    [['Priya Raman', 'priya@raman.io', 'Portfolio review before I apply to agencies.', 'Asia/Kolkata'], { place: 'discord', contact: 'priya.raman', topic: 'advice', link: 'priya.design' }],
  ]

  const soon = Math.ceil((now + 100 * 60_000) / (30 * 60_000)) * 30 * 60_000
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', hourCycle: 'h23' }).format(new Date(soon)))
  if (hour >= 9 && hour < 20 && dayKey(soon, ZONE) === today) {
    addCall(soon, ['Sofia Dimitriou', 'sofia@dimitriou.gr', 'Follow-up on the brand colours.', null], { place: 'meet', topic: 'collab', lang: 'el' })
  }
  addCall(wall(shiftKey(today, -2), 11 * 60), ['Alex Chen', 'alex@chen.design', 'Talked through a Figma handoff.', 'America/New_York'], { place: 'facetime', topic: 'advice' })

  const open = freeSlots(now)
  ;[1, 9, 18, 31, 47].forEach((index, i) => {
    if (open[index]) addCall(open[index], ...people[i])
  })
}

const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

const invite = (start, end) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//blxr//booking demo//EN',
    'BEGIN:VEVENT',
    `UID:demo-${start}@blxr.net`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    'SUMMARY:Call with Blxr',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')

function view(now) {
  return {
    timeZone: ZONE,
    minutes: MINUTES,
    step: MINUTES,
    notice: NOTICE_HOURS,
    days: DAYS,
    maxPerDay: MAX_PER_DAY,
    video: 'FaceTime',
    connected: true,
    custom: schedule.custom,
    rev: schedule.rev,
    hours: schedule.hours,
    blocks: schedule.blocks,
    paused: schedule.paused,
    calendar: 'Calls',
    syncedAt: iso(now - 40_000),
    calendarError: null,
    calls: calls
      .filter((c) => c.end >= now - 30 * DAY_MS)
      .sort((a, b) => a.start - b.start)
      .map((c) => ({ ...c, start: iso(c.start), end: iso(c.end) })),
    busy: personalBusy(now)
      .filter(([, b]) => b > now - DAY_MS)
      .map(([a, b]) => [iso(a), iso(b)]),
    slots: freeSlots(now, { ignorePause: true }).map(iso),
  }
}

function send(res, status, body, delay = 0) {
  const out = () => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.setHeader('cache-control', 'no-store')
    res.end(JSON.stringify(body))
  }
  if (delay) setTimeout(out, delay)
  else out()
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(null)
      }
    })
  })
}

async function book(req, res) {
  const body = await readJson(req)
  const start = Date.parse(body?.start)
  const fields = []
  if (typeof body?.name !== 'string' || body.name.trim().length < 2) fields.push('name')
  if (typeof body?.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email.trim())) fields.push('email')
  fields.push(...cleanCallDetails(body).fields)
  if (fields.length) return send(res, 400, { error: 'invalid', fields })
  if (!freeSlots(Date.now()).includes(start)) return send(res, 409, { error: 'slot_taken' })
  const end = start + MINUTES * 60_000
  const details = addCall(
    start,
    [body.name.trim(), body.email.trim(), typeof body.note === 'string' ? body.note.trim() : '', typeof body.timeZone === 'string' && body.timeZone !== ZONE ? body.timeZone : null],
    body,
  )
  const { video, where } = demoPlace(details)
  send(res, 201, { booking: { start: iso(start), end: iso(end), minutes: MINUTES, video, where, plan: callPlan(details, video), emailed: true, ics: invite(start, end) } }, 700)
}

async function saveSchedule(req, res) {
  const now = Date.now()
  const body = await readJson(req)
  if (!body || typeof body !== 'object') return send(res, 400, { error: 'invalid', fields: [] })
  if (body.rev !== schedule.rev) return send(res, 409, { error: 'conflict', schedule: view(now) })
  const checked = cleanSchedule(body, { today: dayKey(now, ZONE), makeId })
  if (checked.error) return send(res, 400, checked)
  Object.assign(schedule, checked.schedule, { rev: schedule.rev + 1, custom: true })
  send(res, 200, view(now), 380)
}

export default function bookingDemo() {
  return {
    name: 'booking-demo',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/book', (req, res, next) => {
        const now = Date.now()
        seed(now)
        if (/^\/schedule\/?(\?.*)?$/.test(req.url)) {
          if (req.method === 'GET') return send(res, 200, view(now), 250)
          if (req.method === 'PUT') return saveSchedule(req, res)
          return send(res, 405, { error: 'method_not_allowed' })
        }
        if (!/^\/?(\?.*)?$/.test(req.url)) return next()
        if ((req.method === 'GET' || req.method === 'POST') && schedule.paused) return send(res, 503, { error: 'booking_paused' })
        if (req.method === 'GET') {
          return send(res, 200, { timeZone: ZONE, minutes: MINUTES, days: DAYS, video: 'FaceTime', place: 'facetime', slots: freeSlots(now).map(iso) })
        }
        if (req.method === 'POST') return book(req, res)
        next()
      })
      server.config.logger.info('  booking demo: /api/book and /api/book/schedule serve sample data (VITE_BOOKING_DEMO=0 to use the real API)')
    },
  }
}
