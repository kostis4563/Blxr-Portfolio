import { describe, test, expect, beforeEach, vi } from 'vitest'

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

let mod

beforeEach(async () => {
  store.clear()
  vi.resetModules()
  mod = await import('../../src/lib/comments.js')
})

const spot = { path: '/', x: 0.5, y: 400 }

describe('comment store', () => {
  test('adds, persists and reads back', () => {
    const c = mod.addComment({ ...spot, text: '  fix this spacing  ' })
    expect(c.text).toBe('fix this spacing')
    expect(JSON.parse(store.get('blxr-comments'))).toHaveLength(1)
    expect(mod.getComments()).toEqual([c])
  })

  test('ignores blank text and caps length', () => {
    expect(mod.addComment({ ...spot, text: '   ' })).toBeNull()
    const long = mod.addComment({ ...spot, text: 'x'.repeat(mod.MAX_LENGTH + 50) })
    expect(long.text).toHaveLength(mod.MAX_LENGTH)
  })

  test('drops malformed entries from storage', async () => {
    store.set('blxr-comments', JSON.stringify([
      { id: 'a', path: '/', text: 'ok', at: '2026-10-01T00:00:00Z', x: 0.1, y: 10 },
      { id: 'b', path: '/', text: '', at: '2026-10-01T00:00:00Z', x: 0.1, y: 10 },
      { id: 'c', path: '/', text: 'no coords', at: '2026-10-01T00:00:00Z' },
      'junk',
    ]))
    vi.resetModules()
    mod = await import('../../src/lib/comments.js')
    expect(mod.getComments().map((c) => c.id)).toEqual(['a'])
  })

  test('survives broken JSON', async () => {
    store.set('blxr-comments', '{nope')
    vi.resetModules()
    mod = await import('../../src/lib/comments.js')
    expect(mod.getComments()).toEqual([])
  })

  test('edit, resolve, delete and undo', () => {
    const c = mod.addComment({ ...spot, text: 'first' })
    mod.editComment(c.id, 'second')
    expect(mod.getComments()[0]).toMatchObject({ text: 'second', edited: expect.any(String) })

    mod.setResolved(c.id, true)
    expect(mod.getComments()[0].resolved).toBe(true)

    const removed = mod.removeComment(c.id)
    expect(mod.getComments()).toEqual([])
    mod.restoreComments([removed])
    expect(mod.getComments()).toEqual([removed])
  })

  test('editing to empty deletes', () => {
    const c = mod.addComment({ ...spot, text: 'gone soon' })
    mod.editComment(c.id, '  ')
    expect(mod.getComments()).toEqual([])
  })

  test('clearing is scoped to a page, optionally resolved only', () => {
    const a = mod.addComment({ ...spot, text: 'a' })
    mod.addComment({ ...spot, text: 'b' })
    mod.addComment({ ...spot, path: '/cv', text: 'c' })
    mod.setResolved(a.id, true)

    expect(mod.clearComments('/', { resolvedOnly: true })).toHaveLength(1)
    expect(mod.getComments().map((c) => c.text)).toEqual(['b', 'c'])
    expect(mod.clearComments('/')).toHaveLength(1)
    expect(mod.commentsOn(mod.getComments(), '/cv')).toHaveLength(1)
  })

  test('hidden flag persists and commenting unhides', () => {
    mod.setCommentsHidden(true)
    expect(store.get('blxr-comments-hidden')).toBe('1')
    mod.startCommenting()
    expect(mod.commentsHidden()).toBe(false)
    expect(mod.commentsPlacing()).toBe(true)
    mod.stopCommenting()
    expect(mod.commentsPlacing()).toBe(false)
  })
})

describe('formatting', () => {
  test('shortAgo', () => {
    const now = Date.parse('2026-10-05T12:00:00Z')
    expect(mod.shortAgo('2026-10-05T11:59:30Z', now)).toBe('now')
    expect(mod.shortAgo('2026-10-05T11:55:00Z', now)).toBe('5m')
    expect(mod.shortAgo('2026-10-05T09:00:00Z', now)).toBe('3h')
    expect(mod.shortAgo('2026-10-01T12:00:00Z', now)).toBe('4d')
    expect(mod.shortAgo('nope', now)).toBe('')
  })

  test('markdown groups by page', () => {
    const at = '2026-10-05T12:00:00Z'
    const md = mod.commentsMarkdown([
      { id: '1', path: '/', text: 'hero', at, x: 0, y: 0, resolved: false },
      { id: '2', path: '/cv', text: 'typo', at, x: 0, y: 0, resolved: true },
    ], 'https://blxr.net')
    expect(md).toBe('## https://blxr.net/\n\n1. hero _(2026-10-05)_\n\n## https://blxr.net/cv\n\n1. ~~typo~~ _(2026-10-05)_')
  })
})
