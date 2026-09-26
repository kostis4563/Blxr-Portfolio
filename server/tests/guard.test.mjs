import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

process.env.SITE_URL = 'https://blxr.test'
process.env.ALLOWED_ORIGINS = 'http://localhost:5173, not a url ,'
const guard = await import('../src/guard.mjs')
const { rateLimit, rateLimitSize, LIMITS, originAllowed, ALLOWED_ORIGINS, bearerOf, jwtPayload, jwtLooksUsable, isAal2, hasVerifiedFactor, safeEqual, isHttps, isJsonBody, fingerprint, API_HEADERS } = guard

const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
const token = (payload) => `${b64({ alg: 'HS256' })}.${b64(payload)}.signature-part`
const req = (method, headers = {}, socket = {}) => ({ method, headers, socket })

describe('rateLimit (token bucket)', () => {
  test('allows exactly `limit` requests per window, then reports a retry delay', () => {
    const now = Date.now()
    const { limit, windowMs } = LIMITS.write
    for (let i = 0; i < limit; i++) assert.equal(rateLimit('write', 'burst', now), null, `request ${i + 1}`)
    const blocked = rateLimit('write', 'burst', now)
    assert.deepEqual(blocked, { retryAfter: Math.ceil(windowMs / limit / 1000) })
  })

  test('refills continuously: one token comes back after windowMs / limit', () => {
    const now = Date.now()
    const { limit, windowMs } = LIMITS.write
    for (let i = 0; i < limit; i++) rateLimit('write', 'refill', now)
    assert.ok(rateLimit('write', 'refill', now))
    assert.equal(rateLimit('write', 'refill', now + windowMs / limit), null)
    assert.ok(rateLimit('write', 'refill', now + windowMs / limit), 'only one token came back')
  })

  test('buckets are per rule and per address', () => {
    const now = Date.now()
    for (let i = 0; i < LIMITS.write.limit; i++) rateLimit('write', 'isolated', now)
    assert.ok(rateLimit('write', 'isolated', now))
    assert.equal(rateLimit('write', 'someone-else', now), null)
    assert.equal(rateLimit('all', 'isolated', now), null)
  })

  test('never bans for longer than the window', () => {
    const now = Date.now()
    for (let i = 0; i < 1000; i++) rateLimit('auth', 'hammer', now)
    const blocked = rateLimit('auth', 'hammer', now)
    assert.ok(blocked.retryAfter >= 1 && blocked.retryAfter <= LIMITS.auth.windowMs / 1000)
    assert.equal(rateLimit('auth', 'hammer', now + LIMITS.auth.windowMs), null)
  })

  test('unknown rule names are not limited', () => {
    assert.equal(rateLimit('nope', 'x'), null)
  })

  test('sweeps buckets that have fully refilled', () => {
    const t0 = Date.now() + 10 * 60_000
    for (let i = 0; i < 5; i++) rateLimit('all', `sweep-${i}`, t0)
    assert.ok(rateLimitSize() >= 5)
    rateLimit('all', 'sweep-trigger', t0 + 61_000)
    assert.equal(rateLimitSize(), 1, 'only the bucket created after the sweep remains')
  })
})

describe('originAllowed (CSRF guard for mutating requests)', () => {
  test('derives the allow-list from SITE_URL (+www) and ALLOWED_ORIGINS, skipping junk', () => {
    assert.deepEqual([...ALLOWED_ORIGINS].sort(), ['http://localhost:5173', 'https://blxr.test', 'https://www.blxr.test'])
  })

  test('safe methods always pass', () => {
    assert.equal(originAllowed(req('GET', { origin: 'https://evil.test' })), true)
    assert.equal(originAllowed(req('HEAD', { origin: 'https://evil.test' })), true)
  })

  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
    test(`${method}: allowed origins pass, others are refused`, () => {
      assert.equal(originAllowed(req(method, { origin: 'https://blxr.test' })), true)
      assert.equal(originAllowed(req(method, { origin: 'https://www.blxr.test' })), true)
      assert.equal(originAllowed(req(method, { origin: 'https://evil.test' })), false)
      assert.equal(originAllowed(req(method, { origin: 'https://blxr.test.evil.test' })), false)
      assert.equal(originAllowed(req(method, { origin: 'null' })), false)
      assert.equal(originAllowed(req(method, { origin: 'http://blxr.test' })), false, 'scheme matters')
    })
  }

  test('without an Origin header, falls back to Sec-Fetch-Site', () => {
    assert.equal(originAllowed(req('POST', { 'sec-fetch-site': 'cross-site' })), false)
    assert.equal(originAllowed(req('POST', { 'sec-fetch-site': 'same-origin' })), true)
    assert.equal(originAllowed(req('POST', {})), true, 'non-browser clients (curl, sendBeacon fallbacks)')
  })
})

