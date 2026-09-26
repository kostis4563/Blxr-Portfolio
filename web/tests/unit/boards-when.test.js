import { describe, test, expect } from 'vitest'
import { parseWhen, WHEN_EXAMPLES, addMonths, gapWords, dayWords, monthGrid, startOfDay, relativeChoices } from '../../src/lib/boards-when.js'

const NOW = new Date(2026, 8, 23, 10, 0).getTime()
const at = (y, m, d, h = 18, min = 0) => new Date(y, m - 1, d, h, min).getTime()
const when = (text, now = NOW) => parseWhen(text, now)

test('runs in Europe/Athens (the DST cases below depend on it)', () => {
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Athens')
})

describe('parseWhen', () => {
  test.each(WHEN_EXAMPLES)('the placeholder example "%s" parses', (text) => {
    expect(when(text)).not.toBeNull()
  })

  test.each([
    ['tomorrow 6pm', at(2026, 9, 24, 18), 'day'],
    ['tomorrow', at(2026, 9, 24, 18), 'day'],
    ['tmrw 9am', at(2026, 9, 24, 9), 'day'],
    ['today 3:30pm', at(2026, 9, 23, 15, 30), 'day'],
    ['tonight', at(2026, 9, 23, 20), 'day'],
    ['friday 09:00', at(2026, 9, 25, 9), 'day'],
    ['fri', at(2026, 9, 25, 18), 'day'],
    ['wednesday', at(2026, 9, 23, 18), 'day'],
    ['next wednesday', at(2026, 9, 30, 18), 'day'],
    ['next friday', at(2026, 10, 2, 18), 'day'],
    ['this weekend', at(2026, 9, 26, 18), 'day'],
    ['eow', at(2026, 9, 25, 18), 'day'],
    ['next week', at(2026, 9, 30, 18), 'day'],
    ['next month', at(2026, 10, 23, 18), 'day'],
    ['30 sep', at(2026, 9, 30, 18), 'date'],
    ['sep 30th', at(2026, 9, 30, 18), 'date'],
    ['3 sep', at(2027, 9, 3, 18), 'date'],
    ['may 5', at(2027, 5, 5, 18), 'date'],
    ['25 dec 2030 noon', at(2030, 12, 25, 12), 'date'],
    ['2026-12-25', at(2026, 12, 25, 18), 'date'],
    ['25/12', at(2026, 12, 25, 18), 'date'],
    ['25/12/27 8am', at(2027, 12, 25, 8), 'date'],
    ['12pm', at(2026, 9, 23, 12), 'time'],
    ['12am', at(2026, 9, 24, 0), 'time'],
    ['9am', at(2026, 9, 24, 9), 'time'],
    ['1300', at(2026, 9, 23, 13), 'time'],
    ['90m', at(2026, 9, 23, 11, 30), 'gap'],
    ['in 2 days', at(2026, 9, 25, 10), 'gap'],
    ['in 1.5 hours', at(2026, 9, 23, 11, 30), 'gap'],
    ['half an hour', at(2026, 9, 23, 10, 30), 'gap'],
    ['in an hour', at(2026, 9, 23, 11), 'gap'],
    ['a fortnight', at(2026, 10, 7, 10), 'gap'],
    ['in 2 months', at(2026, 11, 23, 10), 'gap'],
    ['in 3 days at 9am', at(2026, 9, 26, 9), 'gap'],
    ['due tomorrow at noon', at(2026, 9, 24, 12), 'day'],
  ])('"%s"', (text, expected, kind) => {
    const result = when(text)
    expect(result, text).not.toBeNull()
    expect(new Date(result.at).toString()).toBe(new Date(expected).toString())
    expect(result.kind).toBe(kind)
  })

  test.each([
    '', '   ', 'banana', 'tomorrow banana', '25:00', '13pm', '9', 'mar', 'may',
    '31 sep', '29 feb', '10:75', 'next', 'in days',
  ])('rejects "%s"', (text) => {
    expect(when(text)).toBeNull()
  })

  test('a custom fallback time applies when only a day is given', () => {
    expect(parseWhen('friday', NOW, { hour: 9, minute: 15 }).at).toBe(at(2026, 9, 25, 9, 15))
  })

  test('"mon" is Monday, not a month', () => {
    expect(when('mon').at).toBe(at(2026, 9, 28, 18))
  })

  test.fails('"next weekend" parses to the Saturday after this one', () => {
    expect(when('next weekend')?.at).toBe(at(2026, 10, 3, 18))
  })
})

