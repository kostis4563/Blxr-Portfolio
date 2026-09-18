export const LIMITS = {
  body: 4000,
  files: 6,
  page: 60,
}

export const RUN_GAP = 5 * 60 * 1000

export const TYPING_EVERY = 2500
export const TYPING_FOR = 4500

export const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥']

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function readHash(hash) {
  const second = (hash || '').replace(/^#/, '').split('/')[1] || ''
  return { thread: ID_RE.test(second) ? second : null }
}

const DAY = 24 * 60 * 60 * 1000

const startOfDay = (at) => {
  const day = new Date(at)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

export function clockOf(stamp) {
  const at = new Date(stamp)
  if (Number.isNaN(at.getTime())) return ''
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function dayLabel(stamp, now = Date.now()) {
  const at = new Date(stamp)
  if (Number.isNaN(at.getTime())) return ''
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days > 1 && days < 7) return DAYS[at.getDay()]
  const date = `${at.getDate()} ${MONTHS[at.getMonth()]}`
  return at.getFullYear() === new Date(now).getFullYear() ? date : `${date} ${at.getFullYear()}`
}

export function inboxTime(stamp, now = Date.now()) {
  const at = new Date(stamp)
  if (Number.isNaN(at.getTime())) return ''
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY)
  if (days === 0) return clockOf(at)
  if (days === 1) return 'Yesterday'
  if (days < 7) return DAYS[at.getDay()].slice(0, 3)
  return `${at.getDate()} ${MONTHS[at.getMonth()]}`
}

export function fullTime(stamp) {
  const at = new Date(stamp)
  if (Number.isNaN(at.getTime())) return ''
  return `${DAYS[at.getDay()]} ${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}, ${clockOf(at)}`
}

export const isImage = (file) => String(file?.type ?? '').startsWith('image/')

export function previewOf(message) {
  if (!message) return ''
  if (message.deleted_at) return 'Unsent a message'
  const body = String(message.body || '').replace(/\s+/g, ' ').trim()
  if (body) return body
  const files = message.files || []
  const count = typeof files === 'number' ? files : files.length
  if (!count) return ''
  const photos = typeof files === 'number' ? 0 : files.filter(isImage).length
  if (photos === count) return count === 1 ? 'Sent a photo' : `Sent ${count} photos`
  return count === 1 ? 'Sent a file' : `Sent ${count} files`
}

export function layout(messages, mine, now = Date.now()) {
  const rows = []
  let lastDay = null
  let previous = null
  const shown = messages.filter((message) => !message.deleted_at)

  shown.forEach((message, index) => {
    const at = Date.parse(message.created_at)
    const day = startOfDay(at)
    if (day !== lastDay) {
      rows.push({ kind: 'day', key: `day-${day}`, label: dayLabel(at, now) })
      lastDay = day
      previous = null
    }
    const next = shown[index + 1]
    const sameSideBefore = previous && mine(previous) === mine(message) && at - Date.parse(previous.created_at) < RUN_GAP
    const sameSideAfter = next && mine(next) === mine(message) && Date.parse(next.created_at) - at < RUN_GAP && startOfDay(Date.parse(next.created_at)) === day
    rows.push({
      kind: 'message',
      key: message.id,
      message,
      mine: mine(message),
      first: !sameSideBefore,
      last: !sameSideAfter,
    })
    previous = message
  })
  return rows
}

export function seenUpTo(messages, mine, theirSeenAt) {
  const seen = Date.parse(theirSeenAt ?? '')
  if (!Number.isFinite(seen)) return null
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.deleted_at || !mine(message)) continue
    return Date.parse(message.created_at) <= seen ? message.id : null
  }
  return null
}

export function unreadIn(messages, mine, mySeenAt) {
  const seen = Date.parse(mySeenAt ?? '')
  return messages.filter((message) => !message.deleted_at && !mine(message) && (!Number.isFinite(seen) || Date.parse(message.created_at) > seen)).length
}

export function toggleReaction(reactions, emoji, uid) {
  const next = { ...(reactions || {}) }
  const held = Array.isArray(next[emoji]) ? next[emoji] : []
  const without = held.filter((who) => who !== uid)
  if (without.length === held.length) next[emoji] = [...held, uid]
  else if (without.length) next[emoji] = without
  else delete next[emoji]
  return next
}

export function reactionRows(reactions, uid) {
  const held = reactions || {}
  return Object.keys(held)
    .filter((emoji) => Array.isArray(held[emoji]) && held[emoji].length)
    .sort((a, b) => {
      const ia = REACTIONS.indexOf(a)
      const ib = REACTIONS.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
    .map((emoji) => ({ emoji, count: held[emoji].length, mine: held[emoji].includes(uid) }))
}

export function mergeMessages(held, incoming) {
  const byId = new Map(held.map((message) => [message.id, message]))
  let changed = false
  for (const message of incoming) {
    const current = byId.get(message.id)
    if (!current || Date.parse(message.updated_at) >= Date.parse(current.updated_at)) {
      if (!current || current !== message) {
        byId.set(message.id, message)
        changed = true
      }
    }
  }
  if (!changed) return held
  return [...byId.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
}

export function newestStamp(messages) {
  let newest = null
  for (const message of messages) {
    if (!newest || Date.parse(message.updated_at) > Date.parse(newest)) newest = message.updated_at
  }
  return newest
}

export function inboxMatches(row, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [row.name, row.email, row.handle, row.last_body].some((field) => String(field || '').toLowerCase().includes(needle))
}

export const inboxUnread = (rows) => rows.reduce((sum, row) => sum + (row.unread || 0), 0)

export function firstNameOf(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'them'
}

export function initialOf(name) {
  return String(name || '').trim().charAt(0).toUpperCase() || '?'
}

export const badgeOf = (count) => (count > 99 ? '99+' : String(count))
