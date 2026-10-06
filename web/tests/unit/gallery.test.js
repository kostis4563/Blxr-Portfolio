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
  imageUrl,
  isVideo,
  LIVE_TYPES,
  cleanLive,
  draftLive,
  moveItem,
  mergeOrder,
  withPositions,
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

  test('a set order wins over dates, and unmoved items stay on top', () => {
    const list = sortItems([
      item({ id: 'a', takenOn: '2026-09-01', position: 2 }),
      item({ id: 'b', takenOn: '2026-01-01', position: 1 }),
      item({ id: 'new', takenOn: '2026-01-01', position: 0 }),
    ])
    expect(list.map((i) => i.id)).toEqual(['new', 'b', 'a'])
  })

  test('moving, and folding a section back into the full order', () => {
    const ids = (list) => list.map((i) => i.id)
    const all = ['p1', 'u1', 'p2', 'u2', 'p3'].map((id) => item({ id, kind: id[0] === 'u' ? 'ui' : 'photo' }))
    const photos = all.filter((i) => i.kind === 'photo')
    expect(ids(moveItem(photos, 'p3', 'p1'))).toEqual(['p3', 'p1', 'p2'])
    expect(ids(moveItem(photos, 'p1', 'p2'))).toEqual(['p2', 'p1', 'p3'])
    expect(moveItem(photos, 'p1', 'nope')).toBe(photos)
    expect(ids(mergeOrder(all, moveItem(photos, 'p3', 'p1')))).toEqual(['p3', 'u1', 'p1', 'u2', 'p2'])
    expect(withPositions(photos).map((i) => i.position)).toEqual([1, 2, 3])
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

  test('live items save as UI with no image, and drop unknown props', () => {
    const draft = draftLive('2026-10-06')
    const form = { ...formFrom(draft), kind: 'photo', live: { type: 'comment', props: { name: 'Ana', text: 'Ship it', time: '1h', evil: 'x' } } }
    const row = toRow(itemFrom(draft, form))
    expect(row).toMatchObject({ kind: 'ui', image: null, width: null, height: null, live: { type: 'comment', props: { name: 'Ana', text: 'Ship it', time: '1h' } } })
    expect(row.live.props).not.toHaveProperty('evil')
    expect(row).not.toHaveProperty('id')
    expect(fromRow({ ...row, id: 'x' }).live.type).toBe('comment')
  })

  test('unknown live types are dropped', () => {
    expect(cleanLive({ type: 'iframe', props: {} })).toBeNull()
  })

  test('every live type passes with its defaults, and flags missing required fields', () => {
    for (const t of LIVE_TYPES) {
      expect(problemsOf({ ...formFrom(draftLive('2026-10-06')), live: { type: t.value, props: { ...t.defaults } } })).toEqual({})
    }
    const problems = problemsOf({ ...formFrom(draftLive('2026-10-06')), live: { type: 'html', props: { html: ' ', css: '', height: '5000' } } })
    expect(Object.keys(problems).sort()).toEqual(['live.height', 'live.html'])
  })

  test('image paths match the bucket layout the SQL enforces', () => {
    expect(IMAGE_RE.test(item().image)).toBe(true)
    expect(IMAGE_RE.test('../etc/passwd.webp')).toBe(false)
    expect(IMAGE_RE.test('00000000-0000-4000-8000-000000000000/clip-a1b2c3.mp4')).toBe(true)
    expect(IMAGE_RE.test('00000000-0000-4000-8000-000000000000/clip-a1b2c3.gif')).toBe(false)
    expect(IMAGE_RE.test('/photos/sunset-a1b2c3d4.webp')).toBe(true)
    expect(IMAGE_RE.test('/photos/../dashboard.webp')).toBe(false)
    expect(IMAGE_RE.test('/assets/sunset.webp')).toBe(false)
  })

  test('site photos are served from the site, not the bucket', () => {
    expect(imageUrl('/photos/sunset-a1b2c3d4.webp')).toBe('/photos/sunset-a1b2c3d4.webp')
  })

  test('videos keep their poster; images never carry one', () => {
    const clip = item({ image: '00000000-0000-4000-8000-000000000000/clip-a1b2c3.mp4', poster: '00000000-0000-4000-8000-000000000000/clip-d4e5f6.webp' })
    expect(isVideo(clip.image)).toBe(true)
    expect(toRow(clip).poster).toBe(clip.poster)
    expect(fromRow(toRow(clip)).poster).toBe(clip.poster)
    expect(toRow(item({ poster: 'stale.webp' })).poster).toBeNull()
  })
})
