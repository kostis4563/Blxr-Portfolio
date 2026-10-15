import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from './support/server.mjs'
import { openReports, ReportStoreFull, REPORT_TTL_MS } from '../src/reports.mjs'

const blob = (size = 64, version = 1) => {
  const bytes = crypto.randomBytes(size)
  bytes[0] = version
  return new Uint8Array(bytes)
}

const OCTET = { 'content-type': 'application/octet-stream' }

let srv
before(async () => {
  srv = await startServer()
})
after(() => srv?.cleanup())

const upload = (body = blob(), query = '', headers = OCTET) => srv.request(`/api/reports${query}`, { method: 'POST', body, headers })

describe('/api/reports', () => {
  test('upload → download → delete, with the shape the macOS app expects', async () => {
    const sent = blob(4096)
    const before = Date.now()
    const created = await upload(sent)
    assert.equal(created.status, 201)
    assert.deepEqual(Object.keys(created.body).sort(), ['deleteToken', 'expiresAt', 'id', 'viewerUrl'])
    assert.match(created.body.id, /^[A-Za-z0-9_-]{22}$/)
    assert.match(created.body.deleteToken, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(created.body.viewerUrl, 'https://blxr.test/report')
    const ttl = Date.parse(created.body.expiresAt) - before
    assert.ok(ttl > REPORT_TTL_MS - 60_000 && ttl <= REPORT_TTL_MS + 60_000, 'kept for 120 days')
    assert.equal(created.headers.get('cache-control'), 'no-store')

    const { id, deleteToken } = created.body
    const res = await fetch(`${srv.base}/api/reports/${id}`, { headers: { 'x-forwarded-for': '10.200.0.1' } })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/octet-stream')
    assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.equal(res.headers.get('x-report-expires-at'), created.body.expiresAt)
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-origin')
    assert.equal(res.headers.get('access-control-allow-origin'), null)
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), sent)

    const head = await srv.request(`/api/reports/${id}`, { method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal(head.text, '')

    assert.equal((await srv.request(`/api/reports/${id}`, { method: 'DELETE' })).status, 401)
    const wrong = await srv.request(`/api/reports/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${'A'.repeat(43)}` } })
    assert.equal(wrong.status, 403)
    assert.equal((await srv.request(`/api/reports/${id}`)).status, 200, 'a wrong token deletes nothing')

    const del = await srv.request(`/api/reports/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${deleteToken}` } })
    assert.equal(del.status, 204)
    const gone = await srv.request(`/api/reports/${id}`)
    assert.equal(gone.status, 404)
    assert.equal(gone.body.error, 'not_found')
    assert.equal((await srv.request(`/api/reports/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${deleteToken}` } })).status, 404)
  })

  test('every report is kept 120 days; the uploader cannot change that', async () => {
    assert.equal(REPORT_TTL_MS, 120 * 24 * 60 * 60 * 1000)
    for (const query of ['', '?ttl=1d', '?ttl=forever', '?expires=0']) {
      const before = Date.now()
      const res = await upload(blob(), query)
      assert.equal(res.status, 201, query)
      const ttl = Date.parse(res.body.expiresAt) - before
      assert.ok(ttl > REPORT_TTL_MS - 60_000 && ttl <= REPORT_TTL_MS + 60_000, query)
    }
  })

  test('only an encrypted report blob is accepted', async () => {
    assert.equal((await upload(blob(64, 2))).body.error, 'bad_payload', 'unknown format version')
    assert.equal((await upload(blob(28))).body.error, 'bad_payload', 'shorter than version + nonce + tag')
    const asJson = await srv.request('/api/reports', { method: 'POST', body: { blob: 'x' } })
    assert.equal(asJson.status, 400, 'JSON is not a report')
    const asForm = await upload('a=1', '', { 'content-type': 'application/x-www-form-urlencoded' })
    assert.equal(asForm.status, 400, 'a form post never reaches the store')
  })

  test('over 5 MB is 413', async () => {
    const res = await upload(blob(5 * 1024 * 1024 + 1))
    assert.equal(res.status, 413)
    assert.equal(res.body.error, 'too_large')
  })

  test('a write from another site is refused; the app (no Origin) is not', async () => {
    const res = await upload(blob(), '', { ...OCTET, origin: 'https://evil.test' })
    assert.equal(res.status, 403)
    assert.equal(res.body.error, 'bad_origin')
    assert.equal((await upload(blob(), '', { ...OCTET, 'user-agent': 'WebScanner-macOS/1' })).status, 201)
  })

  test('bad ids are 404 and wrong methods 405', async () => {
    for (const p of ['/api/reports/short', '/api/reports/../../etc/passwd', `/api/reports/${'A'.repeat(23)}`]) {
      assert.equal((await srv.request(p)).status, 404, p)
    }
    assert.equal((await srv.request('/api/reports')).status, 405)
    assert.equal((await srv.request(`/api/reports/${'A'.repeat(22)}`, { method: 'PUT', body: {} })).status, 405)
  })

  test('uploads share the write rate limit', async () => {
    const ip = '10.250.0.9'
    const statuses = []
    for (let i = 0; i < 14; i++) statuses.push((await srv.request('/api/reports', { method: 'POST', body: blob(), headers: OCTET, ip })).status)
    assert.ok(statuses.slice(0, 12).every((s) => s === 201), statuses.join(' '))
    assert.equal(statuses.at(-1), 429)
  })

  test('reports survive a restart', async () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blxr-reports-'))
    const first = await startServer({ stateDir })
    const sent = blob(256)
    const created = await first.request('/api/reports', { method: 'POST', body: sent, headers: OCTET })
    await first.cleanup({ keepState: true })
    const second = await startServer({ stateDir })
    try {
      const res = await fetch(`${second.base}/api/reports/${created.body.id}`)
      assert.equal(res.status, 200)
      assert.deepEqual(new Uint8Array(await res.arrayBuffer()), sent)
    } finally {
      await second.cleanup()
    }
  })
})

