import { describe, test, expect } from 'vitest'
import { fold, matchRange } from '../../src/lib/text-match.js'
import { passwordProblem, passwordChecks, strengthOf, PASSWORD_MIN, PASSWORD_MAX } from '../../src/lib/password.js'
import { suggestRoutes, splitKnownPrefix } from '../../src/lib/route-suggest.js'

describe('fold / matchRange (accent-insensitive search with highlight ranges)', () => {
  test('folds accents and case, including Greek', () => {
    expect(fold('Crème Brûlée')).toBe('creme brulee')
    expect(fold('ΩΡΑΊΟ')).toBe('ωραιο')
    expect(fold('İstanbul')).toBe('istanbul')
  })

  test('ranges point back into the original, unfolded text', () => {
    const text = 'Crème brûlée recipe'
    const [start, end] = matchRange(text, 'brulee')
    expect(text.slice(start, end)).toBe('brûlée')
    const decomposed = 'Café noir'
    const [s, e] = matchRange(decomposed, 'cafe')
    expect(decomposed.slice(s, e)).toBe('Cafe')
    expect(matchRange('abc', 'zzz')).toBeNull()
  })
})

describe('passwordProblem', () => {
  const ok = 'correct horse battery staple'

  test('a long, varied passphrase passes', () => {
    expect(passwordProblem(ok)).toBeNull()
  })

  test.each([
    ['short', `at least ${PASSWORD_MIN}`],
    ['x'.repeat(PASSWORD_MAX + 1), 'under'],
    ['🔒'.repeat(19), 'under'],
    ['aaaaaaaaaaaa', 'repetitive'],
    ['abababababab', 'repetitive'],
    ['abcdefghijkl', 'Sequences'],
    ['Password1234!', 'breach'],
    ['iloveyouiloveyou', 'breach'],
  ])('%s → mentions "%s"', (pw, hint) => {
    expect(passwordProblem(pw)).toMatch(new RegExp(hint, 'i'))
  })

  test.fails.each([
    'passw0rdpassw0rd',
    'pa55w0rdpa55w0rd',
    'P@ssw0rd1234',
    'Sup3rman!!!!',
    '123456789012',
    'qwerty123456',
  ])('BUG: "%s" (a top breached password) is refused', (pw) => {
    expect(passwordProblem(pw)).not.toBeNull()
  })

  test('the limit is 72 bytes (bcrypt), not 72 characters', () => {
    const emoji = '🔒🔑🗝️🛡️'.repeat(4)
    expect(emoji.length).toBeLessThanOrEqual(PASSWORD_MAX)
    expect(new TextEncoder().encode(emoji).length).toBeGreaterThan(PASSWORD_MAX)
    expect(passwordProblem(emoji)).toMatch(/under/)
  })

  test('refuses passwords containing your name or e-mail local part', () => {
    expect(passwordProblem('kostis-rocks-2026!', { email: 'kostis@example.com' })).toMatch(/name or email/)
    expect(passwordProblem('Nomikos-is-great-99', { name: 'Nomikos' })).toMatch(/name or email/)
    expect(passwordProblem('ada-rocks-hard-2026', { name: 'Ada' }), 'names under 4 letters are too common to police').toBeNull()
  })

  test('strengthOf scores 0–4', () => {
    expect(strengthOf('')).toBe(0)
    expect(strengthOf('short')).toBe(0)
    expect(strengthOf('twelve chars')).toBe(1)
    expect(strengthOf('sixteen chars ok')).toBe(2)
    expect(strengthOf('Sixteen Chars Ok')).toBe(3)
    expect(strengthOf('Sixteen Chars Ok 1!')).toBe(4)
  })

  test('passwordChecks ticks off length, case, digits and symbols separately', () => {
    const met = (pw) => passwordChecks(pw).filter((c) => c.met).map((c) => c.label)
    expect(met('')).toEqual([])
    expect(met('correct horse')).toEqual([`${PASSWORD_MIN}+ characters`])
    expect(met('Correct horse 7')).toEqual([`${PASSWORD_MIN}+ characters`, 'Upper & lowercase', 'A number'])
    expect(met('Correct-horse-7')).toHaveLength(4)
    expect(met('Correct horse 7'), 'a space is not one of the symbols Supabase counts').not.toContain('A symbol')
  })
})

describe('404 route suggestions', () => {
  const catalogue = [
    { path: '/projects', label: 'Projects' },
    { path: '/library', label: 'Library' },
    { path: '/library/supreme-restock', label: 'Supreme Restock' },
    { path: '/reviews', label: 'Reviews' },
    { path: '/cv', label: 'CV' },
    { path: '/uses', label: 'Uses' },
  ]
  const paths = (route) => suggestRoutes(route, catalogue).map((e) => e.path)

  test.each([
    ['/projetcs', '/projects'],
    ['/PROJECTS.html', '/projects'],
    ['/revews', '/reviews'],
    ['/library/supreme', '/library/supreme-restock'],
    ['/libary', '/library'],
  ])('%s → %s', (route, expected) => {
    expect(paths(route)[0]).toBe(expected)
  })

  test('nonsense suggests nothing; the limit is respected; huge input is capped', () => {
    expect(paths('/qwxzv')).toEqual([])
    expect(paths('/')).toEqual([])
    expect(suggestRoutes('/library/x', catalogue, { limit: 1 })).toHaveLength(1)
    const start = performance.now()
    suggestRoutes(`/${'a'.repeat(100_000)}`, catalogue)
    expect(performance.now() - start).toBeLessThan(200)
  })

  test('splitKnownPrefix separates the part of the path that exists', () => {
    expect(splitKnownPrefix('/library/nope/deeper', catalogue)).toEqual({ known: '/library/', unknown: 'nope/deeper' })
    expect(splitKnownPrefix('/nope', catalogue)).toEqual({ known: '/', unknown: 'nope' })
  })
})
