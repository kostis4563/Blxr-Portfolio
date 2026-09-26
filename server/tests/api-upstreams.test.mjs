import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { startServer, bearer, FULL_ENV } from './support/server.mjs'

let srv
before(async () => {
  srv = await startServer()
})
after(() => srv?.cleanup())

let n = 0
const as = (sub, claims = {}) => bearer({ sub, n: ++n, ...claims })

describe('music search', () => {
  test('queries under two characters answer empty without calling out', async () => {
    await srv.clearCalls()
    assert.deepEqual((await srv.request('/api/music/search?q=a')).body, { items: [] })
    assert.deepEqual((await srv.request('/api/music/search?q=%20%20')).body, { items: [] })
    assert.equal((await srv.calls('/search')).length, 0)
  })

  test('drops unusable rows and cleans titles', async () => {
    const { status, body } = await srv.request('/api/music/search?q=Hello')
    assert.equal(status, 200)
    assert.equal(body.items.length, 2, 'live stream and malformed id were dropped')
    const [first, second] = body.items
    assert.match(first.videoId, /^[A-Za-z0-9_-]{11}$/)
    assert.equal(first.title, 'Hello', '"Topic Artist - " prefix and "(Official Music Video) [4K]" removed')
    assert.equal(first.subtitle, 'Topic Artist', '" - Topic" suffix removed')
    assert.equal(first.art, `https://i.ytimg.com/vi/${first.videoId}/mqdefault.jpg`)
    assert.equal(first.duration, 200)
    assert.equal(second.title, 'Hello', '"(Lyrics)" removed')
  })

  test('limit is clamped to 1..20', async () => {
    assert.equal((await srv.request('/api/music/search?q=Clamp&limit=1')).body.items.length, 1)
    assert.equal((await srv.request('/api/music/search?q=Clamp2&limit=-5')).body.items.length, 1)
  })

  test('results are cached', async () => {
    await srv.request('/api/music/search?q=Cached')
    await srv.clearCalls()
    await srv.request('/api/music/search?q=Cached')
    assert.equal((await srv.calls('/search')).length, 0)
  })

  test('the query is trimmed and capped at 120 characters before it goes upstream', async () => {
    await srv.clearCalls()
    await srv.request(`/api/music/search?q=${encodeURIComponent(`  ${'q'.repeat(300)}  `)}`)
    const [call] = await srv.calls('/search')
    assert.equal(new URL(call.url).searchParams.get('q'), 'q'.repeat(120))
  })
})

describe('music search failover', () => {
  let fail
  before(async () => {
    fail = await startServer({ scenario: { piped: { 'https://api.piped.private.coffee': 'fail' } } })
  })
  after(() => fail?.cleanup())

  test('a failing Piped mirror is skipped for five minutes', async () => {
    await fail.clearCalls()
    assert.equal((await fail.request('/api/music/search?q=first')).body.items.length, 2)
    const firstRound = (await fail.calls('/search')).map((c) => new URL(c.url).host)
    assert.ok(!firstRound.includes('api.piped.private.coffee'), 'already marked down by the startup warm-up')
    assert.equal(firstRound[0], 'pipedapi.kavin.rocks')
  })

  test('a slow mirror is overtaken: the next one starts after 800 ms and the first answer wins', async () => {
    await fail.scenario({ pipedDelay: { 'https://pipedapi.kavin.rocks': 5000 } })
    const started = Date.now()
    const { body } = await fail.request('/api/music/search?q=Hedged')
    const took = Date.now() - started
    assert.equal(body.items.length, 2)
    assert.ok(took >= 700 && took < 2500, `answered in ${took} ms`)
    const hosts = (await fail.calls('q=Hedged')).map((c) => new URL(c.url).host)
    assert.deepEqual(hosts.slice(0, 2), ['pipedapi.kavin.rocks', 'pipedapi.leptons.xyz'])
    await fail.scenario({ piped: { 'https://api.piped.private.coffee': 'fail' } })
  })

  test('with every Piped mirror down, Invidious answers', async () => {
    await fail.scenario({ piped: { all: 'fail' } })
    const { body } = await fail.request('/api/music/search?q=Fallback')
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].title, 'Fallback', '"(Audio)" removed')
    assert.equal(body.items[0].subtitle, 'Invidious Artist')
  })

  test('with everything down: an empty 200, and the mirrors show as down on the dashboard', async () => {
    await fail.scenario({ piped: { all: 'fail' }, invidious: 'fail' })
    const res = await fail.request('/api/music/search?q=Nothing')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.items, [])
    const logs = await fail.request('/api/logs', { headers: as('owner') })
    assert.ok(logs.body.system.mirrors.every((m) => m.down), 'all six mirrors are cooling down')
    assert.match(fail.output() + JSON.stringify(logs.body.items), /mirror skipped for 5 min/)
  })
})

