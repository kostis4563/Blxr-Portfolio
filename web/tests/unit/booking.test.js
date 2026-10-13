import { describe, test, expect } from 'vitest'
import {
  WEEKDAYS,
  timeZoneList,
  dateKey,
  groupByDay,
  monthOf,
  shiftMonth,
  monthGrid,
  formatMonth,
  formatDay,
  formatTime,
  formatZone,
  bookingProblems,
  daysUntil,
  emailTypo,
  fullShortDay,
  whenWord,
  dayPhrase,
  ALERTS,
  calendarIcs,
  icsUid,
  googleCalendarUrl,
  outlookCalendarUrl,
  icsFileName,
} from '../../src/lib/booking.js'

const ms = (iso) => Date.parse(iso)

describe('dates in the visitor’s zone', () => {
  test('dateKey reads the calendar date where the visitor is', () => {
    expect(dateKey(ms('2026-10-12T22:30:00Z'), 'Europe/Athens')).toBe('2026-10-13')
    expect(dateKey(ms('2026-10-12T22:30:00Z'), 'America/New_York')).toBe('2026-10-12')
  })

  test('groupByDay buckets and sorts slots by local date, skipping junk', () => {
    const days = groupByDay(['2026-10-13T08:00:00.000Z', '2026-10-12T23:30:00.000Z', 'nope', '2026-10-13T07:00:00.000Z'], 'Europe/Athens')
    expect([...days.keys()]).toEqual(['2026-10-13'])
    expect(days.get('2026-10-13')).toEqual([ms('2026-10-12T23:30:00Z'), ms('2026-10-13T07:00:00Z'), ms('2026-10-13T08:00:00Z')])
    expect([...groupByDay(['2026-10-12T23:30:00.000Z'], 'UTC').keys()]).toEqual(['2026-10-12'])
  })

  test('timeZoneList always contains the current zone', () => {
    expect(timeZoneList('Europe/Athens')).toContain('Europe/Athens')
    expect(timeZoneList('Etc/Unknown')[0]).toBe('Etc/Unknown')
  })
})

