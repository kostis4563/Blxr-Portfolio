import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, bearer, FULL_ENV } from './support/server.mjs'

const ENV = { ...FULL_ENV, STATUS_RETRY_MS: '0' }
const SCENARIO = { status: { '/site.webmanifest': 503 } }

let srv
before(async () => {
  srv = await startServer({ env: ENV, scenario: SCENARIO })
})
after(() => srv?.cleanup())

async function firstCheck(server) {
  for (let i = 0; i < 200; i++) {
    const res = await server.request('/api/status')
    if (res.body?.checkedAt && res.body.services.every((s) => s.state !== 'unknown')) return res
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`no status check finished:\n${server.output()}`)
}

describe('/api/status', () => {
  test('the startup check fills both blxr.net services', async () => {
    const res = await firstCheck(srv)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), 'public, max-age=30')
    assert.deepEqual(res.body.services.map((s) => s.id), ['website', 'api'])
    assert.equal(res.body.days, 90)
    assert.equal(res.body.every, 300)

    const [website, api] = res.body.services
    assert.equal(website.host, 'blxr.test')
    assert.equal(website.link, FULL_ENV.SITE_URL)
    assert.equal(api.state, 'up')
    assert.equal(api.host, 'blxr.test/api')
    assert.equal(api.days.length, 90)
    assert.equal(api.days.at(-1).checks, 1)
  })

  test('a failing check shows as down with an open incident', async () => {
    const { body } = await firstCheck(srv)
    const website = body.services.find((s) => s.id === 'website')
    assert.equal(website.state, 'down')
    assert.equal(website.code, 'http_503')
    assert.equal(website.uptime, 0)
    assert.deepEqual(body.incidents.map(({ service, end, code }) => ({ service, end, code })), [{ service: 'website', end: null, code: 'http_503' }])
  })

  test('probes only go to the site, identify themselves and do not follow redirects', async () => {
    const calls = await srv.calls((c) => /site\.webmanifest|music\/health/.test(c.url))
    const urls = new Set(calls.map((c) => c.url))
    assert.deepEqual([...urls].sort(), ['https://blxr.test/api/music/health', 'https://blxr.test/site.webmanifest'])
    for (const c of calls) assert.match(c.headers['user-agent'], /^blxr-status\/1\.0/)
  })

  test('the outage is in the owner log and the state file is listed in the system report', async () => {
    const res = await srv.request('/api/logs?q=status', { headers: bearer({ sub: 'owner' }) })
    assert.equal(res.status, 200)
    assert.ok(res.body.items.some((e) => e.level === 'warn' && /Website is down \(http_503\)/.test(e.message)))
    assert.ok(res.body.system.state.files.some((f) => f.name === 'status.json'))
  })

  test('only GET is allowed', async () => {
    assert.equal((await srv.request('/api/status', { method: 'POST', body: {} })).status, 405)
  })

  test('the state is kept across a restart', async () => {
    await firstCheck(srv)
    await srv.stop()
    const again = await startServer({ env: ENV, stateDir: srv.stateDir, scenario: SCENARIO })
    try {
      const { body } = await again.request('/api/status')
      assert.ok(body.checkedAt, 'served from the saved file before the first new check')
      assert.equal(body.services.find((s) => s.id === 'website').state, 'down')
    } finally {
      await again.cleanup()
    }
  })
})
