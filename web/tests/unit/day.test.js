import { describe, test, expect } from 'vitest'
import {
  DAY_MINUTES,
  EVERY_DAY,
  WEEKDAYS,
  WEEKENDS,
  KEEP_DAYS,
  todayIso,
  isDate,
  shiftDay,
  weekdayOf,
  weekOf,
  relativeDay,
  formatWeekday,
  clockOf,
  minutesOf,
  formatClock,
  formatRange,
  parseQuick,
  occursOn,
  planFor,
  toggleMark,
  repeatKind,
  repeatLabel,
  maskFor,
  formFrom,
  timesOf,
  problemsOf,
  blockFrom,
  fromRow,
  toRow,
} from '../../src/lib/day.js'

const item = (over = {}) => ({
  id: over.id || 'x',
  title: 'Physics ch. 4',
  note: '',
  start: null,
  end: null,
  day: '2026-10-22',
  repeat: 0,
  done: [],
  skipped: [],
  createdAt: '2026-10-22T08:00:00Z',
  ...over,
})

describe('dates', () => {
  test('todayIso uses the local calendar day', () => {
    expect(todayIso(new Date(2026, 9, 22, 23, 59))).toBe('2026-10-22')
    expect(todayIso(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
  })

  test('isDate accepts real days only', () => {
    expect(isDate('2026-10-22')).toBe(true)
    expect(isDate('2028-02-29')).toBe(true)
    expect(isDate('2026-02-29')).toBe(false)
    expect(isDate('2026-13-01')).toBe(false)
    expect(isDate('22-10-2026')).toBe(false)
    expect(isDate('')).toBe(false)
    expect(isDate(undefined)).toBe(false)
  })

  test('shiftDay crosses months, years and the DST change', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDay('2026-10-24', 1)).toBe('2026-10-25')
    expect(shiftDay('2026-10-25', 1)).toBe('2026-10-26')
  })

  test('weeks start on Monday', () => {
    expect(weekdayOf('2026-10-19')).toBe(0)
    expect(weekdayOf('2026-10-25')).toBe(6)
    expect(weekOf('2026-10-22')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
    expect(weekOf('2026-10-25')[0]).toBe('2026-10-19')
    expect(formatWeekday('2026-10-22')).toBe('Thursday')
  })

  test('relativeDay names the near days', () => {
    expect(relativeDay('2026-10-22', '2026-10-22')).toBe('Today')
    expect(relativeDay('2026-10-23', '2026-10-22')).toBe('Tomorrow')
    expect(relativeDay('2026-10-21', '2026-10-22')).toBe('Yesterday')
    expect(relativeDay('2026-10-25', '2026-10-22')).toBe('In 3 days')
    expect(relativeDay('2026-10-12', '2026-10-22')).toBe('10 days ago')
  })
})

describe('times', () => {
  test('clockOf and minutesOf round-trip, midnight at the end is 24:00', () => {
    expect(clockOf(570)).toBe('09:30')
    expect(clockOf(DAY_MINUTES)).toBe('24:00')
    expect(minutesOf('09:30:00')).toBe(570)
    expect(minutesOf('24:00:00')).toBe(DAY_MINUTES)
    expect(minutesOf('25:00')).toBe(null)
    expect(minutesOf('09:75')).toBe(null)
    expect(minutesOf(null)).toBe(null)
  })

  test('formatClock and formatRange', () => {
    expect(formatClock(570)).toBe('09:30')
    expect(formatClock(DAY_MINUTES)).toBe('00:00')
    expect(formatClock(570, true)).toBe('9:30 am')
    expect(formatClock(0, true)).toBe('12:00 am')
    expect(formatRange(1020, null)).toBe('17:00')
    expect(formatRange(1020, 1110)).toBe('17:00–18:30')
  })
})

describe('quick add', () => {
  test.each([
    ['17:00 Math', { title: 'Math', start: 1020, end: null }],
    ['7:30 Gym', { title: 'Gym', start: 450, end: null }],
    ['9-12 Deep work', { title: 'Deep work', start: 540, end: 720 }],
    ['14:00-15:30 Lab', { title: 'Lab', start: 840, end: 930 }],
    ['14.15–15 Call', { title: 'Call', start: 855, end: 900 }],
    ['9am Lecture', { title: 'Lecture', start: 540, end: null }],
    ['9-11am Focus', { title: 'Focus', start: 540, end: 660 }],
    ['11-1pm Lunch out', { title: 'Lunch out', start: 660, end: 780 }],
    ['23:00-00:00 Revise', { title: 'Revise', start: 1380, end: DAY_MINUTES }],
    ['10 to 11 Walk', { title: 'Walk', start: 600, end: 660 }],
    ['15-14 Oops', { title: 'Oops', start: 900, end: null }],
  ])('%j has a time', (text, expected) => {
    expect(parseQuick(text)).toEqual(expected)
  })

  test.each([
    'Physics ch. 4',
    '10 flashcards',
    '20 pages of history',
    '2024 past paper',
    '25:00 Nope',
    '9-26 Nope',
  ])('%j is for any time', (text) => {
    expect(parseQuick(text)).toEqual({ title: text, start: null, end: null })
  })

  test('extra spaces collapse and empty text adds nothing', () => {
    expect(parseQuick('  Read   a  chapter ')).toEqual({ title: 'Read a chapter', start: null, end: null })
    expect(parseQuick('   ')).toBe(null)
  })
})

describe('what is on a day', () => {
  const gym = item({ id: 'gym', title: 'Gym', day: '2026-10-19', repeat: 0b0010101 })

  test('a one-off lives on its own day only', () => {
    expect(occursOn(item(), '2026-10-22')).toBe(true)
    expect(occursOn(item(), '2026-10-23')).toBe(false)
  })

  test('a repeating item shows on its weekdays from its first day on', () => {
    expect(occursOn(gym, '2026-10-19')).toBe(true)
    expect(occursOn(gym, '2026-10-20')).toBe(false)
    expect(occursOn(gym, '2026-10-21')).toBe(true)
    expect(occursOn(gym, '2026-10-12')).toBe(false)
    expect(occursOn(gym, '2026-11-30')).toBe(true)
    expect(occursOn({ ...gym, skipped: ['2026-10-21'] }, '2026-10-21')).toBe(false)
  })

  test('any-time items come first in the order they were added, then timed ones by time', () => {
    const list = [
      item({ id: 'late', start: 1020 }),
      item({ id: 'second', createdAt: '2026-10-22T09:00:00Z' }),
      item({ id: 'early', start: 540, end: 600 }),
      item({ id: 'first', createdAt: '2026-10-21T09:00:00Z' }),
      item({ id: 'elsewhere', day: '2026-10-23' }),
    ]
    expect(planFor(list, '2026-10-22').map((b) => b.id)).toEqual(['first', 'second', 'early', 'late'])
  })
})

describe('marks', () => {
  test('toggleMark adds and removes a day, sorted', () => {
    expect(toggleMark([], '2026-10-22', true)).toEqual(['2026-10-22'])
    expect(toggleMark(['2026-10-23'], '2026-10-22', true)).toEqual(['2026-10-22', '2026-10-23'])
    expect(toggleMark(['2026-10-22'], '2026-10-22', false)).toEqual([])
    expect(toggleMark(['2026-10-22'], '2026-10-22', true)).toEqual(['2026-10-22'])
  })

  test('marks older than a year fall off', () => {
    const old = shiftDay('2026-10-22', -(KEEP_DAYS + 1))
    expect(toggleMark([old, '2026-10-01'], '2026-10-22', true, '2026-10-22')).toEqual(['2026-10-01', '2026-10-22'])
  })
})

describe('repeats', () => {
  test('kinds and labels', () => {
    expect(repeatKind(0)).toBe('once')
    expect(repeatKind(EVERY_DAY)).toBe('daily')
    expect(repeatKind(WEEKDAYS)).toBe('weekdays')
    expect(repeatKind(WEEKENDS)).toBe('custom')
    expect(repeatLabel(EVERY_DAY)).toBe('Every day')
    expect(repeatLabel(WEEKDAYS)).toBe('Weekdays')
    expect(repeatLabel(WEEKENDS)).toBe('Weekends')
    expect(repeatLabel(0b0010101)).toBe('Mon, Wed, Fri')
  })

  test('maskFor', () => {
    expect(maskFor('once', 5)).toBe(0)
    expect(maskFor('daily', 0)).toBe(EVERY_DAY)
    expect(maskFor('weekdays', 0)).toBe(WEEKDAYS)
    expect(maskFor('custom', 0b0010101)).toBe(0b0010101)
    expect(maskFor('custom', 0)).toBe(0)
  })
})

describe('the editor form', () => {
  test('an any-time item opens with a sensible time ready if you switch one on', () => {
    expect(formFrom(item())).toEqual({ title: 'Physics ch. 4', note: '', timed: false, start: '09:00', end: '', repeat: 'once', days: 1 << 3 })
    expect(timesOf(formFrom(item()))).toEqual({ start: null, end: null })
  })

  test('problems', () => {
    const ok = formFrom(item())
    expect(problemsOf(ok)).toEqual({})
    expect(problemsOf({ ...ok, title: '  ' }).title).toBeTruthy()
    expect(problemsOf({ ...ok, timed: true, start: '' }).time).toBeTruthy()
    expect(problemsOf({ ...ok, timed: true, start: '10:00', end: '09:00' }).time).toBeTruthy()
    expect(problemsOf({ ...ok, timed: true, start: '10:00', end: '' })).toEqual({})
    expect(problemsOf({ ...ok, timed: true, start: '23:00', end: '00:00' })).toEqual({})
    expect(problemsOf({ ...ok, timed: false, start: '', end: '' })).toEqual({})
    expect(problemsOf({ ...ok, repeat: 'custom', days: 0 }).days).toBeTruthy()
  })

  test('setting and clearing a time', () => {
    const base = item({ id: 'p' })
    const timed = blockFrom('p', { ...formFrom(base), timed: true, start: '17:00', end: '' }, { day: '2026-10-22', base })
    expect(timed).toMatchObject({ start: 1020, end: null })
    const cleared = blockFrom('p', { ...formFrom(timed), timed: false }, { day: '2026-10-22', base: timed })
    expect(cleared).toMatchObject({ start: null, end: null })
  })

  test('making an item repeat keeps its first day and marks', () => {
    const base = item({ id: 'p', done: ['2026-10-22'] })
    const next = blockFrom('p', { ...formFrom(base), repeat: 'custom', days: 0b0001010 }, { day: '2026-10-22', base })
    expect(next).toMatchObject({ day: '2026-10-22', repeat: 0b0001010, done: ['2026-10-22'], skipped: [], createdAt: base.createdAt })
  })

  test('an edited routine keeps its first day and skips', () => {
    const base = item({ id: 'r', day: '2026-10-01', repeat: WEEKDAYS, done: ['2026-10-20'], skipped: ['2026-10-21'] })
    const next = blockFrom('r', { ...formFrom(base), title: 'Physics ch. 5' }, { day: '2026-10-22', base })
    expect(next).toMatchObject({ title: 'Physics ch. 5', day: '2026-10-01', repeat: WEEKDAYS, done: ['2026-10-20'], skipped: ['2026-10-21'] })
  })

  test('turning a routine into a one-off pins it to the viewed day', () => {
    const base = item({ id: 'r', day: '2026-10-01', repeat: WEEKDAYS, done: ['2026-10-20', '2026-10-22'], skipped: ['2026-10-21'] })
    const next = blockFrom('r', { ...formFrom(base), repeat: 'once' }, { day: '2026-10-22', base })
    expect(next).toMatchObject({ day: '2026-10-22', repeat: 0, done: ['2026-10-22'], skipped: [] })
  })

  test('an end of midnight is stored as 24:00', () => {
    const made = blockFrom('n', { ...formFrom(item()), timed: true, start: '23:00', end: '00:00' }, { day: '2026-10-22' })
    expect(made.end).toBe(DAY_MINUTES)
    expect(toRow(made).ends).toBe('24:00')
    expect(formFrom(made).end).toBe('00:00')
  })
})

describe('rows', () => {
  test('a timed row round-trips', () => {
    const row = { id: 'x', title: 'Math', note: null, starts: '17:00:00', ends: '18:30:00', day: '2026-10-19', repeat: 21, done: ['2026-10-19'], skipped: null, created_at: '2026-10-19T08:00:00Z' }
    const read = fromRow(row)
    expect(read).toEqual({ id: 'x', title: 'Math', note: '', start: 1020, end: 1110, day: '2026-10-19', repeat: 21, done: ['2026-10-19'], skipped: [], createdAt: '2026-10-19T08:00:00Z' })
    expect(toRow(read)).toEqual({ id: 'x', title: 'Math', note: '', starts: '17:00', ends: '18:30', day: '2026-10-19', repeat: 21, done: ['2026-10-19'], skipped: [] })
  })

  test('an any-time row has no times either way', () => {
    const read = fromRow({ id: 'y', title: 'Flashcards', note: '', starts: null, ends: null, day: '2026-10-22', repeat: 0, done: [], skipped: [] })
    expect(read).toMatchObject({ start: null, end: null, createdAt: null })
    expect(toRow(read)).toMatchObject({ starts: null, ends: null })
    expect(fromRow(null)).toBe(null)
  })
})