describe('top chart', () => {
  test('served warm from the startup fetch', async () => {
    const { status, body } = await srv.request('/api/music/top')
    assert.equal(status, 200)
    assert.equal(body.title, 'Top Songs: Test')
    assert.equal(body.items.length, 10)
    assert.equal(body.items[0].title, 'Song 1', 'chart names win over YouTube titles')
    assert.equal(body.items[0].subtitle, 'Artist 1')
    assert.equal(body.items[0].move, null, 'no baseline yet, so no movement arrows')
    assert.equal(new Set(body.items.map((i) => i.videoId)).size, 10)
  })

  test('country and limit are sanitised before building the Apple URL', async () => {
    await srv.clearCalls()
    assert.equal((await srv.request('/api/music/top?country=GB&limit=3')).body.items.length, 3)
    const [apple] = await srv.calls('rss.marketingtools.apple.com')
    assert.match(apple.url, /\/api\/v2\/gb\/music\/most-played\/11\/songs\.json$/)

    await srv.clearCalls()
    await srv.request('/api/music/top?country=../../x&limit=999')
    const [odd] = await srv.calls('rss.marketingtools.apple.com')
    assert.match(odd.url, /\/api\/v2\/x\/music\/most-played\/23\/songs\.json$/, 'only letters survive, limit capped at 15')
  })

  test('chart and contributions tell browsers to reuse a stale copy while revalidating', async () => {
    assert.equal((await srv.request('/api/music/top')).headers.get('cache-control'), 'public, max-age=300, stale-while-revalidate=3600')
    assert.equal((await srv.request('/api/github/contributions?user=octo')).headers.get('cache-control'), 'public, max-age=600, stale-while-revalidate=86400')
  })

  test('the same video is never listed twice', async () => {
    await srv.scenario({ appleSongs: [{ name: 'Same', artistName: 'Artist' }, { name: 'Same', artistName: 'Artist' }, { name: 'Other', artistName: 'Artist' }] })
    const { body } = await srv.request('/api/music/top?country=fr&limit=5')
    await srv.scenario({})
    assert.deepEqual(body.items.map((i) => i.title), ['Same', 'Other'])
  })
})

describe('top chart movement', () => {
  let seeded
  before(async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), 'blxr-state-'))
    const ranks = { 'song 1|artist 1': 3, 'song 2|artist 2': 1, 'song 3|artist 3': 3 }
    const history = [
      { at: Date.now() - 20 * 3600_000, country: 'us', ranks },
      { at: Date.now() - 2 * 3600_000, country: 'us', ranks: {} },
    ]
    await writeFile(path.join(stateDir, 'chart-history.json'), JSON.stringify(history))
    seeded = await startServer({ stateDir })
  })
  after(() => seeded?.cleanup())

  test('compares against the oldest snapshot at least 18 hours old', async () => {
    const { body } = await seeded.request('/api/music/top')
    const move = Object.fromEntries(body.items.map((i) => [i.title, i.move]))
    assert.deepEqual(move['Song 1'], { dir: 'up', delta: 2 })
    assert.deepEqual(move['Song 2'], { dir: 'down', delta: 1 })
    assert.deepEqual(move['Song 3'], { dir: 'same' })
    assert.deepEqual(move['Song 4'], { dir: 'new' })
  })
})

