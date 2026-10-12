import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, bearer, FULL_ENV, ICLOUD_ENV } from './support/server.mjs'

const OPEN = {
  ...FULL_ENV,
  ...ICLOUD_ENV,
  BOOKING_TIMEZONE: 'UTC',
  BOOKING_HOURS: 'sun-sat 00:00-24:00',
  BOOKING_NOTICE_HOURS: '0',
  BOOKING_DAYS: '3',
  BOOKING_MAX_PER_DAY: '0',
}

const HOUR = 3_600_000
const DAY = 24 * HOUR
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const iso = (ms) => new Date(ms).toISOString()
const midnight = (offsetDays = 0) => Math.floor(Date.now() / DAY) * DAY + offsetDays * DAY
const vevent = (uid, start, end, ...extra) => ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, ...extra, 'END:VEVENT']
const vcal = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...events.flat(), 'END:VCALENDAR', ''].join('\r\n')

let ipN = 0
const freshIp = () => `10.200.${(ipN >> 8) & 255}.${++ipN & 255}`
let guestN = 0
const guest = (start, extra = {}) => ({ start, name: 'Ada Lovelace', email: `ada${++guestN}@example.com`, note: 'Talk about engines', timeZone: 'Europe/London', ...extra })

const book = (srv, body, ip = freshIp()) => srv.request('/api/book', { method: 'POST', body, ip })
const slots = async (srv) => (await srv.request('/api/book')).body.slots
const puts = (srv) => srv.calls((c) => c.method === 'PUT' && c.url.includes('caldav.icloud.test'))
const mails = async (srv) => (await srv.calls('api.resend.com')).map((c) => JSON.parse(c.body))
const decodeAttachment = (mail) => Buffer.from(mail.attachments[0].content, 'base64').toString('utf8').replace(/\r\n /g, '')

describe('booking: availability from iCloud', () => {
  let srv
  const oneOff = midnight(1) + 9 * HOUR
  const tomorrowNoon = midnight(1) + 12 * HOUR
  const dayAfterNoon = midnight(2) + 12 * HOUR

  before(async () => {
    srv = await startServer({
      env: OPEN,
      scenario: {
        icloud: {
          calendars: [
            {
              id: 'home',
              name: 'Calendar',
              events: {
                'one-off.ics': vcal(vevent('one-off', oneOff, oneOff + HOUR)),
                'daily.ics': vcal(vevent('daily', midnight(-30) + 12 * HOUR, midnight(-30) + 13 * HOUR, 'RRULE:FREQ=DAILY', `EXDATE:${stamp(tomorrowNoon)}`)),
                'free.ics': vcal(vevent('free', midnight(1) + 15 * HOUR, midnight(1) + 16 * HOUR, 'TRANSP:TRANSPARENT')),
                'cancelled.ics': vcal(vevent('cancelled', midnight(2) + 20 * HOUR, midnight(2) + 21 * HOUR, 'STATUS:CANCELLED')),
              },
            },
            { id: 'work', name: 'Work', events: { 'standup.ics': vcal(vevent('standup', midnight(2) + 9 * HOUR, midnight(2) + 10 * HOUR)) } },
            { id: 'tasks', name: 'Reminders', todo: true, events: { 'x.ics': vcal(vevent('todo-cal', midnight(2) + 18 * HOUR, midnight(2) + 19 * HOUR)) } },
          ],
        },
      },
    })
  })
  after(() => srv?.cleanup())

  test('answers the settings and the open slots', async () => {
    const res = await srv.request('/api/book')
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), 'no-store')
    const { timeZone, minutes, days, video, slots: list } = res.body
    assert.deepEqual({ timeZone, minutes, days, video }, { timeZone: 'UTC', minutes: 30, days: 3, video: 'Video call' })
    assert.ok(list.length > 80)
    assert.deepEqual([...list].sort(), list)
    for (const s of list) assert.equal(new Date(s).getUTCMinutes() % 30, 0)
  })

  test('one-off, repeating and other-calendar events block time; Free, cancelled and skipped ones do not', async () => {
    const list = await slots(srv)
    const has = (ms) => list.includes(iso(ms))
    assert.ok(!has(oneOff) && !has(oneOff + HOUR / 2), 'one-off event')
    assert.ok(has(oneOff + HOUR), 'right after the one-off event')
    assert.ok(!has(dayAfterNoon) && !has(dayAfterNoon + HOUR / 2), 'daily repeat')
    assert.ok(has(tomorrowNoon), 'EXDATE skips tomorrow')
    assert.ok(has(midnight(1) + 15 * HOUR), 'TRANSP:TRANSPARENT is free')
    assert.ok(has(midnight(2) + 20 * HOUR), 'STATUS:CANCELLED is free')
    assert.ok(!has(midnight(2) + 9 * HOUR), 'Work calendar counts')
    assert.ok(has(midnight(2) + 18 * HOUR), 'a Reminders list is not an event calendar')
  })

  test('iCloud is discovered once and signed in with the app-specific password', async () => {
    const root = await srv.calls((c) => new URL(c.url).hostname === 'caldav.icloud.test')
    assert.equal(root.length, 2)
    assert.equal(root[0].method, 'PROPFIND')
    assert.equal(root[0].headers.authorization, `Basic ${Buffer.from('owner@icloud.test:abcd-efgh-ijkl-mnop').toString('base64')}`)
  })

  test('only GET and POST', async () => {
    assert.equal((await srv.request('/api/book', { method: 'DELETE' })).status, 405)
  })
})

