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
