import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, bearer } from './support/server.mjs'

let srv
before(async () => {
  srv = await startServer()
})
after(() => srv?.cleanup())

const owner = bearer({ sub: 'owner' })
const valid = (over = {}) => ({ name: 'Ada Lovelace', role: 'Engineer', rating: 5, text: 'Great work, delivered on time and well documented.', ...over })
const post = (body, opts = {}) => srv.request('/api/reviews', { method: 'POST', body, ...opts })
const cookieOf = (res) => /blxr_rv=([a-f0-9]{32})/.exec(res.headers.get('set-cookie') || '')?.[1]
const list = async (headers = {}) => (await srv.request('/api/reviews', { headers })).body.items
const setSettings = (body) => srv.request('/api/reviews/panel/settings', { method: 'PUT', headers: owner, body })

describe('posting a review', () => {
  test('201 with the public shape only — no submitter hashes leak', async () => {
    const res = await post(valid())
    assert.equal(res.status, 201)
    const { item } = res.body
    assert.match(item.id, /^[a-z0-9]{8}$/)
    assert.deepEqual(Object.keys(item).sort(), ['at', 'id', 'name', 'rating', 'role', 'text'])
    assert.ok(Math.abs(Date.parse(item.at) - Date.now()) < 5000)
    const listed = (await list()).find((r) => r.id === item.id)
    assert.ok(listed)
    for (const key of ['ipHash', 'deviceHash', 'cookieHash']) assert.equal(listed[key], undefined)
  })

  test('issues an HttpOnly, SameSite=Strict, path-scoped cookie; Secure behind HTTPS', async () => {
    const plain = await post(valid({ name: 'Plain Http' }))
    const cookie = plain.headers.get('set-cookie')
    assert.match(cookie, /^blxr_rv=[a-f0-9]{32}; Path=\/api\/reviews; Max-Age=259200; HttpOnly; SameSite=Strict$/)

    const secure = await post(valid({ name: 'Behind Tls' }), { headers: { 'x-forwarded-proto': 'https' } })
    assert.match(secure.headers.get('set-cookie'), /; Secure$/)
  })

  const invalid = [
    ['name too short', { name: 'A' }, ['name']],
    ['name without letters', { name: '12345 !!' }, ['name']],
    ['name only emoji', { name: '🔥🔥🔥' }, ['name']],
    ['name too long', { name: 'N'.repeat(41) }, ['name']],
    ['role too long', { role: 'r'.repeat(61) }, ['role']],
    ['rating 0', { rating: 0 }, ['rating']],
    ['rating 6', { rating: 6 }, ['rating']],
    ['rating 4.5', { rating: 4.5 }, ['rating']],
    ['rating missing', { rating: undefined }, ['rating']],
    ['rating as words', { rating: 'five' }, ['rating']],
    ['text too short', { text: 'Too short text.' }, ['text']],
    ['text too long', { text: 'x'.repeat(601) }, ['text']],
    ['text that is only whitespace', { text: ' \n\t '.repeat(20) }, ['text']],
    ['everything wrong', { name: '', role: 'r'.repeat(99), rating: 9, text: '' }, ['name', 'role', 'rating', 'text']],
  ]
  for (const [label, over, fields] of invalid) {
    test(`400 invalid: ${label}`, async () => {
      const res = await post(valid(over))
      assert.equal(res.status, 400)
      assert.deepEqual(res.body, { error: 'invalid', fields })
    })
  }

  test('a numeric-string rating is accepted as the number', async () => {
    const res = await post(valid({ name: 'String Rating', rating: '4' }))
    assert.equal(res.status, 201)
    assert.equal(res.body.item.rating, 4)
  })

  for (const text of [
    'Check out https://spam.example for more great content!!',
    'Visit www.spam-site for cheap stuff right now ok',
    'I really recommend cheapstuff.com to everyone here',
    'Find me at my-portfolio.dev, thanks for everything',
    'Contact: spammer.io/offer for the best deals around',
  ]) {
    test(`links are refused: ${text.slice(0, 30)}…`, async () => {
      const res = await post(valid({ text }))
      assert.equal(res.status, 400)
      assert.equal(res.body.error, 'link')
    })
  }

  test('ordinary prose that merely has dots is not mistaken for a link', async () => {
    const res = await post(valid({ name: 'Dotty Prose', text: 'Worked with React and Node.js, e.g. the API. Deployed on time.' }))
    assert.equal(res.status, 201)
  })

  test('control, zero-width and bidi-override characters are stripped; whitespace tidied', async () => {
    const res = await post(valid({
      name: '  Mal‮ory​   Evil \u0007',
      text: 'Line one‍ is fine.\r\n\r\n\r\n\r\nLine two   has    spaces\ttoo.',
    }))
    assert.equal(res.status, 201)
    assert.equal(res.body.item.name, 'Malory Evil')
    assert.equal(res.body.item.text, 'Line one is fine.\n\nLine two has spaces too.')
  })

  test('HTML is stored verbatim as text (the client renders it as text, never as markup)', async () => {
    const res = await post(valid({ name: 'Html Person', text: '<img src=x onerror=alert(1)> this is a review body' }))
    assert.equal(res.status, 201)
    assert.equal(res.body.item.text, '<img src=x onerror=alert(1)> this is a review body')
    assert.match(res.headers.get('content-type'), /application\/json/, 'never served as HTML')
  })

  test('malformed and oversized bodies are 400', async () => {
    assert.equal((await post('{"name": "x"')).status, 400)
    assert.equal((await post('[]')).status, 400)
    assert.equal((await post(valid({ text: 'y'.repeat(5000) }))).status, 400)
    assert.equal((await post(JSON.stringify(valid()), { headers: { 'content-type': 'text/plain' } })).status, 400)
  })
})

