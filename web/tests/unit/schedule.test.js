import { describe, test, expect } from 'vitest'
import {
  occursOn,
  isOver,
  repeatLabel,
  minuteLabel,
  rangeLabel,
  blockWhen,
  timeOptions,
  minutesIn,
  freeMinutes,
  overlaps,
  clashingRanges,
  shiftDay,
  daysBetween,
  weekdayOf,
  weekdayName,
  dayLabel,
  newBlockId,
} from '../../src/lib/schedule'

const block = (over = {}) => ({ id: 'abc123', date: '2026-10-14', start: 840, end: 900, repeat: 'none', until: null, except: [], label: '', ...over })
const daysOf = (b, from = '2026-10-12', count = 92) => Array.from({ length: count }, (_, i) => shiftDay(from, i)).filter((key) => occursOn(b, key))

describe('repeats', () => {
  test('match the server: each repeat lands on the same days', () => {
    expect(daysOf(block())).toEqual(['2026-10-14'])
    expect(daysOf(block({ repeat: 'daily', until: '2026-10-16' }))).toEqual(['2026-10-14', '2026-10-15', '2026-10-16'])
    expect(daysOf(block({ repeat: 'weekdays', until: '2026-10-20' }))).toEqual(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20'])
    expect(daysOf(block({ repeat: 'weekly', until: '2026-11-04' }))).toEqual(['2026-10-14', '2026-10-21', '2026-10-28', '2026-11-04'])
    expect(daysOf(block({ repeat: 'biweekly', until: '2026-11-25' }))).toEqual(['2026-10-14', '2026-10-28', '2026-11-11', '2026-11-25'])
    expect(daysOf(block({ repeat: 'monthly', date: '2026-10-31' }))).toEqual(['2026-10-31', '2026-12-31'])
    expect(daysOf(block({ repeat: 'weekly', until: '2026-11-04', except: ['2026-10-21', '2026-10-28'] }))).toEqual(['2026-10-14', '2026-11-04'])
  })

  test('a block is over once its last day has passed', () => {
    expect(isOver(block(), '2026-10-14')).toBe(false)
    expect(isOver(block(), '2026-10-15')).toBe(true)
    expect(isOver(block({ repeat: 'weekly' }), '2030-01-01')).toBe(false)
    expect(isOver(block({ repeat: 'daily', until: '2026-10-20' }), '2026-10-21')).toBe(true)
  })

  test('are named after the day they start on', () => {
    expect(['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly'].map((r) => repeatLabel(r, '2026-10-14'))).toEqual([
      'Never',
      'Every day',
      'Every weekday',
      'Every Wednesday',
      'Every other Wednesday',
      'Monthly on the 14th',
    ])
    expect(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-11', '2026-10-12', '2026-10-21', '2026-10-22', '2026-10-23'].map((d) => repeatLabel('monthly', d).split(' ').pop())).toEqual([
      '1st',
      '2nd',
      '3rd',
      '11th',
      '12th',
      '21st',
      '22nd',
      '23rd',
    ])
  })
})

describe('labels', () => {
  test('minutes of the day read as clock times, midnight at the end included', () => {
    expect(minuteLabel(570)).toBe('09:30')
    expect(minuteLabel(1440)).toBe('24:00')
    expect(minuteLabel(810, true)).toMatch(/^1:30\s?pm$/i)
    expect(rangeLabel(null, null)).toBe('All day')
    expect(rangeLabel(600, 690)).toBe('10:00 – 11:30')
  })

  test('blocks describe when they happen', () => {
    expect(blockWhen(block())).toBe('Wed 14 Oct · 14:00 – 15:00')
    expect(blockWhen(block({ start: null, end: null, repeat: 'daily', until: '2026-10-20' }))).toBe('14 Oct – 20 Oct · All day')
    expect(blockWhen(block({ repeat: 'weekly' }))).toBe('Every Wednesday · 14:00 – 15:00')
    expect(blockWhen(block({ repeat: 'weekly', until: '2026-12-01' }))).toBe('Every Wednesday · 14:00 – 15:00 · until 1 Dec')
  })

  test('days, weekdays and distances', () => {
    expect(weekdayOf('2026-10-18')).toBe(0)
    expect(weekdayName(1)).toBe('Monday')
    expect(dayLabel('2026-10-14')).toBe('Wed 14 Oct')
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01')
    expect(daysBetween('2026-10-14', '2026-10-25')).toBe(11)
    expect(daysBetween('2026-10-14', '2026-10-13')).toBe(-1)
  })
})

describe('time maths', () => {
  test('time options step by 15 minutes', () => {
    const list = timeOptions(600, 660)
    expect(list).toEqual([600, 615, 630, 645, 660])
    expect(timeOptions().length).toBe(97)
  })

  test('minutesIn reads the wall clock in the zone', () => {
    expect(minutesIn(Date.parse('2026-10-14T11:15:00Z'), 'Europe/Athens')).toBe(14 * 60 + 15)
    expect(minutesIn(Date.parse('2026-10-14T11:15:00Z'), 'UTC')).toBe(11 * 60 + 15)
  })

  test('freeMinutes subtracts blocks from the open hours', () => {
    const windows = [
      { start: 600, end: 780 },
      { start: 840, end: 1080 },
    ]
    expect(freeMinutes(windows, [])).toBe(420)
    expect(freeMinutes(windows, [block({ start: 720, end: 900 })])).toBe(300)
    expect(freeMinutes(windows, [block({ start: 600, end: 700 }), block({ start: 650, end: 780 })])).toBe(240)
    expect(freeMinutes(windows, [block({ start: null, end: null })])).toBe(0)
  })

  test('overlaps and clashing ranges', () => {
    expect(overlaps(block(), 870, 900)).toBe(true)
    expect(overlaps(block(), 900, 930)).toBe(false)
    expect(overlaps(block({ start: null, end: null }), 0, 30)).toBe(true)
    expect([
      ...clashingRanges([
        { start: 600, end: 720 },
        { start: 700, end: 800 },
        { start: 900, end: 960 },
      ]),
    ]).toEqual([0, 1])
  })

  test('new block ids are what the server accepts', () => {
    const ids = new Set(Array.from({ length: 50 }, newBlockId))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]{6,24}$/)
  })
})
