import { describe, test, expect } from 'vitest'
import { normalizePath, parseRoute, staticPaths, projectPath, libraryPath, profilePath, dashboardPath } from '../../src/lib/router.js'
import { metaFor, headTags, lastmodFor, SITE_URL } from '../../src/lib/seo.js'
import { projectsList } from '../../src/lib/projects.js'
import { libraryList } from '../../src/lib/library.js'

describe('normalizePath', () => {
  test.each([
    ['/', '/'],
    ['', '/'],
    [undefined, '/'],
    ['/index.html', '/'],
    ['/projects/', '/projects'],
    ['/projects///', '/projects'],
    ['/cv.html', '/cv'],
    ['/library/index.html', '/library'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePath(input)).toBe(expected)
  })
})

describe('parseRoute', () => {
  test.each([
    ['/', 'home'],
    ['/projects', 'projects'],
    ['/library', 'library'],
    ['/reviews', 'reviews'],
    ['/uses', 'uses'],
    ['/cv', 'cv'],
    ['/contact', 'contact'],
    ['/login', 'login'],
    ['/dashboard', 'dashboard'],
    ['/nope', 'notFound'],
    ['/library/not-a-real-item', 'notFound'],
    ['/projects/not-a-real-project', 'notFound'],
    ['/dashboard/extra', 'notFound'],
  ])('%s → %s', (path, name) => {
    expect(parseRoute(path).name).toBe(name)
  })

  test('query strings and fragments do not change the route', () => {
    expect(parseRoute('/cv?utm_source=x')).toEqual({ name: 'cv' })
    expect(parseRoute('/dashboard#boards')).toEqual({ name: 'dashboard' })
  })

  test('profiles: /@handle (lowercased, decoded) and the legacy /u/handle redirect', () => {
    expect(parseRoute('/@Kostis')).toEqual({ name: 'profile', handle: 'kostis' })
    expect(parseRoute('/@')).toEqual({ name: 'profile', handle: null })
    expect(parseRoute('/u/Old_Name')).toEqual({ name: 'profile', handle: 'old_name', redirect: '/@old_name' })
  })

  test('every real project and library item resolves', () => {
    for (const p of projectsList) expect(parseRoute(`/projects/${p.id}`)).toEqual({ name: 'projects', projectId: p.id, redirect: projectPath(p.id) })
    for (const item of libraryList) expect(parseRoute(libraryPath(item.id))).toEqual({ name: 'library', itemId: item.id })
  })

  test.fails.each(['/@%', '/@%E0%A4%A', '/library/%zz', '/u/%'])('BUG: malformed escapes in %s give notFound instead of throwing', (path) => {
    expect(parseRoute(path).name).toBe('notFound')
  })

  test('path builders encode what they are given', () => {
    expect(projectPath('a b')).toBe('/projects#a%20b')
    expect(libraryPath('x/y')).toBe('/library/x%2Fy')
    expect(profilePath('ünï')).toBe('/@%C3%BCn%C3%AF')
    expect(dashboardPath()).toBe('/dashboard')
    expect(dashboardPath('boards')).toBe('/dashboard#boards')
  })
})

describe('SEO metadata for every prerendered page', () => {
  const pages = staticPaths()
  const LONG_DESCRIPTION_BASELINE = new Set(['/library/battlepass', '/library/direct-roleplay-inventory'])

  test('static paths are unique and all resolve to real routes', () => {
    expect(new Set(pages).size).toBe(pages.length)
    for (const p of pages) expect(parseRoute(p).name, p).not.toBe('notFound')
  })

  test.each(pages)('%s has a unique, well-sized title and description', (path) => {
    const { title, description } = metaFor(path)
    expect(title.length, 'title').toBeGreaterThan(10)
    expect(title.length, `title "${title}" is cut off in search results past ~65 chars`).toBeLessThanOrEqual(65)
    expect(description.length, 'description').toBeGreaterThanOrEqual(50)
    if (LONG_DESCRIPTION_BASELINE.has(path)) expect(description.length, 'fixed? remove it from the baseline').toBeGreaterThan(170)
    else expect(description.length, `description is truncated past ~170 chars (${description.length})`).toBeLessThanOrEqual(170)
    const others = pages.filter((p) => p !== path).map((p) => metaFor(p).title)
    expect(others, 'duplicate title').not.toContain(title)
  })

  test.each(pages)('%s head tags: canonical, OG/Twitter, valid JSON-LD', (path) => {
    const head = headTags(path)
    const { noindex } = metaFor(path)
    if (!noindex) expect(head).toContain(`<link rel="canonical" href="${SITE_URL}${path}" />`)
    for (const prop of ['og:title', 'og:description', 'og:url', 'og:image', 'twitter:card']) expect(head).toMatch(new RegExp(`(property|name)="${prop}"`))
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(head)
    if (ld) {
      const data = JSON.parse(ld[1])
      expect(data['@context']).toBe('https://schema.org')
    }
    expect(head.match(/<title>/g)).toHaveLength(1)
  })

  test('titles and JSON-LD cannot break out of their HTML context', () => {
    const head = headTags(staticPaths().find((p) => p.startsWith('/library/')))
    const scripts = head.match(/<script[\s\S]*?<\/script>/g) || []
    for (const s of scripts) expect(s.slice(8, -9)).not.toContain('<')
    expect(head).not.toMatch(/content="[^"]*"[^ />]/)
  })

  test('uses and cv carry their own lastmod dates', () => {
    expect(lastmodFor('/uses')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(lastmodFor('/cv')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(lastmodFor('/projects')).toBeNull()
  })
})
