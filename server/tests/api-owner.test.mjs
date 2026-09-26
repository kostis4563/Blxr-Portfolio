import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, bearer, FULL_ENV, SECRET_KEY } from './support/server.mjs'

let srv
before(async () => {
  srv = await startServer()
})
after(() => srv?.cleanup())

let n = 0
const as = (sub, claims = {}) => bearer({ sub, n: ++n, ...claims })
const OWNER = () => as('owner')
const valid = (over = {}) => ({ name: 'Ada Lovelace', role: 'Engineer', rating: 5, text: 'Great work, delivered on time and well documented.', ...over })

describe('owner gate', () => {
  const endpoints = ['/api/logs', '/api/reviews/panel', '/api/hits', '/api/vitals']
  const hour = Math.floor(Date.now() / 1000) + 3600

  const cases = [
    ['no credentials', () => ({}), 401, 'unauthorized'],
    ['a malformed bearer', () => ({ authorization: 'Bearer nope' }), 401, 'unauthorized'],
    ['a signed-in member', () => as('member'), 401, 'unauthorized'],
    ['a token Supabase does not recognise', () => as('ghost'), 401, 'unauthorized'],
    ['the owner e-mail on an unconfirmed account', () => as('owner-unconfirmed'), 401, 'unauthorized'],
    ['an expired owner token', () => as('owner', { exp: Math.floor(Date.now() / 1000) - 120 }), 401, 'unauthorized'],
    ['an owner token for the wrong audience', () => as('owner', { aud: 'anon', exp: hour }), 401, 'unauthorized'],
    ['the owner, MFA enrolled, first factor only', () => as('owner-mfa', { aal: 'aal1' }), 401, 'needs_mfa'],
    ['the owner, MFA enrolled, second factor done', () => as('owner-mfa', { aal: 'aal2' }), 200, null],
    ['the owner without MFA', () => as('owner'), 200, null],
  ]

  for (const endpoint of endpoints) {
    for (const [who, headers, status, error] of cases) {
      test(`${endpoint}: ${who} → ${status}${error ? ` ${error}` : ''}`, async () => {
        const res = await srv.request(endpoint, { headers: headers() })
        assert.equal(res.status, status)
        if (error) assert.deepEqual(res.body, { error })
      })
    }
  }

  test('fails closed when Supabase is down', async () => {
    await srv.scenario({ supabase: 'down' })
    try {
      assert.equal((await srv.request('/api/logs', { headers: OWNER() })).status, 401)
    } finally {
      await srv.scenario({})
    }
  })

  test('the Supabase lookup forwards the caller token and the publishable key', async () => {
    await srv.clearCalls()
    const headers = OWNER()
    await srv.request('/api/logs', { headers })
    const [call] = await srv.calls('supabase.test/auth/v1/user')
    assert.equal(call.headers.authorization, headers.authorization)
    assert.equal(call.headers.apikey, FULL_ENV.SUPABASE_PUBLISHABLE_KEY)
  })

  test('session lookups are cached (one upstream call per token per minute)', async () => {
    await srv.clearCalls()
    const headers = OWNER()
    for (let i = 0; i < 5; i++) await srv.request('/api/hits', { headers })
    assert.equal((await srv.calls('/auth/v1/user')).length, 1)
  })
})

