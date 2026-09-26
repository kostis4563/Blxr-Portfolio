import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, bearer } from './support/server.mjs'

let srv
before(async () => {
  srv = await startServer()
})
after(() => srv?.cleanup())

const owner = () => bearer({ sub: 'owner' })

describe('routing and methods', () => {
  test('health check answers (deploy.sh curls this after every restart)', async () => {
    const res = await srv.request('/api/music/health')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { ok: true, source: 'youtube' })
    assert.match(res.headers.get('content-type'), /^application\/json; charset=utf-8/)
  })

  test('HEAD is served like GET, without a body', async () => {
    const res = await srv.request('/api/music/health', { method: 'HEAD' })
    assert.equal(res.status, 200)
    assert.equal(res.text, '')
  })

  test('unknown paths are JSON 404s', async () => {
    for (const p of ['/api/nope', '/', '/api', '/api/reviews/../../etc/passwd', '/api/music/health/extra']) {
      const res = await srv.request(p)
      assert.equal(res.status, 404, p)
      assert.deepEqual(res.body, { error: 'not_found' }, p)
    }
  })

  test('unsupported methods are 405 before anything else runs', async () => {
    for (const method of ['OPTIONS', 'PROPFIND']) {
      const res = await srv.request('/api/music/health', { method })
      assert.equal(res.status, 405, method)
      assert.equal(res.body.error, 'method_not_allowed')
    }
    assert.equal((await srv.request('/api/hit')).status, 405, 'GET on a POST-only beacon')
    assert.equal((await srv.request('/api/music/search?q=ab', { method: 'DELETE' })).status, 405)
  })

  test('every response carries the API hardening headers', async () => {
    for (const [p, method] of [['/api/music/health', 'GET'], ['/api/nope', 'GET'], ['/api/hit', 'GET'], ['/api/logs', 'GET'], ['/x', 'OPTIONS']]) {
      const res = await srv.request(p, { method })
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff', `${method} ${p}`)
      assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow', `${method} ${p}`)
      assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-origin', `${method} ${p}`)
      assert.equal(res.headers.get('referrer-policy'), 'no-referrer', `${method} ${p}`)
      assert.equal(res.headers.get('access-control-allow-origin'), null, 'no CORS is ever granted')
      assert.equal(res.headers.get('x-powered-by'), null)
    }
  })

  test('private and error responses are never cached', async () => {
    for (const p of ['/api/reviews', '/api/logs', '/api/vitals']) {
      assert.equal((await srv.request(p)).headers.get('cache-control'), 'no-store', p)
    }
  })
})

describe('CSRF: origin checks on mutating requests', () => {
  test('a foreign Origin is refused', async () => {
    const res = await srv.request('/api/hit', { method: 'POST', body: { path: '/' }, headers: { origin: 'https://evil.test' } })
    assert.equal(res.status, 403)
    assert.equal(res.body.error, 'bad_origin')
  })

  test('a cross-site request without Origin is refused', async () => {
    const res = await srv.request('/api/reviews', { method: 'POST', body: {}, headers: { 'sec-fetch-site': 'cross-site' } })
    assert.equal(res.status, 403)
  })

  test('the site itself (apex and www) is allowed', async () => {
    for (const origin of ['https://blxr.test', 'https://www.blxr.test']) {
      const res = await srv.request('/api/hit', { method: 'POST', body: { path: '/' }, headers: { origin } })
      assert.equal(res.status, 204, origin)
    }
  })
})