describe('spam defences', () => {
  test('honeypot: a filled `website` field gets a convincing 201 but nothing is stored', async () => {
    const res = await post(valid({ name: 'Bot Person', website: 'http://spam.example' }))
    assert.equal(res.status, 201)
    assert.equal(res.headers.get('set-cookie'), null)
    assert.ok(!(await list()).some((r) => r.id === res.body.item.id))
  })

  test('one review per client per 3 days, tracked by IP, cookie and device', async () => {
    const ip = '192.0.2.10'
    const device = 'd'.repeat(32)
    const first = await post(valid({ name: 'Once Only', device }), { ip })
    assert.equal(first.status, 201)
    const cookie = cookieOf(first)

    const sameIp = await post(valid({ name: 'Once Again' }), { ip })
    assert.equal(sameIp.status, 429)
    assert.equal(sameIp.body.error, 'rate_limited')
    const threeDays = 3 * 24 * 3600
    assert.ok(sameIp.body.retryAfter > threeDays - 60 && sameIp.body.retryAfter <= threeDays)
    assert.equal(sameIp.headers.get('retry-after'), String(sameIp.body.retryAfter))

    const sameCookie = await post(valid({ name: 'New Ip Same Cookie' }), { ip: '192.0.2.11', headers: { cookie: `other=1; blxr_rv=${cookie}` } })
    assert.equal(sameCookie.status, 429)

    const sameDevice = await post(valid({ name: 'New Ip Same Device', device }), { ip: '192.0.2.12' })
    assert.equal(sameDevice.status, 429)

    const stranger = await post(valid({ name: 'Real Stranger' }), { ip: '192.0.2.13' })
    assert.equal(stranger.status, 201)
  })

  test('a malformed cookie or device token is ignored rather than trusted', async () => {
    const res = await post(valid({ name: 'Odd Tokens', device: 'not-hex' }), { headers: { cookie: 'blxr_rv=../../etc' } })
    assert.equal(res.status, 201)
    assert.match(cookieOf(res), /^[a-f0-9]{32}$/, 'a fresh cookie was issued')
  })

  test('blocked terms match through case, accents and full-width letters', async () => {
    assert.equal((await setSettings({ blockedTerms: ['spamword'] })).status, 200)
    for (const text of ['This contains SPAMWORD somewhere inside it.', 'This contains spämwörd somewhere inside it.', 'This contains ｓｐａｍｗｏｒｄ somewhere inside it.']) {
      const res = await post(valid({ name: 'Blocked Person', text }))
      assert.equal(res.status, 400, text)
      assert.equal(res.body.error, 'blocked')
    }
    await setSettings({ blockedTerms: [] })
  })

  test('paused reviews: 503 with Retry-After', async () => {
    await setSettings({ paused: true })
    const res = await post(valid({ name: 'Paused Person' }))
    assert.equal(res.status, 503)
    assert.equal(res.body.error, 'paused')
    assert.equal(res.headers.get('retry-after'), '3600')
    await setSettings({ paused: false })
  })
})

