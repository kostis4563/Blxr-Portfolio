import { describe, test, expect } from 'vitest'
import {
  sortItems,
  filterItems,
  countsOf,
  parseTags,
  titleFromFile,
  problemsOf,
  formFrom,
  itemFrom,
  toRow,
  fromRow,
  IMAGE_RE,
} from '../../src/lib/gallery.js'

const item = (over = {}) => ({
  id: '00000000-0000-4000-8000-000000000000',
  kind: 'photo',
  title: 'Sunset',
  caption: '',
  image: '00000000-0000-4000-8000-000000000000/sunset-a1b2c3.webp',
  width: 1600,
  height: 1200,
  takenOn: '2026-05-10',
  url: null,
  tags: [],
  published: true,
  createdAt: '2026-05-10T10:00:00Z',
  ...over,
})

describe('ordering and filtering', () => {
  test('newest date first, then newest upload', () => {
    const list = sortItems([
      item({ id: 'a', takenOn: '2026-01-01' }),
      item({ id: 'b', takenOn: '2026-03-01', createdAt: '2026-03-01T09:00:00Z' }),
      item({ id: 'c', takenOn: '2026-03-01', createdAt: '2026-03-01T12:00:00Z' }),
    ])
    expect(list.map((i) => i.id)).toEqual(['c', 'b', 'a'])
  })

  test('filter and counts by kind', () => {
    const list = [item({ id: 'a' }), item({ id: 'b', kind: 'ui' }), item({ id: 'c', kind: 'ui' })]
    expect(filterItems(list, 'all')).toHaveLength(3)
    expect(filterItems(list, 'ui').map((i) => i.id)).toEqual(['b', 'c'])
    expect(countsOf(list)).toEqual({ all: 3, photo: 1, ui: 2 })
  })
})

describe('helpers', () => {
  test('tags are trimmed, lowercased and deduped', () => {
    expect(parseTags(' Athens, night ,athens,, ')).toEqual(['athens', 'night'])
  })

  test('titles come from file names', () => {
    expect(titleFromFile('dashboard_dark-mode.png')).toBe('Dashboard dark mode')
    expect(titleFromFile('.png')).toBe('Untitled')
    expect(titleFromFile(`${'x'.repeat(120)}.jpg`)).toHaveLength(80)
  })
})

describe('validation', () => {
  const form = (over = {}) => ({ ...formFrom(item()), ...over })

  test('a filled form passes', () => {
    expect(problemsOf(form())).toEqual({})
  })

  test('flags bad fields', () => {
    const problems = problemsOf(form({ title: ' ', kind: 'video', takenOn: '', url: 'ftp://x', tags: 'a,b,c,d,e,f,g' }))
    expect(Object.keys(problems).sort()).toEqual(['kind', 'tags', 'takenOn', 'title', 'url'])
  })
})

describe('rows', () => {
  test('round-trips through the database shape', () => {
    const next = itemFrom(item(), { ...formFrom(item()), kind: 'ui', title: '  Checkout  ', tags: 'Web, Mobile', url: ' https://x.dev ' })
    const row = toRow(next)
    expect(row).toMatchObject({ kind: 'ui', title: 'Checkout', tags: ['web', 'mobile'], url: 'https://x.dev', taken_on: '2026-05-10' })
    expect(fromRow({ ...row, created_at: null, updated_at: null })).toMatchObject({ kind: 'ui', title: 'Checkout', width: 1600, height: 1200 })
  })

  test('unknown kinds read as photos', () => {
    expect(fromRow({ ...toRow(item()), kind: 'gif' }).kind).toBe('photo')
  })

  test('image paths match the bucket layout the SQL enforces', () => {
    expect(IMAGE_RE.test(item().image)).toBe(true)
    expect(IMAGE_RE.test('../etc/passwd.webp')).toBe(false)
  })
})
