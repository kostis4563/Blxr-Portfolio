import { describe, test, expect } from 'vitest'
import {
  GOALS,
  AREAS,
  STATUSES,
  ROADMAP_UPDATED,
  isMonth,
  monthKey,
  monthLabel,
  monthsBetween,
  spanOf,
  dueOf,
  sortGoals,
  groupByYear,
  statusCounts,
  nextUp,
  todayBefore,
} from '../../src/lib/roadmap.js'

const goal = (id, by, status = 'planned', extra = {}) => ({ id, title: id, area: 'code', by, status, ...extra })

describe('roadmap content', () => {
  test('ids are unique and URL-safe', () => {
    const ids = GOALS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  test('every goal has a target month, a known area and a known status', () => {
    const areas = new Set(AREAS.map((a) => a.id))
    const statuses = new Set(STATUSES.map((s) => s.id))
    for (const g of GOALS) {
      expect(g.title, g.id).toBeTruthy()
      expect(isMonth(g.by), `${g.id}.by is not YYYY-MM`).toBe(true)
      expect(areas.has(g.area), `${g.id}.area`).toBe(true)
      expect(statuses.has(g.status), `${g.id}.status`).toBe(true)
    }
  })

  test('a start month, when there is one, is a month no later than the deadline', () => {
    for (const g of GOALS.filter((g) => g.from !== undefined)) {
      expect(isMonth(g.from), `${g.id}.from is not YYYY-MM`).toBe(true)
      expect(g.from <= g.by, `${g.id} starts after its deadline`).toBe(true)
    }
  })

  test('only done goals have doneAt, and it is a month', () => {
    for (const g of GOALS) {
      if (g.status === 'done') expect(g.doneAt === undefined || isMonth(g.doneAt), g.id).toBe(true)
      else expect(g.doneAt, g.id).toBeUndefined()
    }
  })

  test('the updated date is a real date', () => {
    expect(ROADMAP_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isNaN(Date.parse(ROADMAP_UPDATED))).toBe(false)
  })
})

describe('months', () => {
  test('isMonth accepts YYYY-MM only', () => {
    expect(isMonth('2027-05')).toBe(true)
    expect(isMonth('2027-13')).toBe(false)
    expect(isMonth('2027-5')).toBe(false)
    expect(isMonth('2027-05-01')).toBe(false)
    expect(isMonth(null)).toBe(false)
  })

  test('monthKey uses the local calendar month', () => {
    expect(monthKey(new Date(2026, 9, 22, 12).getTime())).toBe('2026-10')
    expect(monthKey(new Date(2027, 0, 1).getTime())).toBe('2027-01')
  })

  test('monthLabel', () => {
    expect(monthLabel('2028-05')).toBe('May 2028')
    expect(monthLabel('2026-12', { short: true })).toBe('Dec 2026')
  })

  test('monthsBetween crosses years and goes negative', () => {
    expect(monthsBetween('2026-10', '2026-12')).toBe(2)
    expect(monthsBetween('2026-10', '2028-05')).toBe(19)
    expect(monthsBetween('2026-10', '2026-08')).toBe(-2)
  })

  test('spanOf', () => {
    expect(spanOf(1)).toBe('1 month')
    expect(spanOf(7)).toBe('7 months')
    expect(spanOf(12)).toBe('1 year')
    expect(spanOf(19)).toBe('1 year, 7 months')
    expect(spanOf(25)).toBe('2 years, 1 month')
  })
})

describe('dueOf', () => {
  test('open goals count down to their month', () => {
    expect(dueOf(goal('a', '2026-10'), '2026-10')).toEqual({ text: 'Due this month', late: false })
    expect(dueOf(goal('a', '2026-11'), '2026-10')).toEqual({ text: 'Due next month', late: false })
    expect(dueOf(goal('a', '2027-06'), '2026-10')).toEqual({ text: 'In 8 months', late: false })
  })

  test('a focus that has not started counts down to its start, then to its deadline', () => {
    const js = goal('js', '2027-02', 'planned', { from: '2026-12' })
    expect(dueOf(js, '2026-10')).toEqual({ text: 'Starts in 2 months', late: false })
    expect(dueOf(js, '2026-11')).toEqual({ text: 'Starts next month', late: false })
    expect(dueOf(js, '2026-12')).toEqual({ text: 'In 2 months', late: false })
    expect(dueOf(js, '2027-03')).toEqual({ text: '1 month late', late: true })
  })

  test('open goals past their month are late', () => {
    expect(dueOf(goal('a', '2026-08', 'active'), '2026-10')).toEqual({ text: '2 months late', late: true })
  })

  test('done goals say how they landed, never late', () => {
    expect(dueOf(goal('a', '2026-10', 'done'), '2027-01')).toEqual({ text: 'Done', late: false })
    expect(dueOf(goal('a', '2026-10', 'done', { doneAt: '2026-09' }), '2027-01')).toEqual({ text: 'Done on time', late: false })
    expect(dueOf(goal('a', '2026-10', 'done', { doneAt: '2026-12' }), '2027-01')).toEqual({ text: 'Done 2 months late', late: false })
  })
})

describe('grouping', () => {
  const goals = [goal('c', '2028-05'), goal('a', '2026-12', 'active'), goal('d', '2027-06'), goal('b', '2026-10', 'done'), goal('e', '2027-06')]

  test('sortGoals orders by month and keeps file order within a month', () => {
    expect(sortGoals(goals).map((g) => g.id)).toEqual(['b', 'a', 'd', 'e', 'c'])
    expect(goals.map((g) => g.id)).toEqual(['c', 'a', 'd', 'b', 'e'])
  })

  test('groupByYear', () => {
    expect(groupByYear(goals).map((y) => [y.year, y.goals.map((g) => g.id)])).toEqual([
      ['2026', ['b', 'a']],
      ['2027', ['d', 'e']],
      ['2028', ['c']],
    ])
    expect(groupByYear([])).toEqual([])
  })

  test('a focus that spans a new year sorts and groups by when it starts', () => {
    const spans = [goal('apply', '2028-01', 'planned', { from: '2027-10' }), goal('cert', '2027-12'), goal('js', '2027-02', 'planned', { from: '2026-12' })]
    expect(sortGoals(spans).map((g) => g.id)).toEqual(['js', 'apply', 'cert'])
    expect(groupByYear(spans).map((y) => [y.year, y.goals.map((g) => g.id)])).toEqual([
      ['2026', ['js']],
      ['2027', ['apply', 'cert']],
    ])
  })

  test('statusCounts counts late open goals separately', () => {
    expect(statusCounts(goals, '2027-01')).toEqual({ done: 1, active: 1, planned: 3, late: 1 })
    expect(statusCounts(goals, '2026-10')).toEqual({ done: 1, active: 1, planned: 3, late: 0 })
  })

  test('nextUp is the nearest open goal not yet late, else the oldest open one', () => {
    expect(nextUp(goals, '2026-10').id).toBe('a')
    expect(nextUp(goals, '2027-01').id).toBe('d')
    expect(nextUp(goals, '2029-01').id).toBe('a')
    expect(nextUp([goal('b', '2026-10', 'done')], '2026-10')).toBeNull()
  })

  test('todayBefore places the marker before the first goal due this month or later', () => {
    expect(todayBefore(goals, '2026-10')).toBe('b')
    expect(todayBefore(goals, '2026-11')).toBe('a')
    expect(todayBefore(goals, '2027-07')).toBe('c')
    expect(todayBefore(goals, '2029-01')).toBeNull()
  })
})