describe('review panel', () => {
  let id
  before(async () => {
    id = (await srv.request('/api/reviews', { method: 'POST', body: valid({ name: 'Panel Subject', rating: 3 }) })).body.item.id
  })
  const patch = (body) => srv.request(`/api/reviews/panel/reviews/${id}`, { method: 'PATCH', headers: OWNER(), body })
  const publicItem = async () => (await srv.request('/api/reviews')).body.items.find((r) => r.id === id)

  test('lists reviews, invites, settings and stats — never the submitter hashes', async () => {
    const { status, body } = await srv.request('/api/reviews/panel', { headers: OWNER() })
    assert.equal(status, 200)
    assert.deepEqual(Object.keys(body).sort(), ['invites', 'reviews', 'settings', 'stats'])
    const row = body.reviews.find((r) => r.id === id)
    for (const key of ['ipHash', 'deviceHash', 'cookieHash']) assert.equal(row[key], undefined)
    assert.equal(body.stats.distribution[3] >= 1, true)
    assert.equal(typeof body.stats.average, 'number')
  })

  test('hide / unhide', async () => {
    assert.equal((await patch({ hidden: true })).body.item.hidden, true)
    assert.equal(await publicItem(), undefined)
    const res = await patch({ hidden: false })
    assert.equal(res.body.item.hidden, undefined, 'false flags are removed, not stored')
    assert.ok(await publicItem())
  })

  test('pin shows up publicly', async () => {
    await patch({ pinned: true })
    assert.equal((await publicItem()).pinned, true)
    await patch({ pinned: false })
    assert.equal((await publicItem()).pinned, undefined)
  })

  test('owner replies: set, refuse links, clear', async () => {
    assert.equal((await patch({ reply: '  Thank you!  ' })).status, 200)
    assert.equal((await publicItem()).reply.text, 'Thank you!')
    const withLink = await patch({ reply: 'see https://blxr.net/x' })
    assert.equal(withLink.status, 400)
    assert.deepEqual(withLink.body.fields, ['reply'])
    await patch({ reply: '' })
    assert.equal((await publicItem()).reply, undefined)
  })

  test('owner edits are validated and stamped', async () => {
    const bad = await patch({ rating: 7 })
    assert.equal(bad.status, 400)
    const good = await patch({ rating: 4 })
    assert.equal(good.body.item.rating, 4)
    assert.ok(good.body.item.editedAt)
  })

  test('delete, then 404', async () => {
    const del = await srv.request(`/api/reviews/panel/reviews/${id}`, { method: 'DELETE', headers: OWNER() })
    assert.equal(del.status, 204)
    assert.equal((await srv.request(`/api/reviews/panel/reviews/${id}`, { method: 'DELETE', headers: OWNER() })).status, 404)
  })

  test('settings are normalised: strict booleans, tidy de-duplicated terms, capped', async () => {
    const res = await srv.request('/api/reviews/panel/settings', {
      method: 'PUT',
      headers: OWNER(),
      body: { paused: 'yes', approval: 1, blockedTerms: ['  spam ', 'spam', '\u0007bad​word', 'x'.repeat(100), 42, '', ...Array.from({ length: 300 }, (_, i) => `t${i}`)], extra: 'dropped' },
    })
    assert.equal(res.status, 200)
    const s = res.body.settings
    assert.deepEqual(Object.keys(s).sort(), ['approval', 'blockedTerms', 'paused'])
    assert.equal(s.paused, false)
    assert.equal(s.approval, false)
    assert.deepEqual(s.blockedTerms.slice(0, 3), ['spam', 'badword', 'x'.repeat(60)])
    assert.equal(s.blockedTerms.length, 200)
    await srv.request('/api/reviews/panel/settings', { method: 'PUT', headers: OWNER(), body: { blockedTerms: [] } })
  })

  test('wrong methods and shapes are 405', async () => {
    assert.equal((await srv.request('/api/reviews/panel', { method: 'POST', headers: OWNER(), body: {} })).status, 405)
    assert.equal((await srv.request('/api/reviews/panel/settings', { headers: OWNER() })).status, 405)
    assert.equal((await srv.request('/api/reviews/panel/reviews', { method: 'PATCH', headers: OWNER(), body: {} })).status, 405)
  })
})

