import { describe, test, expect } from 'vitest'
import {
  cleanChangelog,
  describeCommit,
  isNoise,
  groupChangelog,
  timelineOf,
  monthOf,
  sizeOf,
  kindCounts,
  dayKeyOf,
  dayHeading,
  rangeHeading,
  monthHeading,
  formatLines,
  spanDays,
  commitUrl,
  describeError,
} from '../../src/lib/changelog.js'

const sha = (c) => c.repeat(40)
const commit = (repo, c, message, date, extra = {}) => ({ repo, sha: sha(c), message, date, additions: 1, deletions: 0, ...extra })
const repo = (name) => ({ name, url: `https://github.com/octo/${name}`, description: '', language: null, commits: 1 })

describe('cleanChangelog', () => {
  test('keeps a well-formed response and sorts commits newest first', () => {
    const raw = {
      since: '2026-05-01T00:00:00.000Z',
      fetchedAt: '2026-10-22T12:00:00.000Z',
      repos: [{ name: 'site', url: 'https://github.com/octo/site', description: 'The site', language: { name: 'JavaScript', color: '#f1e05a' }, commits: 2 }],
      commits: [commit('site', 'a', 'Older', '2026-10-01T00:00:00Z'), commit('site', 'b', 'Newer', '2026-10-02T00:00:00Z')],
    }
    const clean = cleanChangelog(raw)
    expect(clean.repos).toEqual(raw.repos)
    expect(clean.commits.map((c) => c.message)).toEqual(['Newer', 'Older'])
    expect(clean.since).toBe(raw.since)
  })

  test('drops junk instead of throwing', () => {
    const clean = cleanChangelog({
      since: 'never',
      repos: [null, { name: 'x y', url: 'https://github.com/octo/x' }, { name: 'evil', url: 'javascript:alert(1)' }, { ...repo('ok'), language: { name: 'Go', color: 'red; background:url(x)' } }],
      commits: [
        commit('ok', 'a', 'Good', '2026-10-01T00:00:00Z'),
        commit('unknown-repo', 'b', 'No repo', '2026-10-01T00:00:00Z'),
        commit('ok', 'z', 'Bad sha', '2026-10-01T00:00:00Z'),
        commit('ok', 'c', 'Bad date', 'yesterday'),
        commit('ok', 'd', 42, '2026-10-01T00:00:00Z'),
        commit('ok', 'e', 'Negative lines', '2026-10-01T00:00:00Z', { additions: -5, deletions: 'many' }),
      ],
    })
    expect(clean.since).toBe(null)
    expect(clean.repos.map((r) => r.name)).toEqual(['ok'])
    expect(clean.repos[0].language).toEqual({ name: 'Go', color: null })
    expect(clean.commits.map((c) => c.message)).toEqual(['Good', 'Negative lines'])
    expect(clean.commits[1]).toMatchObject({ additions: 0, deletions: 0 })
    expect(cleanChangelog(null)).toEqual({ since: null, fetchedAt: null, repos: [], commits: [] })
  })
})

describe('describeCommit', () => {
  test.each([
    ['Add site status monitoring page', 'added'],
    ['added express.js', 'added'],
    ['Initial commit', 'added'],
    ['fixed some error', 'fixed'],
    ['Fixed deploy for the status', 'fixed'],
    ['Remove stats', 'removed'],
    ['Revert "Add x"', 'removed'],
    ['Update README.md', 'changed'],
    ['Redesign /listening in a Spotify style', 'changed'],
    ['Fix vulnerable build dependencies', 'security'],
    ['Fix vitals prototype pollution, integer chart limit', 'security'],
    ['Add security scans and post-deploy ZAP scan', 'security'],
  ])('%s → %s', (message, kind) => {
    expect(describeCommit(message).kind).toBe(kind)
  })

  test('conventional prefixes set the kind and are stripped from the text', () => {
    expect(describeCommit('feat(web): the changelog page')).toEqual({ kind: 'added', text: 'The changelog page' })
    expect(describeCommit('fix: footer overlap')).toEqual({ kind: 'fixed', text: 'Footer overlap' })
    expect(describeCommit('chore!: bump deps')).toEqual({ kind: 'changed', text: 'Bump deps' })
    expect(describeCommit('feat: patch the xss in comments').kind).toBe('security')
  })

  test('a colon in an ordinary message is left alone', () => {
    expect(describeCommit('Booking: show the caller’s zone').text).toBe('Booking: show the caller’s zone')
  })
})

describe('isNoise', () => {
  test.each(['.', ',', './', 'a', ' ASDASDASDA', 'wip', '...'])('%j is noise', (message) => {
    expect(isNoise(message)).toBe(true)
  })

  test.each(['added express.js', 'fixed some error', 'Update README.md', 'fix: typo'])('%j is a real message', (message) => {
    expect(isNoise(message)).toBe(false)
  })
})

