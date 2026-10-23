import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  LIMITS,
  THEME_IDS,
  LAYOUT_IDS,
  DEFAULT_TITLE,
  paletteOf,
  slideFrom,
  slideToJson,
  newSlide,
  duplicateSlide,
  moveSlide,
  sectionNumber,
  slideLabel,
  templateSlides,
  blankDeck,
  deckFrom,
  deckToRow,
  newToken,
  TOKEN_RE,
  shareUrl,
  tokenFromHash,
  keyAction,
  formatClock,
  editedLabel,
  imagesOf,
} from '../../src/lib/presentations.js'

const SQL = readFileSync(fileURLToPath(new URL('../../../deploy/supabase/presentations.sql', import.meta.url)), 'utf8')
const key = (k, extra = {}) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...extra })

describe('slides', () => {
  test('slideFrom fills every field and drops junk', () => {
    const slide = slideFrom({ id: 'a', layout: 'nope', tone: 'neon', align: 'right', title: 5, points: ['one', 2, 'two'], image: { path: '' } })
    expect(slide).toMatchObject({ id: 'a', layout: 'title', tone: 'theme', align: 'left', title: '', points: ['one', 'two'], image: null, notes: '' })
  })

  test('slideFrom caps text and lists at the limits', () => {
    const slide = slideFrom({ title: 'x'.repeat(500), points: Array.from({ length: 20 }, () => 'y'.repeat(500)) })
    expect(slide.title).toHaveLength(LIMITS.heading)
    expect(slide.points).toHaveLength(LIMITS.points)
    expect(slide.points[0]).toHaveLength(LIMITS.point)
  })

  test('slideToJson keeps only what is set and trims trailing empty points', () => {
    const json = slideToJson(slideFrom({ id: 'a', layout: 'bullets', title: 'Hi', points: ['one', '', 'two  ', '', ''] }))
    expect(json).toEqual({ id: 'a', layout: 'bullets', title: 'Hi', points: ['one', '', 'two'] })
    expect(slideToJson(slideFrom({ id: 'b', layout: 'quote', tone: 'accent', align: 'center' }))).toEqual({ id: 'b', layout: 'quote', tone: 'accent', align: 'center' })
  })

  test('a slide survives the round trip through the database shape', () => {
    const slide = newSlide('split', { title: 'T', points: ['a'], image: { path: 'u/d/x.webp', alt: 'A', fit: 'contain' }, notes: 'say this' })
    expect(slideFrom(slideToJson(slide))).toEqual(slide)
  })

  test('duplicates get a fresh id and their own image object', () => {
    const slide = newSlide('split', { image: { path: 'u/d/x.webp', alt: '', fit: 'cover' } })
    const copy = duplicateSlide(slide)
    expect(copy.id).not.toBe(slide.id)
    expect(copy.image).toEqual(slide.image)
    expect(copy.image).not.toBe(slide.image)
  })

  test('moveSlide moves and clamps', () => {
    const list = ['a', 'b', 'c', 'd']
    expect(moveSlide(list, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveSlide(list, 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(moveSlide(list, 1, 99)).toEqual(['a', 'c', 'd', 'b'])
    expect(moveSlide(list, 2, 2)).toBe(list)
  })

  test('section numbers count section slides up to the one asked about', () => {
    const slides = ['title', 'section', 'bullets', 'section', 'stat'].map((layout) => newSlide(layout))
    expect(sectionNumber(slides, 1)).toBe('01')
    expect(sectionNumber(slides, 2)).toBe('01')
    expect(sectionNumber(slides, 3)).toBe('02')
    expect(sectionNumber(slides, 0)).toBe('01')
  })

  test('labels fall back from the title to whatever text there is, then the layout', () => {
    expect(slideLabel(newSlide('quote', { quote: 'Be brief.' }))).toBe('Be brief.')
    expect(slideLabel(newSlide('bullets', { points: ['', 'Second'] }))).toBe('Second')
    expect(slideLabel(newSlide('stat'))).toBe('Big number')
  })

  test('imagesOf lists the image paths in order', () => {
    const slides = [newSlide('image', { image: { path: 'a' } }), newSlide('title'), newSlide('split', { image: { path: 'b' } })]
    expect(imagesOf(slides)).toEqual(['a', 'b'])
  })
})

describe('decks', () => {
  test('templates start with a title slide and the outline uses every layout', () => {
    expect(templateSlides('blank').map((slide) => slide.layout)).toEqual(['title'])
    const outline = templateSlides('outline')
    expect(outline[0].layout).toBe('title')
    for (const layout of LAYOUT_IDS.filter((id) => id !== 'image')) expect(outline.some((slide) => slide.layout === layout), layout).toBe(true)
  })

  test('deckFrom never hands back an empty deck or an unknown theme', () => {
    const deck = deckFrom({ id: 'x', title: '', theme: 'neon', transition: 'spin', slides: [], numbers: null })
    expect(deck).toMatchObject({ title: DEFAULT_TITLE, theme: 'midnight', transition: 'fade', numbers: true })
    expect(deck.slides).toHaveLength(1)
  })

  test('deckToRow maps only the fields in the patch', () => {
    expect(deckToRow({ title: '  Q3  ' })).toEqual({ title: 'Q3' })
    expect(deckToRow({ title: '   ' })).toEqual({ title: DEFAULT_TITLE })
    expect(deckToRow({ shareToken: null, numbers: false })).toEqual({ share_token: null, numbers: false })
    const row = deckToRow(blankDeck({ template: 'outline', theme: 'paper' }))
    expect(row.theme).toBe('paper')
    expect(row.slides).toHaveLength(8)
    expect(row.slides.every((slide) => typeof slide.id === 'string' && slide.id.length <= 32)).toBe(true)
  })

  test('accent and inverted tones paint a solid background', () => {
    for (const id of THEME_IDS) {
      for (const tone of ['accent', 'invert']) {
        const palette = paletteOf(id, tone)
        expect(palette.paint, `${id}/${tone}`).toBe(palette.base)
        expect(palette.ink).not.toBe(palette.base)
      }
    }
  })

  test('the SQL accepts exactly the themes and layouts the app offers', () => {
    const themes = /theme in \(([^)]*)\)/.exec(SQL)[1].match(/'([a-z]+)'/g).map((s) => s.slice(1, -1))
    const layouts = /'layout', ''\) not in \(([^)]*)\)/.exec(SQL)[1].match(/'([a-z]+)'/g).map((s) => s.slice(1, -1))
    expect(themes).toEqual(THEME_IDS)
    expect(layouts).toEqual(LAYOUT_IDS)
    expect(SQL).toContain(`between 1 and ${LIMITS.slides}`)
    expect(SQL).toContain(`> ${LIMITS.notes}`)
    expect(SQL).toContain(`>= ${LIMITS.decks}`)
  })

  test('the share function never returns speaker notes', () => {
    const fn = /create or replace function public\.shared_presentation[\s\S]*?\$\$;/.exec(SQL)[0]
    expect(fn).toMatch(/s - 'notes'/)
    expect(fn).not.toMatch(/p\.slides,/)
  })
})

