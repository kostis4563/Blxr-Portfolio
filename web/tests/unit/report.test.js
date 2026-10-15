import { describe, test, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  parseLink,
  loadReport,
  ReportError,
  summarize,
  normalizeFinding,
  safeHref,
  errorState,
  formatWhen,
  reportApiBase,
} from '../../src/lib/report.js'
import { FindingDetails, ReportView } from '../../src/report-page.jsx'

const API = 'https://api.example.test'
const ID = 'qHFwbXrI3ivE5zuvJ9JDMQ'
const EXPIRES = '2026-10-21T17:47:22Z'
const b64url = (bytes) => Buffer.from(bytes).toString('base64url')

const REPORT = {
  schema: 'webscanner.report/1',
  generator: 'WebScanner for macOS',
  target: 'https://example.com',
  finalURL: 'https://example.com/',
  modes: ['siteScan', 'portScan'],
  intensity: 'deep',
  startedAt: '2026-10-14T17:46:40Z',
  finishedAt: '2026-10-14T17:47:22Z',
  grade: 'F',
  counts: { critical: 1, high: 0, medium: 1, low: 0, info: 1 },
  findings: [
    { id: 'm', title: 'Missing HSTS', severity: 'medium', category: 'Headers', location: 'https://example.com/', detail: 'No HSTS.', evidence: '—', exploit: 'Downgrade.', remediation: 'Send HSTS.' },
    { id: 'i', title: 'Slow TTFB', severity: 'info', category: 'Performance', location: 'https://example.com/', detail: 'Slow.', evidence: '900 ms', exploit: 'Users leave.', remediation: 'Cache.' },
    {
      id: 'c',
      title: 'Exposed .env file',
      severity: 'critical',
      category: 'Information Disclosure',
      location: 'https://example.com/.env',
      detail: 'Environment file is publicly readable.',
      evidence: '<script>alert(1)</script>',
      exploit: 'An attacker downloads the credentials.',
      remediation: 'Block dotfiles at the web server.',
      reference: 'https://owasp.org/x',
      reproduction: 'curl -s https://example.com/.env',
      capturedContent: 'DB_PASSWORD=<img src=x onerror=alert(1)>',
    },
  ],
}

async function seal(report, { version = 1 } = {}) {
  const raw = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt'])
  const plain = deflateRawSync(Buffer.from(JSON.stringify(report)))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain))
  const blob = new Uint8Array(13 + sealed.length)
  blob[0] = version
  blob.set(iv, 1)
  blob.set(sealed, 13)
  return { blob, key: b64url(raw) }
}

