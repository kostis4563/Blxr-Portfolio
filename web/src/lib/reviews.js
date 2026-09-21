export const REVIEW_LIMITS = {
  name: { min: 2, max: 40 },
  role: { min: 0, max: 60 },
  text: { min: 20, max: 600 },
}

export const RATINGS = [5, 4, 3, 2, 1]

export const SORTS = ['newest', 'highest', 'lowest']

export const PAGE_SIZE = 8

export const LINK_RE = /https?:\/\/|www\.|\S+\.(?:com|net|org|io|gg|xyz|me|app|dev|co)(?=[\s/,.;:!?)]|$)/i

export const EDIT_WINDOW_MS = 15 * 60 * 1000
export const INVITE_DAYS = 4
export const TOKEN_RE = /^[a-f0-9]{32}$/

const OWN_KEY = 'blxr-review'
const DEVICE_KEY = 'blxr-device'

export function summarize(items) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sum = 0
  for (const item of items) {
    distribution[item.rating] += 1
    sum += item.rating
  }
  const count = items.length
  const average = count ? Math.round((sum / count) * 10) / 10 : 0
  return { count, average, distribution }
}

export function sortReviews(items, sort) {
  const byDate = (a, b) => Date.parse(b.at) - Date.parse(a.at)
  const byPin = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
  const copy = [...items]
  if (sort === 'highest') return copy.sort((a, b) => byPin(a, b) || b.rating - a.rating || byDate(a, b))
  if (sort === 'lowest') return copy.sort((a, b) => byPin(a, b) || a.rating - b.rating || byDate(a, b))
  return copy.sort((a, b) => byPin(a, b) || byDate(a, b))
}

export function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = [...parts[0]][0] || ''
  const last = parts.length > 1 ? [...parts[parts.length - 1]][0] || '' : ''
  return (first + last).toLocaleUpperCase()
}

const UNITS = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

export function relativeTime(iso, now = Date.now()) {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''
  const diff = (then - now) / 1000
  const abs = Math.abs(diff)
  try {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    for (const [unit, seconds] of UNITS) {
      if (abs >= seconds) return rtf.format(Math.round(diff / seconds), unit)
    }
    return rtf.format(0, 'second')
  } catch {
    return new Date(then).toLocaleDateString()
  }
}

export function absoluteTime(iso) {
  try {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function validateDraft({ name, role, rating, text }) {
  const fields = {}
  const n = name.trim()
  const r = role.trim()
  const t = text.trim()
  if (n.length < REVIEW_LIMITS.name.min || n.length > REVIEW_LIMITS.name.max || !/\p{L}/u.test(n)) fields.name = 'length'
  if (r.length > REVIEW_LIMITS.role.max) fields.role = 'length'
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fields.rating = 'missing'
  if (t.length < REVIEW_LIMITS.text.min || t.length > REVIEW_LIMITS.text.max) fields.text = 'length'
  else if (LINK_RE.test(t) || LINK_RE.test(n) || LINK_RE.test(r)) fields.text = 'link'
  return fields
}

export function deviceToken() {
  try {
    const saved = localStorage.getItem(DEVICE_KEY)
    if (saved && /^[a-f0-9]{32}$/.test(saved)) return saved
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(DEVICE_KEY, token)
    return token
  } catch {
    return null
  }
}

export function readOwnReview() {
  try {
    const parsed = JSON.parse(localStorage.getItem(OWN_KEY) || 'null')
    return parsed && typeof parsed.id === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function rememberOwnReview(item) {
  try {
    localStorage.setItem(OWN_KEY, JSON.stringify({ id: item.id, at: item.at }))
  } catch {
  }
}

export function forgetOwnReview() {
  try {
    localStorage.removeItem(OWN_KEY)
  } catch {
  }
}

export function editMinutesLeft(item, now = Date.now()) {
  const left = EDIT_WINDOW_MS - (now - Date.parse(item.at))
  return left > 0 ? Math.ceil(left / 60_000) : 0
}

export function inviteLink(token) {
  return `${window.location.origin}/reviews?invite=${token}`
}
