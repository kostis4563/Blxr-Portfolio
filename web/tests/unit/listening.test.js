import { describe, test, expect } from 'vitest'
import {
  MAX_SAMPLE_AGE_MS,
  TRACK_END_GRACE_MS,
  artistLine,
  formatDuration,
  sampleNow,
  progressAt,
  trackEnded,
  nowStatus,
  dayLabel,
  clockTime,
  groupByDay,
  listeningStats,
  onRepeat,
  playsOn,
  hourly,
  albumsOf,
  artistCounts,
  heroColor,
  fallbackColor,
} from '../../src/lib/listening'

describe('colours', () => {
  const parts = (hsl) => hsl.match(/hsl\((\d+) (\d+)% (\d+)%\)/).slice(1).map(Number)

  test('heroColor keeps the hue but darkens enough for white text', () => {
    const [h, s, l] = parts(heroColor([255, 230, 0]))
    expect(h).toBe(54)
    expect(s).toBeLessThanOrEqual(70)
    expect(l).toBeLessThanOrEqual(36)
  })

  test('heroColor lifts a near-black cover and leaves greys grey', () => {
    expect(parts(heroColor([5, 5, 30]))[2]).toBe(20)
    expect(parts(heroColor([128, 128, 128]))[1]).toBe(0)
  })

  test('heroColor refuses junk', () => {
    expect(heroColor(null)).toBe(null)
    expect(heroColor([1, NaN, 2])).toBe(null)
  })

  test('fallbackColor is stable per seed', () => {
    expect(fallbackColor('abc')).toBe(fallbackColor('abc'))
    expect(fallbackColor('abc')).not.toBe(fallbackColor('abd'))
    expect(fallbackColor('abc')).toMatch(/^hsl\(\d+ 40% 28%\)$/)
  })
})

const track = (id, extra = {}) => ({ id, title: `Song ${id}`, artists: [{ name: `Artist ${id}` }], durationMs: 180_000, ...extra })
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime()
const iso = (ms) => new Date(ms).toISOString()

describe('formatting', () => {
  test('artistLine joins names and falls back', () => {
    expect(artistLine({ artists: [{ name: 'A' }, { name: 'B' }] })).toBe('A, B')
    expect(artistLine({ artists: [] })).toBe('Unknown artist')
    expect(artistLine(null)).toBe('Unknown artist')
  })

  test('formatDuration', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65_400)).toBe('1:05')
    expect(formatDuration(3_725_000)).toBe('1:02:05')
    expect(formatDuration(-1)).toBe('0:00')
    expect(formatDuration(NaN)).toBe('0:00')
  })

  test('clockTime is local HH:MM', () => {
    expect(clockTime(iso(at(2026, 10, 9, 7, 5)))).toBe('07:05')
    expect(clockTime('nope')).toBe('')
  })
})

describe('progress', () => {
  test('sampleNow trusts the server stamp but never more than the cap', () => {
    expect(sampleNow({ at: 1_000 }, 4_000).sampledAt).toBe(1_000)
    expect(sampleNow({ at: 0 }, 100_000).sampledAt).toBe(100_000 - MAX_SAMPLE_AGE_MS)
    expect(sampleNow({ at: 9_000 }, 4_000).sampledAt).toBe(4_000)
    expect(sampleNow(null)).toBe(null)
  })

  test('progress advances while playing, stays put when paused, caps at the duration', () => {
    const now = { playing: true, track: track(1), progressMs: 10_000, sampledAt: 0 }
    expect(progressAt(now, 5_000)).toBe(15_000)
    expect(progressAt(now, 999_999)).toBe(180_000)
    expect(progressAt({ ...now, playing: false }, 5_000)).toBe(10_000)
    expect(progressAt({ ...now, progressMs: null }, 5_000)).toBe(null)
  })

  test('trackEnded waits for the grace period and only while playing', () => {
    const now = { playing: true, track: track(1), progressMs: 179_000, sampledAt: 0 }
    expect(trackEnded(now, 1_000)).toBe(false)
    expect(trackEnded(now, 1_000 + TRACK_END_GRACE_MS)).toBe(true)
    expect(trackEnded({ ...now, playing: false }, 999_999)).toBe(false)
  })

  test('nowStatus', () => {
    expect(nowStatus({ playing: true, track: track(1) })).toBe('playing')
    expect(nowStatus({ playing: true, kind: 'episode', track: null })).toBe('podcast')
    expect(nowStatus({ playing: false, track: track(1) })).toBe('paused')
    expect(nowStatus({ playing: false, track: null })).toBe('idle')
    expect(nowStatus(null)).toBe('idle')
  })
})

describe('history', () => {
  const clock = at(2026, 10, 9, 15)
  const items = [
    { track: track('a'), playedAt: iso(at(2026, 10, 9, 14)) },
    { track: track('b', { artists: [{ name: 'Artist a' }, { name: 'Other' }] }), playedAt: iso(at(2026, 10, 9, 13)) },
    { track: track('a'), playedAt: iso(at(2026, 10, 8, 23)) },
    { track: track('c'), playedAt: iso(at(2026, 10, 3, 9)) },
    { track: track('a'), playedAt: 'garbage' },
  ]

  test('dayLabel', () => {
    expect(dayLabel(items[0].playedAt, clock)).toBe('Today')
    expect(dayLabel(items[2].playedAt, clock)).toBe('Yesterday')
    expect(dayLabel(items[3].playedAt, clock)).toBe('Saturday 3 October')
  })

  test('groupByDay keeps order and skips bad timestamps', () => {
    const groups = groupByDay(items, clock)
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['Today', 2],
      ['Yesterday', 1],
      ['Saturday 3 October', 1],
    ])
  })

  test('listeningStats counts unique artists case-insensitively and sums minutes', () => {
    const stats = listeningStats(items.slice(0, 4))
    expect(stats.plays).toBe(4)
    expect(stats.artists).toBe(3)
    expect(stats.minutes).toBe(12)
    expect(stats.since).toBe(items[3].playedAt)
  })

  test('hourly buckets plays by local hour and finds the peak', () => {
    const { counts, max, peak } = hourly(items)
    expect(counts).toHaveLength(24)
    expect(counts[14] + counts[13] + counts[23] + counts[9]).toBe(4)
    expect(max).toBe(1)
    expect(peak).toBe(9)
    expect(hourly([]).peak).toBe(null)
  })

  test('artistCounts counts every credited artist and sorts by plays', () => {
    const counted = artistCounts(items)
    expect(counted[0]).toEqual({ name: 'Artist a', url: null, count: 4 })
    expect(counted.map((a) => a.name)).toEqual(['Artist a', 'Artist c', 'Other'])
    expect(artistCounts(items, 1)).toHaveLength(1)
  })

  test('albumsOf dedupes by album and skips art-less tracks', () => {
    const withArt = (id, album) => ({ track: { ...track(id), art: `https://i.scdn.co/${id}`, album: { url: album } } })
    const list = [withArt('a', 'x'), withArt('b', 'x'), withArt('c', 'y'), { track: track('d') }]
    expect(albumsOf(list).map((t) => t.id)).toEqual(['a', 'c'])
    expect(albumsOf(list, 1)).toHaveLength(1)
  })

  test('playsOn counts only today', () => {
    expect(playsOn(items, clock)).toBe(2)
    expect(playsOn([], clock)).toBe(0)
  })

  test('onRepeat counts replays by track id', () => {
    expect(onRepeat(items).map((e) => [e.track.id, e.count])).toEqual([['a', 3]])
    expect(onRepeat(items, 4)).toEqual([])
  })
})