describe('month grid', () => {
  test('starts on Monday and pads to whole weeks', () => {
    const cells = monthGrid('2026-10')
    expect(cells.length % 7).toBe(0)
    expect(cells.slice(0, 4)).toEqual([null, null, null, '2026-10-01'])
    expect(cells.filter(Boolean)).toHaveLength(31)
    expect(monthGrid('2026-02').filter(Boolean)).toHaveLength(28)
    expect(WEEKDAYS).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  test('months shift across years', () => {
    expect(monthOf('2026-12-31')).toBe('2026-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})

describe('formatting', () => {
  test('days, months and times read in English whatever the date', () => {
    expect(formatMonth('2026-10')).toBe('October 2026')
    expect(formatDay('2026-10-13')).toBe('Tuesday 13 October')
    expect(formatTime(ms('2026-10-13T07:00:00Z'), 'Europe/Athens')).toBe('10:00')
    expect(formatTime(ms('2026-10-13T13:30:00Z'), 'Europe/Athens', true)).toMatch(/^4:30\s?pm$/i)
  })

  test('zones show the city and the offset', () => {
    expect(formatZone('Europe/Athens', ms('2026-07-01T12:00:00Z'))).toBe('Athens (GMT+3)')
    expect(formatZone('America/New_York', ms('2026-01-01T12:00:00Z'))).toBe('New York (GMT-5)')
  })
})

describe('bookingProblems', () => {
  const ok = { name: 'Ada Lovelace', email: 'ada@example.com', note: '' }

  test('a filled-in form has none', () => {
    expect(bookingProblems(ok)).toEqual({})
  })

  test('name, email and note are each checked', () => {
    expect(Object.keys(bookingProblems({ name: ' ', email: 'ada@', note: 'x'.repeat(1001) }))).toEqual(['name', 'email', 'note'])
    expect(bookingProblems({ ...ok, name: '42' }).name).toBeTruthy()
    expect(bookingProblems({ ...ok, email: '' }).email).toMatch(/invite/)
    expect(bookingProblems({ ...ok, email: 'a b@example.com' }).email).toBeTruthy()
    expect(bookingProblems({ ...ok, name: 'Buy now at spam.com' }).name).toMatch(/no links/)
  })
})

describe('daysUntil', () => {
  test('counts calendar days in the visitor’s zone', () => {
    const now = ms('2026-10-12T18:00:00Z')
    expect(daysUntil(ms('2026-10-12T19:00:00Z'), 'Europe/Athens', now)).toBe(0)
    expect(daysUntil(ms('2026-10-13T07:00:00Z'), 'Europe/Athens', now)).toBe(1)
    expect(daysUntil(ms('2026-10-12T22:30:00Z'), 'Europe/Athens', now)).toBe(1)
    expect(daysUntil(ms('2026-10-12T22:30:00Z'), 'America/New_York', now)).toBe(0)
    expect(whenWord(ms('2026-10-13T07:00:00Z'), 'Europe/Athens', now)).toBe('Tomorrow')
    expect(whenWord(ms('2026-10-16T07:00:00Z'), 'Europe/Athens', now)).toBe('In 4 days')
    expect(dayPhrase(ms('2026-10-12T19:00:00Z'), 'Europe/Athens', now)).toBe('today')
    expect(dayPhrase(ms('2026-10-16T07:00:00Z'), 'Europe/Athens', now)).toBe('on Friday')
    expect(dayPhrase(ms('2026-10-27T07:00:00Z'), 'Europe/Athens', now)).toBe('on Tue 27 Oct')
    expect(fullShortDay(ms('2026-10-12T22:30:00Z'), 'Europe/Athens')).toBe('Tue 13 Oct')
    expect(daysUntil(ms('2026-10-16T07:00:00Z'), 'Europe/Athens', now)).toBe(4)
  })
})

describe('calendar exports', () => {
  const event = { start: ms('2026-10-21T08:00:00Z'), end: ms('2026-10-21T08:30:00Z'), title: 'Intro; call, with Blxr', notes: 'Line one\nLine two', location: '' }

  test('the ics carries the edits, escaped, with the chosen alert', () => {
    const ics = calendarIcs({ ...event, uid: 'abc@blxr.net', alert: 30, stamp: ms('2026-10-12T10:00:00Z') })
    expect(ics).toContain('UID:abc@blxr.net\r\n')
    expect(ics).toContain('DTSTAMP:20261012T100000Z\r\n')
    expect(ics).toContain('DTSTART:20261021T080000Z\r\nDTEND:20261021T083000Z\r\n')
    expect(ics).toContain('SUMMARY:Intro\\; call\\, with Blxr\r\n')
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two\r\n')
    expect(ics).toContain('TRIGGER:-PT30M\r\n')
    expect(ics).not.toContain('LOCATION')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  test('no alert means no alarm, and long lines fold under 75 octets', () => {
    const ics = calendarIcs({ ...event, uid: 'x', notes: 'ά'.repeat(120), alert: null })
    expect(ics).not.toContain('VALARM')
    const lines = ics.split('\r\n')
    expect(lines.every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true)
    expect(lines.some((line) => line.startsWith(' '))).toBe(true)
    expect(calendarIcs({ ...event, uid: 'x', alert: 0 })).toContain('TRIGGER:-PT0M')
  })

  test('the uid is read back from the server invite', () => {
    expect(icsUid('BEGIN:VEVENT\r\nUID:42-call@blxr.net\r\nEND:VEVENT')).toBe('42-call@blxr.net')
    expect(icsUid('')).toBe(null)
    expect(icsUid(undefined)).toBe(null)
  })

  test('web calendars get prefilled links', () => {
    const google = new URL(googleCalendarUrl(event))
    expect(google.searchParams.get('text')).toBe(event.title)
    expect(google.searchParams.get('dates')).toBe('20261021T080000Z/20261021T083000Z')
    expect(google.searchParams.get('details')).toBe('Line one\nLine two')
    expect(google.searchParams.has('location')).toBe(false)
    const outlook = new URL(outlookCalendarUrl({ ...event, location: 'https://facetime.apple.com/join' }))
    expect(outlook.searchParams.get('subject')).toBe(event.title)
    expect(outlook.searchParams.get('startdt')).toBe('2026-10-21T08:00:00.000Z')
    expect(outlook.searchParams.get('location')).toBe('https://facetime.apple.com/join')
  })

  test('file names follow the title', () => {
    expect(icsFileName('Call with Blxr')).toBe('call-with-blxr.ics')
    expect(icsFileName('  Café & logo chat!! ')).toBe('cafe-logo-chat.ics')
    expect(icsFileName('Κλήση')).toBe('call-with-blxr.ics')
    expect(ALERTS.find((a) => a.minutes === 10).label).toBe('10 min before')
  })
})

describe('emailTypo', () => {
  test('suggests the common provider a typo was aiming for', () => {
    expect(emailTypo('ada@gmial.com')).toBe('ada@gmail.com')
    expect(emailTypo('ada@gmail.con')).toBe('ada@gmail.com')
    expect(emailTypo(' ada@icloud.co ')).toBe('ada@icloud.com')
    expect(emailTypo('ada@hotmal.com')).toBe('ada@hotmail.com')
    expect(emailTypo('ada@gmail')).toBe('ada@gmail.com')
  })

  test('leaves real addresses alone', () => {
    expect(emailTypo('ada@gmail.com')).toBe(null)
    expect(emailTypo('ada@mail.com')).toBe(null)
    expect(emailTypo('ada@gmx.de')).toBe(null)
    expect(emailTypo('ada@studio.gr')).toBe(null)
    expect(emailTypo('ada@')).toBe(null)
    expect(emailTypo('nope')).toBe(null)
  })
})
