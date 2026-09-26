import { describe, test, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { projectsList, isVideoLink } from '../../src/lib/projects.js'
import { libraryList } from '../../src/lib/library.js'
import { IMAGES } from '../../src/lib/image-manifest.js'
import { imageProps, imageUrl, SIZES } from '../../src/lib/images.js'
import * as cv from '../../src/lib/cv.js'
import * as skills from '../../src/lib/skills.js'
import * as uses from '../../src/lib/uses.js'

const PUBLIC = fileURLToPath(new URL('../../public', import.meta.url))
const onDisk = (url) => existsSync(PUBLIC + url.split('?')[0])

function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value]
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${at}[${i}]`)
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k)
}
const ASSET_RE = /^\/[\w./-]+\.(webp|png|jpe?g|svg|gif|mp3|pdf|avif)$/

const sources = { projects: projectsList, library: libraryList, cv, skills, uses }

describe('referenced local assets exist', () => {
  for (const [name, data] of Object.entries(sources)) {
    test(name, () => {
      const missing = [...strings(data)].filter(([, s]) => ASSET_RE.test(s) && !onDisk(s)).map(([at, s]) => `${at}: ${s}`)
      expect(missing).toEqual([])
    })
  }
})

describe('outbound links are well-formed https', () => {
  for (const [name, data] of Object.entries(sources)) {
    test(name, () => {
      const bad = [...strings(data)]
        .filter(([at, s]) => /^https?:\/\//.test(s) || /(^|\.)(url|github|href|link)$/i.test(at))
        .filter(([, s]) => s !== null && s !== '')
        .filter(([, s]) => {
          try {
            const u = new URL(s)
            if (u.protocol === 'mailto:') return !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(u.pathname)
            return u.protocol !== 'https:' || !u.hostname.includes('.')
          } catch {
            return !s.startsWith('/') && !s.startsWith('mailto:')
          }
        })
        .map(([at, s]) => `${at}: ${s}`)
      expect(bad).toEqual([])
    })
  }
})

describe('projects', () => {
  test('ids are unique and URL-safe', () => {
    const ids = projectsList.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  test.each(projectsList.map((p) => [p.id, p]))('%s has the fields its page renders', (_, p) => {
    for (const key of ['title', 'category', 'shortDescription', 'fullDescription', 'image']) expect(p[key], key).toBeTruthy()
    expect(p.imageAlt ?? p.title, 'alt text').toBeTruthy()
    for (const g of p.gallery || []) expect(g.alt, `gallery alt for ${g.src}`).toBeTruthy()
    if (p.accent) expect(p.accent).toMatch(/^#[0-9a-f]{6}$/i)
    expect(p.tags ?? [], 'tags').toBeInstanceOf(Array)
  })

  test('the CV only features projects that exist', () => {
    const ids = new Set(projectsList.map((p) => p.id))
    for (const id of cv.CV_PROJECT_IDS) expect(ids.has(id), id).toBe(true)
  })

  test('isVideoLink recognises YouTube only', () => {
    expect(isVideoLink('https://www.youtube.com/watch?v=x')).toBe(true)
    expect(isVideoLink('https://youtu.be/x')).toBe(true)
    expect(isVideoLink('https://notyoutube.com/x')).toBe(false)
    expect(isVideoLink(null)).toBe(false)
  })
})

describe('library', () => {
  test('ids are unique and URL-safe', () => {
    const ids = libraryList.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  test.each(libraryList.map((i) => [i.id, i]))('%s has the fields its page renders', (_, item) => {
    for (const key of ['title', 'shortDescription', 'fullDescription', 'image']) expect(item[key], key).toBeTruthy()
    for (const src of item.gallery || []) expect(typeof src, 'gallery entries are plain paths').toBe('string')
  })
})

describe('dated pages', () => {
  test('update stamps are real, past dates', () => {
    for (const stamp of [cv.CV_UPDATED, uses.USES_UPDATED]) {
      expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(`${stamp}T00:00:00Z`).toISOString().slice(0, 10)).toBe(stamp)
      expect(Date.parse(stamp)).toBeLessThanOrEqual(Date.now())
    }
  })
})

describe('image manifest', () => {
  const entries = Object.entries(IMAGES)

  test('every source and every generated width exists on disk', () => {
    const missing = []
    for (const [src, { ext, widths }] of entries) {
      if (!onDisk(src)) missing.push(src)
      const stem = src.slice(0, src.lastIndexOf('.'))
      for (const w of widths) if (!onDisk(`${stem}-${w}${ext}`)) missing.push(`${stem}-${w}${ext}`)
    }
    expect(missing).toEqual([])
  })

  test('?v= stamps match the current file contents', () => {
    const stale = entries
      .filter(([src]) => onDisk(src))
      .filter(([src, { v }]) => createHash('sha256').update(readFileSync(PUBLIC + src)).digest('hex').slice(0, 8) !== v)
      .map(([src]) => src)
    expect(stale, 'run: node web/make-image-variants.js').toEqual([])
  })

  test('widths are ascending (srcset and imageUrl rely on it)', () => {
    for (const [src, { widths }] of entries) expect([...widths].sort((a, b) => a - b), src).toEqual(widths)
  })

  test('imageProps builds a versioned srcset from the manifest', () => {
    const [src, { v, widths }] = entries.find(([, e]) => e.widths.length > 1)
    const props = imageProps(src, SIZES.contentColumn)
    expect(props.srcSet.split(', ')).toHaveLength(widths.length)
    expect(props.src).toContain(`-${widths.at(-1)}`)
    expect(props.src).toContain(`?v=${v}`)
    expect(props.sizes).toBe(SIZES.contentColumn)
    expect(imageProps('/unknown.webp')).toEqual({ src: '/unknown.webp' })
  })

  test('imageUrl picks the smallest width that is big enough', () => {
    const [src, { widths }] = entries.find(([, e]) => e.widths.length > 1)
    expect(imageUrl(src, widths[0] - 1)).toContain(`-${widths[0]}`)
    expect(imageUrl(src, widths[0] + 1)).toContain(`-${widths[1]}`)
    expect(imageUrl(src, 99_999)).toMatch(new RegExp(`^${src.replace('.', '\\.')}\\?v=`))
    expect(imageUrl('/unknown.webp', 100)).toBe('/unknown.webp')
  })
})
