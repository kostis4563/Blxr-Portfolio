import { describe, test, expect } from 'vitest'
import { suggestHandle, handleProblem, normalizeUrl, isHttpUrl, fromRow, linkKind, hostOf, accentOf, shadeHex, RESERVED_HANDLES } from '../../src/lib/profiles.js'
import {
  readHash, layout, seenUpTo, unreadIn, toggleReaction, reactionRows, mergeMessages, previewOf, badgeOf, inboxMatches, firstNameOf, dayLabel, clockOf, RUN_GAP,
} from '../../src/lib/messages.js'
import { rankCommands, groupCommands } from '../../src/lib/commands.js'
import { fold } from '../../src/lib/text-match.js'

describe('profile handles', () => {
  test.each([
    ['Kostis Nomikos', 'kostis_nomikos'],
    ['Ünïcödé Nâme', 'unicode_name'],
    ['__x__', ''],
    ['admin', ''],
    ['a'.repeat(40), 'a'.repeat(20)],
    ['!!!', ''],
    [null, ''],
  ])('suggestHandle(%s) → "%s"', (input, expected) => {
    expect(suggestHandle(input)).toBe(expected)
  })

  test('handleProblem', () => {
    expect(handleProblem('')).toMatch(/Pick/)
    expect(handleProblem('ab')).toMatch(/3 characters/)
    expect(handleProblem('Bad-Handle')).toMatch(/Lowercase/)
    expect(handleProblem('root')).toMatch(/reserved/)
    expect(handleProblem('good_one')).toBeNull()
  })

  test('routes and app words cannot be taken as handles', () => {
    for (const word of ['dashboard', 'login', 'api', 'admin', 'settings', 'null', 'undefined']) expect(RESERVED_HANDLES.has(word), word).toBe(true)
  })
})

describe('profile links are sanitised (stored XSS guard)', () => {
  test('normalizeUrl adds https, rejects other schemes and bare words', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
    expect(normalizeUrl('http://example.com/a/')).toBe('http://example.com/a')
    expect(normalizeUrl('')).toBe('')
    expect(normalizeUrl('localhost')).toBeNull()
    for (const evil of ['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x', 'file:///etc/passwd']) expect(normalizeUrl(evil), evil).toBeNull()
  })

  test('isHttpUrl refuses scripts, whitespace and quote tricks', () => {
    expect(isHttpUrl('https://ok.example/path?q=1')).toBe(true)
    for (const evil of ['javascript:alert(1)', 'https://x.io/" onmouseover="alert(1)', 'https://x.io/<script>', ' https://x.io', 'https://x .io', 42, null]) {
      expect(isHttpUrl(evil), String(evil)).toBe(false)
    }
  })

  test('fromRow drops unsafe or malformed values coming back from the database', () => {
    const p = fromRow({
      id: 'u1',
      handle: 'x',
      display_name: 'X',
      website: 'javascript:alert(1)',
      links: [{ url: 'https://ok.example' }, { url: 'javascript:alert(1)' }, null],
      showcase: [{ title: 'A', url: 'data:text/html,x' }, { nope: true }],
      accent: 'custom',
      accent_hex: '#GGGGGG',
      sections: ['about', 'hacked'],
      discord_id: '123',
      layout: '<script>',
      theme: 'evil',
    })
    expect(p.website).toBe('')
    expect(p.links).toEqual([{ url: 'https://ok.example' }])
    expect(p.showcase).toEqual([{ title: 'A', url: '' }])
    expect(p.accent).toBe('ink')
    expect(p.accentHex).toBeNull()
    expect(p.sections).not.toContain('hacked')
    expect(p.discordId).toBeNull()
    expect(p.layout).toBe('card')
    expect(p.theme).toBe('system')
    expect(fromRow(null)).toBeNull()
  })

  test('linkKind matches real hosts and subdomains, not look-alikes', () => {
    expect(linkKind('https://github.com/kostis4563')?.id).toBe('github')
    expect(linkKind('https://www.youtube.com/@x')?.id).toBe('youtube')
    expect(linkKind('https://gist.github.com/x')?.id).toBe('github')
    expect(linkKind('https://github.com.evil.io/x')).toBeNull()
    expect(linkKind('https://evilgithub.com/x')).toBeNull()
    expect(linkKind('nope')).toBeNull()
    expect(hostOf('https://www.example.com/a')).toBe('example.com')
  })

  test('accent colours', () => {
    expect(shadeHex('#808080', 0)).toBe('#808080')
    expect(shadeHex('#000000', -1)).toBe('#000000')
    expect(accentOf({ accent: 'custom', accentHex: '#123456' })).toBeTruthy()
  })
})