describe('booking: making a booking', () => {
  let srv
  before(async () => {
    srv = await startServer({
      env: OPEN,
      scenario: { icloud: { calendars: [{ id: 'work', name: 'Work', events: {} }, { id: 'home', name: 'Calendar', events: {} }] } },
    })
  })
  after(() => srv?.cleanup())

  test('saves the call into the iCloud calendar and emails the guest an invite', async () => {
    const [first] = await slots(srv)
    const res = await book(srv, guest(first, { email: 'ada@example.com' }))
    assert.equal(res.status, 201)
    const { ics, ...rest } = res.body.booking
    assert.deepEqual(rest, { start: first, end: iso(Date.parse(first) + 30 * 60_000), minutes: 30, video: null, emailed: true })
    assert.match(ics, /METHOD:PUBLISH/)
    assert.doesNotMatch(ics, /ATTENDEE/)

    const [put] = await puts(srv)
    put.body = put.body.replace(/\r\n /g, '')
    const url = new URL(put.url)
    assert.equal(url.hostname, 'p01-caldav.icloud.test')
    assert.match(url.pathname, /^\/1234567\/calendars\/home\/[0-9a-f-]{36}%40book\.blxr\.net\.ics$/)
    assert.equal(put.headers['content-type'], 'text/calendar; charset=utf-8')
    assert.match(put.body, new RegExp(`DTSTART:${stamp(Date.parse(first))}\r\n`))
    assert.match(put.body, /SUMMARY:Call with Ada Lovelace\r\n/)
    assert.match(put.body, /Talk about engines\\n\\nAda Lovelace <ada@example\.com>\\nTheir time zone: Europe\/London\\nBooked on https:\/\/blxr\.test\/book/)
    assert.doesNotMatch(put.body, /ATTENDEE|ORGANIZER|METHOD/)

    const [mail] = await mails(srv)
    assert.deepEqual(mail.to, ['ada@example.com'])
    assert.equal(mail.reply_to, 'owner@example.com')
    assert.match(mail.subject, /^Call booked: /)
    assert.equal(mail.attachments[0].filename, 'invite.ics')
    const invite = decodeAttachment(mail)
    assert.match(invite, /METHOD:REQUEST/)
    assert.doesNotMatch(invite, /engines/)
    assert.doesNotMatch(ics, /engines/)
    assert.doesNotMatch(JSON.stringify(mail), /engines/)
    assert.match(invite, /ORGANIZER;CN="blxr":mailto:owner@example\.com/)
    assert.match(invite, /ATTENDEE;CN="Ada Lovelace";.*:mailto:ada@example\.com/)
    assert.equal(/UID:(.+)\r\n/.exec(invite)[1], /UID:(.+)\r\n/.exec(put.body)[1])

    assert.ok(!(await slots(srv)).includes(first))
  })

  test('after a booking only the new event is fetched from iCloud', async () => {
    const [first, second] = await slots(srv)
    assert.equal((await book(srv, guest(first))).status, 201)
    await srv.clearCalls()
    assert.equal((await book(srv, guest(second))).status, 201)
    const reports = await srv.calls((c) => c.method === 'REPORT')
    assert.equal(reports.length, 1)
    assert.equal([...reports[0].body.matchAll(/<d:href>/g)].length, 1)
  })

  test('a slot someone already took answers 409 without even asking iCloud', async () => {
    const [first] = await slots(srv)
    assert.equal((await book(srv, guest(first))).status, 201)
    await srv.clearCalls()
    const res = await book(srv, guest(first))
    assert.equal(res.status, 409)
    assert.deepEqual(res.body, { error: 'slot_taken' })
    assert.equal((await srv.calls('icloud.test')).length, 0)
  })

  test('two requests racing for one slot: exactly one wins', async () => {
    const [first] = await slots(srv)
    const results = await Promise.all([book(srv, guest(first)), book(srv, guest(first))])
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409])
  })

  test('a time that is not on the grid, or in the past, is not bookable', async () => {
    const [first] = await slots(srv)
    assert.deepEqual((await book(srv, guest(iso(Date.parse(first) + 7 * 60_000)))).body, { error: 'slot_taken' })
    assert.equal((await book(srv, guest('2020-01-01T10:00:00.000Z'))).status, 409)
  })

  test('bad input is refused field by field', async () => {
    const res = await book(srv, { start: 'tomorrow', name: ' 1 ', email: 'not-an-email', note: 'x'.repeat(1001) })
    assert.equal(res.status, 400)
    assert.deepEqual(res.body, { error: 'invalid', fields: ['name', 'email', 'note', 'start'] })
    const [first] = await slots(srv)
    for (const name of ['Visit https://spam.example', 'Cheap pills at pills.com', 'www.example']) {
      assert.deepEqual((await book(srv, guest(first, { name }))).body, { error: 'invalid', fields: ['name'] }, name)
    }
  })

  test('the honeypot answers like a booking and touches nothing', async () => {
    const [first] = await slots(srv)
    await srv.clearCalls()
    const res = await book(srv, guest(first, { website: 'https://spam.example' }))
    assert.equal(res.status, 201)
    assert.equal(res.body.booking.start, first)
    assert.equal((await puts(srv)).length, 0)
    assert.equal((await mails(srv)).length, 0)
  })

  test('three bookings per address a day, two per email', async () => {
    const ip = freshIp()
    for (let i = 0; i < 3; i += 1) {
      const [first] = await slots(srv)
      assert.equal((await book(srv, guest(first), ip)).status, 201)
    }
    const [next] = await slots(srv)
    const limited = await book(srv, guest(next), ip)
    assert.equal(limited.status, 429)
    assert.equal(limited.body.error, 'rate_limited')
    assert.ok(Number(limited.headers.get('retry-after')) > 0)

    for (let i = 0; i < 2; i += 1) {
      const [first] = await slots(srv)
      assert.equal((await book(srv, guest(first, { email: 'twice@example.com' }))).status, 201)
    }
    const [again] = await slots(srv)
    assert.equal((await book(srv, guest(again, { email: 'TWICE@example.com' }))).status, 429)
  })
})

