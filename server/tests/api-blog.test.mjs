import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, bearer, FULL_ENV } from './support/server.mjs'

let srv
let n = 0
const OWNER = () => bearer({ sub: 'owner', n: ++n })
const MEMBER = () => bearer({ sub: 'member', n: ++n })

const post = (title, body = 'Hello there.', extra = '') => `---\ntitle: ${title}\ndate: 2026-10-06\n${extra}---\n\n${body}\n`
const SEED = {
  'web/src/content/blog/first-post.md': post('First post'),
  'web/src/content/blog/notes.txt': 'not a post',
  'web/public/blog/old.webp': 'img',
}

before(async () => {
  srv = await startServer({ scenario: { blogFiles: SEED } })
})
after(() => srv?.cleanup())

const list = async () => (await srv.request('/api/blog/posts', { headers: OWNER() })).body.items
const put = (slug, body, headers = OWNER()) => srv.request(`/api/blog/posts/${slug}`, { method: 'PUT', headers, body })

describe('blog: access', () => {
  test('only the owner gets in', async () => {
    assert.equal((await srv.request('/api/blog/posts')).status, 401)
    assert.equal((await srv.request('/api/blog/posts', { headers: MEMBER() })).status, 401)
    assert.equal((await put('x', { source: post('X') }, MEMBER())).status, 401)
    assert.equal((await srv.request('/api/blog/posts', { headers: OWNER() })).status, 200)
  })

  test('is switched off without BLOG_REPO', async () => {
    const off = await startServer({ env: { ...FULL_ENV, BLOG_REPO: '' } })
    try {
      const res = await off.request('/api/blog/posts', { headers: OWNER() })
      assert.deepEqual([res.status, res.body], [503, { error: 'blog_disabled' }])
    } finally {
      await off.cleanup()
    }
  })

  test('says so when the token cannot write the repo', async () => {
    await srv.scenario({ blogFiles: SEED, blogRepo: 'forbidden' })
    try {
      const res = await srv.request('/api/blog/posts', { headers: OWNER() })
      assert.deepEqual([res.status, res.body], [503, { error: 'blog_forbidden' }])
    } finally {
      await srv.scenario({ blogFiles: SEED })
    }
  })
})