describe('report store', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'blxr-report-store-'))
  const limits = { maxBytes: 10_000, maxCount: 3 }

  test('expired reports read as gone and the sweep deletes their files', async () => {
    const dir = tmp()
    const store = openReports(dir, limits)
    const now = Date.now()
    const { id } = await store.create(Buffer.from(blob(100)), 1000, now)
    assert.ok(await store.get(id, now + 999))
    assert.equal(await store.get(id, now + 1000), null)
    assert.equal(store.remove(id, 'A'.repeat(43), now + 1000), 'not_found')
    store.sweep(now + 1000)
    assert.deepEqual(fs.readdirSync(dir), [])
    assert.equal(store.count, 0)
    assert.equal(store.bytes, 0)
  })

  test('a full store refuses until something expires', async () => {
    const store = openReports(tmp(), limits)
    const now = Date.now()
    await store.create(Buffer.from(blob(100)), 1000, now)
    await store.create(Buffer.from(blob(100)), 60_000, now)
    await store.create(Buffer.from(blob(100)), 60_000, now)
    await assert.rejects(store.create(Buffer.from(blob(100)), 60_000, now), ReportStoreFull, 'count cap')
    await store.create(Buffer.from(blob(100)), 60_000, now + 1000)
    const big = openReports(tmp(), limits)
    await assert.rejects(big.create(Buffer.from(blob(10_001)), 60_000), ReportStoreFull, 'byte cap')
  })

  test('reopening keeps good reports and clears half-written or foreign files', async () => {
    const dir = tmp()
    const store = openReports(dir, limits)
    const kept = await store.create(Buffer.from(blob(100)), 60_000)
    const broken = await store.create(Buffer.from(blob(100)), 60_000)
    fs.truncateSync(path.join(dir, `${broken.id}.bin`), 10)
    fs.writeFileSync(path.join(dir, `${'B'.repeat(22)}.bin`), 'orphan')
    fs.writeFileSync(path.join(dir, `${'C'.repeat(22)}.bin.123.tmp`), 'partial')
    const reopened = openReports(dir, limits)
    assert.equal(reopened.count, 1)
    assert.ok(await reopened.get(kept.id))
    assert.equal(await reopened.get(broken.id), null)
    assert.deepEqual(fs.readdirSync(dir).sort(), [`${kept.id}.bin`, `${kept.id}.json`].sort())
  })

  test('the delete token is stored only as a hash', async () => {
    const dir = tmp()
    const store = openReports(dir, limits)
    const { id, deleteToken } = await store.create(Buffer.from(blob(100)), 60_000)
    const meta = fs.readFileSync(path.join(dir, `${id}.json`), 'utf8')
    assert.ok(!meta.includes(deleteToken))
    assert.equal(store.remove(id, deleteToken), 'deleted')
  })
})