describe('weather', () => {
  test('warmed at startup: the first visitor does not wait on open-meteo', async () => {
    const fresh = await startServer()
    try {
      for (let i = 0; i < 20 && !(await fresh.calls('open-meteo')).length; i++) await new Promise((r) => setTimeout(r, 25))
      const before = (await fresh.calls('open-meteo')).length
      assert.equal(before, 1, 'one warm-up call at startup')
      assert.equal((await fresh.request('/api/weather')).status, 200)
      assert.equal((await fresh.calls('open-meteo')).length, before)
    } finally {
      await fresh.cleanup()
    }
  })

  test('rounded to a tenth, cacheable (with stale-while-revalidate), and cached server-side', async () => {
    const res = await srv.request('/api/weather')
    assert.equal(res.status, 200)
    assert.equal(res.body.tempC, 21.3)
    assert.equal(res.body.code, 3)
    assert.equal(res.headers.get('cache-control'), 'public, max-age=300, stale-while-revalidate=600')
    await srv.clearCalls()
    await srv.request('/api/weather')
    assert.equal((await srv.calls('open-meteo')).length, 0)
  })

  test('502 when the first lookup fails or answers nonsense', async () => {
    const bad = await startServer({ scenario: { weather: 'garbage' } })
    try {
      assert.deepEqual((await bad.request('/api/weather')).body, { error: 'weather_failed' })
      await bad.scenario({ weather: 'fail' })
      assert.equal((await bad.request('/api/weather')).status, 502)
    } finally {
      await bad.cleanup()
    }
  })
})

describe('github contributions', () => {
  const get = (q) => srv.request(`/api/github/contributions?${q}`)

  test('rejects malformed usernames and years', async () => {
    for (const user of ['', '-octo', 'octo-', 'oc--to', 'o'.repeat(40), 'octo/../x', 'octo%00']) {
      assert.equal((await get(`user=${encodeURIComponent(user)}`)).body.error, 'bad_user', user)
    }
    const nextYear = new Date().getUTCFullYear() + 1
    for (const y of ['2007', String(nextYear), '20x6', 'lastyear']) {
      assert.equal((await get(`user=octo&y=${y}`)).body.error, 'bad_year', y)
    }
  })

  test('only allow-listed accounts are proxied (case-insensitive)', async () => {
    assert.equal((await get('user=torvalds')).status, 404)
    assert.equal((await get('user=OcTo')).status, 200)
  })

  test('uses GraphQL with the token, then caches', async () => {
    await srv.clearCalls()
    const res = await get('user=octo&y=2025')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { contributions: [{ date: '2026-09-23', count: 3 }], total: { 2025: 3 } })
    const [call] = await srv.calls('api.github.com/graphql')
    assert.equal(call.headers.authorization, `Bearer ${FULL_ENV.GITHUB_TOKEN}`)
    await srv.clearCalls()
    await get('user=octo&y=2025')
    assert.equal((await srv.calls('github')).length, 0)
  })

  test('falls back to the public mirror when GraphQL fails', async () => {
    await srv.scenario({ github: 'unauthorized' })
    const res = await get('user=octo&y=2024')
    await srv.scenario({})
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.total, { lastYear: 4 })
  })
})

describe('github developer stats', () => {
  test('anonymous visitors get private repositories redacted', async () => {
    const { status, body } = await srv.request('/api/github/stats')
    assert.equal(status, 200)
    assert.equal(body.access.owner, false)
    const priv = body.repos.find((r) => r.private)
    assert.deepEqual({ fullName: priv.fullName, name: priv.name, url: priv.url, owner: priv.owner, ownerType: priv.ownerType, stars: priv.stars }, { fullName: null, name: null, url: null, owner: null, ownerType: 'private', stars: 0 })
    assert.ok(!JSON.stringify(body).includes('secret-org'), 'the private org name appears nowhere')
    assert.ok(!JSON.stringify(body).includes('private-repo'))
    const hidden = body.owners.find((o) => o.type === 'private')
    assert.deepEqual({ login: hidden.login, repos: hidden.repos, c: hidden.c }, { login: null, repos: 1, c: 1 })
  })

  test('a signed-in member is still redacted', async () => {
    const { body } = await srv.request('/api/github/stats', { headers: as('member') })
    assert.equal(body.access.owner, false)
  })

  test('the owner (matched by verified GitHub e-mail) sees everything', async () => {
    const { body } = await srv.request('/api/github/stats', { headers: as('owner') })
    assert.equal(body.access.owner, true)
    assert.ok(body.repos.some((r) => r.fullName === 'secret-org/private-repo'))
  })

  test('the owner with MFA must be at aal2 to see private data', async () => {
    assert.equal((await srv.request('/api/github/stats', { headers: as('owner-mfa', { aal: 'aal1' }) })).body.access.owner, false)
    assert.equal((await srv.request('/api/github/stats', { headers: as('owner-mfa', { aal: 'aal2' }) })).body.access.owner, true)
  })

  test('aggregates: streaks, busiest day, languages and totals', async () => {
    const { body } = await srv.request('/api/github/stats', { headers: as('owner') })
    assert.deepEqual(body.calendar.streak, { current: 3, longest: 3, longestFrom: '2026-09-21', longestTo: '2026-09-23' })
    assert.deepEqual(body.calendar.busiestDay, { date: '2026-09-22', count: 3 })
    assert.equal(body.calendar.activeDays, 3)
    assert.equal(body.periods.all.c, 3)
    assert.equal(body.periods.all.a, 115)
    assert.equal(body.general.stars, 5)
    assert.deepEqual(body.languages.map((l) => [l.name, l.commits, Math.round(l.share * 100)]), [['JavaScript', 2, 67], ['Go', 1, 33]])
    assert.equal(body.grid.length, 7)
    assert.ok(body.grid.every((row) => row.length === 24))
    assert.equal(body.coverage.truncated, false)
  })

  test('cached: a refresh inside two minutes does not refetch', async () => {
    await srv.clearCalls()
    await srv.request('/api/github/stats?refresh=1')
    assert.equal((await srv.calls('api.github.com/graphql')).length, 0)
  })

  test('a rejected token or GitHub rate limit map to 503 / 429', async () => {
    const broken = await startServer({ scenario: { github: 'unauthorized' } })
    const limited = await startServer({ scenario: { github: 'rate_limited' } })
    try {
      assert.deepEqual((await broken.request('/api/github/stats')).body, { error: 'stats_disabled' })
      assert.equal((await broken.request('/api/github/stats')).status, 503)
      assert.deepEqual((await limited.request('/api/github/stats')).body, { error: 'rate_limited' })
    } finally {
      await Promise.all([broken.cleanup(), limited.cleanup()])
    }
  })
})