describe('review invites', () => {
  const create = (body, headers = OWNER()) => srv.request('/api/reviews/invites', { method: 'POST', headers, body })

  test('only the owner can create or list them', async () => {
    assert.equal((await create({ name: 'Client Co' }, {})).status, 403)
    assert.equal((await create({ name: 'Client Co' }, as('member'))).status, 403)
    assert.deepEqual((await create({ name: 'Client Co' }, as('owner-mfa', { aal: 'aal1' }))).body, { error: 'needs_mfa' })
    assert.equal((await srv.request('/api/reviews/invites', { headers: as('member') })).status, 403)
  })

  test('creation validates like reviews and clamps the lifetime', async () => {
    assert.deepEqual((await create({ name: 'X' })).body, { error: 'invalid', fields: ['name'] })
    assert.equal((await create({ name: 'Client Co', text: 'see www.example.com for details please' })).body.error, 'link')
    const res = await create({ name: 'Client Co', days: 400, rating: 9 })
    assert.equal(res.status, 201)
    const life = Date.parse(res.body.invite.expiresAt) - Date.parse(res.body.invite.createdAt)
    assert.equal(life, 4 * 86_400_000, 'out-of-range days fall back to the 4-day default')
    assert.equal(res.body.invite.rating, 5, 'out-of-range rating falls back to 5')
  })

  test('full lifecycle: public preview → invited review → single use → delete rules', async () => {
    const created = await create({ name: 'Acme Ltd', role: 'CTO', rating: 4, days: 2 })
    assert.equal(created.status, 201)
    const { token } = created.body.invite
    assert.match(token, /^[a-f0-9]{32}$/)
    assert.equal(created.body.invite.status, 'pending')

    const preview = await srv.request(`/api/reviews/invites/${token}`)
    assert.equal(preview.status, 200)
    assert.deepEqual(Object.keys(preview.body.invite).sort(), ['expiresAt', 'name', 'rating', 'role', 'status', 'text'])
    assert.equal(preview.body.invite.text, 'Rated without leaving a written review.')

    const ip = '192.0.2.77'
    assert.equal((await srv.request('/api/reviews', { method: 'POST', ip, body: valid({ name: 'Acme First' }) })).status, 201)
    await srv.request('/api/reviews/panel/settings', { method: 'PUT', headers: OWNER(), body: { approval: true } })
    const invited = await srv.request('/api/reviews', { method: 'POST', ip, body: valid({ name: 'Acme Person', invite: token }) })
    await srv.request('/api/reviews/panel/settings', { method: 'PUT', headers: OWNER(), body: { approval: false } })
    assert.equal(invited.status, 201, 'invites bypass the per-client limit')
    assert.equal(invited.body.item.pending, undefined, 'and the approval queue')

    const again = await srv.request('/api/reviews', { method: 'POST', body: valid({ name: 'Acme Again', invite: token }) })
    assert.equal(again.status, 410)
    assert.equal(again.body.error, 'invite_used')

    assert.equal((await srv.request(`/api/reviews/invites/${token}`)).body.invite.status, 'used')
    assert.equal((await srv.request(`/api/reviews/invites/${token}`, { method: 'DELETE', headers: OWNER() })).status, 409)
  })

  test('unknown invites', async () => {
    const ghost = 'a'.repeat(32)
    assert.equal((await srv.request(`/api/reviews/invites/${ghost}`)).status, 404)
    const res = await srv.request('/api/reviews', { method: 'POST', body: valid({ name: 'Ghost Invite', invite: ghost }) })
    assert.equal(res.status, 410)
    assert.equal(res.body.error, 'invite_not_found')
  })

  test('an unused invite can be withdrawn', async () => {
    const { token } = (await create({ name: 'Withdrawn Co' })).body.invite
    assert.equal((await srv.request(`/api/reviews/invites/${token}`, { method: 'DELETE', headers: OWNER() })).status, 204)
    assert.equal((await srv.request(`/api/reviews/invites/${token}`)).status, 404)
  })
})

describe('logs dashboard', () => {
  test('client errors are recorded with a readable device and a type prefix', async () => {
    const res = await srv.request('/api/logs/client', {
      method: 'POST',
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36' },
      body: { kind: 'rejection', message: 'boom from the browser', path: '/dashboard', stack: 'at x', detail: 'd' },
    })
    assert.equal(res.status, 204)
    const { body } = await srv.request('/api/logs?source=client&q=boom', { headers: OWNER() })
    const entry = body.items[0]
    assert.equal(entry.message, 'unhandled rejection: boom from the browser')
    assert.equal(entry.client, 'Chrome on macOS')
    assert.equal(entry.path, '/dashboard')
  })

  test('client error intake is capped per client (40 per 10 minutes), silently', async () => {
    const ip = '192.0.2.40'
    for (let i = 0; i < 45; i++) {
      const res = await srv.request('/api/logs/client', { method: 'POST', ip, body: { message: `flood ${i}` } })
      assert.equal(res.status, 204)
    }
    const { body } = await srv.request('/api/logs?source=client&q=flood&limit=500', { headers: OWNER() })
    assert.equal(body.matched, 40)
  })

  test('the report includes system state but never a secret', async () => {
    const res = await srv.request('/api/logs', { headers: OWNER() })
    assert.equal(res.status, 200)
    assert.deepEqual(Object.keys(res.body).sort(), ['facets', 'items', 'matched', 'now', 'summary', 'system'])
    assert.deepEqual(res.body.system.features, { owner: true, supabase: true, mail: true, accountDelete: true, github: true, discord: true })
    for (const secret of [SECRET_KEY, FULL_ENV.RESEND_API_KEY, FULL_ENV.GITHUB_TOKEN, FULL_ENV.REVIEW_SALT]) {
      assert.ok(!res.text.includes(secret), `leaked ${secret}`)
    }
  })

  test('filters are validated; junk values are ignored rather than erroring', async () => {
    const res = await srv.request('/api/logs?level=warn,bogus&source=api&status=4xx&limit=3', { headers: OWNER() })
    assert.equal(res.status, 200)
    assert.ok(res.body.items.length <= 3)
    for (const e of res.body.items) {
      assert.equal(e.level, 'warn')
      assert.equal(e.source, 'api')
      assert.ok(e.status >= 400 && e.status < 500)
    }
    assert.equal((await srv.request('/api/logs?status=abc&since=xyz&before=nan', { headers: OWNER() })).status, 200)
  })

  test('DELETE clears the log (and notes that it did)', async () => {
    const res = await srv.request('/api/logs', { method: 'DELETE', headers: OWNER() })
    assert.equal(res.status, 200)
    assert.ok(res.body.removed > 0)
    const after = await srv.request('/api/logs?source=server', { headers: OWNER() })
    assert.match(after.body.items[0].message, /log cleared from the dashboard/)
  })
})