describe('bearer tokens', () => {
  const good = token({ sub: 'u1', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 60 })

  test('bearerOf extracts well-formed JWTs only', () => {
    assert.equal(bearerOf(req('GET', { authorization: `Bearer ${good}` })), good)
    assert.equal(bearerOf(req('GET', { authorization: `Bearer   ${good}  ` })), good)
    assert.equal(bearerOf(req('GET', {})), null)
    assert.equal(bearerOf(req('GET', { authorization: `Basic ${good}` })), null)
    assert.equal(bearerOf(req('GET', { authorization: 'Bearer a.b.c' })), null)
    assert.equal(bearerOf(req('GET', { authorization: `Bearer ${good}.extra` })), null)
    assert.equal(bearerOf(req('GET', { authorization: `Bearer ${'a'.repeat(2100)}.${'b'.repeat(2100)}.cccccccccc` })), null, 'over 4 KB')
    assert.equal(bearerOf(req('GET', { authorization: `bearer ${good}` })), null, 'scheme is case-sensitive here')
  })

  test('jwtPayload tolerates garbage', () => {
    assert.equal(jwtPayload('x.!!!.y'), null)
    assert.equal(jwtPayload(`x.${Buffer.from('"str"').toString('base64url')}.y`), null)
    assert.deepEqual(jwtPayload(token({ sub: 'a' })), { sub: 'a' })
  })

  test('jwtLooksUsable checks audience, expiry (30 s skew) and subject', () => {
    const now = Date.now()
    const exp = (s) => Math.floor(now / 1000) + s
    assert.equal(jwtLooksUsable(token({ sub: 'u', aud: 'authenticated', exp: exp(60) }), now), true)
    assert.equal(jwtLooksUsable(token({ sub: 'u', aud: ['x', 'authenticated'], exp: exp(60) }), now), true)
    assert.equal(jwtLooksUsable(token({ sub: 'u', exp: exp(60) }), now), true, 'aud is optional')
    assert.equal(jwtLooksUsable(token({ sub: 'u', aud: 'anon', exp: exp(60) }), now), false)
    assert.equal(jwtLooksUsable(token({ sub: 'u', aud: 'authenticated', exp: exp(-20) }), now), true, 'inside skew')
    assert.equal(jwtLooksUsable(token({ sub: 'u', aud: 'authenticated', exp: exp(-40) }), now), false)
    assert.equal(jwtLooksUsable(token({ aud: 'authenticated', exp: exp(60) }), now), false)
    assert.equal(jwtLooksUsable(token({ sub: '', aud: 'authenticated' }), now), false)
    assert.equal(jwtLooksUsable('not.a.jwt', now), false)
  })

  test('isAal2 / hasVerifiedFactor', () => {
    assert.equal(isAal2(token({ aal: 'aal2' })), true)
    assert.equal(isAal2(token({ aal: 'aal1' })), false)
    assert.equal(isAal2('junk'), false)
    assert.equal(hasVerifiedFactor({ factors: [{ status: 'unverified' }, { status: 'verified' }] }), true)
    assert.equal(hasVerifiedFactor({ factors: [{ status: 'unverified' }, null] }), false)
    assert.equal(hasVerifiedFactor({}), false)
    assert.equal(hasVerifiedFactor(null), false)
  })
})

describe('small helpers', () => {
  test('safeEqual compares in constant time and refuses empties/non-strings', () => {
    assert.equal(safeEqual('abc', 'abc'), true)
    assert.equal(safeEqual('abc', 'abd'), false)
    assert.equal(safeEqual('abc', 'abcd'), false)
    assert.equal(safeEqual('', ''), false)
    assert.equal(safeEqual(undefined, undefined), false)
    assert.equal(safeEqual(null, 'x'), false)
    assert.equal(safeEqual('é', 'é'), true)
  })

  test('isHttps trusts X-Forwarded-Proto or a TLS socket', () => {
    assert.equal(isHttps(req('GET', { 'x-forwarded-proto': 'https' })), true)
    assert.equal(isHttps(req('GET', { 'x-forwarded-proto': 'http' })), false)
    assert.equal(isHttps(req('GET', {}, { encrypted: true })), true)
    assert.equal(isHttps(req('GET', {})), false)
  })

  test('isJsonBody accepts JSON (or no body) only', () => {
    assert.equal(isJsonBody(req('POST', {})), true)
    assert.equal(isJsonBody(req('POST', { 'content-length': '0' })), true)
    assert.equal(isJsonBody(req('POST', { 'content-length': '12' })), false)
    assert.equal(isJsonBody(req('POST', { 'content-type': 'application/json' })), true)
    assert.equal(isJsonBody(req('POST', { 'content-type': 'Application/JSON; charset=utf-8' })), true)
    assert.equal(isJsonBody(req('POST', { 'content-type': 'application/jsonp' })), false)
    assert.equal(isJsonBody(req('POST', { 'content-type': 'text/plain' })), false, 'simple CORS content types never parse')
    assert.equal(isJsonBody(req('POST', { 'content-type': 'application/x-www-form-urlencoded' })), false)
  })

  test('fingerprint is stable per process, kind-separated and short', () => {
    assert.equal(fingerprint('ip', '1.2.3.4'), fingerprint('ip', '1.2.3.4'))
    assert.notEqual(fingerprint('ip', '1.2.3.4'), fingerprint('rl', '1.2.3.4'))
    assert.match(fingerprint('ip', 'x'), /^[A-Za-z0-9_-]{24}$/)
  })

  test('API responses are nosniff, noindex, same-origin and referrer-free', () => {
    assert.deepEqual(API_HEADERS, {
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow',
      'cross-origin-resource-policy': 'same-origin',
      'referrer-policy': 'no-referrer',
    })
  })
})