describe('blog: posts', () => {
  test('lists the markdown files with their source and sha', async () => {
    const res = await srv.request('/api/blog/posts', { headers: OWNER() })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.deepEqual(res.body.repo, 'octo/site')
    const [first, ...others] = res.body.items
    assert.equal(others.length, 0, 'notes.txt is not a post')
    assert.equal(first.slug, 'first-post')
    assert.match(first.sha, /^[0-9a-f]{40}$/)
    assert.equal(first.source, SEED['web/src/content/blog/first-post.md'])
  })

  test('publishes a new post as one commit, images included', async () => {
    await srv.clearCalls()
    const source = post('Second: the sequel', 'Look ![a](/blog/shot-ab12cd.png)')
    const res = await put('second-post', { source, images: [{ name: 'shot-ab12cd.png', type: 'image/png', data: Buffer.from('png!').toString('base64') }] })
    assert.equal(res.status, 201)
    assert.equal(res.body.item.source, source)
    assert.match(res.body.commit.url, /^https:\/\/github\.com\/octo\/site\/commit\/[0-9a-f]{40}$/)

    const commits = (await srv.calls((c) => c.url.endsWith('/git/commits') && c.method === 'POST')).map((c) => JSON.parse(c.body))
    assert.equal(commits.length, 1)
    assert.equal(commits[0].message, 'Blog: publish "Second: the sequel" (+1 image)')
    const tree = JSON.parse((await srv.calls((c) => c.url.endsWith('/git/trees')))[0].body).tree
    assert.deepEqual(tree.map((e) => e.path), ['web/src/content/blog/second-post.md', 'web/public/blog/shot-ab12cd.png'])

    const items = await list()
    assert.equal(items.find((p) => p.slug === 'second-post').sha, res.body.item.sha, 'the returned sha is the one GitHub stores')
  })

  test('refuses to publish over an existing post', async () => {
    const res = await put('first-post', { source: post('Again') })
    assert.deepEqual([res.status, res.body], [409, { error: 'exists' }])
  })

  test('updates with the current sha, refuses a stale one', async () => {
    const { sha } = (await list()).find((p) => p.slug === 'first-post')
    const ok = await put('first-post', { source: post('First post, edited'), sha })
    assert.equal(ok.status, 200)
    const stale = await put('first-post', { source: post('Lost update'), sha })
    assert.deepEqual([stale.status, stale.body], [409, { error: 'conflict' }])
    assert.match((await list()).find((p) => p.slug === 'first-post').source, /First post, edited/)
  })

  test('rejects a post the build would fail on, before touching GitHub', async () => {
    await srv.clearCalls()
    const cases = [
      ['no frontmatter at all', 'just text', ['frontmatter']],
      ['an unknown key', post('T', 'x', 'colour: red\n'), ['frontmatter']],
      ['a missing title', '---\ndate: 2026-10-06\n---\nx', ['title']],
      ['a bad date', '---\ntitle: T\ndate: 6/10/2026\n---\nx', ['date']],
      ['a relative cover', post('T', 'x', 'cover: pic.webp\n'), ['cover']],
    ]
    for (const [what, source, fields] of cases) {
      const res = await put('bad-post', { source })
      assert.deepEqual([res.status, res.body], [400, { error: 'invalid', fields }], what)
    }
    assert.equal((await put('Bad_Slug', { source: post('T') })).status, 400)
    assert.equal((await put('ok-slug', { source: post('T'), images: [{ name: '../x.png', type: 'image/png', data: 'AA==' }] })).status, 400)
    assert.equal((await put('ok-slug', { source: post('T'), images: [{ name: 'x.svg', type: 'image/svg+xml', data: 'AA==' }] })).status, 400)
    assert.equal((await srv.calls('api.github.com/repos')).length, 0)
  })

  test('deletes with the current sha', async () => {
    const { sha } = (await list()).find((p) => p.slug === 'second-post')
    assert.equal((await srv.request('/api/blog/posts/second-post?sha=' + 'f'.repeat(40), { method: 'DELETE', headers: OWNER() })).status, 409)
    const res = await srv.request(`/api/blog/posts/second-post?sha=${sha}`, { method: 'DELETE', headers: OWNER() })
    assert.equal(res.status, 200)
    assert.equal((await list()).some((p) => p.slug === 'second-post'), false)
  })
})

describe('blog: deploy status', () => {
  const sha = 'a'.repeat(40)
  const state = async (runs) => {
    await srv.scenario({ blogFiles: SEED, blogRuns: { [sha]: runs } })
    return (await srv.request(`/api/blog/deploy?sha=${sha}`, { headers: OWNER() })).body
  }

  test('follows the Actions run for the commit', async () => {
    const url = 'https://github.com/octo/site/actions/runs/1'
    assert.deepEqual(await state([]), { state: 'queued', url: null })
    assert.deepEqual(await state([{ event: 'push', status: 'queued', html_url: url }]), { state: 'queued', url })
    assert.deepEqual(await state([{ event: 'push', status: 'in_progress', html_url: url }]), { state: 'building', url })
    assert.deepEqual(await state([{ event: 'push', status: 'completed', conclusion: 'success', html_url: url }]), { state: 'live', url })
    assert.deepEqual(await state([{ event: 'push', status: 'completed', conclusion: 'failure', html_url: url }]), { state: 'failed', url })
    await srv.scenario({ blogFiles: SEED })
  })

  test('needs a full commit sha', async () => {
    assert.equal((await srv.request('/api/blog/deploy?sha=abc', { headers: OWNER() })).status, 400)
  })
})