const serve = (body, init = {}) => {
  const fetch = vi.fn(async () => new Response(body, init))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const failure = (promise) => promise.then(() => null, (error) => error)

afterEach(() => vi.unstubAllGlobals())

describe('parseLink', () => {
  const key = 'A'.repeat(43)

  test('reads id and key from the fragment, with or without the #', () => {
    expect(parseLink(`#id=${ID}&key=${key}`)).toEqual({ id: ID, key })
    expect(parseLink(`id=${ID}&key=${key}`)).toEqual({ id: ID, key })
  })

  test.each([
    ['', 'empty'],
    [`#id=${ID}`, 'no key'],
    [`#id=${ID}&key=${key.slice(1)}`, 'key cut short'],
    [`#id=${ID.slice(1)}&key=${key}`, 'id cut short'],
    [`#id=${ID}&key=${key.slice(1)}+`, 'non-base64url key'],
    [`#id=../../etc/passw&key=${key}`, 'path in the id'],
  ])('%s → null (%s)', (hash) => {
    expect(parseLink(hash)).toBeNull()
  })
})

describe('loadReport', () => {
  test('downloads once, without credentials or referrer, and decrypts in place', async () => {
    const { blob, key } = await seal(REPORT)
    const fetch = serve(blob, { headers: { 'X-Report-Expires-At': EXPIRES } })
    const { report, expiresAt } = await loadReport({ id: ID, key }, API)
    expect(report).toEqual(REPORT)
    expect(expiresAt).toBe(EXPIRES)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`${API}/reports/${ID}`)
    expect(url).not.toContain(key)
    expect(init).toEqual({ cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
  })

  test('one changed character in the key is a key error', async () => {
    const { blob, key } = await seal(REPORT)
    serve(blob)
    const tampered = (key[0] === 'A' ? 'B' : 'A') + key.slice(1)
    const error = await failure(loadReport({ id: ID, key: tampered }, API))
    expect(error).toBeInstanceOf(ReportError)
    expect(error.code).toBe('key')
  })

  test('404 is expired, other statuses are http, a failed fetch is network', async () => {
    serve('{"error":"not_found"}', { status: 404 })
    expect((await failure(loadReport({ id: ID, key: 'A'.repeat(43) }, API))).code).toBe('expired')
    serve('', { status: 503 })
    const http = await failure(loadReport({ id: ID, key: 'A'.repeat(43) }, API))
    expect(http.code).toBe('http')
    expect(http.message).toContain('503')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect((await failure(loadReport({ id: ID, key: 'A'.repeat(43) }, API))).code).toBe('network')
  })

  test('wrong version byte, a truncated blob and a foreign schema are format errors', async () => {
    const wrongVersion = await seal(REPORT, { version: 2 })
    serve(wrongVersion.blob)
    expect((await failure(loadReport({ id: ID, key: wrongVersion.key }, API))).code).toBe('format')
    serve(new Uint8Array([1, 2, 3]))
    expect((await failure(loadReport({ id: ID, key: wrongVersion.key }, API))).code).toBe('format')
    const foreign = await seal({ ...REPORT, schema: 'something/else' })
    serve(foreign.blob)
    expect((await failure(loadReport({ id: ID, key: foreign.key }, API))).code).toBe('format')
  })
})

describe('reportApiBase', () => {
  test('outside a production build it talks to the proxied /api, or ?api=', () => {
    expect(reportApiBase('')).toBe('/api')
    expect(reportApiBase('?api=http://127.0.0.1:9999')).toBe('http://127.0.0.1:9999')
  })
})

describe('summarize', () => {
  test('sorts critical → info, counts what it lists, and builds the header', () => {
    const summary = summarize(REPORT)
    expect(summary.findings.map((f) => f.severity)).toEqual(['critical', 'medium', 'info'])
    expect(summary.counts).toEqual({ critical: 1, high: 0, medium: 1, low: 0, info: 1 })
    expect(summary.worst).toBe('critical')
    expect(summary.eyebrow).toBe('Site Scan + Port Scan · Deep · Report')
    expect(summary.title).toBe('example.com · Scan Report · blxr')
    expect(summary.url).toBe('https://example.com/')
    expect(summary.grade).toBe('F')
    expect(summary.gradeSeverity).toBe('critical')
    expect(summary.generator).toBe('WebScanner for macOS')
  })

  test('grade colours follow the spec', () => {
    const colour = (grade) => summarize({ ...REPORT, grade }).gradeSeverity
    expect([colour('A'), colour('A-'), colour('B'), colour('C'), colour('D'), colour('F')]).toEqual(['info', 'info', 'low', 'medium', 'high', 'critical'])
  })

  test('malformed or hostile fields degrade to empty text instead of crashing the page', () => {
    const summary = summarize({
      schema: 'webscanner.report/1',
      modes: ['constructor', '__proto__', 'customMode', 7, {}],
      intensity: 'toString',
      grade: 'Z',
      finalURL: { toString: 1 },
      findings: [null, { title: { $$typeof: 'x' }, severity: 'nuclear', evidence: ' — ', reference: ['x'] }],
    })
    expect(summary.eyebrow).toBe('constructor + __proto__ + customMode + 7 · Report')
    expect(summary.grade).toBeNull()
    expect(summary.url).toBe('')
    expect(summary.title).toBe('Scan Report · blxr')
    expect(summary.findings).toHaveLength(2)
    for (const finding of summary.findings) {
      expect(finding.severity).toBe('info')
      for (const [field, value] of Object.entries(finding)) expect(typeof value, field).toBe('string')
      expect(finding.evidence).toBe('')
    }
  })

  test('no findings at all', () => {
    const summary = summarize({ ...REPORT, findings: undefined })
    expect(summary.findings).toEqual([])
    expect(summary.worst).toBeNull()
  })
})

describe('safeHref', () => {
  test.each([
    ['https://owasp.org/x', 'https://owasp.org/x'],
    ['http://example.com', 'http://example.com/'],
    ['javascript:alert(1)', null],
    ['JaVaScRiPt:alert(1)', null],
    ['data:text/html,<script>alert(1)</script>', null],
    ['/relative', null],
    ['', null],
  ])('%s → %s', (input, expected) => {
    expect(safeHref(input)).toBe(expected)
  })
})

describe('errorState', () => {
  test.each([
    ['expired', 'Report not found.'],
    ['key', 'Can’t decrypt this report.'],
    ['network', 'Can’t reach blxr.'],
    ['http', 'Something went wrong.'],
    ['format', 'Something went wrong.'],
    ['constructor', 'Something went wrong.'],
  ])('%s → %s', (code, title) => {
    expect(errorState(new ReportError(code, 'why'))).toEqual({ title, message: 'why' })
  })

  test('plain errors keep their message', () => {
    expect(errorState(new SyntaxError('Unexpected end of JSON input'))).toEqual({ title: 'Something went wrong.', message: 'Unexpected end of JSON input' })
  })
})

describe('formatWhen', () => {
  test('local date and time, or nothing for junk', () => {
    expect(formatWhen('2026-10-14T17:47:22Z')).toMatch(/2026/)
    expect(formatWhen('not a date')).toBe('')
    expect(formatWhen(undefined)).toBe('')
  })
})

describe('rendering', () => {
  const critical = normalizeFinding(REPORT.findings[2], 0)

  test('report text is escaped, never parsed as HTML', () => {
    const html = renderToStaticMarkup(createElement(FindingDetails, { id: 'f', finding: critical }))
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/<img/i)
  })

  test('references link only over http(s), in a new tab without an opener', () => {
    const linked = renderToStaticMarkup(createElement(FindingDetails, { id: 'f', finding: critical }))
    expect(linked).toContain('<a href="https://owasp.org/x" target="_blank" rel="noopener noreferrer"')
    const hostile = renderToStaticMarkup(createElement(FindingDetails, { id: 'f', finding: { ...critical, reference: 'javascript:alert(1)' } }))
    expect(hostile).not.toContain('<a ')
    expect(hostile).toContain('javascript:alert(1)')
  })

  test('performance findings call the exploit row Impact; captured contents wait behind <details>', () => {
    const perf = renderToStaticMarkup(createElement(FindingDetails, { id: 'f', finding: normalizeFinding(REPORT.findings[1], 0) }))
    expect(perf).toContain('Impact')
    expect(perf).not.toContain('Exploit')
    const html = renderToStaticMarkup(createElement(FindingDetails, { id: 'f', finding: critical }))
    expect(html).toContain('<details')
    expect(html).not.toContain('DB_PASSWORD')
    expect(html).toContain('Proof of concept')
  })

  test('the report view: title, grade, chips for non-empty severities, footer', () => {
    const html = renderToStaticMarkup(createElement(ReportView, { summary: summarize(REPORT), expiresAt: EXPIRES }))
    expect(html).toContain('https://example.com/</h1>')
    expect(html).toContain('aria-label="Grade F"')
    expect(html).toContain('worst severity')
    expect(html).toMatch(/aria-pressed="true"[^>]*>(?:<span[^>]*>[^<]*<\/span>)*<span>All<\/span><span[^>]*>3<\/span>/)
    expect(html).toContain('<span>Critical</span>')
    expect(html).toContain('<span>Medium</span>')
    expect(html).not.toContain('<span>High</span>')
    expect(html).toContain('E2E encrypted')
    expect(html).toContain('Link expires')
    expect(html).toContain('Generated by WebScanner for macOS.')
  })

  test('zero findings: All clear.', () => {
    const html = renderToStaticMarkup(createElement(ReportView, { summary: summarize({ ...REPORT, findings: [] }), expiresAt: null }))
    expect(html).toContain('All clear.')
    expect(html).not.toContain('aria-pressed')
    expect(html).not.toContain('Link expires')
  })
})

describe('the report page stays isolated', () => {
  const source = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')
  const FILES = ['src/report-main.jsx', 'src/report-page.jsx', 'src/lib/report.js', 'report.html']

  test('no HTML sinks, eval, beacons or reads of the full URL', () => {
    for (const file of FILES) {
      const text = source(file)
      for (const sink of ['dangerouslySetInnerHTML', 'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function', 'sendBeacon', 'location.href', 'history.replaceState', 'history.pushState']) {
        expect(text, `${file} uses ${sink}`).not.toContain(sink)
      }
    }
  })

  test('imports nothing from the main app (no error reporter, analytics or router)', () => {
    const imports = (file) => [...source(file).matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1])
    expect(imports('src/report-main.jsx')).toEqual(['react', 'react-dom/client', './report.css', './report-page.jsx'])
    expect(imports('src/report-page.jsx')).toEqual(['react', './lib/report'])
    expect(imports('src/lib/report.js')).toEqual([])
  })

  test('the only network call is the one report fetch', () => {
    const lib = source('src/lib/report.js')
    expect(lib.match(/fetch\(/g)).toHaveLength(1)
    expect(source('src/report-page.jsx')).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|EventSource/)
  })
})
