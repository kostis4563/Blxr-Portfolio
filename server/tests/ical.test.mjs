import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseEvents, parseTime, parseDuration, busyFrom, timeOf, eventIcs } from '../src/ical.mjs'

const at = (s) => Date.parse(s)
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z')
const cal = (...lines) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...lines, 'END:VCALENDAR'].join('\r\n')
const event = (...lines) => ['BEGIN:VEVENT', 'UID:e1', ...lines, 'END:VEVENT']
const busy = (text, from, to, timeZone = 'Europe/Athens') => busyFrom(parseEvents(text), { from: at(from), to: at(to), timeZone }).map(([a, b]) => `${iso(a)}/${iso(b)}`)
const starts = (text, from, to, timeZone = 'Europe/Athens') => busy(text, from, to, timeZone).map((s) => s.split('/')[0])

describe('parsing', () => {
  test('unfolds lines, reads quoted params, and ignores alarms, time zones and to-dos', () => {
    const text = cal(
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Athens',
      'BEGIN:STANDARD',
      'DTSTART:19701025T040000',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VTODO',
      'UID:todo',
      'DTSTART:20261013T100000Z',
      'END:VTODO',
      'BEGIN:VEVENT',
      'UID:abc@',
      ' example.com',
      'DTSTART;TZID="Europe/Athens":20261013T100000',
      'DTEND;TZID="Europe/Athens":20261013T110000',
      'SUMMARY:x',
      'BEGIN:VALARM',
      'TRIGGER:-PT5M',
      'DTSTART:19990101T000000Z',
      'END:VALARM',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:no-start',
      'END:VEVENT',
    )
    const events = parseEvents(text)
    assert.equal(events.length, 1)
    assert.equal(events[0].uid, 'abc@example.com')
    assert.equal(iso(timeOf(events[0].start, 'UTC')), '2026-10-13T07:00:00Z')
  })

  test('times: UTC, zoned, floating, dates and odd TZIDs', () => {
    assert.equal(iso(timeOf(parseTime('20261013T100000Z'), 'Europe/Athens')), '2026-10-13T10:00:00Z')
    assert.equal(iso(timeOf(parseTime('20261013T100000', { TZID: 'America/New_York' }), 'UTC')), '2026-10-13T14:00:00Z')
    assert.equal(iso(timeOf(parseTime('20261013T100000'), 'Europe/Athens')), '2026-10-13T07:00:00Z')
    assert.equal(iso(timeOf(parseTime('20261013', { VALUE: 'DATE' }), 'Europe/Athens')), '2026-10-12T21:00:00Z')
    assert.equal(iso(timeOf(parseTime('20261013T100000', { TZID: '/mozilla.org/20050126_1/Europe/London' }), 'UTC')), '2026-10-13T09:00:00Z')
    assert.equal(iso(timeOf(parseTime('20261013T100000', { TZID: 'GTB Standard Time' }), 'Europe/Athens')), '2026-10-13T07:00:00Z')
    assert.equal(parseTime('nope'), null)
  })

  test('durations', () => {
    assert.equal(parseDuration('PT1H30M'), 90 * 60_000)
    assert.equal(parseDuration('P1DT2H'), 26 * 3_600_000)
    assert.equal(parseDuration('P1W'), 7 * 86_400_000)
    assert.equal(parseDuration('-PT15M'), -15 * 60_000)
    assert.equal(parseDuration('soon'), null)
  })
})

