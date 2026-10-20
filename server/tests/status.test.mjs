import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createMonitor, probe, statusTargets, lastDays, STATUS_DAYS } from '../src/status.mjs'

const dirs = []
after(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))))

const stateFile = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'blxr-status-'))
  dirs.push(dir)
  return path.join(dir, 'status.json')
}

const TARGETS = [
  { id: 'site', name: 'Site', host: 'site.test', link: 'https://site.test', url: 'https://site.test/ping' },
  { id: 'other', name: 'Other', host: 'other.test', link: null, url: 'https://other.test/' },
]

const NOON = Date.parse('2026-10-16T12:00:00Z')

function harness({ file, start = NOON, targets = TARGETS } = {}) {
  const replies = new Map()
  const calls = []
  let now = start
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    const queue = replies.get(new URL(url).hostname) || []
    const next = queue.length > 1 ? queue.shift() : queue[0] ?? 200
    if (next instanceof Error) throw next
    return new Response(null, { status: next })
  }
  const changes = []
  const monitor = createMonitor({
    file,
    targets,
    fetchImpl,
    clock: () => now,
    retryMs: 0,
    onChange: (target, from, to, result) => changes.push([target.id, from, to, result.code]),
  })
  return {
    monitor,
    calls,
    changes,
    reply: (host, ...statuses) => replies.set(host, statuses),
    advance: (ms) => {
      now += ms
    },
    service: (id) => monitor.view().services.find((s) => s.id === id),
  }
}

const timeout = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })

