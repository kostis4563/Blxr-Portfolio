const BASE = '/api/music'
const REVIEWS = '/api/reviews'

export const SEARCH_LIMIT_MAX = 20
export const TOP_LIMIT_MAX = 15

async function getJson(path, signal) {
  const res = await fetch(`${BASE}${path}`, { signal })

  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
  return res.json()
}

const itemsOf = (data) => (Array.isArray(data?.items) ? data.items : [])

export async function searchTracks(q, { limit = 12, signal } = {}) {
  const params = new URLSearchParams({ q, limit: String(limit) })
  return itemsOf(await getJson(`/search?${params}`, signal))
}

export async function fetchTopChart({ limit = 10, country, signal } = {}) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (country) params.set('country', country)
  return itemsOf(await getJson(`/top?${params}`, signal))
}

export function recordHit(path) {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl) return

  const send = () => {
    try {
      navigator.sendBeacon('/api/hit', new Blob([JSON.stringify({ path })], { type: 'application/json' }))
    } catch {
    }
  }

  if (typeof document !== 'undefined' && document.prerendering) {
    document.addEventListener('prerenderingchange', send, { once: true })
  } else {
    send()
  }
}

export class ReviewError extends Error {
  constructor(code, { fields = [], retryAfter = 0, status = 0 } = {}) {
    super(code)
    this.code = code
    this.fields = fields
    this.retryAfter = retryAfter
    this.status = status
  }
}

export async function fetchReviews({ signal } = {}) {
  const res = await fetch(REVIEWS, { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`${REVIEWS} → HTTP ${res.status}`)
  const data = await res.json()
  return itemsOf(data)
}

export async function submitReview(review, { signal } = {}) {
  const res = await fetch(REVIEWS, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(review),
    credentials: 'same-origin',
    signal,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ReviewError(data?.error || 'failed', {
      fields: Array.isArray(data?.fields) ? data.fields : [],
      retryAfter: Number(res.headers.get('retry-after')) || Number(data?.retryAfter) || 0,
      status: res.status,
    })
  }
  return data?.item ?? null
}

export async function checkHealth({ signal } = {}) {
  try {
    const data = await getJson('/health', signal)
    return data?.ok === true
  } catch {
    return false
  }
}
