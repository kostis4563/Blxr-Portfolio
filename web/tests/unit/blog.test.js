import { describe, test, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from '../../blog-plugin.js'
import { serializePost, readMeta, postSlugFor, renderMarkdown } from '../../src/lib/blog-markdown.js'
import { postsList, findPost, adjacentPosts, postsByYear, matchesPost } from '../../src/lib/blog.js'
import { parseRoute, blogPath, staticPaths } from '../../src/lib/router.js'
import { metaFor, headTags, labelFor, lastmodFor } from '../../src/lib/seo.js'
import sample from '../../src/content/blog/how-to-write-a-post.md'

const PUBLIC = fileURLToPath(new URL('../../public', import.meta.url))

describe('parseFrontmatter', () => {
  test('reads strings, quoted strings, booleans and lists', () => {
    const { data, body } = parseFrontmatter('---\ntitle: "Hi: there"\ndate: 2026-01-02\ntags: [a, "b c"]\ndraft: true\n---\nBody')
    expect(data).toEqual({ title: 'Hi: there', date: '2026-01-02', tags: ['a', 'b c'], draft: true })
    expect(body).toBe('Body')
  })

  test('rejects a missing block and unknown keys', () => {
    expect(() => parseFrontmatter('# no frontmatter')).toThrow(/--- block/)
    expect(() => parseFrontmatter('---\ntitel: x\n---\n')).toThrow(/unknown frontmatter key "titel"/)
  })
})

describe('posts', () => {
  test('are sorted newest first with the derived fields filled in', () => {
    const dates = postsList.map((post) => post.date)
    expect(dates).toEqual([...dates].sort().reverse())
    for (const post of postsList) {
      expect(post.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(post.title).toBeTruthy()
      expect(post.description).toBeTruthy()
      expect(post.minutes).toBeGreaterThanOrEqual(1)
    }
  })

  test('every post and its cover resolve', () => {
    for (const post of postsList) {
      expect(parseRoute(blogPath(post.slug))).toEqual({ name: 'blog', slug: post.slug })
      expect(staticPaths()).toContain(blogPath(post.slug))
      if (post.cover) expect(existsSync(PUBLIC + post.cover), post.cover).toBe(true)
    }
  })

  test('adjacent posts, year groups and filtering', () => {
    const [first] = postsList
    expect(adjacentPosts(first.slug).newer).toBeNull()
    expect(adjacentPosts('nope')).toEqual({ newer: null, older: null })
    expect(postsByYear(postsList).flatMap((g) => g.posts)).toEqual(postsList)
    expect(matchesPost(first, '', null)).toBe(true)
    expect(matchesPost(first, 'zzzz-no-match', null)).toBe(false)
    expect(matchesPost(first, '', 'not-a-tag')).toBe(false)
  })
})

describe('the sample post', () => {
  const meta = findPost('how-to-write-a-post')

  test('is a draft, visible outside production builds only', () => {
    expect(meta.draft).toBe(true)
    expect(metaFor(blogPath(meta.slug)).noindex).toBe(true)
  })

  test('renders highlighted code, callouts, figures and a table of contents', () => {
    expect(sample.html).toContain('<figure class="code-block" data-lang="js">')
    expect(sample.html).toContain('<span class="code-title">server.mjs</span>')
    expect(sample.html).toContain('--shiki-dark:')
    expect(sample.html).toContain('<aside class="callout" data-kind="tip">')
    expect(sample.html).toContain('<figure class="post-figure">')
    expect(sample.html).toContain('<div class="table-wrap"><table>')
    expect(sample.html).toMatch(/<a href="https:\/\/github.com" target="_blank" rel="noreferrer" class="external">/)
    expect(sample.toc[0]).toEqual({ id: 'the-frontmatter', text: 'The frontmatter', depth: 2 })
    expect(sample.toc.some((item) => item.depth === 3)).toBe(true)
  })

  test('gets article metadata', () => {
    const path = blogPath(meta.slug)
    const head = headTags(path)
    expect(head).toContain('<meta property="og:type" content="article" />')
    expect(head).toContain(`<meta property="article:published_time" content="${meta.date}" />`)
    expect(head).toContain('"@type":"BlogPosting"')
    expect(labelFor(path)).toBe(meta.title.slice(0, 18))
    expect(lastmodFor(path)).toBe(meta.date)
  })
})

describe('the dashboard editor format', () => {
  const roundTrip = (fields, body = 'Hello.') => parseFrontmatter(serializePost(fields, body)).data

  test('serializePost writes what parseFrontmatter reads back', () => {
    const fields = { title: 'Ship it: a story', date: '2026-10-06', updated: '2026-10-08', description: 'Short and sweet', tags: ['Go', ' web ', ''], cover: '/blog/c.webp', draft: true }
    expect(roundTrip(fields)).toEqual({ title: 'Ship it: a story', date: '2026-10-06', updated: '2026-10-08', description: 'Short and sweet', tags: ['go', 'web'], cover: '/blog/c.webp', draft: true })
  })

  test('values that would read as something else are quoted', () => {
    expect(roundTrip({ title: 'true', date: '2026-10-06' }).title).toBe('true')
    expect(roundTrip({ title: '[not a list]', date: '2026-10-06' }).title).toBe('[not a list]')
    expect(roundTrip({ title: '"Quoted"', date: '2026-10-06' }).title).toBe('"Quoted"')
    expect(roundTrip({ title: 'The users\'', date: '2026-10-06' }).title).toBe("The users'")
    expect(roundTrip({ title: 'A\nB', date: '2026-10-06', description: 'one\n\ntwo' })).toMatchObject({ title: 'A B', description: 'one two' })
  })

  test('leaves optional fields out and passes the build checks', () => {
    const source = serializePost({ title: 'Plain', date: '2026-10-06', updated: '2026-10-06', tags: [] }, '\n\nBody text\r\n\n')
    expect(source).toBe('---\ntitle: Plain\ndate: 2026-10-06\n---\n\nBody text\n')
    expect(readMeta('plain', source, 'plain.md').meta).toMatchObject({ title: 'Plain', updated: null, draft: false })
  })

  test('postSlugFor makes a URL that always passes the slug rule', () => {
    expect(postSlugFor('Hello, World! Ünïcode & more')).toBe('hello-world-unicode-more')
    expect(postSlugFor('Γειά σου, κόσμε')).toBe('geia-sou-kosme')
    expect(postSlugFor('日本語')).toBe('')
    expect(postSlugFor('a'.repeat(100) + ' b')).toHaveLength(80)
  })

  test('the preview renderer escapes code without shiki', () => {
    const { html } = renderMarkdown('```js\nconst a = "<b>"\n```')
    expect(html).toContain('<pre class="shiki"><code>const a = &quot;&lt;b&gt;&quot;</code></pre>')
  })
})
