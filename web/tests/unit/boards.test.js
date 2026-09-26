import { describe, test, expect } from 'vitest'
import {
  positionFor, needsRenumber, POSITION_STEP, sortCards, tally, cardMatches, dueState, filtersActive, EMPTY_FILTERS,
  stepSeconds, stepWords, sortSteps, joinWords, remindOf, DEFAULT_REMIND, ago, initials, sizeWords, prettyLink,
  factChips, factText, purposeOf, filledFacts, strayFacts, shortId, plural, PURPOSES, FACT_FIELDS, shade, COLOURS,
} from '../../src/lib/boards.js'

const NOW = Date.parse('2026-09-23T10:00:00Z')
const hours = (h) => new Date(NOW + h * 3600_000).toISOString()

describe('card ordering (fractional positions)', () => {
  const rows = [{ position: 1024 }, { position: 2048 }, { position: 3072 }]

  test('positions for empty lists, the top, the bottom and between', () => {
    expect(positionFor([], 0)).toBe(POSITION_STEP)
    expect(positionFor(rows, 0)).toBe(0)
    expect(positionFor(rows, 3)).toBe(4096)
    expect(positionFor(rows, 1)).toBe(1536)
  })

  test('repeated inserts at the same slot eventually ask for a renumber', () => {
    const list = [{ position: 0 }, { position: 1 }]
    let inserts = 0
    while (!needsRenumber(list, 1) && inserts < 100) {
      list.splice(1, 0, { position: positionFor(list, 1) })
      inserts += 1
    }
    expect(inserts).toBeGreaterThan(5)
    expect(inserts).toBeLessThan(100)
    for (let i = 1; i < list.length; i++) expect(list[i].position).toBeGreaterThan(list[i - 1].position)
  })

  test('sortCards returns a new array and never mutates its input', () => {
    const cards = [
      { title: 'b', due: hours(5), created_at: '2026-01-02', done: true, position: 2 },
      { title: 'a', due: null, created_at: '2026-01-03', done: false, position: 3 },
      { title: 'c', due: hours(1), created_at: '2026-01-01', done: false, position: 1 },
    ]
    const frozen = JSON.stringify(cards)
    expect(sortCards(cards, 'due').map((c) => c.title)).toEqual(['c', 'b', 'a'])
    expect(sortCards(cards, 'title').map((c) => c.title)).toEqual(['a', 'b', 'c'])
    expect(sortCards(cards, 'made').map((c) => c.title)).toEqual(['a', 'b', 'c'])
    expect(sortCards(cards, 'done').map((c) => c.title)).toEqual(['c', 'a', 'b'])
    expect(sortCards(cards, 'unknown')).not.toBe(cards)
    expect(sortCards(null, 'due')).toEqual([])
    expect(JSON.stringify(cards)).toBe(frozen)
  })
})

describe('due dates and filters', () => {
  test('dueState tones', () => {
    expect(dueState({ due: hours(-1) }, NOW).tone).toBe('late')
    expect(dueState({ due: hours(47) }, NOW).tone).toBe('soon')
    expect(dueState({ due: hours(49) }, NOW).tone).toBe('calm')
    expect(dueState({ due: hours(-1), done: true }, NOW).tone).toBe('done')
    expect(dueState({ due: null }, NOW)).toBeNull()
    expect(dueState({ due: 'garbage' }, NOW)).toBeNull()
  })

  test('tally ignores archived cards and done cards for overdue/soon', () => {
    const t = tally([
      { due: hours(-2) },
      { due: hours(-2), done: true },
      { due: hours(3) },
      { due: hours(100) },
      { due: hours(-2), archived: true },
    ], NOW)
    expect(t).toEqual({ cards: 4, done: 1, archived: 1, overdue: 1, soon: 1 })
  })

  const labels = [{ id: 'l1', name: 'Urgent' }]
  const card = { seq: 42, title: 'Fix login', notes: 'Safari only', labels: ['l1'], done: false }

  test('cardMatches: text search covers #seq, title, notes and label names', () => {
    for (const text of ['#42', 'LOGIN', 'safari', 'urgent']) expect(cardMatches(card, { ...EMPTY_FILTERS, text }, labels), text).toBe(true)
    expect(cardMatches(card, { ...EMPTY_FILTERS, text: 'nope' }, labels)).toBe(false)
  })

  test('cardMatches: archive, done, label and due filters', () => {
    expect(cardMatches({ ...card, archived: true }, null)).toBe(false)
    expect(cardMatches({ ...card, archived: true }, { ...EMPTY_FILTERS, archived: true })).toBe(true)
    expect(cardMatches({ ...card, done: true }, { ...EMPTY_FILTERS, hideDone: true })).toBe(false)
    expect(cardMatches(card, { ...EMPTY_FILTERS, label: 'l2' })).toBe(false)
    expect(cardMatches({ ...card, due: null }, { ...EMPTY_FILTERS, due: 'none' })).toBe(true)
    expect(cardMatches({ ...card, due: hours(1) }, { ...EMPTY_FILTERS, due: 'none' })).toBe(false)
  })

  test('filtersActive', () => {
    expect(filtersActive(EMPTY_FILTERS)).toBe(false)
    expect(filtersActive({ ...EMPTY_FILTERS, text: 'x' })).toBe(true)
  })
})

