import { describe, test, expect } from 'vitest'
import {
  cleanStatus,
  overallOf,
  dayTone,
  formatUptime,
  describeCode,
  formatSpan,
  formatMs,
  dayLabel,
  describeDay,
  stripSummary,
} from '../../src/lib/status.js'

const service = (id, state) => ({ id, name: id, state })
const day = (date, checks, up, ms = null) => ({ day: date, checks, up, ms })

describe('cleanStatus', () => {
  test('keeps a well-formed response as is', () => {
    const raw = {
      checkedAt: '2026-10-16T12:00:00.000Z',
      every: 300,
      services: [{ id: 'website', name: 'Website', host: 'blxr.net', link: 'https://blxr.net', state: 'up', since: '2026-10-01T00:00:00.000Z', ms: 120, code: null, uptime: 1, avgMs: 130, days: [day('2026-10-16', 10, 10, 120)] }],
      incidents: [{ service: 'website', name: 'Website', start: '2026-10-02T00:00:00.000Z', end: '2026-10-02T00:10:00.000Z', code: 'http_530' }],
    }
    expect(cleanStatus(raw)).toEqual(raw)
  })

  test('drops junk instead of throwing', () => {
    const clean = cleanStatus({
      checkedAt: 'yesterday',
      every: -5,
      services: [null, { id: 1 }, { id: 'x', name: 'X', state: 'weird', link: 'javascript:alert(1)', days: [{ day: 'nope' }, day('2026-10-16', 2, 9)] }],
      incidents: [{ service: 'x', start: 'never' }],
    })
    expect(clean.checkedAt).toBe(null)
    expect(clean.every).toBe(300)
    expect(clean.services).toHaveLength(1)
    expect(clean.services[0].state).toBe('unknown')
    expect(clean.services[0].link).toBe(null)
    expect(clean.services[0].days).toEqual([day('2026-10-16', 2, 2)])
    expect(clean.incidents).toEqual([])
    expect(cleanStatus(null).services).toEqual([])
  })
})

describe('overallOf', () => {
  test.each([
    [[], 'unknown', 'Checking…'],
    [[service('a', 'unknown')], 'unknown', 'Checking…'],
    [[service('a', 'up'), service('b', 'up')], 'up', 'All systems operational'],
    [[service('a', 'up'), service('b', 'down')], 'partial', 'b is down'],
    [[service('a', 'up'), service('b', 'down'), service('c', 'down')], 'partial', '2 services are down'],
    [[service('a', 'down'), service('b', 'unknown')], 'down', 'Everything is down'],
  ])('%#', (services, tone, label) => {
    expect(overallOf(services)).toEqual({ tone, label })
  })
})

describe('days', () => {
  test('tone by share of passing checks', () => {
    expect(dayTone(day('2026-10-16', 0, 0))).toBe('none')
    expect(dayTone(day('2026-10-16', 288, 288))).toBe('up')
    expect(dayTone(day('2026-10-16', 288, 287))).toBe('partial')
    expect(dayTone(day('2026-10-16', 100, 94))).toBe('down')
  })

  test('readout for one day', () => {
    expect(describeDay(day('2026-10-16', 0, 0), 300)).toBe('No data')
    expect(describeDay(day('2026-10-16', 288, 288, 142), 300)).toBe('100% up · 142 ms avg')
    expect(describeDay(day('2026-10-16', 288, 286, 142), 300)).toBe('99.30% up · about 10 min down')
  })

  test('labels are in UTC', () => {
    expect(dayLabel('2026-10-16')).toBe('Oct 16')
    expect(dayLabel('2026-10-16', 'long')).toBe('October 16, 2026')
  })

  test('summary for screen readers names the rough days', () => {
    expect(stripSummary([day('2026-10-15', 0, 0), day('2026-10-16', 0, 0)])).toBe('No checks in the last 2 days yet.')
    expect(stripSummary([day('2026-10-15', 10, 10), day('2026-10-16', 10, 10)])).toBe('100% up over 2 days. No downtime.')
    expect(stripSummary([day('2026-10-15', 10, 5), day('2026-10-16', 10, 10)])).toBe('75.00% up over 2 days. One day with downtime: Oct 15 (50.00%).')
  })
})

describe('formatting', () => {
  test('uptime never rounds up to 100%', () => {
    expect(formatUptime(1)).toBe('100%')
    expect(formatUptime(0.99999)).toBe('99.99%')
    expect(formatUptime(0.5)).toBe('50.00%')
    expect(formatUptime(null)).toBe('—')
  })

  test('codes read as words', () => {
    expect(describeCode('timeout')).toBe('Timed out')
    expect(describeCode('unreachable')).toBe('Could not connect')
    expect(describeCode('http_530')).toBe('HTTP 530')
    expect(describeCode(null)).toBe('')
  })

  test('durations', () => {
    expect(formatSpan(30_000)).toBe('under a minute')
    expect(formatSpan(12 * 60_000)).toBe('12 min')
    expect(formatSpan(60 * 60_000)).toBe('1 h')
    expect(formatSpan(125 * 60_000)).toBe('2 h 5 min')
    expect(formatSpan(50 * 3_600_000)).toBe('2 d 2 h')
    expect(formatSpan(NaN)).toBe('under a minute')
  })

  test('response times', () => {
    expect(formatMs(142.4)).toBe('142 ms')
    expect(formatMs(1534)).toBe('1.53 s')
    expect(formatMs(null)).toBe('—')
  })
})
