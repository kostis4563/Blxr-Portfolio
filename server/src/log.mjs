import fs from 'node:fs'
import path from 'node:path'

export const LEVELS = ['error', 'warn', 'info']
export const SOURCES = ['server', 'api', 'client', 'upstream', 'github', 'auth', 'reviews', 'mail']

const MAX_ENTRIES = 3000
const DEDUPE_MS = 60_000
const TEXT_MAX = { message: 500, stack: 4000, path: 200, detail: 2000 }

let file = null
let entries = []
let nextId = 1
let dirty = false

const trim = (value, max) => (typeof value === 'string' ? value.replace(/\s+$/, '').slice(0, max) : '')

const isEntry = (e) =>
  e && typeof e === 'object' && Number.isInteger(e.id) && typeof e.at === 'string' && LEVELS.includes(e.level) && SOURCES.includes(e.source) && typeof e.message === 'string'

export function openLog(stateDir) {
  file = path.join(stateDir, 'logs.json')
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (Array.isArray(parsed?.entries)) entries = parsed.entries.filter(isEntry).slice(-MAX_ENTRIES)
    nextId = Math.max(Number(parsed?.nextId) || 1, ...entries.map((e) => e.id + 1))
  } catch {
    entries = []
  }
}

export function saveLog() {
  if (!dirty || !file) return
  dirty = false
  try {
    fs.writeFileSync(file, JSON.stringify({ nextId, entries }))
  } catch {
  }
}

const dedupeKey = (e) => [e.level, e.source, e.message, e.path || '', e.method || '', e.status || '', e.code || ''].join('\u001f')

export function record({ level, source, message, path: reqPath, method, status, code, stack, detail, client }) {
  if (!LEVELS.includes(level) || !SOURCES.includes(source)) return null
  const now = new Date().toISOString()
  const entry = {
    id: 0,
    at: now,
    count: 1,
    level,
    source,
    message: trim(message, TEXT_MAX.message) || '(no message)',
  }
  if (reqPath) entry.path = trim(reqPath, TEXT_MAX.path)
  if (method) entry.method = String(method).slice(0, 8)
  if (Number.isInteger(status)) entry.status = status
  if (code) entry.code = trim(String(code), 64)
  if (stack) entry.stack = trim(stack, TEXT_MAX.stack)
  if (client) entry.client = trim(client, 80)
  if (detail !== undefined && detail !== null) {
    const text = typeof detail === 'string' ? detail : JSON.stringify(detail)
    if (text) entry.detail = trim(text, TEXT_MAX.detail)
  }

  const key = dedupeKey(entry)
  for (let i = entries.length - 1; i >= 0 && i >= entries.length - 50; i--) {
    const prev = entries[i]
    if (Date.parse(now) - Date.parse(prev.last || prev.at) > DEDUPE_MS) break
    if (dedupeKey(prev) === key) {
      prev.count += 1
      prev.last = now
      if (entry.stack && !prev.stack) prev.stack = entry.stack
      dirty = true
      return prev
    }
  }

  entry.id = nextId++
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
  dirty = true
  return entry
}

const describe = (err) => (err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err))
export const log = {
  error: (source, err, context = {}) => record({ level: 'error', source, message: describe(err), stack: err instanceof Error ? err.stack : undefined, ...context }),
  warn: (source, message, context = {}) => record({ level: 'warn', source, message: describe(message), ...context }),
  info: (source, message, context = {}) => record({ level: 'info', source, message: describe(message), ...context }),
}

export function queryLog({ levels = [], sources = [], q, since, status, limit = 200, before } = {}) {
  const needle = typeof q === 'string' ? q.trim().toLowerCase() : ''
  const cap = Math.min(500, Math.max(0, Number(limit) || 0))
  const from = Number(since) > 0 ? Number(since) : 0
  const items = []
  let matched = 0
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (levels.length && !levels.includes(e.level)) continue
    if (sources.length && !sources.includes(e.source)) continue
    if (from && Date.parse(e.last || e.at) < from) continue
    if (status && !statusMatches(e.status, status)) continue
    if (needle && ![e.message, e.path, e.code, e.stack, e.detail, e.client].some((v) => typeof v === 'string' && v.toLowerCase().includes(needle))) continue
    matched += 1
    if (before && e.id >= before) continue
    if (items.length < cap) items.push(e)
  }
  return { items, matched }
}

const statusMatches = (code, wanted) =>
  Number.isInteger(code) && (wanted === '4xx' ? code >= 400 && code < 500 : wanted === '5xx' ? code >= 500 : code === Number(wanted))

export function facetsOf(since = 0) {
  const levels = { error: 0, warn: 0, info: 0 }
  const sources = Object.fromEntries(SOURCES.map((s) => [s, 0]))
  const statuses = { '4xx': 0, '5xx': 0 }
  const from = Number(since) > 0 ? Number(since) : 0
  for (const e of entries) {
    if (from && Date.parse(e.last || e.at) < from) continue
    levels[e.level] += 1
    sources[e.source] += 1
    if (Number.isInteger(e.status)) {
      if (e.status >= 500) statuses['5xx'] += 1
      else if (e.status >= 400) statuses['4xx'] += 1
    }
  }
  return { levels, sources, statuses }
}

export function summariseLog(now = Date.now()) {
  const dayAgo = now - 86_400_000
  const byLevel = { error: 0, warn: 0, info: 0 }
  const bySource = Object.fromEntries(SOURCES.map((s) => [s, 0]))
  const recent = { error: 0, warn: 0, info: 0, api: 0, client: 0 }
  let last = null
  for (const e of entries) {
    byLevel[e.level] += e.count
    bySource[e.source] += e.count
    if (Date.parse(e.last || e.at) >= dayAgo) {
      recent[e.level] += e.count
      if (e.source === 'api' && e.level !== 'info') recent.api += e.count
      if (e.source === 'client') recent.client += e.count
    }
    if (e.level === 'error') last = e.last || e.at
  }
  return { total: entries.length, byLevel, bySource, recent, lastError: last, oldest: entries[0]?.at || null }
}

export function clearLog() {
  const removed = entries.length
  entries = []
  dirty = true
  return removed
}

export const logSize = () => entries.length
