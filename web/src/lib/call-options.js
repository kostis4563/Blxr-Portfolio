export const CALL_PLACES = [
  { id: 'facetime', label: 'FaceTime', contact: 'link', example: 'facetime.apple.com/join#…' },
  { id: 'meet', label: 'Google Meet', short: 'Meet', contact: 'link', example: 'meet.google.com/abc-defg-hij' },
  { id: 'zoom', label: 'Zoom', contact: 'link', example: 'zoom.us/j/…' },
  { id: 'teams', label: 'Microsoft Teams', short: 'Teams', contact: 'link', example: 'teams.microsoft.com/…' },
  { id: 'discord', label: 'Discord', contact: 'handle' },
  { id: 'whatsapp', label: 'WhatsApp', contact: 'phone' },
  { id: 'phone', label: 'Phone', short: 'Phone call', contact: 'phone' },
  { id: 'other', label: 'Somewhere else', short: 'Other', contact: 'place' },
]

export const CALL_MODES = [
  { id: 'video', label: 'Video' },
  { id: 'voice', label: 'Voice only' },
]

export const CALL_LANGS = [
  { id: 'en', label: 'English', own: 'English' },
  { id: 'el', label: 'Greek', own: 'Ελληνικά' },
]

export const CALL_TOPICS = [
  { id: 'project', label: 'A project', hint: 'What are you building, who is it for, and where are you stuck?' },
  { id: 'job', label: 'A job or role', hint: 'The role, the team, and what you’re looking for.' },
  { id: 'collab', label: 'A collaboration', hint: 'What you have in mind, and how we might work on it together.' },
  { id: 'advice', label: 'Advice or feedback', hint: 'What you’d like a second pair of eyes on.' },
  { id: 'chat', label: 'Just to chat', hint: 'Anything on your mind.' },
]

export const CALL_BUDGETS = [
  { id: 'small', label: 'Under €1k' },
  { id: 'mid', label: '€1k–5k' },
  { id: 'large', label: '€5k–15k' },
  { id: 'huge', label: '€15k+' },
  { id: 'open', label: 'Not sure yet' },
]

export const CALL_TIMELINES = [
  { id: 'now', label: 'As soon as possible' },
  { id: 'month', label: 'Within a month' },
  { id: 'later', label: 'Later on' },
]

export const CALL_LIMITS = { company: 80, link: 300, phone: 24, place: 80 }

const PHONE_RE = /^\+?[\d\s().-]+$/
const HANDLE_RE = /^@?(?:[a-z0-9_.]{2,32}|[^\s@#:]{2,32}#\d{4})$/i

export const placeById = (id) => CALL_PLACES.find((p) => p.id === id) || null
export const labelOf = (list, id) => list.find((o) => o.id === id)?.label || null

export function cleanLink(value) {
  const raw = String(value ?? '').trim()
  if (!raw || raw.length > CALL_LIMITS.link || /\s/.test(raw)) return null
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !/^[^.]+(\.[^.]+)+$/.test(url.hostname) || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

export function cleanContact(kind, value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (kind === 'link') return text ? cleanLink(text) : ''
  if (!text) return null
  if (kind === 'phone') {
    const digits = text.replace(/\D/g, '').length
    return text.length <= CALL_LIMITS.phone && PHONE_RE.test(text) && digits >= 6 && digits <= 15 ? text : null
  }
  if (kind === 'handle') return HANDLE_RE.test(text) ? text.replace(/^@/, '') : null
  return text.length >= 2 && text.length <= CALL_LIMITS.place ? text : null
}

export function contactProblem(placeId, value) {
  const place = placeById(placeId)
  if (!place || cleanContact(place.contact, value) !== null) return null
  const empty = !String(value ?? '').trim()
  if (place.contact === 'phone') return empty ? 'Add a number I can call.' : 'That number doesn’t look right. Include the country code.'
  if (place.contact === 'handle') return empty ? 'Add your Discord username.' : 'That doesn’t look like a Discord username.'
  if (place.contact === 'place') return empty ? 'Tell me where.' : `Keep it under ${CALL_LIMITS.place} characters.`
  return 'That link doesn’t look right.'
}