describe('approval queue', () => {
  test('pending reviews are visible only to their author until approved', async () => {
    await setSettings({ approval: true })
    const res = await post(valid({ name: 'Needs Approval' }))
    assert.equal(res.status, 201)
    assert.equal(res.body.item.pending, true)
    const id = res.body.item.id
    const cookie = cookieOf(res)

    assert.ok(!(await list()).some((r) => r.id === id), 'hidden from the public')
    const mine = (await list({ cookie: `blxr_rv=${cookie}` })).find((r) => r.id === id)
    assert.equal(mine?.pending, true, 'the author sees it, marked pending')

    const approve = await srv.request(`/api/reviews/panel/reviews/${id}`, { method: 'PATCH', headers: owner, body: { pending: false } })
    assert.equal(approve.status, 200)
    assert.equal(approve.body.item.pending, undefined)
    assert.equal(approve.body.item.hidden, undefined)
    assert.ok((await list()).some((r) => r.id === id), 'public after approval')
    await setSettings({ approval: false })
  })
})

describe('editing your own review', () => {
  let id
  let cookie
  const device = 'e'.repeat(32)
  const patch = (reviewId, body, headers = {}) => srv.request(`/api/reviews/${reviewId}`, { method: 'PATCH', body, headers })

  before(async () => {
    const res = await post(valid({ name: 'Editor Person', device }))
    id = res.body.item.id
    cookie = cookieOf(res)
  })

  test('the author (by cookie) can edit within the window', async () => {
    const res = await patch(id, valid({ name: 'Editor Person', text: 'Edited: still great, even better on reflection.' }), { cookie: `blxr_rv=${cookie}` })
    assert.equal(res.status, 200)
    assert.equal(res.body.item.text, 'Edited: still great, even better on reflection.')
    assert.ok(res.body.item.editedAt)
  })

  test('the author (by device token, e.g. cookies cleared) can edit too', async () => {
    const res = await patch(id, valid({ name: 'Editor Person', rating: 4, device }))
    assert.equal(res.status, 200)
    assert.equal(res.body.item.rating, 4)
  })

  test('anyone else gets 403 not_yours', async () => {
    assert.equal((await patch(id, valid())).status, 403)
    assert.equal((await patch(id, valid(), { cookie: `blxr_rv=${'0'.repeat(32)}` })).body.error, 'not_yours')
    assert.equal((await patch(id, valid({ device: 'f'.repeat(32) }))).status, 403)
  })

  test('edits are validated like new reviews', async () => {
    const res = await patch(id, valid({ text: 'now with a link https://spam.example ok' }), { cookie: `blxr_rv=${cookie}` })
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'link')
  })

  test('unknown ids 404; other methods 405', async () => {
    assert.equal((await patch('zzzzzzzz', valid(), { cookie: `blxr_rv=${cookie}` })).status, 404)
    assert.equal((await srv.request(`/api/reviews/${id}`, { method: 'DELETE' })).status, 405)
  })
})

describe('global flood protection', () => {
  test('after 30 reviews in an hour from anyone, new ones get 429 busy', async () => {
    const flood = await startServer()
    try {
      for (let i = 0; i < 30; i++) {
        const res = await flood.request('/api/reviews', { method: 'POST', body: valid({ name: `Flooder ${String.fromCharCode(65 + (i % 26))}` }) })
        assert.equal(res.status, 201, `review ${i + 1}`)
      }
      const res = await flood.request('/api/reviews', { method: 'POST', body: valid({ name: 'One Too Many' }) })
      assert.equal(res.status, 429)
      assert.deepEqual(res.body, { error: 'busy', retryAfter: 600 })
    } finally {
      await flood.cleanup()
    }
  })
})
