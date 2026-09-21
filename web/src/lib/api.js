import { analyticsAllowed } from './prefs'

const REVIEWS = '/api/reviews'

const itemsOf = (data) => (Array.isArray(data?.items) ? data.items : [])

export function recordHit(path) {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl) return
  if (!analyticsAllowed()) return

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

export function deleteAccountRequest(accessToken) {
  return fetch('/api/account/delete', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  }).catch(() => new Response(JSON.stringify({ error: 'offline' }), { status: 0 }))
}

export function notifyPasswordChanged(accessToken) {
  return fetch('/api/mail/password-changed', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    keepalive: true,
  }).catch(() => null)
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

async function reviewRequest(path, { method = 'GET', body, bearer, signal } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (bearer) headers.authorization = `Bearer ${bearer}`
  const res = await fetch(`${REVIEWS}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ReviewError(data?.error || 'failed', {
      fields: Array.isArray(data?.fields) ? data.fields : [],
      retryAfter: Number(res.headers.get('retry-after')) || Number(data?.retryAfter) || 0,
      status: res.status,
    })
  }
  return data
}

export async function editReview(id, review, { signal } = {}) {
  const data = await reviewRequest(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: review, signal })
  return data?.item ?? null
}

export async function fetchInvite(token, { signal } = {}) {
  const data = await reviewRequest(`/invites/${encodeURIComponent(token)}`, { signal })
  return data?.invite ?? null
}

export async function createInvite(invite, { signal, bearer } = {}) {
  const data = await reviewRequest('/invites', { method: 'POST', body: invite, signal, bearer })
  return data?.invite ?? null
}

export function deleteInvite(token, { signal, bearer } = {}) {
  return reviewRequest(`/invites/${encodeURIComponent(token)}`, { method: 'DELETE', signal, bearer })
}

export function fetchPanel({ signal, bearer } = {}) {
  return reviewRequest('/panel', { signal, bearer })
}

export async function panelUpdateReview(id, patch, { signal, bearer } = {}) {
  const data = await reviewRequest(`/panel/reviews/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch, signal, bearer })
  return data?.item ?? null
}

export function panelDeleteReview(id, { signal, bearer } = {}) {
  return reviewRequest(`/panel/reviews/${encodeURIComponent(id)}`, { method: 'DELETE', signal, bearer })
}

export async function panelSaveSettings(settings, { signal, bearer } = {}) {
  const data = await reviewRequest('/panel/settings', { method: 'PUT', body: settings, signal, bearer })
  return data?.settings ?? null
}