describe('rate limiting', () => {
  test('beacons: 60 per minute per client, then 429 with Retry-After', async () => {
    const ip = '203.0.113.60'
    const statuses = []
    for (let i = 0; i < 61; i++) statuses.push((await srv.request('/api/hit', { method: 'POST', body: { path: '/' }, ip })).status)
    assert.deepEqual(statuses.slice(0, 60), Array(60).fill(204))
    const last = await srv.request('/api/hit', { method: 'POST', body: { path: '/' }, ip })
    assert.equal(last.status, 429)
    assert.equal(last.body.error, 'rate_limited')
    assert.ok(Number(last.headers.get('retry-after')) >= 1)
    assert.equal(last.headers.get('retry-after'), String(last.body.retryAfter))
    assert.equal((await srv.request('/api/hit', { method: 'POST', body: { path: '/' }, ip: '203.0.113.61' })).status, 204, 'other clients unaffected')
  })

  test('the client address is the last X-Forwarded-For hop (the one nginx wrote)', async () => {
    const ip = '198.51.100.7'
    for (let i = 0; i < 60; i++) await srv.request('/api/hit', { method: 'POST', body: { path: '/' }, ip: `1.1.1.${i}, ${ip}` })
    const spoofed = await srv.request('/api/hit', { method: 'POST', body: { path: '/' }, ip: `9.9.9.9, ${ip}` })
    assert.equal(spoofed.status, 429, 'a forged first hop does not buy a fresh bucket')
  })

  test('auth-protected endpoints use the tighter auth bucket (30/min)', async () => {
    const ip = '203.0.113.30'
    const codes = []
    for (let i = 0; i < 31; i++) codes.push((await srv.request('/api/logs', { ip })).status)
    assert.deepEqual(codes.slice(0, 30), Array(30).fill(401))
    assert.equal(codes[30], 429)
  })
})