describe('reminders', () => {
  test('step parsing', () => {
    expect(stepSeconds('90m')).toBe(5400)
    expect(stepSeconds('1w')).toBe(604800)
    expect(stepSeconds('1y')).toBe(0)
    expect(stepSeconds('99999h')).toBe(0)
    expect(stepSeconds(null)).toBe(0)
    expect(stepWords('1d')).toBe('1 day')
    expect(stepWords('3h')).toBe('3 hours')
    expect(stepWords('junk')).toBe('junk')
  })

  test('sortSteps drops junk and duplicates, shortest first', () => {
    expect(sortSteps(['1d', 'x', '1h', '1d', '30m'])).toEqual(['30m', '1h', '1d'])
  })

  test('remindOf falls back to defaults and sanitises stored steps', () => {
    expect(remindOf({})).toEqual(DEFAULT_REMIND)
    expect(remindOf({ remind: 'yes' })).toEqual(DEFAULT_REMIND)
    expect(remindOf({ remind: { on: 1, lead: ['2h', 'bad'], late: [] } })).toEqual({ on: true, lead: ['2h'], late: [], quiet: false })
  })

  test('joinWords', () => {
    expect(joinWords([])).toBe('')
    expect(joinWords(['a'])).toBe('a')
    expect(joinWords(['a', '', 'b'])).toBe('a and b')
    expect(joinWords(['a', 'b', 'c'])).toBe('a, b and c')
  })
})

describe('board purposes and facts', () => {
  test('unknown purposes fall back to Personal', () => {
    expect(purposeOf('nope').id).toBe('personal')
    expect(purposeOf(undefined).id).toBe('personal')
  })

  test('purpose ids and field ids are unique; shared ids mean the same kind of field', () => {
    expect(new Set(PURPOSES.map((p) => p.id)).size).toBe(PURPOSES.length)
    for (const p of PURPOSES) expect(new Set(p.fields.map((f) => f.id)).size, p.id).toBe(p.fields.length)
    for (const p of PURPOSES) for (const f of p.fields) expect(FACT_FIELDS[f.id].kind, `${p.id}.${f.id}`).toBe(f.kind)
  })

  test('server chips join host and port, and hide the separate port chip', () => {
    const server = purposeOf('server')
    const chips = factChips(server, { game: 'FiveM', host: 'play.example.com', port: '30120' })
    expect(chips.map((c) => c.text)).toEqual(['FiveM', 'play.example.com:30120'])
    expect(factChips(server, { port: '30120' }).map((c) => c.text)).toEqual(['30120'])
  })

  test('link facts render as host/path', () => {
    expect(prettyLink('https://example.com/')).toBe('example.com')
    expect(prettyLink('example.com/docs')).toBe('example.com/docs')
    expect(prettyLink('  ')).toBe('')
    expect(prettyLink('not a url at all')).toBe('not a url at all')
    expect(factText({ kind: 'link' }, 'https://x.io/a')).toBe('x.io/a')
  })

  test('filled and stray facts', () => {
    const server = purposeOf('server')
    expect(filledFacts(server, { game: 'x', host: '  ', leftover: 'y' })).toBe(1)
    expect(strayFacts(server, { game: 'x', leftover: 'y', empty: ' ' })).toEqual(['leftover'])
  })

  test('every colour has a shade; unknown colours fall back', () => {
    for (const c of COLOURS) expect(shade(c.id).swatch).toBeTruthy()
    expect(shade('nope')).toEqual(shade('violet'))
  })
})

describe('small formatters', () => {
  test.each([
    [NOW, 'just now'],
    [NOW + 60_000, 'just now'],
    [NOW - 5 * 60_000, '5m ago'],
    [NOW - 47 * 3600_000, '47h ago'],
    [NOW - 49 * 3600_000, '2d ago'],
    ['garbage', ''],
  ])('ago(%s)', (stamp, expected) => {
    expect(ago(stamp, NOW)).toBe(expected)
  })

  test.each([
    ['Ada Lovelace', 'AL'],
    ['ada', 'AD'],
    ['john.doe', 'JD'],
    ['  ', '?'],
    [null, '?'],
  ])('initials(%s)', (name, expected) => {
    expect(initials(name)).toBe(expected)
  })

  test('sizeWords', () => {
    expect(sizeWords(0)).toBe('0 B')
    expect(sizeWords(1023)).toBe('1023 B')
    expect(sizeWords(1024)).toBe('1 KB')
    expect(sizeWords(1024 * 1024)).toBe('1.0 MB')
    expect(sizeWords('x')).toBe('0 B')
  })

  test('plural', () => {
    expect(plural(1, 'card')).toBe('1 card')
    expect(plural(0, 'card')).toBe('0 cards')
  })

  test('shortId is 12 characters and does not repeat', () => {
    const ids = new Set(Array.from({ length: 1000 }, shortId))
    expect(ids.size).toBe(1000)
    for (const id of ids) expect(id).toHaveLength(12)
  })
})