describe('groupChangelog', () => {
  const commits = [
    commit('site', 'a', 'Add the changelog', '2026-10-22T20:00:00Z'),
    commit('site', 'b', '.', '2026-10-22T19:00:00Z'),
    commit('tool', 'c', 'Fix the build', '2026-10-22T01:00:00Z'),
    commit('tool', 'd', 'a', '2026-10-21T10:00:00Z'),
  ]

  const shape = (days) => days.map((d) => [d.day, d.changes, d.groups.map((g) => [g.repo, g.entries.map((e) => e.sha[0]), g.quiet.map((q) => q.sha[0])])])

  test('groups by day in the given zone, then by repo, folding noise into quiet', () => {
    const days = groupChangelog(commits, { timeZone: 'UTC' })
    expect(shape(days)).toEqual([
      ['2026-10-22', 2, [['site', ['a'], ['b']], ['tool', ['c'], []]]],
      ['2026-10-21', 0, [['tool', [], ['d']]]],
    ])
    expect(days[0].groups[0].entries[0]).toMatchObject({ kind: 'added', text: 'Add the changelog' })
  })

  test('the day boundary follows the visitor, not UTC', () => {
    const days = groupChangelog(commits, { timeZone: 'America/Los_Angeles' })
    expect(shape(days)).toEqual([
      ['2026-10-22', 1, [['site', ['a'], ['b']]]],
      ['2026-10-21', 1, [['tool', ['c'], ['d']]]],
    ])
  })

  test('kindCounts ignores noise', () => {
    expect(kindCounts(commits)).toEqual({ added: 1, fixed: 1, changed: 0, removed: 0, security: 0 })
  })
})

describe('timelineOf', () => {
  const day = (date, changes, quiet = []) => ({ day: date, changes, groups: [{ repo: 'site', entries: [], quiet }] })
  const q = (c) => commit('site', c, '.', '2026-10-01T00:00:00Z')

  test('runs of days with only untitled commits fold into one row, within a month', () => {
    const items = timelineOf([
      day('2026-10-22', 0, [q('a')]),
      day('2026-10-20', 3),
      day('2026-10-15', 0, [q('b')]),
      day('2026-10-12', 0, [q('c'), q('d')]),
      day('2026-10-01', 0, [q('e')]),
      day('2026-09-30', 0, [q('f')]),
    ])
    expect(items.map((i) => (i.type === 'day' ? ['day', i.day] : ['quiet', i.from, i.to, i.commits.map((c) => c.sha[0]).join('')]))).toEqual([
      ['quiet', '2026-10-22', '2026-10-22', 'a'],
      ['day', '2026-10-20'],
      ['quiet', '2026-10-01', '2026-10-15', 'bcde'],
      ['quiet', '2026-09-30', '2026-09-30', 'f'],
    ])
    expect(items.map(monthOf)).toEqual(['2026-10', '2026-10', '2026-10', '2026-09'])
    expect(sizeOf(items[2])).toBe(4)
  })
})

describe('formatting', () => {
  const now = Date.parse('2026-10-22T12:00:00Z')

  test('dayHeading names today and yesterday, adds the year only when it differs', () => {
    expect(dayHeading('2026-10-22', now, 'UTC')).toBe('Today')
    expect(dayHeading('2026-10-21', now, 'UTC')).toBe('Yesterday')
    expect(dayHeading('2026-10-02', now, 'UTC')).toBe('Fri, Oct 2')
    expect(dayHeading('2025-12-31', now, 'UTC')).toBe('Wed, Dec 31, 2025')
  })

  test('rangeHeading collapses a run of days, keeping today and yesterday by name', () => {
    expect(rangeHeading('2026-10-12', '2026-10-12', now, 'UTC')).toBe('Mon, Oct 12')
    expect(rangeHeading('2026-10-12', '2026-10-15', now, 'UTC')).toBe('Oct 12 – 15')
    expect(rangeHeading('2026-10-19', '2026-10-22', now, 'UTC')).toBe('Oct 19 – Today')
    expect(monthHeading('2026-09')).toBe('September 2026')
  })

  test('dayKeyOf is a plain YYYY-MM-DD', () => {
    expect(dayKeyOf('2026-01-05T23:30:00Z', 'UTC')).toBe('2026-01-05')
    expect(dayKeyOf('2026-01-05T23:30:00Z', 'Europe/Athens')).toBe('2026-01-06')
  })

  test('line counts compact past a thousand', () => {
    expect(formatLines(0)).toBe('0')
    expect(formatLines(999)).toBe('999')
    expect(formatLines(1234)).toBe('1.2K')
    expect(formatLines(56_000)).toBe('56K')
  })

  test('spanDays rounds and never answers zero', () => {
    expect(spanDays('2026-04-25T12:00:00Z', now)).toBe(180)
    expect(spanDays('2026-10-22T11:00:00Z', now)).toBe(1)
    expect(spanDays('nope', now)).toBe(null)
  })

  test('commit links and error copy', () => {
    expect(commitUrl(repo('site'), sha('a'))).toBe(`https://github.com/octo/site/commit/${sha('a')}`)
    expect(describeError({ code: 'rate_limited' })).toMatch(/rate limiting/)
    expect(describeError({ code: 'offline' })).toMatch(/connection/)
    expect(describeError({ code: 'anything' })).toMatch(/GitHub/)
  })
})