describe('request bodies', () => {
  test('page hits: counts clean paths, folds odd ones into "other", ignores non-JSON and oversize bodies', async () => {
    const post = (body, headers) => srv.request('/api/hit', { method: 'POST', body, headers })
    assert.equal((await post({ path: '/projects' })).status, 204)
    assert.equal((await post({ path: '/projects' })).status, 204)
    await post({ path: '/../../etc/passwd' })
    await post({ path: `/${'a'.repeat(60)}` })
    await post({ path: 42 })
    await post(JSON.stringify({ path: '/text-plain' }), { 'content-type': 'text/plain' })
    await post(JSON.stringify({ path: '/huge', pad: 'x'.repeat(600) }))
    await post('{"path": "/broken"')

    const res = await srv.request('/api/hits', { headers: owner() })
    assert.equal(res.status, 200)
    assert.equal(res.body.today['/projects'], 2)
    assert.equal(res.body.today.other, 2)
    for (const p of ['/text-plain', '/huge', '/broken']) assert.equal(res.body.today[p], undefined, p)
  })

  test('bodies streamed without Content-Length are still cut off at the limit', async () => {
    const payload = new TextEncoder().encode(JSON.stringify({ path: '/chunked-oversize', pad: 'x'.repeat(2000) }))
    const body = new ReadableStream({
      start(controller) {
        for (let i = 0; i < payload.length; i += 256) controller.enqueue(payload.slice(i, i + 256))
        controller.close()
      },
    })
    await fetch(`${srv.base}/api/hit`, { method: 'POST', body, duplex: 'half', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.99' } }).catch(() => null)
    const res = await srv.request('/api/hits', { headers: owner() })
    assert.equal(res.body.today['/chunked-oversize'], undefined)
    assert.equal((await srv.request('/api/music/health')).status, 200, 'the server survived the cut-off')
  })

  test('web vitals: bucketed against the published thresholds, junk dropped', async () => {
    const res = await srv.request('/api/vitals', {
      method: 'POST',
      body: [
        { m: 'LCP', v: 1200 },
        { m: 'LCP', v: 3000 },
        { m: 'LCP', v: 9000 },
        { m: 'CLS', v: 0.3 },
        { m: 'INP', v: '100' },
        { m: 'FOO', v: 1 },
        { m: 'TTFB', v: -1 },
        { m: 'FCP', v: 1e9 },
        { m: 'FCP', v: Infinity },
      ],
    })
    assert.equal(res.status, 204)
    const { body } = await srv.request('/api/vitals?days=1', { headers: owner() })
    assert.deepEqual(body.metrics.LCP, { samples: 3, mean: 4400, worst: 9000, good: 1, needsImprovement: 1, poor: 1, goodShare: 0.33, pass: false })
    assert.equal(body.metrics.CLS.poor, 1)
    for (const m of ['INP', 'FOO', 'TTFB', 'FCP']) assert.equal(body.metrics[m], undefined, m)
  })

  test('web vitals: at most 12 samples per beacon', async () => {
    await srv.request('/api/vitals', { method: 'POST', body: Array.from({ length: 20 }, () => ({ m: 'TTFB', v: 100 })), ip: '203.0.113.12' })
    const { body } = await srv.request('/api/vitals?days=1', { headers: owner() })
    assert.equal(body.metrics.TTFB.samples, 12)
  })

  test('the ?days window is clamped to 1..90', async () => {
    assert.equal((await srv.request('/api/vitals?days=0', { headers: owner() })).body.window, 7)
    assert.equal((await srv.request('/api/vitals?days=-5', { headers: owner() })).body.window, 1)
    assert.equal((await srv.request('/api/vitals?days=9999', { headers: owner() })).body.window, 90)
  })
})

describe('robustness', () => {
  let seed = 0x5eed
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const pick = (list) => list[Math.floor(rand() * list.length)]

  test('300 random requests: no crashes, no 500s, no unhandled errors', async () => {
    const paths = [
      '/api/hit', '/api/vitals', '/api/reviews', '/api/reviews/abcd1234', '/api/reviews/panel', '/api/reviews/panel/settings',
      '/api/reviews/panel/reviews/abcd1234', '/api/reviews/invites', `/api/reviews/invites/${'a'.repeat(32)}`, '/api/logs', '/api/logs/client',
      '/api/hits', '/api/mail/password-changed', '/api/account/delete', '/api/music/search', '/api/music/top', '/api/github/contributions',
      '/api/discord/user', '/api/weather', '/api/nope',
    ]
    const queries = ['', '?q=a', '?q=%00%ff', '?limit=-1', '?limit=1e308', '?country=../../', '?user=octo&y=2099', '?id=1&id=2', `?q=${'x'.repeat(5000)}`]
    const bodies = [undefined, '', 'null', '[]', '{}', '"str"', '{"__proto__":{"polluted":1}}', '{"constructor":{"prototype":{"x":1}}}', 'x'.repeat(10_000), '\u0000\u0001', '{"name":1e999}', '[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]']
    const types = ['application/json', 'text/plain', 'application/json; charset=utf-16', 'multipart/form-data; boundary=x', undefined]
    const methods = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
    const auths = [{}, owner(), { authorization: 'Bearer x' }, { authorization: 'Basic Zm9vOmJhcg==' }]

    for (let i = 0; i < 300; i++) {
      const method = pick(methods)
      const body = method === 'GET' ? undefined : pick(bodies)
      const type = pick(types)
      const headers = { ...pick(auths), ...(type && body !== undefined ? { 'content-type': type } : {}) }
      const res = await srv.request(pick(paths) + pick(queries), { method, body, headers })
      assert.ok(res.status < 500 || [502, 503].includes(res.status), `${method} → ${res.status} ${res.text.slice(0, 200)}`)
      assert.notEqual(res.body?.error, 'upstream_failed', `${method} ${res.status}: a handler threw`)
    }
    assert.equal((await srv.request('/api/music/health')).status, 200, 'still alive')
    assert.doesNotMatch(srv.output(), /uncaught|unhandled/i)
  })

  test('prototype pollution attempts do not leak into settings', async () => {
    const res = await srv.request('/api/reviews/panel/settings', {
      method: 'PUT',
      headers: owner(),
      body: '{"__proto__":{"paused":true},"constructor":{"prototype":{"approval":true}},"blockedTerms":["ok"]}',
    })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.settings, { paused: false, approval: false, blockedTerms: ['ok'] })
    assert.equal((await srv.request('/api/reviews', { method: 'POST', body: { name: 'Proto', rating: 5, text: 'This review should still post normally.' } })).status, 201)
  })

  test('a very long URL is answered, not hung', async () => {
    const res = await srv.request(`/api/music/search?q=${'a'.repeat(15_000)}`)
    assert.equal(res.status, 200)
  })
})