describe('busy time', () => {
  test('a one-off event, a DURATION, and a zero-length event (not busy)', () => {
    const text = cal(
      ...event('DTSTART;TZID=Europe/Athens:20261013T100000', 'DURATION:PT45M'),
      ...['BEGIN:VEVENT', 'UID:point', 'DTSTART:20261013T120000Z', 'END:VEVENT'],
    )
    assert.deepEqual(busy(text, '2026-10-12T00:00:00Z', '2026-10-20T00:00:00Z'), ['2026-10-13T07:00:00Z/2026-10-13T07:45:00Z'])
  })

  test('all-day events cover the whole day in the owner’s zone', () => {
    const text = cal(...event('DTSTART;VALUE=DATE:20261013', 'DTEND;VALUE=DATE:20261015'))
    assert.deepEqual(busy(text, '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z'), ['2026-10-12T21:00:00Z/2026-10-14T21:00:00Z'])
  })

  test('Free, cancelled and out-of-window events are skipped', () => {
    const text = cal(
      ...event('DTSTART:20261013T100000Z', 'DTEND:20261013T110000Z', 'TRANSP:TRANSPARENT'),
      ...['BEGIN:VEVENT', 'UID:e2', 'DTSTART:20261013T100000Z', 'DTEND:20261013T110000Z', 'STATUS:CANCELLED', 'END:VEVENT'],
      ...['BEGIN:VEVENT', 'UID:e3', 'DTSTART:20261113T100000Z', 'DTEND:20261113T110000Z', 'END:VEVENT'],
    )
    assert.deepEqual(busy(text, '2026-10-12T00:00:00Z', '2026-10-20T00:00:00Z'), [])
  })

  test('weekly on two days, with a skipped date and a moved instance', () => {
    const text = cal(
      ...event('DTSTART;TZID=Europe/Athens:20260105T110000', 'DTEND;TZID=Europe/Athens:20260105T120000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE', 'EXDATE;TZID=Europe/Athens:20261014T110000'),
      ...event('RECURRENCE-ID;TZID=Europe/Athens:20261019T110000', 'DTSTART;TZID=Europe/Athens:20261019T150000', 'DTEND;TZID=Europe/Athens:20261019T160000'),
    )
    assert.deepEqual(starts(text, '2026-10-12T00:00:00Z', '2026-10-22T00:00:00Z'), ['2026-10-12T08:00:00Z', '2026-10-19T12:00:00Z', '2026-10-21T08:00:00Z'])
  })

  test('a cancelled moved instance removes that one occurrence', () => {
    const text = cal(
      ...event('DTSTART:20261001T090000Z', 'DTEND:20261001T100000Z', 'RRULE:FREQ=DAILY'),
      ...event('RECURRENCE-ID:20261013T090000Z', 'DTSTART:20261013T090000Z', 'DTEND:20261013T100000Z', 'STATUS:CANCELLED'),
    )
    assert.deepEqual(starts(text, '2026-10-12T00:00:00Z', '2026-10-15T00:00:00Z'), ['2026-10-12T09:00:00Z', '2026-10-14T09:00:00Z'])
  })

  test('a daily event from years ago keeps its wall-clock time across a DST change', () => {
    const text = cal(...event('DTSTART;TZID=Europe/Athens:20190101T090000', 'DTEND;TZID=Europe/Athens:20190101T093000', 'RRULE:FREQ=DAILY'))
    assert.deepEqual(starts(text, '2026-10-24T00:00:00Z', '2026-10-27T00:00:00Z'), ['2026-10-24T06:00:00Z', '2026-10-25T07:00:00Z', '2026-10-26T07:00:00Z'])
  })

  test('every other week, counting from the week of DTSTART', () => {
    const text = cal(...event('DTSTART:20261005T100000Z', 'DTEND:20261005T110000Z', 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH'))
    assert.deepEqual(starts(text, '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', 'UTC'), [
      '2026-10-05T10:00:00Z',
      '2026-10-08T10:00:00Z',
      '2026-10-19T10:00:00Z',
      '2026-10-22T10:00:00Z',
    ])
  })

  test('monthly: second Tuesday, last Friday, first weekday, the 31st and the last day', () => {
    const monthly = (rule) => cal(...event('DTSTART:20260101T100000Z', 'DTEND:20260101T110000Z', `RRULE:${rule}`))
    const range = ['2026-09-01T00:00:00Z', '2027-01-01T00:00:00Z', 'UTC']
    const days = (rule) => starts(monthly(rule), ...range).map((s) => s.slice(0, 10))
    assert.deepEqual(days('FREQ=MONTHLY;BYDAY=2TU'), ['2026-09-08', '2026-10-13', '2026-11-10', '2026-12-08'])
    assert.deepEqual(days('FREQ=MONTHLY;BYDAY=-1FR'), ['2026-09-25', '2026-10-30', '2026-11-27', '2026-12-25'])
    assert.deepEqual(days('FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=1'), ['2026-09-01', '2026-10-01', '2026-11-02', '2026-12-01'])
    assert.deepEqual(days('FREQ=MONTHLY;BYMONTHDAY=31'), ['2026-10-31', '2026-12-31'])
    assert.deepEqual(days('FREQ=MONTHLY;BYMONTHDAY=-1'), ['2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31'])
  })

  test('yearly, COUNT and UNTIL', () => {
    const yearly = cal(...event('DTSTART:20200310T100000Z', 'DTEND:20200310T110000Z', 'RRULE:FREQ=YEARLY'))
    assert.deepEqual(starts(yearly, '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', 'UTC'), ['2026-03-10T10:00:00Z'])
    const counted = cal(...event('DTSTART:20261010T100000Z', 'DTEND:20261010T110000Z', 'RRULE:FREQ=DAILY;COUNT=3'))
    assert.deepEqual(starts(counted, '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', 'UTC'), ['2026-10-10T10:00:00Z', '2026-10-11T10:00:00Z', '2026-10-12T10:00:00Z'])
    const until = cal(...event('DTSTART:20261010T100000Z', 'DTEND:20261010T110000Z', 'RRULE:FREQ=DAILY;UNTIL=20261011T100000Z'))
    assert.deepEqual(starts(until, '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', 'UTC'), ['2026-10-10T10:00:00Z', '2026-10-11T10:00:00Z'])
  })

  test('RDATE adds extra occurrences', () => {
    const text = cal(...event('DTSTART:20261010T100000Z', 'DTEND:20261010T110000Z', 'RDATE:20261015T100000Z,20261016T120000Z'))
    assert.deepEqual(starts(text, '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', 'UTC'), ['2026-10-10T10:00:00Z', '2026-10-15T10:00:00Z', '2026-10-16T12:00:00Z'])
  })
})

describe('eventIcs', () => {
  const ics = eventIcs({
    method: 'REQUEST',
    uid: 'u1@book.blxr.net',
    stamp: at('2026-10-12T09:00:00Z'),
    start: at('2026-10-13T07:00:00Z'),
    end: at('2026-10-13T07:30:00Z'),
    summary: 'Call with Ζωή, “Z”',
    description: `${'Long note; with, commas '.repeat(8)}\nsecond line`,
    organizer: { name: 'blxr', email: 'owner@example.com' },
    attendee: { name: 'Ζωή "Z"', email: 'zoe@example.com' },
    alarmMinutes: 10,
  })

  test('uses CRLF, folds at 75 octets and escapes text', () => {
    assert.ok(ics.endsWith('\r\n'))
    for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line)
    const flat = ics.replace(/\r\n /g, '')
    assert.match(flat, /SUMMARY:Call with Ζωή\\, “Z”\r\n/)
    assert.match(flat, /DESCRIPTION:Long note\\; with\\, commas .*\\nsecond line\r\n/)
    assert.match(flat, /ATTENDEE;CN="Ζωή Z";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:zoe@example\.com\r\n/)
    assert.match(flat, /BEGIN:VALARM\r\nACTION:DISPLAY\r\n.*\r\nTRIGGER:-PT10M\r\nEND:VALARM/)
  })

  test('reads back as the same busy block', () => {
    const [e] = parseEvents(ics)
    assert.equal(e.uid, 'u1@book.blxr.net')
    assert.deepEqual(busy(ics, '2026-10-13T00:00:00Z', '2026-10-14T00:00:00Z'), ['2026-10-13T07:00:00Z/2026-10-13T07:30:00Z'])
  })
})