describe('booking: settings', () => {
  const calendars = [
    { id: 'home', name: 'Calendar', events: {} },
    { id: 'work', name: 'Work', events: { 'standup.ics': vcal(vevent('standup', midnight(2) + 9 * HOUR, midnight(2) + 10 * HOUR)) } },
  ]

  test('BOOKING_CALENDAR picks where bookings go; an unknown name is a 502', async () => {
    const srv = await startServer({ env: { ...OPEN, BOOKING_CALENDAR: 'work' }, scenario: { icloud: { calendars } } })
    try {
      const [first] = await slots(srv)
      assert.equal((await book(srv, guest(first))).status, 201)
      assert.match(new URL((await puts(srv))[0].url).pathname, /^\/1234567\/calendars\/work\//)
    } finally {
      await srv.cleanup()
    }
    const wrong = await startServer({ env: { ...OPEN, BOOKING_CALENDAR: 'Nope' }, scenario: { icloud: { calendars } } })
    try {
      assert.deepEqual((await wrong.request('/api/book')).body, { error: 'calendar_failed' })
    } finally {
      await wrong.cleanup()
    }
  })

  test('BOOKING_BUSY_CALENDARS limits which calendars block time', async () => {
    const srv = await startServer({ env: { ...OPEN, BOOKING_BUSY_CALENDARS: 'Calendar' }, scenario: { icloud: { calendars } } })
    try {
      assert.ok((await slots(srv)).includes(iso(midnight(2) + 9 * HOUR)))
    } finally {
      await srv.cleanup()
    }
  })

  test('BOOKING_MAX_PER_DAY closes a day, counting bookings by their UID', async () => {
    const srv = await startServer({ env: { ...OPEN, BOOKING_MAX_PER_DAY: '1' }, scenario: { icloud: { calendars } } })
    try {
      const list = await slots(srv)
      const day = list[list.length - 1].slice(0, 10)
      assert.equal((await book(srv, guest(list.find((s) => s.startsWith(day))))).status, 201)
      const after = await slots(srv)
      assert.ok(!after.some((s) => s.startsWith(day)))
      assert.ok(after.length > 0)
    } finally {
      await srv.cleanup()
    }
  })

  test('BOOKING_VIDEO_URL goes into the page, the event and the invite', async () => {
    const video = 'https://facetime.apple.com/join#v=1&p=abcdef&k=xyz'
    const srv = await startServer({ env: { ...OPEN, BOOKING_VIDEO_URL: video }, scenario: { icloud: { calendars } } })
    try {
      assert.equal((await srv.request('/api/book')).body.video, 'FaceTime')
      const [first] = await slots(srv)
      const res = await book(srv, guest(first))
      assert.equal(res.body.booking.video, video)
      assert.match((await puts(srv))[0].body.replace(/\r\n /g, ''), /URL:https:\/\/facetime\.apple\.com\/join#v=1&p=abcdef&k=xyz/)
      const [mail] = await mails(srv)
      assert.match(mail.html, /Join on FaceTime/)
      assert.match(decodeAttachment(mail), /LOCATION:https:\/\/facetime\.apple\.com/)
    } finally {
      await srv.cleanup()
    }
  })

  test('calendar data wrapped in CDATA parses the same', async () => {
    const srv = await startServer({ env: OPEN, scenario: { icloudCdata: true, icloud: { calendars } } })
    try {
      assert.ok(!(await slots(srv)).includes(iso(midnight(2) + 9 * HOUR)))
    } finally {
      await srv.cleanup()
    }
  })
})

describe('booking: failures', () => {
  test('off without iCloud credentials', async () => {
    const srv = await startServer({ env: { ...OPEN, ICLOUD_APP_PASSWORD: '' } })
    try {
      assert.deepEqual((await srv.request('/api/book')).body, { error: 'booking_disabled' })
      assert.equal((await book(srv, guest('2030-01-01T10:00:00.000Z'))).status, 503)
      assert.equal((await srv.calls('icloud.test')).length, 0)
    } finally {
      await srv.cleanup()
    }
  })

  test('a refused app-specific password pauses booking instead of retrying on every request', async () => {
    const srv = await startServer({ env: OPEN, scenario: { icloudMode: 'revoked' } })
    try {
      const res = await srv.request('/api/book')
      assert.equal(res.status, 503)
      assert.deepEqual(res.body, { error: 'booking_disabled' })
      await srv.request('/api/book')
      assert.equal((await srv.calls('icloud.test')).length, 1)
    } finally {
      await srv.cleanup()
    }
  })

  test('iCloud down answers 502 calendar_failed', async () => {
    const srv = await startServer({ env: OPEN, scenario: { icloudMode: 'down' } })
    try {
      const res = await srv.request('/api/book')
      assert.equal(res.status, 502)
      assert.deepEqual(res.body, { error: 'calendar_failed' })
    } finally {
      await srv.cleanup()
    }
  })

  test('a failed save is a 502, nothing is emailed, and the slot stays open', async () => {
    const srv = await startServer({ env: OPEN })
    try {
      const [first] = await slots(srv)
      await srv.scenario({ icloudPut: 'fail' })
      assert.equal((await book(srv, guest(first))).status, 502)
      assert.equal((await mails(srv)).length, 0)
      await srv.scenario({})
      assert.equal((await book(srv, guest(first))).status, 201)
    } finally {
      await srv.cleanup()
    }
  })

  test('if the email fails the booking still stands', async () => {
    const srv = await startServer({ env: OPEN, scenario: { resend: 'fail' } })
    try {
      const [first] = await slots(srv)
      const res = await book(srv, guest(first))
      assert.equal(res.status, 201)
      assert.equal(res.body.booking.emailed, false)
      assert.equal((await puts(srv)).length, 1)
    } finally {
      await srv.cleanup()
    }
  })

  test('without mail set up the guest gets the .ics on the page instead', async () => {
    const srv = await startServer({ env: { ...OPEN, RESEND_API_KEY: '' } })
    try {
      const [first] = await slots(srv)
      const res = await book(srv, guest(first))
      assert.equal(res.body.booking.emailed, false)
      assert.match(res.body.booking.ics, /BEGIN:VCALENDAR/)
      assert.equal((await srv.calls('api.resend.com')).length, 0)
    } finally {
      await srv.cleanup()
    }
  })

  test('the owner report shows booking on and never the app-specific password', async () => {
    const srv = await startServer({ env: OPEN })
    try {
      const res = await srv.request('/api/logs', { headers: bearer({ sub: 'owner', n: 1 }) })
      assert.equal(res.status, 200)
      assert.equal(res.body.system.features.booking, true)
      assert.ok(!res.text.includes(OPEN.ICLOUD_APP_PASSWORD))
    } finally {
      await srv.cleanup()
    }
  })
})
