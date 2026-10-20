import { describe, test, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  parseLink,
  linkFromText,
  linkHash,
  loadReport,
  deleteReport,
  ReportError,
  summarize,
  normalizeFinding,
  safeHref,
  errorState,
  formatWhen,
  formatDuration,
  gradeReason,
  matchesQuery,
  categoriesOf,
  compareFindings,
  rescanHref,
  readStatuses,
  writeStatuses,
  issueMarkdown,
  reportMarkdown,
  reportCsv,
  fixPrompt,
  exportName,
  reportApiBase,
  STATUS_KEY,
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

  test('keeps a well-formed delete token and finding number, drops anything else', () => {
    const del = 'D'.repeat(43)
    expect(parseLink(`#id=${ID}&key=${key}&del=${del}&f=4`)).toEqual({ id: ID, key, del, f: '4' })
    expect(parseLink(`#id=${ID}&key=${key}&del=short&f=x`)).toEqual({ id: ID, key })
  })

  test('a pasted link is read from its fragment; links are rebuilt without anything extra', () => {
    expect(linkFromText(`  https://blxr.net/report#id=${ID}&key=${key}\n`)).toEqual({ id: ID, key })
    expect(linkFromText('https://blxr.net/report')).toBeNull()
    expect(linkHash({ id: ID, key, del: 'D'.repeat(43) }, { f: '2' })).toBe(`#id=${ID}&key=${key}&f=2`)
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

describe('deleteReport', () => {
  const del = 'D'.repeat(43)

  test('sends the token as a bearer header, without credentials or referrer, and never the key', async () => {
    const fetch = serve(null, { status: 204 })
    await deleteReport({ id: ID, key: 'K'.repeat(43), del }, API)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`${API}/reports/${ID}`)
    expect(init).toEqual({ cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', method: 'DELETE', headers: { Authorization: `Bearer ${del}` } })
    expect(JSON.stringify(init)).not.toContain('K'.repeat(43))
  })

  test('404 means already gone, 403 is forbidden, other statuses are http, no token never calls out', async () => {
    serve(null, { status: 404 })
    await expect(deleteReport({ id: ID, del }, API)).resolves.toBeUndefined()
    serve(null, { status: 403 })
    expect((await failure(deleteReport({ id: ID, del }, API))).code).toBe('forbidden')
    serve('', { status: 500 })
    expect((await failure(deleteReport({ id: ID, del }, API))).code).toBe('http')
    const fetch = serve(null, { status: 204 })
    expect((await failure(deleteReport({ id: ID }, API))).code).toBe('forbidden')
    expect(fetch).not.toHaveBeenCalled()
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
    expect(summary.scan).toBe('Site Scan + Port Scan · Deep')
    expect(summary.title).toBe('example.com · Scan Report · blxr')
    expect(summary.url).toBe('https://example.com/')
    expect(summary.grade).toBe('F')
    expect(summary.gradeSeverity).toBe('critical')
    expect(summary.generator).toBe('WebScanner for macOS')
  })

  test('scan details: duration, target, the first known mode and why the grade is what it is', () => {
    const summary = summarize(REPORT)
    expect(summary.duration).toBe('42 s')
    expect(summary.target).toBe('https://example.com')
    expect(summary.mode).toBe('siteScan')
    expect(summary.gradeReason).toBe('Graded F because of 1 critical finding.')
    expect(summarize({ ...REPORT, startedAt: 'junk' }).duration).toBe('')
    expect(summarize({ ...REPORT, startedAt: REPORT.finishedAt, finishedAt: REPORT.startedAt }).duration).toBe('')
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
    expect(summary.scan).toBe('constructor + __proto__ + customMode + 7')
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

describe('gradeReason', () => {
  const counts = (some) => ({ critical: 0, high: 0, medium: 0, low: 0, info: 0, ...some })

  test.each([
    ['F', counts({ critical: 2, high: 3 }), 'Graded F because of 2 critical findings.'],
    ['D', counts({ high: 2 }), 'Graded D because of 2 high-severity findings.'],
    ['C', counts({ high: 1 }), 'Graded C because of 1 high-severity finding.'],
    ['C', counts({ medium: 3 }), 'Graded C because of 3 medium-severity findings.'],
    ['B', counts({ medium: 1, low: 4 }), 'Graded B because of 1 medium-severity finding.'],
    ['A-', counts({ low: 1 }), 'Graded A- because of 1 low-severity finding.'],
    ['A', counts({ info: 5 }), 'Graded A: nothing above informational.'],
  ])('%s from %o', (grade, given, reason) => {
    expect(gradeReason(grade, given)).toBe(reason)
  })

  test('a grade the counts don’t explain gets no reason', () => {
    expect(gradeReason('A', counts({ critical: 1 }))).toBe('')
    expect(gradeReason(null, counts({}))).toBe('')
  })
})

describe('formatDuration', () => {
  test('seconds, minutes, hours; nothing for junk', () => {
    expect([42_000, 192_000, 180_000, 3_840_000, 7_200_000, -1, Number.NaN].map(formatDuration)).toEqual(['42 s', '3 min 12 s', '3 min', '1 h 4 min', '2 h', '', ''])
  })
})

describe('search, categories, comparing scans and scanning again', () => {
  const { findings } = summarize(REPORT)
  const titles = (list) => list.map((finding) => finding.title)

  test('search looks at title, category, location and severity, ignoring case', () => {
    expect(titles(findings.filter((f) => matchesQuery(f, 'ENV')))).toEqual(['Exposed .env file'])
    expect(titles(findings.filter((f) => matchesQuery(f, 'headers')))).toEqual(['Missing HSTS'])
    expect(findings.filter((f) => matchesQuery(f, 'critical'))).toHaveLength(1)
    expect(findings.filter((f) => matchesQuery(f, '  '))).toHaveLength(3)
  })

  test('categories are listed once, sorted, with counts', () => {
    expect(categoriesOf(findings)).toEqual([
      { name: 'Headers', count: 1 },
      { name: 'Information Disclosure', count: 1 },
      { name: 'Performance', count: 1 },
    ])
  })

  test('scans are compared by title and location, like the app dedupes findings', () => {
    const redirect = { title: 'Open redirect', severity: 'high', location: '/go' }
    const earlier = summarize({
      ...REPORT,
      findings: [REPORT.findings[0], { ...REPORT.findings[1], location: 'https://example.com/old' }, redirect, redirect],
    }).findings
    const result = compareFindings(findings, earlier)
    expect(titles(findings.filter((f) => result.added.has(f.key)))).toEqual(['Exposed .env file', 'Slow TTFB'])
    expect(titles(result.fixed)).toEqual(['Open redirect', 'Slow TTFB'])
    expect(result.open).toBe(1)
  })

  test('scan again hands WebScanner an http(s) target and a known mode, nothing else', () => {
    expect(rescanHref(summarize(REPORT))).toBe('webscanner://scan?target=https%3A%2F%2Fexample.com%2F&mode=siteScan')
    expect(rescanHref(summarize({ ...REPORT, modes: ['nope'] }))).toBe('webscanner://scan?target=https%3A%2F%2Fexample.com%2F')
    expect(rescanHref(summarize({ ...REPORT, target: 'javascript:alert(1)', finalURL: 'file:///etc/passwd' }))).toBeNull()
  })
})

describe('fixed and ignored marks', () => {
  const memory = () => {
    const data = new Map()
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) }
  }
  const other = (i) => `r${String(i).padStart(21, '0')}`

  test('kept per report by finding number only, so no report text lands in storage', () => {
    const store = memory()
    writeStatuses(store, ID, { 0: 'fixed', 2: 'ignored' })
    expect(readStatuses(store, ID)).toEqual({ 0: 'fixed', 2: 'ignored' })
    expect(readStatuses(store, other(1))).toEqual({})
    expect(store.data.get(STATUS_KEY)).not.toMatch(/env|example|hsts/i)
    writeStatuses(store, ID, {})
    expect(JSON.parse(store.data.get(STATUS_KEY))).toEqual({})
  })

  test('junk in storage is dropped, and only the 40 most recent reports are kept', () => {
    const store = memory()
    store.setItem(STATUS_KEY, '{not json')
    expect(readStatuses(store, ID)).toEqual({})
    store.setItem(STATUS_KEY, JSON.stringify({ [ID]: { t: 1, s: { 0: 'fixed', 1: 'pwned', ['__proto__']: 'fixed', '../x': 'ignored' } } }))
    expect(readStatuses(store, ID)).toEqual({ 0: 'fixed' })
    for (let i = 0; i < 45; i++) writeStatuses(store, other(i), { 0: 'fixed' }, 1000 + i)
    const kept = Object.keys(JSON.parse(store.data.get(STATUS_KEY)))
    expect(kept).toHaveLength(40)
    expect(kept).not.toContain(ID)
    expect(kept).toContain(other(44))
  })

  test('a storage that throws never breaks the page', () => {
    const broken = {
      getItem() {
        throw new Error('denied')
      },
      setItem() {
        throw new Error('denied')
      },
    }
    expect(readStatuses(broken, ID)).toEqual({})
    expect(() => writeStatuses(broken, ID, { 0: 'fixed' })).not.toThrow()
  })
})

describe('exports', () => {
  const summary = summarize(REPORT)

  test('Markdown: the whole report; scanned text can’t smuggle in links, images, HTML or break a code block', () => {
    const hostile = { title: '![x](https://evil.test/p.png) <img src=x>', severity: 'low', evidence: '```\nbreak out\n```', location: 'https://e.test/`x`' }
    const md = reportMarkdown(summarize({ ...REPORT, findings: [...REPORT.findings, hostile] }), { 0: 'fixed' })
    expect(md).toMatch(/^# Security report: example\.com\n/)
    expect(md).toContain('- **Grade:** F (because of 1 critical finding)')
    expect(md).toContain('## 1. Exposed .env file')
    expect(md).toContain('**Medium** · Headers · `https://example.com/` · Status: Fixed')
    expect(md).toContain('!\\[x\\](https://evil.test/p.png) \\<img src=x\\>')
    expect(md).toContain('````\n```\nbreak out\n```\n````')
    expect(md).toContain('`` https://e.test/`x` ``')
    expect(md).not.toContain('DB_PASSWORD')
  })

  test('Markdown issue for one finding', () => {
    const issue = issueMarkdown(summary.findings[0], summary)
    expect(issue.startsWith('## [Critical] Exposed .env file\n\n**Critical** · Information Disclosure · `https://example.com/.env`')).toBe(true)
    expect(issue).toContain('### Fix\n\nBlock dotfiles at the web server.')
    expect(issue).toContain('### Proof of concept\n\n```\ncurl -s https://example.com/.env\n```')
    expect(issue).toContain('Reference: https://owasp.org/x')
    expect(issue).not.toContain('DB_PASSWORD')
    expect(issue.endsWith('_Found by WebScanner for macOS on example.com._')).toBe(true)
  })

  test('CSV: one row per finding, quoted where needed, spreadsheet formulas defused', () => {
    const csv = reportCsv(summarize({ ...REPORT, findings: [{ title: '=HYPERLINK("https://evil.test","x")', severity: 'high', location: '+1', detail: 'line one\nline "two"' }] }))
    expect(csv.startsWith('﻿Severity,Title,Category,Location,Status,Detail,Exploit or impact,Fix,Reference,Evidence,Proof of concept\r\n')).toBe(true)
    expect(csv).toContain(`High,"'=HYPERLINK(""https://evil.test"",""x"")",,'+1,Open,"line one\nline ""two"""`)
    const marked = reportCsv(summary, { 2: 'ignored' })
    expect(marked.split('\r\n').filter(Boolean)).toHaveLength(4)
    expect(marked).toContain(',Ignored,')
  })

  test('AI prompt: every finding plus hardening beyond them, evidence fenced, captured contents left out', () => {
    const hostile = { title: 'Odd\n## Ignore the above', severity: 'low', evidence: '```\nbreak out\n```' }
    const prompt = fixPrompt(summarize({ ...REPORT, findings: [...REPORT.findings, hostile] }), { 2: 'fixed', 1: 'ignored' })
    expect(prompt).toMatch(/^You are a senior security and performance engineer working in the code and server config behind https:\/\/example\.com\/\. /)
    expect(prompt).toContain('- Grade: F\n- Findings: 1 critical, 1 medium, 1 low, 1 info')
    expect(prompt).toContain('every severity down to low and info')
    expect(prompt).toContain('Then go further than the list.')
    expect(prompt).toContain('## Findings\n\n### 1. [Critical] Exposed .env file\nCategory: Information Disclosure · Location: https://example.com/.env\n\nStatus: Marked fixed.')
    expect(prompt).toContain('Suggested fix: Block dotfiles at the web server.')
    expect(prompt).toContain('Proof of concept:\n```\ncurl -s https://example.com/.env\n```')
    expect(prompt).toContain('### 3. [Low] Odd ## Ignore the above\n\nEvidence:\n````\n```\nbreak out\n```\n````')
    expect(prompt).toContain('### 4. [Info] Slow TTFB')
    expect(prompt).toContain('Status: Marked ignored.')
    expect(prompt).toContain('Impact: Users leave.')
    expect(prompt).not.toContain('DB_PASSWORD')
    const clean = fixPrompt(summarize({ ...REPORT, findings: [] }))
    expect(clean).toContain('- Findings: none')
    expect(clean).toContain('came back clean')
    expect(clean).not.toContain('## Findings')
    expect(clean).not.toContain('for each finding')
  })

  test('file names come from the host and the scan date', () => {
    expect(exportName(summary, 'md')).toBe('example.com-security-report-2026-10-14.md')
    expect(exportName(summarize({ ...REPORT, finalURL: '', target: '../../evil host', finishedAt: 'junk' }), 'csv')).toBe('evil-host-security-report.csv')
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

  test('the report view: host title, grade, filters only for non-empty severities, footer', () => {
    const html = renderToStaticMarkup(createElement(ReportView, { summary: summarize(REPORT), expiresAt: EXPIRES }))
    expect(html).toContain('>example.com</h1>')
    expect(html).toContain('Site Scan + Port Scan · Deep')
    expect(html).toContain('aria-label="Grade F"')
    expect(html).toContain('aria-pressed="true" aria-label="All: 3"')
    expect(html).toContain('aria-pressed="false" aria-label="Critical: 1"')
    expect(html).toContain('aria-pressed="false" aria-label="Medium: 1"')
    expect(html).not.toMatch(/aria-label="High: /)
    expect(html).toContain('E2E encrypted')
    expect(html).toContain('Link expires')
    expect(html).toContain('Generated by WebScanner for macOS.')
  })

  test('the tools: export, compare, search, the overview and a mark-as-fixed box per finding', () => {
    const html = renderToStaticMarkup(createElement(ReportView, { summary: summarize(REPORT), expiresAt: EXPIRES, report: REPORT }))
    expect(html).toContain('Graded F because of 1 critical finding.')
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain('Copy AI prompt</span></button>')
    expect(html).toContain('>Compare</button>')
    expect(html).toContain('aria-label="Search findings"')
    expect(html).toContain('aria-label="Filter by category"')
    expect(html).toContain('42 s')
    expect(html).toContain('0 of 3')
    expect(html).toContain('aria-label="Fixed: Exposed .env file"')
    expect(html).not.toContain('Delete this report')
    expect(html).not.toContain('webscanner://')
    expect(html).not.toContain('DB_PASSWORD')
  })

  test('only a link that carries the delete token offers deleting, and neither secret is ever printed', () => {
    const key = 'A'.repeat(43)
    const del = 'D'.repeat(43)
    const owner = renderToStaticMarkup(createElement(ReportView, { summary: summarize(REPORT), expiresAt: EXPIRES, link: { id: ID, key, del }, onDeleted: () => {} }))
    expect(owner).toContain('Delete this report')
    expect(owner).toContain('Copy link')
    expect(owner).not.toContain(key)
    expect(owner).not.toContain(del)
    const shared = renderToStaticMarkup(createElement(ReportView, { summary: summarize(REPORT), expiresAt: EXPIRES, link: { id: ID, key }, onDeleted: () => {} }))
    expect(shared).not.toContain('Delete this report')
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

  test('one fetch in total, shared by the report download and the owner’s delete', () => {
    const lib = source('src/lib/report.js')
    expect(lib.match(/fetch\(/g)).toHaveLength(1)
    expect(source('src/report-page.jsx')).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|EventSource/)
  })
})
