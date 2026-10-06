import { describe, test, expect } from 'vitest'
import {
  formatRange,
  daysIn,
  formatHours,
  totalsOf,
  eventsByYear,
  parseTags,
  problemsOf,
  blankForm,
  formFrom,
  eventFrom,
  toRow,
  fromRow,
  PHOTO_RE,
} from '../../src/lib/volunteer.js'

const event = (over = {}) => ({
  id: '00000000-0000-4000-8000-000000000000',
  title: 'Beach clean-up',
  organization: 'Sea Watch',
  role: 'Volunteer',
  location: 'Athens',
  startedOn: '2026-05-10',
  endedOn: null,
  hours: 4,
  summary: '',
  url: null,
  tags: [],
  photos: [],
  published: true,
  ...over,
})

describe('dates', () => {
  test.each([
    ['2026-05-10', null, 'May 10, 2026'],
    ['2026-05-10', '2026-05-10', 'May 10, 2026'],
    ['2026-05-10', '2026-05-12', 'May 10 to 12, 2026'],
    ['2026-05-30', '2026-06-02', 'May 30 to Jun 2, 2026'],
    ['2025-12-30', '2026-01-02', 'Dec 30, 2025 to Jan 2, 2026'],
  ])('%s → %s', (start, end, text) => {
    expect(formatRange(start, end)).toBe(text)
  })

  test('days count both ends', () => {
    expect(daysIn('2026-05-10', null)).toBe(1)
    expect(daysIn('2026-05-10', '2026-05-12')).toBe(3)
  })
})

describe('totals and grouping', () => {
  test('hours and organizations add up, empty orgs ignored, case-insensitive', () => {
    const totals = totalsOf([
      event({ hours: 4 }),
      event({ id: 'b', organization: 'sea watch ', hours: 2.5 }),
      event({ id: 'c', organization: '', hours: null, startedOn: '2025-01-01', endedOn: '2025-01-03' }),
    ])
    expect(totals).toEqual({ events: 3, hours: 6.5, organizations: 1, days: 5 })
    expect(formatHours(totals.hours)).toBe('6.5 h')
    expect(formatHours(4)).toBe('4 h')
  })

  test('newest year first, newest event first inside a year', () => {
    const groups = eventsByYear([
      event({ id: 'a', startedOn: '2025-03-01' }),
      event({ id: 'b', startedOn: '2026-01-01' }),
      event({ id: 'c', startedOn: '2026-06-01' }),
    ])
    expect(groups.map((g) => [g.year, g.events.map((e) => e.id)])).toEqual([
      ['2026', ['c', 'b']],
      ['2025', ['a']],
    ])
  })
})

describe('form', () => {
  test('tags are trimmed, lowercased and deduped', () => {
    expect(parseTags(' Kids, environment ,kids,, ')).toEqual(['kids', 'environment'])
  })

  test('a blank form only needs a title', () => {
    const form = blankForm('2026-10-06')
    expect(problemsOf(form)).toEqual({ title: expect.any(String) })
    expect(problemsOf({ ...form, title: 'Food drive' })).toEqual({})
  })

  test('rejects backwards dates, bad hours, bad links and too many tags', () => {
    const form = { ...blankForm('2026-10-06'), title: 'x', endedOn: '2026-10-01', hours: '-2', url: 'javascript:alert(1)', tags: 'a,b,c,d,e,f,g' }
    expect(Object.keys(problemsOf(form)).sort()).toEqual(['endedOn', 'hours', 'tags', 'url'])
  })

  test('form → event → row → event round-trips', () => {
    const original = event({ hours: 3.5, tags: ['kids'], url: 'https://example.org', photos: ['00000000-0000-4000-8000-000000000000/a-1f2e3d.webp'] })
    const back = eventFrom(original.id, formFrom(original), original.photos)
    const row = toRow(back)
    expect(row.started_on).toBe('2026-05-10')
    expect(row.ended_on).toBeNull()
    expect(fromRow({ ...row, updated_at: null })).toEqual({ ...original, updatedAt: null })
  })

  test('photo paths match what the database accepts', () => {
    expect(PHOTO_RE.test('00000000-0000-4000-8000-000000000000/beach-day-1f2e3d.webp')).toBe(true)
    expect(PHOTO_RE.test('../etc/passwd.webp')).toBe(false)
  })
})