describe('sharing', () => {
  test('tokens are long, url-safe and different every time', () => {
    const a = newToken()
    const b = newToken()
    expect(a).toMatch(TOKEN_RE)
    expect(a).toHaveLength(24)
    expect(a).not.toBe(b)
  })

  test('the share link puts the token in the hash, where it never reaches a server log', () => {
    expect(shareUrl('A'.repeat(24), 'https://kostis.wtf')).toBe(`https://kostis.wtf/present#${'A'.repeat(24)}`)
  })

  test('tokenFromHash reads the token and ignores a slide number', () => {
    const token = `${'a'.repeat(11)}_-${'B'.repeat(11)}`
    expect(tokenFromHash(`#${token}`)).toBe(token)
    expect(tokenFromHash(`#${token}/4`)).toBe(token)
    expect(tokenFromHash('#short')).toBe(null)
    expect(tokenFromHash('#<script>')).toBe(null)
    expect(tokenFromHash('')).toBe(null)
  })
})

describe('presenter keys', () => {
  test('the usual presentation keys map to actions', () => {
    expect(keyAction(key('ArrowRight'))).toBe('next')
    expect(keyAction(key(' '))).toBe('next')
    expect(keyAction(key(' ', { shiftKey: true }))).toBe('prev')
    expect(keyAction(key('PageUp'))).toBe('prev')
    expect(keyAction(key('B'))).toBe('black')
    expect(keyAction(key('s'))).toBe('speaker')
    expect(keyAction(key('7'))).toBe('digit')
    expect(keyAction(key('Escape'))).toBe('close')
  })

  test('shortcuts with a modifier are left to the browser', () => {
    expect(keyAction(key('ArrowRight', { metaKey: true }))).toBe(null)
    expect(keyAction(key('f', { ctrlKey: true }))).toBe(null)
    expect(keyAction(key('q'))).toBe(null)
  })

  test('formatClock reads like a stopwatch', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(65_400)).toBe('01:05')
    expect(formatClock(3_725_000)).toBe('1:02:05')
    expect(formatClock(-5)).toBe('00:00')
  })

  test('editedLabel gets coarser as time passes', () => {
    const now = new Date('2026-10-23T12:00:00Z').getTime()
    expect(editedLabel('2026-10-23T11:59:30Z', now)).toBe('Edited just now')
    expect(editedLabel('2026-10-23T11:15:00Z', now)).toBe('Edited 45 min ago')
    expect(editedLabel('2026-10-23T07:00:00Z', now)).toBe('Edited 5 h ago')
    expect(editedLabel('2026-10-01T07:00:00Z', now)).toBe('Edited 1 Oct')
    expect(editedLabel('2025-10-01T07:00:00Z', now)).toBe('Edited 1 Oct 2025')
  })
})
