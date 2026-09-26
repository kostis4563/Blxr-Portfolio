import { test, describe, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { openLog, saveLog, record, log, queryLog, facetsOf, summariseLog, clearLog, logSize } from '../src/log.mjs'

const dirs = []
after(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))))

const fresh = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'blxr-log-'))
  dirs.push(dir)
  openLog(dir)
  clearLog()
  return dir
}

describe('record', () => {
  beforeEach(fresh)

  test('rejects unknown levels and sources', () => {
    assert.equal(record({ level: 'debug', source: 'api', message: 'x' }), null)
    assert.equal(record({ level: 'info', source: 'nope', message: 'x' }), null)
    assert.equal(logSize(), 0)
  })

  test('trims and caps every text field', () => {
    const e = record({
      level: 'error',
      source: 'client',
      message: `${'m'.repeat(900)}   `,
      path: '/p'.repeat(200),
      method: 'PROPFIND-LONG',
      status: 404.5,
      code: 'c'.repeat(100),
      stack: 's'.repeat(5000),
      detail: { nested: true },
      client: 'Chrome on macOS'.repeat(10),
    })
    assert.equal(e.message.length, 500)
    assert.equal(e.path.length, 200)
    assert.equal(e.method, 'PROPFIND')
    assert.equal(e.status, undefined, 'non-integer status is dropped')
    assert.equal(e.code.length, 64)
    assert.equal(e.stack.length, 4000)
    assert.equal(e.detail, '{"nested":true}')
    assert.equal(e.client.length, 80)
  })

  test('an empty message still records something readable', () => {
    assert.equal(record({ level: 'warn', source: 'api', message: '   ' }).message, '(no message)')
  })

  test('collapses repeats inside a minute into one entry with a count', () => {
    const a = record({ level: 'warn', source: 'api', message: '404 not_found', path: '/x', status: 404 })
    const b = record({ level: 'warn', source: 'api', message: '404 not_found', path: '/x', status: 404 })
    const c = record({ level: 'warn', source: 'api', message: '404 not_found', path: '/y', status: 404 })
    assert.equal(a, b)
    assert.equal(a.count, 2)
    assert.ok(a.last)
    assert.notEqual(c.id, a.id)
    assert.equal(logSize(), 2)
  })

  test('a repeat that arrives with a stack keeps it', () => {
    const a = record({ level: 'error', source: 'server', message: 'boom' })
    record({ level: 'error', source: 'server', message: 'boom', stack: 'Error: boom\n  at x' })
    assert.match(a.stack, /at x/)
  })

  test('keeps only the newest 3000 entries', () => {
    for (let i = 0; i < 3100; i++) record({ level: 'info', source: 'server', message: `m${i}` })
    assert.equal(logSize(), 3000)
    const { items } = queryLog({ limit: 500 })
    assert.equal(items[0].message, 'm3099')
  })

  test('log.* helpers describe errors, strings and objects', () => {
    const e = log.error('server', new Error('kaput'))
    assert.equal(e.message, 'kaput')
    assert.match(e.stack, /kaput/)
    assert.equal(log.warn('api', { a: 1 }).message, '{"a":1}')
    assert.equal(log.info('mail', 'sent').level, 'info')
  })
})