describe('parseWhen across daylight-saving time', () => {
  test.fails('BUG: "tomorrow", said on the fall-back day, is the next day', () => {
    const sunday = new Date(2026, 9, 25, 10, 0).getTime()
    expect(new Date(when('tomorrow', sunday).at).getDate()).toBe(26)
  })

  test.fails('BUG: "monday", said the Friday before fall-back, is Monday', () => {
    const friday = new Date(2026, 9, 23, 10, 0).getTime()
    expect(new Date(when('monday', friday).at).getDay()).toBe(1)
  })

  test.fails('BUG: "next week", said the Saturday before fall-back, is a week later', () => {
    const saturday = new Date(2026, 9, 24, 10, 0).getTime()
    expect(new Date(when('next week', saturday).at).getDate()).toBe(31)
  })

  test('spring-forward (29 March 2026) weekday maths is still right', () => {
    const friday = new Date(2026, 2, 27, 10, 0).getTime()
    expect(new Date(when('monday', friday).at).getDate()).toBe(30)
    expect(new Date(when('tomorrow', friday).at).getDate()).toBe(28)
  })
})

describe('date helpers', () => {
  test('addMonths clamps to the last day of shorter months', () => {
    expect(new Date(addMonths(at(2026, 1, 31), 1)).getDate()).toBe(28)
    expect(new Date(addMonths(at(2028, 1, 31), 1)).getDate()).toBe(29)
    expect(new Date(addMonths(at(2026, 12, 15), 2)).getMonth()).toBe(1)
    expect(new Date(addMonths(at(2026, 3, 31), -1)).getDate()).toBe(28)
  })

  test('startOfDay is local midnight', () => {
    const d = new Date(startOfDay(NOW))
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getDate()]).toEqual([0, 0, 0, 23])
  })

  test.each([
    [10_000, 'in under a minute'],
    [-10_000, 'just now'],
    [5 * 60_000, 'in 5 minutes'],
    [-60_000, '1 minute ago'],
    [90 * 60_000, 'in 1 hour 30 minutes'],
    [2 * 3600_000, 'in 2 hours'],
    [30 * 3600_000, 'in 30 hours'],
    [3 * 86400_000, 'in 3 days'],
    [-90 * 86400_000, '3 months ago'],
  ])('gapWords(%i ms) → %s', (delta, expected) => {
    expect(gapWords(NOW + delta, NOW)).toBe(expected)
  })

  test('dayWords names nearby days', () => {
    expect(dayWords(NOW, NOW)).toBe('Today')
    expect(dayWords(NOW + 86400_000, NOW)).toBe('Tomorrow')
    expect(dayWords(NOW - 86400_000, NOW)).toBe('Yesterday')
    expect(dayWords(NOW + 3 * 86400_000, NOW)).toMatch(/Saturday/)
    expect(dayWords('nope', NOW)).toBe('')
  })

  test('monthGrid is six Monday-first weeks covering the month', () => {
    const grid = monthGrid(2026, 8)
    expect(grid).toHaveLength(42)
    expect(new Date(grid[0].at).getDay()).toBe(1)
    expect(grid.filter((c) => c.inside).map((c) => c.day)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
  })

  test('relativeChoices only offers future moments', () => {
    const late = new Date(2026, 8, 30, 21, 0).getTime()
    const labels = relativeChoices(late).map((c) => c.label)
    expect(labels).not.toContain('Tonight')
    expect(labels).not.toContain('Month end')
    for (const c of relativeChoices(NOW)) expect(c.at).toBeGreaterThan(NOW)
  })
})