describe('account actions', () => {
  test('password-changed mail: sent once per 10 minutes to the signed-in user', async () => {
    assert.equal((await srv.request('/api/mail/password-changed', { method: 'POST' })).status, 401)
    await srv.clearCalls()
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'
    const first = await srv.request('/api/mail/password-changed', { method: 'POST', headers: { ...as('member'), 'user-agent': ua } })
    assert.equal(first.status, 204)
    const [call] = await srv.calls('api.resend.com')
    const sent = JSON.parse(call.body)
    assert.deepEqual(sent.to, ['member@example.com'])
    assert.match(sent.text, /Firefox on Linux/)

    const second = await srv.request('/api/mail/password-changed', { method: 'POST', headers: as('member') })
    assert.equal(second.status, 429)
    assert.equal(second.body.error, 'too_soon')
  })

  test('password-changed mail: a failed send is reported and does not burn the 10-minute slot', async () => {
    await srv.scenario({ resend: 'fail' })
    const failed = await srv.request('/api/mail/password-changed', { method: 'POST', headers: as('owner') })
    assert.equal(failed.status, 502)
    assert.equal(failed.body.error, 'mail_failed')
    await srv.scenario({})
    assert.equal((await srv.request('/api/mail/password-changed', { method: 'POST', headers: as('owner') })).status, 204)
  })

  test('MFA users must finish their second factor first', async () => {
    const res = await srv.request('/api/mail/password-changed', { method: 'POST', headers: as('member-mfa', { aal: 'aal1' }) })
    assert.deepEqual(res.body, { error: 'needs_mfa' })
    const del = await srv.request('/api/account/delete', { method: 'POST', headers: as('member-mfa', { aal: 'aal1' }) })
    assert.deepEqual(del.body, { error: 'needs_mfa' })
  })

  test('account delete: calls the Supabase admin API for the caller only, with the secret key', async () => {
    assert.equal((await srv.request('/api/account/delete', { method: 'POST' })).status, 401)
    assert.equal((await srv.request('/api/account/delete', { headers: as('member') })).status, 405)
    await srv.clearCalls()
    const res = await srv.request('/api/account/delete', { method: 'POST', headers: as('member'), body: { id: 'owner' } })
    assert.equal(res.status, 204)
    const deletes = await srv.calls((c) => c.method === 'DELETE')
    assert.equal(deletes.length, 1)
    assert.equal(deletes[0].url, 'https://supabase.test/auth/v1/admin/users/member', 'the body cannot pick a different victim')
    assert.equal(deletes[0].headers.apikey, SECRET_KEY)
  })

  test('account delete: an upstream refusal is 502, not a false success', async () => {
    await srv.scenario({ supabaseDelete: 'fail' })
    const res = await srv.request('/api/account/delete', { method: 'POST', headers: as('member') })
    assert.equal(res.status, 502)
    assert.equal(res.body.error, 'delete_failed')
    await srv.scenario({})
  })
})

describe('features switch off cleanly when unconfigured', () => {
  let bare
  before(async () => {
    bare = await startServer({ env: { SUPABASE_URL: FULL_ENV.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: FULL_ENV.SUPABASE_PUBLISHABLE_KEY } })
  })
  after(() => bare?.cleanup())

  test('no SITE_OWNER_EMAIL: owner surfaces are disabled, not open', async () => {
    const owner = as('owner')
    assert.deepEqual((await bare.request('/api/logs', { headers: owner })).body, { error: 'logs_disabled' })
    assert.equal((await bare.request('/api/hits', { headers: owner })).status, 404)
    assert.equal((await bare.request('/api/vitals', { headers: owner })).status, 404)
    assert.equal((await bare.request('/api/reviews/invites', { headers: owner })).status, 404)
    assert.equal((await bare.request('/api/reviews/panel', { headers: owner })).status, 401)
  })

  test('no mail key / secret key / GitHub token: 503 with a named reason', async () => {
    assert.deepEqual((await bare.request('/api/mail/password-changed', { method: 'POST', headers: as('member') })).body, { error: 'mail_disabled' })
    assert.deepEqual((await bare.request('/api/account/delete', { method: 'POST', headers: as('member') })).body, { error: 'delete_disabled' })
    assert.deepEqual((await bare.request('/api/github/stats')).body, { error: 'stats_disabled' })
  })

  test('warns at startup when REVIEW_SALT is missing', () => {
    assert.match(bare.output(), /REVIEW_SALT is unset/)
  })
})