describe('messages', () => {
  const uuid = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
  const at = (min) => new Date(Date.parse('2026-09-23T10:00:00Z') + min * 60_000).toISOString()
  const msg = (id, from, min, extra = {}) => ({ id, from, created_at: at(min), updated_at: at(min), ...extra })
  const mine = (m) => m.from === 'me'

  test('readHash only accepts a UUID thread id', () => {
    expect(readHash(`#messages/${uuid}`)).toEqual({ thread: uuid })
    expect(readHash('#messages/../../x')).toEqual({ thread: null })
    expect(readHash('')).toEqual({ thread: null })
  })

  test('layout groups runs by sender and time, with day separators', () => {
    const rows = layout([msg('a', 'me', 0), msg('b', 'me', 1), msg('c', 'them', 2), msg('d', 'me', 3 + RUN_GAP / 60_000), msg('x', 'me', 4, { deleted_at: at(5) })], mine, Date.parse(at(10)))
    const shape = rows.map((r) => (r.kind === 'day' ? 'day' : `${r.message.id}:${r.first ? 'F' : ''}${r.last ? 'L' : ''}`))
    expect(shape).toEqual(['day', 'a:F', 'b:L', 'c:FL', 'd:FL'])
  })

  test('seen and unread markers', () => {
    const thread = [msg('a', 'me', 0), msg('b', 'them', 1), msg('c', 'me', 2)]
    expect(seenUpTo(thread, mine, at(2))).toBe('c')
    expect(seenUpTo(thread, mine, at(1))).toBeNull()
    expect(seenUpTo(thread, mine, null)).toBeNull()
    expect(unreadIn(thread, mine, at(0))).toBe(1)
    expect(unreadIn(thread, mine, at(5))).toBe(0)
    expect(unreadIn(thread, mine, null)).toBe(1)
  })

  test('reactions toggle per user and sort in picker order', () => {
    let r = toggleReaction({}, '🔥', 'u1')
    r = toggleReaction(r, '❤️', 'u2')
    r = toggleReaction(r, '🔥', 'u2')
    expect(reactionRows(r, 'u1')).toEqual([{ emoji: '❤️', count: 1, mine: false }, { emoji: '🔥', count: 2, mine: true }])
    r = toggleReaction(r, '🔥', 'u1')
    r = toggleReaction(r, '🔥', 'u2')
    expect(r).toEqual({ '❤️': ['u2'] })
  })

  test('mergeMessages keeps the newest version of each and stays in order', () => {
    const held = [msg('a', 'me', 0), msg('b', 'me', 1)]
    expect(mergeMessages(held, [held[0]])).toBe(held)
    const edited = { ...held[0], body: 'edited', updated_at: at(9) }
    const stale = { ...held[1], body: 'stale', updated_at: at(-5) }
    const merged = mergeMessages(held, [edited, stale, msg('c', 'them', -1)])
    expect(merged.map((m) => m.id)).toEqual(['c', 'a', 'b'])
    expect(merged[1].body).toBe('edited')
    expect(merged[2].body).toBeUndefined()
  })

  test('previews, badges and search', () => {
    expect(previewOf({ body: '  hello \n there ' })).toBe('hello there')
    expect(previewOf({ deleted_at: 'x', body: 'secret' })).toBe('Unsent a message')
    expect(previewOf({ body: '', files: [{ type: 'image/png' }, { type: 'image/jpeg' }] })).toBe('Sent 2 photos')
    expect(previewOf({ body: '', files: [{ type: 'application/pdf' }] })).toBe('Sent a file')
    expect(previewOf({ body: '', files: 3 })).toBe('Sent 3 files')
    expect(badgeOf(100)).toBe('99+')
    expect(badgeOf(7)).toBe('7')
    expect(inboxMatches({ name: 'Ada', last_body: 'About the invoice' }, 'INVOICE')).toBe(true)
    expect(firstNameOf('  Ada Lovelace ')).toBe('Ada')
    expect(firstNameOf('')).toBe('them')
  })

  test('clock and day labels use local time', () => {
    const now = new Date(2026, 8, 23, 12, 0).getTime()
    expect(clockOf(new Date(2026, 8, 23, 9, 5))).toBe('09:05')
    expect(dayLabel(new Date(2026, 8, 22, 23, 59), now)).toBe('Yesterday')
    expect(dayLabel(new Date(2026, 8, 19), now)).toBe('Saturday')
    expect(dayLabel(new Date(2025, 0, 2), now)).toBe('2 Jan 2025')
    expect(clockOf('nope')).toBe('')
  })
})

describe('command palette ranking', () => {
  const cmd = (label, group, keywords = '') => ({ label, group, keywords, fLabel: fold(label), haystack: fold(`${label} ${group} ${keywords}`) })
  const commands = [cmd('Open projects', 'Go to'), cmd('Projects archive', 'Go to'), cmd('Toggle theme', 'Settings', 'dark light'), cmd('Café menu', 'Fun')]

  test('prefix beats substring beats keyword; accents fold', () => {
    expect(rankCommands(commands, 'proj').map((c) => c.label)).toEqual(['Projects archive', 'Open projects'])
    expect(rankCommands(commands, 'dark').map((c) => c.label)).toEqual(['Toggle theme'])
    expect(rankCommands(commands, 'cafe').map((c) => c.label)).toEqual(['Café menu'])
    expect(rankCommands(commands, '  ')).toBe(commands)
  })

  test('groupCommands keeps first-seen group order', () => {
    expect(groupCommands(commands).map((g) => g.name)).toEqual(['Go to', 'Settings', 'Fun'])
  })
})