describe('probe', () => {
  test('2xx and 3xx are up; the redirect is not followed', async () => {
    for (const status of [200, 204, 301, 308]) {
      let init
      const r = await probe('https://x.test/', { fetchImpl: async (_, i) => ((init = i), new Response(null, { status })) })
      assert.equal(r.ok, true, String(status))
      assert.equal(r.code, null)
      assert.ok(Number.isInteger(r.ms) && r.ms >= 0)
      assert.equal(init.redirect, 'manual')
      assert.match(init.headers['user-agent'], /^blxr-status\//)
    }
  })

  test('4xx and 5xx are down with the status as the code', async () => {
    for (const status of [403, 404, 500, 530]) {
      const r = await probe('https://x.test/', { fetchImpl: async () => new Response(null, { status }) })
      assert.equal(r.ok, false)
      assert.equal(r.code, `http_${status}`)
    }
  })

  test('a timeout and a network failure are told apart', async () => {
    assert.equal((await probe('https://x.test/', { fetchImpl: async () => { throw timeout() } })).code, 'timeout')
    assert.equal((await probe('https://x.test/', { fetchImpl: async () => { throw new TypeError('fetch failed') } })).code, 'unreachable')
  })
})

describe('statusTargets', () => {
  test('the site checks are built from SITE_URL, trailing slash or not', () => {
    for (const site of ['https://blxr.test', 'https://blxr.test/']) {
      const [website, api] = statusTargets(site)
      assert.equal(website.url, 'https://blxr.test/site.webmanifest')
      assert.equal(website.host, 'blxr.test')
      assert.equal(api.url, 'https://blxr.test/api/music/health')
    }
    assert.equal(statusTargets(undefined)[0].host, 'kostis.wtf')
  })

  test('ids are unique', () => {
    const ids = statusTargets('https://blxr.net').map((t) => t.id)
    assert.equal(new Set(ids).size, ids.length)
  })
})

describe('monitor', () => {
  test('before the first check every service is unknown with an empty 90-day strip', () => {
    const h = harness()
    const view = h.monitor.view()
    assert.equal(view.checkedAt, null)
    assert.equal(view.days, STATUS_DAYS)
    for (const s of view.services) {
      assert.equal(s.state, 'unknown')
      assert.equal(s.uptime, null)
      assert.equal(s.days.length, STATUS_DAYS)
      assert.ok(s.days.every((d) => d.checks === 0))
    }
    assert.deepEqual(view.incidents, [])
  })

  test('a passing check marks the service up and fills today', async () => {
    const h = harness()
    await h.monitor.checkAll()
    const site = h.service('site')
    assert.equal(site.state, 'up')
    assert.equal(site.since, new Date(NOON).toISOString())
    assert.equal(site.uptime, 1)
    assert.equal(site.code, null)
    assert.ok(Number.isInteger(site.ms))
    assert.deepEqual(site.days.at(-1), { day: '2026-10-16', checks: 1, up: 1, ms: site.ms })
    assert.equal(h.monitor.view().checkedAt, new Date(NOON).toISOString())
    assert.deepEqual(h.changes.map((c) => c.slice(0, 3)), [['site', 'unknown', 'up'], ['other', 'unknown', 'up']])
  })

  test('one failed attempt that passes on the retry is not an outage', async () => {
    const h = harness()
    h.reply('site.test', 503, 200)
    await h.monitor.checkAll()
    assert.equal(h.service('site').state, 'up')
    assert.equal(h.calls.filter((c) => c.url.includes('site.test')).length, 2)
    assert.deepEqual(h.monitor.view().incidents, [])
  })

  test('two failures open an incident, recovery closes it', async () => {
    const h = harness()
    await h.monitor.checkAll()
    h.reply('site.test', 530)
    h.advance(5 * 60_000)
    await h.monitor.checkAll()

    let site = h.service('site')
    assert.equal(site.state, 'down')
    assert.equal(site.code, 'http_530')
    assert.equal(site.ms, null)
    assert.equal(site.uptime, 0.5)
    let [incident] = h.monitor.view().incidents
    assert.deepEqual(incident, { service: 'site', name: 'Site', start: new Date(NOON + 5 * 60_000).toISOString(), end: null, code: 'http_530' })

    h.advance(5 * 60_000)
    await h.monitor.checkAll()
    assert.equal(h.service('site').state, 'down', 'still down: no second incident')
    assert.equal(h.monitor.view().incidents.length, 1)

    h.reply('site.test', 200)
    h.advance(5 * 60_000)
    await h.monitor.checkAll()
    site = h.service('site')
    assert.equal(site.state, 'up')
    assert.equal(site.since, new Date(NOON + 15 * 60_000).toISOString())
    ;[incident] = h.monitor.view().incidents
    assert.equal(incident.end, new Date(NOON + 15 * 60_000).toISOString())
    assert.equal(h.service('other').state, 'up', 'the other service is untouched')
    assert.deepEqual(h.changes.filter((c) => c[0] === 'site'), [
      ['site', 'unknown', 'up', null],
      ['site', 'up', 'down', 'http_530'],
      ['site', 'down', 'up', null],
    ])
  })

  test('timeouts are recorded as such', async () => {
    const h = harness()
    h.reply('other.test', timeout())
    await h.monitor.checkAll()
    assert.equal(h.service('other').code, 'timeout')
    assert.equal(h.monitor.view().incidents[0].code, 'timeout')
  })

  test('the strip is 90 days, oldest first, and older days are dropped', async () => {
    const h = harness()
    await h.monitor.checkAll()
    h.advance(STATUS_DAYS * 86_400_000)
    await h.monitor.checkAll()
    const site = h.service('site')
    assert.equal(site.days.length, STATUS_DAYS)
    assert.equal(site.days.at(-1).day, '2027-01-14')
    assert.equal(site.days[0].day, '2026-10-17')
    assert.equal(site.days.reduce((n, d) => n + d.checks, 0), 1, 'the first check fell out of the window')
    assert.deepEqual(lastDays(Date.parse('2026-03-01T00:30:00Z'), 3), ['2026-02-27', '2026-02-28', '2026-03-01'])
  })

  test('average response time covers the last 7 days of passing checks', async () => {
    const h = harness()
    await h.monitor.checkAll()
    const { avgMs, ms } = h.service('site')
    assert.equal(avgMs, ms)
    h.advance(8 * 86_400_000)
    assert.equal(h.service('site').avgMs, null)
  })

  test('concurrent checkAll calls share one run', async () => {
    const h = harness()
    await Promise.all([h.monitor.checkAll(), h.monitor.checkAll()])
    assert.equal(h.calls.length, TARGETS.length)
  })

  test('state survives a restart; removed targets and junk are dropped', async () => {
    const file = await stateFile()
    const a = harness({ file })
    a.reply('site.test', 500)
    await a.monitor.checkAll()
    a.monitor.save()

    const saved = JSON.parse(await readFile(file, 'utf8'))
    saved.services.gone = saved.services.site
    saved.incidents.push({ service: 'gone', start: saved.checkedAt, end: null, code: 'x' }, { service: 'site', start: 'nope' })
    saved.services.site.days['not-a-day'] = [1, 1, 1]
    saved.services.site.days['2026-10-15'] = [1, 5, 0]
    await writeFile(file, JSON.stringify(saved))

    const b = harness({ file, targets: TARGETS.slice(0, 1) })
    const view = b.monitor.view()
    assert.deepEqual(view.services.map((s) => s.id), ['site'])
    assert.equal(view.services[0].state, 'down')
    assert.equal(view.services[0].days.reduce((n, d) => n + d.checks, 0), 1)
    assert.deepEqual(view.incidents.map((i) => i.service), ['site'])

    b.reply('site.test', 200)
    await b.monitor.checkAll()
    assert.deepEqual(b.changes, [['site', 'down', 'up', null]], 'resumes from the saved state instead of unknown')
  })

  test('a corrupt state file starts fresh', async () => {
    const file = await stateFile()
    await writeFile(file, '{not json')
    const h = harness({ file })
    assert.equal(h.monitor.view().checkedAt, null)
  })
})
