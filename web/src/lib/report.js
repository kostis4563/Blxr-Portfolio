const API_BASE = '/api'

export function parseLink(hash) {
  const p = new URLSearchParams(String(hash).replace(/^#/, ''))
  const id = p.get('id') || ''
  const key = p.get('key') || ''
  if (!/^[A-Za-z0-9_-]{22}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(key)) return null
  return { id, key }
}

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export class ReportError extends Error {
  constructor(code, message) { super(message); this.code = code }
}

export async function loadReport({ id, key }, apiBase = API_BASE) {
  let res
  try {
    res = await fetch(`${apiBase}/reports/${id}`, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
  } catch {
    throw new ReportError('network', 'Could not reach the report service.')
  }
  if (res.status === 404) throw new ReportError('expired', 'This report has expired or was deleted.')
  if (!res.ok) throw new ReportError('http', `The report service returned HTTP ${res.status}.`)
  const expiresAt = res.headers.get('X-Report-Expires-At') || null
  const blob = new Uint8Array(await res.arrayBuffer())
  if (blob.length < 29 || blob[0] !== 1) throw new ReportError('format', 'Unsupported report format.')
  let plain
  try {
    const cryptoKey = await crypto.subtle.importKey('raw', b64urlToBytes(key), { name: 'AES-GCM' }, false, ['decrypt'])
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: blob.slice(1, 13) }, cryptoKey, blob.slice(13))
  } catch {
    throw new ReportError('key', 'Could not decrypt this report. The link may be incomplete — copy it again in full.')
  }
  const stream = new Blob([plain]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const report = JSON.parse(await new Response(stream).text())
  if (!report || report.schema !== 'webscanner.report/1') throw new ReportError('format', 'Unsupported report format.')
  return { report, expiresAt }
}

export function reportApiBase(search = '') {
  if (!import.meta.env.DEV) return API_BASE
  return new URLSearchParams(search).get('api') || API_BASE
}

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info']

export const SEVERITY_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' }

export const MODE_LABEL = {
  fullAudit: 'Full Audit',
  siteScan: 'Site Scan',
  contentDiscovery: 'Content Discovery',
  urlMask: 'URL Mask',
  portScan: 'Port Scan',
  database: 'Database',
  hostScan: 'Host',
  info: 'Info',
  performance: 'Performance',
  userView: 'User View',
}

export const INTENSITY_LABEL = { quick: 'Quick', standard: 'Standard', deep: 'Deep', aggressive: 'Aggressive', maximum: 'Max' }

export const GRADE_SEVERITY = { A: 'info', 'A-': 'info', B: 'low', C: 'medium', D: 'high', F: 'critical' }

export const LOADING_STATE = { title: 'Decrypting report', message: 'The report is being decrypted in your browser.' }

export const INCOMPLETE_STATE = {
  title: 'This link is incomplete.',
  message: 'A report link ends in #id=…&key=… — make sure you copied all of it.',
}

const ERROR_TITLES = { expired: 'Report not found.', key: 'Can’t decrypt this report.', network: 'Can’t reach blxr.' }

export const DEFAULT_TITLE = 'Scan Report · blxr'

const own = (map, key) => (typeof key === 'string' && Object.hasOwn(map, key) ? map[key] : undefined)

export const text = (value) => (typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '')

export const severityOf = (value) => (SEVERITIES.includes(value) ? value : 'info')

export function safeHref(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function formatWhen(iso) {
  if (typeof iso !== 'string' || !iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return date.toISOString()
  }
}

export function reportHost(report) {
  const raw = text(report.finalURL) || text(report.target)
  try {
    return new URL(raw).host || raw
  } catch {
    return raw
  }
}

export function normalizeFinding(raw, index) {
  const f = raw && typeof raw === 'object' ? raw : {}
  const evidence = text(f.evidence)
  return {
    key: `${index}:${text(f.id)}`,
    title: text(f.title),
    severity: severityOf(f.severity),
    category: text(f.category),
    location: text(f.location),
    detail: text(f.detail),
    exploit: text(f.exploit),
    remediation: text(f.remediation),
    evidence: evidence.trim() === '—' ? '' : evidence,
    reference: text(f.reference),
    reproduction: text(f.reproduction),
    capturedContent: text(f.capturedContent),
  }
}

export function summarize(report) {
  const findings = (Array.isArray(report.findings) ? report.findings : [])
    .map(normalizeFinding)
    .map((finding, order) => ({ finding, order }))
    .sort((a, b) => SEVERITIES.indexOf(a.finding.severity) - SEVERITIES.indexOf(b.finding.severity) || a.order - b.order)
    .map(({ finding }) => finding)
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s).length]))
  const modes = (Array.isArray(report.modes) ? report.modes : []).map((m) => own(MODE_LABEL, m) || text(m)).filter(Boolean)
  const grade = own(GRADE_SEVERITY, report.grade) ? report.grade : null
  const host = reportHost(report)
  return {
    findings,
    counts,
    worst: SEVERITIES.find((s) => counts[s] > 0) || null,
    scan: [modes.join(' + ') || 'Scan', own(INTENSITY_LABEL, report.intensity)].filter(Boolean).join(' · '),
    url: text(report.finalURL) || text(report.target),
    host,
    title: host ? `${host} · Scan Report · blxr` : DEFAULT_TITLE,
    grade,
    gradeSeverity: grade ? GRADE_SEVERITY[grade] : null,
    finishedAt: text(report.finishedAt),
    generator: text(report.generator) || 'WebScanner',
  }
}

export function errorState(error) {
  return {
    title: own(ERROR_TITLES, error?.code) || 'Something went wrong.',
    message: typeof error?.message === 'string' && error.message ? error.message : String(error),
  }
}
