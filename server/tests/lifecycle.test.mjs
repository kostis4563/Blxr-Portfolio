import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { mkdtemp, writeFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { startServer, bearer, readState, FULL_ENV, SERVER, FAKE } from './support/server.mjs'

const owner = () => bearer({ sub: 'owner', n: crypto.randomUUID() })
const valid = (over = {}) => ({ name: 'Ada Lovelace', role: 'Engineer', rating: 5, text: 'Great work, delivered on time and well documented.', ...over })
const newStateDir = () => mkdtemp(path.join(os.tmpdir(), 'blxr-state-'))
const cookieHash = (cookie) => crypto.createHash('sha256').update(`${FULL_ENV.REVIEW_SALT}:cookie:${cookie}`).digest('hex').slice(0, 16)
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString()
const DAY = 86_400_000

describe('graceful shutdown and restart', () => {
  test('SIGTERM writes every state file; a restart picks them all up', async () => {
    const stateDir = await newStateDir()
    const first = await startServer({ stateDir })
    const posted = await first.request('/api/reviews', { method: 'POST', body: valid({ name: 'Survivor' }) })
    await first.request('/api/hit', { method: 'POST', body: { path: '/cv' } })
    await first.request('/api/vitals', { method: 'POST', body: { m: 'CLS', v: 0.01 } })
    await first.request('/api/reviews/invites', { method: 'POST', headers: owner(), body: { name: 'Kept Invite' } })
    await first.request('/api/reviews/panel/settings', { method: 'PUT', headers: owner(), body: { blockedTerms: ['persisted'] } })

    const { code } = await first.stop('SIGTERM')
    assert.equal(code, 0)
    const files = await readdir(stateDir)
    for (const f of ['reviews.json', 'hits.json', 'vitals.json', 'review-invites.json', 'review-settings.json', 'logs.json', 'chart-history.json']) {
      assert.ok(files.includes(f), `${f} was written`)
    }
    await first.cleanup({ keepState: true })

    const second = await startServer({ stateDir })
    try {
      assert.ok((await second.request('/api/reviews')).body.items.some((r) => r.id === posted.body.item.id))
      assert.equal((await second.request('/api/hits', { headers: owner() })).body.today['/cv'], 1)
      assert.equal((await second.request('/api/vitals?days=1', { headers: owner() })).body.metrics.CLS.samples, 1)
      const panel = (await second.request('/api/reviews/panel', { headers: owner() })).body
      assert.deepEqual(panel.settings.blockedTerms, ['persisted'])
      assert.equal(panel.invites[0].name, 'Kept Invite')
      const logs = (await second.request('/api/logs?q=stopping', { headers: owner() })).body
      assert.equal(logs.matched, 1, 'the shutdown itself was logged and persisted')
    } finally {
      await second.cleanup()
    }
  })

  test('SIGINT is handled the same way', async () => {
    const srv = await startServer()
    await srv.request('/api/hit', { method: 'POST', body: { path: '/' } })
    assert.equal((await srv.stop('SIGINT')).code, 0)
    assert.ok((await readdir(srv.stateDir)).includes('hits.json'))
    await srv.cleanup()
  })
})

describe('privacy retention', () => {
  test('submitter hashes are erased from reviews older than three days', async () => {
    const stateDir = await newStateDir()
    const hashes = { ipHash: 'aaaaaaaaaaaaaaaa', deviceHash: 'bbbbbbbbbbbbbbbb', cookieHash: 'cccccccccccccccc' }
    await writeFile(
      path.join(stateDir, 'reviews.json'),
      JSON.stringify([
        { id: 'old00001', name: 'Old Review', role: '', rating: 4, text: 'x'.repeat(30), at: iso(4 * DAY), ...hashes },
        { id: 'new00001', name: 'New Review', role: '', rating: 5, text: 'y'.repeat(30), at: iso(DAY), ...hashes },
      ]),
    )
    const srv = await startServer({ stateDir })
    await srv.request('/api/reviews', { method: 'POST', body: valid({ name: 'Trigger Save' }) })
    await srv.stop()
    const saved = await readState(stateDir, 'reviews.json')
    const old = saved.find((r) => r.id === 'old00001')
    const recent = saved.find((r) => r.id === 'new00001')
    for (const key of Object.keys(hashes)) {
      assert.equal(old[key], undefined, `old review lost ${key}`)
      assert.equal(recent[key], hashes[key], `recent review keeps ${key} (it still rate-limits)`)
    }
    await srv.cleanup()
  })

  test('page-hit and vitals history older than 90 days is pruned', async () => {
    const stateDir = await newStateDir()
    const ancient = new Date(Date.now() - 100 * DAY).toISOString().slice(0, 10)
    const recent = new Date(Date.now() - 10 * DAY).toISOString().slice(0, 10)
    await writeFile(path.join(stateDir, 'hits.json'), JSON.stringify({ [ancient]: { '/': 5 }, [recent]: { '/': 3 } }))
    await writeFile(path.join(stateDir, 'vitals.json'), JSON.stringify({ [ancient]: {}, [recent]: {} }))
    const srv = await startServer({ stateDir })
    await srv.request('/api/hit', { method: 'POST', body: { path: '/' } })
    await srv.request('/api/vitals', { method: 'POST', body: { m: 'LCP', v: 100 } })
    await srv.stop()
    for (const file of ['hits.json', 'vitals.json']) {
      const days = Object.keys(await readState(stateDir, file))
      assert.ok(!days.includes(ancient), `${file} pruned`)
      assert.ok(days.includes(recent), `${file} kept recent`)
    }
    await srv.cleanup()
  })
})

describe('hostile or damaged state', () => {
  test('corrupt state files do not stop the server from starting', async () => {
    const stateDir = await newStateDir()
    for (const f of ['reviews.json', 'hits.json', 'vitals.json', 'review-invites.json', 'review-settings.json', 'chart-history.json', 'logs.json']) {
      await writeFile(path.join(stateDir, f), '{"truncated": ')
    }
    const srv = await startServer({ stateDir })
    try {
      assert.equal((await srv.request('/api/music/health')).status, 200)
      assert.deepEqual((await srv.request('/api/reviews')).body, { items: [], total: 0 })
    } finally {
      await srv.cleanup()
    }
  })

  test('malformed review and invite records are discarded on load', async () => {
    const stateDir = await newStateDir()
    const good = { id: 'good0001', name: 'Good One', rating: 5, text: 'z'.repeat(30), at: iso(DAY) }
    await writeFile(
      path.join(stateDir, 'reviews.json'),
      JSON.stringify([good, { ...good, id: 'BAD!' }, { ...good, id: 'bad00002', rating: 9 }, { ...good, id: 'bad00003', at: 'yesterday' }, null, 'str']),
    )
    await writeFile(path.join(stateDir, 'review-invites.json'), JSON.stringify([{ token: 'nothex', name: 'x', createdAt: iso(0), expiresAt: iso(0) }]))
    const srv = await startServer({ stateDir })
    try {
      assert.deepEqual((await srv.request('/api/reviews')).body.items.map((r) => r.id), ['good0001'])
      assert.deepEqual((await srv.request('/api/reviews/invites', { headers: owner() })).body.items, [])
    } finally {
      await srv.cleanup()
    }
  })
})

describe('time-based behaviour', () => {
  test('an invite that expired unused becomes an automatic review at startup', async () => {
    const stateDir = await newStateDir()
    const token = 'f'.repeat(32)
    await writeFile(
      path.join(stateDir, 'review-invites.json'),
      JSON.stringify([{ token, name: 'Quiet Client', role: 'Owner', text: '', rating: 4, createdAt: iso(5 * DAY), expiresAt: iso(DAY), reviewId: null, auto: false }]),
    )
    const srv = await startServer({ stateDir })
    try {
      const item = (await srv.request('/api/reviews')).body.items.find((r) => r.name === 'Quiet Client')
      assert.ok(item, 'auto review posted')
      assert.equal(item.auto, true)
      assert.equal(item.rating, 4)
      assert.equal(item.text, 'Rated without leaving a written review.')
      assert.equal((await srv.request(`/api/reviews/invites/${token}`)).body.invite.status, 'auto')
    } finally {
      await srv.cleanup()
    }
  })

  test('authors can edit for 15 minutes, not after', async () => {
    const stateDir = await newStateDir()
    const cookie = '1'.repeat(32)
    const base = { role: '', rating: 5, text: 'q'.repeat(30), cookieHash: cookieHash(cookie) }
    await writeFile(
      path.join(stateDir, 'reviews.json'),
      JSON.stringify([
        { id: 'fresh001', name: 'Fresh Author', at: iso(5 * 60_000), ...base },
        { id: 'stale001', name: 'Stale Author', at: iso(20 * 60_000), ...base },
      ]),
    )
    const srv = await startServer({ stateDir })
    try {
      const headers = { cookie: `blxr_rv=${cookie}` }
      assert.equal((await srv.request('/api/reviews/fresh001', { method: 'PATCH', headers, body: valid({ name: 'Fresh Author' }) })).status, 200)
      const stale = await srv.request('/api/reviews/stale001', { method: 'PATCH', headers, body: valid({ name: 'Stale Author' }) })
      assert.equal(stale.status, 403)
      assert.equal(stale.body.error, 'edit_window')
    } finally {
      await srv.cleanup()
    }
  })
})

describe('startup failures', () => {
  test('a taken port exits with code 1 and a helpful message', async () => {
    const srv = await startServer()
    const fakeDir = await mkdtemp(path.join(os.tmpdir(), 'blxr-fake-'))
    try {
      const clash = spawn(process.execPath, ['--import', FAKE, SERVER], {
        env: { PATH: process.env.PATH, PORT: String(srv.port), STATE_DIRECTORY: srv.stateDir, FAKE_UPSTREAM_DIR: fakeDir },
      })
      let out = ''
      clash.stdout.on('data', (d) => (out += d))
      clash.stderr.on('data', (d) => (out += d))
      const code = await new Promise((resolve) => clash.on('exit', resolve))
      assert.equal(code, 1)
      assert.match(out, /already in use/)
    } finally {
      await srv.cleanup()
      await rm(fakeDir, { recursive: true, force: true })
    }
  })

  test('the server only listens on loopback (nginx is the public face)', async () => {
    const srv = await startServer()
    try {
      assert.match(srv.output(), /on http:\/\/127\.0\.0\.1:\d+/)
      const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)
      if (lan) {
        await assert.rejects(fetch(`http://${lan.address}:${srv.port}/api/music/health`, { signal: AbortSignal.timeout(2000) }))
      }
    } finally {
      await srv.cleanup()
    }
  })
})