describe('queryLog / facets / summary', () => {
  beforeEach(async () => {
    await fresh()
    record({ level: 'error', source: 'api', message: '502 upstream_failed', status: 502, path: '/api/music/top' })
    record({ level: 'warn', source: 'api', message: '404 not_found', status: 404, path: '/api/nope' })
    record({ level: 'warn', source: 'api', message: '429 rate_limited', status: 429, path: '/api/hit' })
    record({ level: 'error', source: 'client', message: 'TypeError: x is undefined', stack: 'at Board (boards.jsx:10)' })
    record({ level: 'info', source: 'reviews', message: 'review posted #abcd1234' })
  })

  test('newest first, filtered by level and source', () => {
    assert.deepEqual(queryLog().items.map((e) => e.source), ['reviews', 'client', 'api', 'api', 'api'])
    assert.equal(queryLog({ levels: ['error'] }).matched, 2)
    assert.equal(queryLog({ sources: ['client'] }).items[0].message, 'TypeError: x is undefined')
    assert.equal(queryLog({ levels: ['warn'], sources: ['api'] }).matched, 2)
  })

  test('free-text search covers message, path and stack, case-insensitively', () => {
    assert.equal(queryLog({ q: 'MUSIC/TOP' }).matched, 1)
    assert.equal(queryLog({ q: 'boards.jsx' }).matched, 1)
    assert.equal(queryLog({ q: '  ' }).matched, 5, 'blank search matches everything')
  })

  test('status filters: class and exact code', () => {
    assert.equal(queryLog({ status: '4xx' }).matched, 2)
    assert.equal(queryLog({ status: '5xx' }).matched, 1)
    assert.equal(queryLog({ status: '429' }).matched, 1)
  })

  test('limit is clamped to 0..500 while matched still counts everything', () => {
    assert.equal(queryLog({ limit: 2 }).items.length, 2)
    assert.equal(queryLog({ limit: 0 }).items.length, 0)
    assert.equal(queryLog({ limit: 0 }).matched, 5)
    assert.equal(queryLog({ limit: 99999 }).items.length, 5)
    assert.equal(queryLog({ limit: 'abc' }).items.length, 0)
  })

  test('`before` pages backwards by id', () => {
    const all = queryLog().items
    const page = queryLog({ before: all[1].id })
    assert.deepEqual(page.items.map((e) => e.id), all.slice(2).map((e) => e.id))
  })

  test('`since` hides entries last seen before it', () => {
    assert.equal(queryLog({ since: Date.now() + 60_000 }).matched, 0)
    assert.equal(queryLog({ since: Date.now() - 60_000 }).matched, 5)
  })

  test('facets and summary agree with the entries', () => {
    const f = facetsOf()
    assert.deepEqual(f.levels, { error: 2, warn: 2, info: 1 })
    assert.equal(f.sources.api, 3)
    assert.deepEqual(f.statuses, { '4xx': 2, '5xx': 1 })
    const s = summariseLog()
    assert.equal(s.total, 5)
    assert.equal(s.recent.error, 2)
    assert.equal(s.recent.api, 3)
    assert.equal(s.recent.client, 1)
    assert.ok(s.lastError)
  })

  test('clearLog empties and reports the count', () => {
    assert.equal(clearLog(), 5)
    assert.equal(logSize(), 0)
  })
})

describe('persistence', () => {
  test('round-trips through logs.json and keeps ids increasing', async () => {
    const dir = await fresh()
    const first = record({ level: 'info', source: 'server', message: 'persist me' })
    saveLog()
    const saved = JSON.parse(await readFile(path.join(dir, 'logs.json'), 'utf8'))
    assert.equal(saved.entries.length, 1)

    clearLog()
    openLog(dir)
    assert.equal(logSize(), 1)
    const next = record({ level: 'info', source: 'server', message: 'after reload' })
    assert.ok(next.id > first.id)
    await rm(dir, { recursive: true, force: true })
  })

  test('drops malformed entries and survives a corrupt file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'blxr-log-'))
    dirs.push(dir)
    await writeFile(
      path.join(dir, 'logs.json'),
      JSON.stringify({
        nextId: 2,
        entries: [
          { id: 7, at: new Date().toISOString(), level: 'info', source: 'server', message: 'ok', count: 1 },
          { id: 'x', at: 'now', level: 'info', source: 'server', message: 'bad id' },
          { id: 8, at: new Date().toISOString(), level: 'fatal', source: 'server', message: 'bad level' },
        ],
      }),
    )
    openLog(dir)
    assert.equal(logSize(), 1)
    assert.ok(record({ level: 'info', source: 'server', message: 'new' }).id >= 8, 'nextId never goes backwards')

    await writeFile(path.join(dir, 'logs.json'), '{not json')
    openLog(dir)
    assert.equal(logSize(), 0)
    await rm(dir, { recursive: true, force: true })
  })
})