describe('discord lookups', () => {
  const ID = '175928847299117063'
  const lookup = (id, headers = as('member')) => srv.request(`/api/discord/user?id=${id}`, { headers })

  test('signed-in users only, so the lookup is not an open proxy', async () => {
    assert.equal((await lookup(ID, {})).status, 401)
  })

  test('ids must be 17–20 digit snowflakes', async () => {
    for (const id of ['abc', '123', '1'.repeat(21), `${ID}x`, '']) assert.equal((await lookup(id)).body.error, 'bad_id', id)
  })

  test('maps the public profile (via the mirror without a bot token)', async () => {
    await srv.clearCalls()
    const { status, body } = await lookup(ID)
    assert.equal(status, 200)
    const u = body.user
    assert.equal(u.id, ID)
    assert.equal(u.displayName, 'Nelly')
    assert.equal(u.createdAt, '2016-04-30T11:18:25.796Z')
    assert.equal(u.avatar, `https://cdn.discordapp.com/avatars/${ID}/8342729096ea3675442027381ff50dfe.png?size=512`)
    assert.equal(u.banner, null)
    assert.equal(u.accent, '#ff0000')
    assert.match(u.decoration.url, /avatar-decoration-presets\/a_fed43ab12698df65902ba06727e20c0e\.png/)
    assert.equal(u.tag.text, 'TOOL', 'guild tags are capped at four characters')
    assert.equal((await srv.calls('japi.rest')).length, 1)
    assert.equal((await srv.calls('discord.com')).length, 0)
  })

  test('cached for ten minutes', async () => {
    await srv.clearCalls()
    await lookup(ID)
    assert.equal((await srv.calls('japi.rest')).length, 0)
  })

  test('unknown users are 404, upstream trouble is 502', async () => {
    assert.deepEqual((await lookup('11111111111111111')).body, { error: 'not_found' })
    await srv.scenario({ discord: 'fail' })
    const res = await lookup('222222222222222222')
    await srv.scenario({})
    assert.equal(res.status, 502)
  })

  test('with a bot token, Discord itself is asked first', async () => {
    const bot = await startServer({ env: { ...FULL_ENV, DISCORD_BOT_TOKEN: ' bot-token-123 ' } })
    try {
      await bot.clearCalls()
      assert.equal((await bot.request(`/api/discord/user?id=${ID}`, { headers: as('member') })).status, 200)
      const [call] = await bot.calls('discord.com/api/v10/users/')
      assert.equal(call.headers.authorization, 'Bot bot-token-123', 'token is trimmed')
    } finally {
      await bot.cleanup()
    }
  })
})
