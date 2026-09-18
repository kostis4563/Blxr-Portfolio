import crypto from 'node:crypto'

const SALT = crypto.randomBytes(16).toString('hex')
export const fingerprint = (kind, value) =>
  crypto.createHash('sha256').update(`${SALT}:${kind}:${value}`).digest('base64url').slice(0, 24)

const buckets = new Map()
let lastSweep = Date.now()
const SWEEP_MS = 60_000
const BUCKETS_MAX = 20_000

export const LIMITS = {
  all: { limit: 300, windowMs: 60_000 },
  auth: { limit: 30, windowMs: 60_000 },
  upstream: { limit: 90, windowMs: 60_000 },
  write: { limit: 12, windowMs: 60_000 },
  beacon: { limit: 60, windowMs: 60_000 },
}

function sweep(now) {
  if (now - lastSweep < SWEEP_MS && buckets.size < BUCKETS_MAX) return
  lastSweep = now
  for (const [key, b] of buckets) {
    const rule = LIMITS[b.name]
    const refilled = b.tokens + ((now - b.at) / rule.windowMs) * rule.limit
    if (refilled >= rule.limit) buckets.delete(key)
  }
  if (buckets.size > BUCKETS_MAX) {
    const excess = buckets.size - BUCKETS_MAX
    let i = 0
    for (const key of buckets.keys()) {
      if (i++ >= excess) break
      buckets.delete(key)
    }
  }
}

export function rateLimit(name, address, now = Date.now()) {
  const rule = LIMITS[name]
  if (!rule) return null
  sweep(now)
  const key = `${name}:${fingerprint('rl', address)}`
  let b = buckets.get(key)
  if (!b) {
    b = { name, tokens: rule.limit, at: now }
    buckets.set(key, b)
  } else {
    b.tokens = Math.min(rule.limit, b.tokens + ((now - b.at) / rule.windowMs) * rule.limit)
    b.at = now
  }
  if (b.tokens < 1) {
    const perToken = rule.windowMs / rule.limit
    return { retryAfter: Math.max(1, Math.ceil(((1 - b.tokens) * perToken) / 1000)) }
  }
  b.tokens -= 1
  return null
}

export const rateLimitSize = () => buckets.size

function originsFrom(env) {
  const list = new Set()
  const add = (value) => {
    try {
      const u = new URL(String(value || '').trim())
      list.add(u.origin)
    } catch {
    }
  }
  if (env.SITE_URL) {
    add(env.SITE_URL)
    try {
      const u = new URL(env.SITE_URL)
      add(`${u.protocol}//${u.host.startsWith('www.') ? u.host.slice(4) : `www.${u.host}`}`)
    } catch {
    }
  }
  for (const o of String(env.ALLOWED_ORIGINS || '').split(',')) if (o.trim()) add(o)
  return list
}

export const ALLOWED_ORIGINS = originsFrom(process.env)
const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

export function originAllowed(req) {
  if (!MUTATING.has(req.method)) return true
  if (!ALLOWED_ORIGINS.size) return true
  const origin = req.headers.origin
  if (typeof origin !== 'string' || !origin) {
    const site = req.headers['sec-fetch-site']
    return site !== 'cross-site'
  }
  return ALLOWED_ORIGINS.has(origin)
}

const JWT_RE = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/
const JWT_MAX = 4096

export function bearerOf(req) {
  const auth = req.headers.authorization
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null
  const token = auth.slice(7).trim()
  if (token.length > JWT_MAX || !JWT_RE.test(token)) return null
  return token
}

export function jwtPayload(token) {
  try {
    const body = Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
    const payload = JSON.parse(body)
    return payload && typeof payload === 'object' ? payload : null
  } catch {
    return null
  }
}

export function jwtLooksUsable(token, now = Date.now()) {
  const p = jwtPayload(token)
  if (!p) return false
  if (p.aud !== undefined && p.aud !== 'authenticated' && !(Array.isArray(p.aud) && p.aud.includes('authenticated'))) return false
  if (typeof p.exp === 'number' && p.exp * 1000 < now - 30_000) return false
  if (typeof p.sub !== 'string' || !p.sub) return false
  return true
}

export const isAal2 = (token) => jwtPayload(token)?.aal === 'aal2'

export const hasVerifiedFactor = (user) =>
  Array.isArray(user?.factors) && user.factors.some((f) => f && f.status === 'verified')

export const API_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow',
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
}
