import { describe, test, expect } from 'vitest'
import {
  LIMITS,
  DEFAULT_AUTHOR,
  slugify,
  uniqueSlug,
  todayIso,
  paragraphsOf,
  fromRow,
  toRow,
  blankForm,
  formFrom,
  quoteFrom,
  wordsOf,
  problemsOf,
  sortQuotes,
  arrangeQuotes,
  formatQuoteDate,
  quoteNumber,
} from '../../src/lib/quote.js'

const quote = (over = {}) => ({
  id: '00000000-0000-4000-8000-000000000000',
  slug: 'true-heroes-never-run',
  text: 'True heroes never run.',
  author: 'Blxr',
  explanation: '',
  featured: false,
  published: true,
  addedOn: '2026-10-13',
  editedOn: null,
  createdAt: '2026-10-13T10:00:00Z',
  ...over,
})

const validForm = (over = {}) => ({ ...formFrom(quote()), ...over })

describe('slugs', () => {
  test.each([
    ['True heroes never run.', 'true-heroes-never-run'],
    ['  Café — déjà vu!  ', 'cafe-deja-vu'],
    ['one two three four five six seven eight nine ten', 'one-two-three-four-five-six-seven-eight'],
    ['Οι ήρωες δεν τρέχουν', ''],
    ['', ''],
  ])('%j -> %j', (text, slug) => {
    expect(slugify(text)).toBe(slug)
  })

  test('slugs never pass the length limit or end on a dash', () => {
    const slug = slugify('a'.repeat(50) + ' ' + 'b'.repeat(50))
    expect(slug.length).toBeLessThanOrEqual(LIMITS.slug)
    expect(slug).not.toMatch(/-$/)
  })

  test('uniqueSlug counts up past taken links and falls back to "quote"', () => {
    expect(uniqueSlug('stay', [])).toBe('stay')
    expect(uniqueSlug('stay', ['stay', 'stay-2'])).toBe('stay-3')
    expect(uniqueSlug('', ['quote'])).toBe('quote-2')
  })
})

describe('rows', () => {
  test('fromRow and toRow round-trip a quote', () => {
    const row = toRow(quote({ explanation: 'Why.', editedOn: '2026-10-20' }))
    expect(row).toMatchObject({ body: 'True heroes never run.', added_on: '2026-10-13', edited_on: '2026-10-20', explanation: 'Why.' })
    expect(fromRow({ ...row, created_at: '2026-10-13T10:00:00Z' })).toEqual(quote({ explanation: 'Why.', editedOn: '2026-10-20' }))
  })

  test('toRow trims text and fills an empty author', () => {
    const row = toRow(quote({ text: '  Stay.  ', author: '   ', explanation: '  \n ', editedOn: '' }))
    expect(row.body).toBe('Stay.')
    expect(row.author).toBe(DEFAULT_AUTHOR)
    expect(row.explanation).toBe('')
    expect(row.edited_on).toBeNull()
  })

  test('a form round-trips back into the same quote', () => {
    const q = quote({ editedOn: '2026-10-20', featured: true })
    const { createdAt, ...rest } = q
    expect(quoteFrom(q.id, formFrom(q))).toEqual(rest)
    expect(blankForm('2026-10-13')).toMatchObject({ text: '', author: DEFAULT_AUTHOR, addedOn: '2026-10-13', editedOn: '', published: true, featured: false })
  })

  test('wordsOf changes only when the words change', () => {
    const form = validForm()
    expect(wordsOf({ ...form, featured: true, addedOn: '2026-01-01' })).toBe(wordsOf(form))
    expect(wordsOf({ ...form, text: 'Other.' })).not.toBe(wordsOf(form))
    expect(wordsOf({ ...form, explanation: 'Note' })).not.toBe(wordsOf(form))
  })
})

describe('problemsOf', () => {
  test('a filled-in form has no problems', () => {
    expect(problemsOf(validForm())).toEqual({})
    expect(problemsOf(validForm({ editedOn: '2026-10-20', author: '' }))).toEqual({})
  })

  test.each([
    ['text', { text: '   ' }],
    ['text', { text: 'x'.repeat(LIMITS.text + 1) }],
    ['author', { author: 'x'.repeat(LIMITS.author + 1) }],
    ['explanation', { explanation: 'x'.repeat(LIMITS.explanation + 1) }],
    ['slug', { slug: '' }],
    ['slug', { slug: 'Has Spaces' }],
    ['slug', { slug: 'double--dash' }],
    ['addedOn', { addedOn: '' }],
    ['editedOn', { editedOn: '2026-10-01' }],
  ])('flags %s', (key, over) => {
    expect(problemsOf(validForm(over))).toHaveProperty(key)
  })

  test('a link another quote uses is taken', () => {
    expect(problemsOf(validForm(), ['true-heroes-never-run'])).toHaveProperty('slug')
  })
})

describe('arranging quotes', () => {
  const a = quote({ id: 'a', slug: 'a', addedOn: '2026-09-01' })
  const b = quote({ id: 'b', slug: 'b', addedOn: '2026-10-01', createdAt: '2026-10-01T09:00:00Z' })
  const c = quote({ id: 'c', slug: 'c', addedOn: '2026-10-01', createdAt: '2026-10-01T12:00:00Z' })

  test('numbers count up from the oldest and the list runs newest first', () => {
    const { all } = arrangeQuotes([b, a, c])
    expect(all.map((q) => [q.id, q.number])).toEqual([['c', 3], ['b', 2], ['a', 1]])
    expect(sortQuotes([a, c, b]).map((q) => q.id)).toEqual(['c', 'b', 'a'])
  })

  test('the featured quote leads and the rest follow', () => {
    const { featured, more } = arrangeQuotes([a, b, { ...c }, { ...a, id: 'f', slug: 'f', featured: true, addedOn: '2026-08-01' }])
    expect(featured.id).toBe('f')
    expect(featured.number).toBe(1)
    expect(more.map((q) => q.id)).toEqual(['c', 'b', 'a'])
  })

  test('without a featured quote the newest one leads', () => {
    const { featured, more } = arrangeQuotes([a, b, c])
    expect(featured.id).toBe('c')
    expect(more.map((q) => q.id)).toEqual(['b', 'a'])
  })

  test('no quotes means nothing to lead', () => {
    expect(arrangeQuotes([])).toEqual({ all: [], featured: null, more: [] })
  })
})

describe('text helpers', () => {
  test('paragraphs split on blank lines and keep single line breaks', () => {
    expect(paragraphsOf('One.\nStill one.\n\n  Two.  \n\n\n')).toEqual(['One.\nStill one.', 'Two.'])
    expect(paragraphsOf('')).toEqual([])
  })

  test('dates and numbers format the same everywhere', () => {
    expect(formatQuoteDate('2026-10-13')).toBe('13 Oct 2026')
    expect(formatQuoteDate('2026-01-01')).toBe('1 Jan 2026')
    expect(quoteNumber(3)).toBe('03')
    expect(quoteNumber(12)).toBe('12')
  })

  test('today is the local calendar day', () => {
    expect(todayIso(new Date(2026, 9, 13, 23, 59))).toBe('2026-10-13')
    expect(todayIso(new Date(2026, 0, 2, 0, 1))).toBe('2026-01-02')
  })
})
