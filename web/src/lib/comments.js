import { useSyncExternalStore } from 'react'

const KEY = 'blxr-comments'
const HIDDEN_KEY = 'blxr-comments-hidden'
const MAX_COMMENTS = 200
export const MAX_LENGTH = 500

const EMPTY = Object.freeze([])
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())

let list = null
let hidden = null
let placing = false
let focused = null

const finite = (n) => typeof n === 'number' && Number.isFinite(n)

function clean(raw) {
  if (!raw || typeof raw !== 'object') return null
  const { id, path, text, at, x, y, anchor, resolved, edited } = raw
  if (typeof id !== 'string' || typeof path !== 'string' || typeof text !== 'string' || !text.trim()) return null
  if (!finite(x) || !finite(y) || Number.isNaN(Date.parse(at))) return null
  const comment = { id, path, text: text.slice(0, MAX_LENGTH), at, x, y, resolved: resolved === true }
  if (anchor && typeof anchor.id === 'string' && finite(anchor.fx) && finite(anchor.dy)) {
    comment.anchor = { id: anchor.id, fx: anchor.fx, dy: anchor.dy }
  }
  if (typeof edited === 'string' && !Number.isNaN(Date.parse(edited))) comment.edited = edited
  return comment
}

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(clean).filter(Boolean) : []
  } catch {
    return []
  }
}

function save(next) {
  list = next.slice(-MAX_COMMENTS)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
  }
  emit()
}

const onStorage = (e) => {
  if (e.key !== null && e.key !== KEY && e.key !== HIDDEN_KEY) return
  list = null
  hidden = null
  emit()
}

function subscribe(fn) {
  if (!listeners.size && typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
    if (!listeners.size && typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

export function getComments() {
  if (list === null) list = load()
  return list
}

export function commentsHidden() {
  if (hidden === null) {
    try {
      hidden = localStorage.getItem(HIDDEN_KEY) === '1'
    } catch {
      hidden = false
    }
  }
  return hidden
}

export const commentsPlacing = () => placing
export const focusedComment = () => focused

export const useComments = () => useSyncExternalStore(subscribe, getComments, () => EMPTY)
export const useCommentsHidden = () => useSyncExternalStore(subscribe, commentsHidden, () => false)
export const useCommentsPlacing = () => useSyncExternalStore(subscribe, commentsPlacing, () => false)
export const useFocusedComment = () => useSyncExternalStore(subscribe, focusedComment, () => null)

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export function addComment({ path, text, x, y, anchor = null }, now = new Date()) {
  const body = text.trim().slice(0, MAX_LENGTH)
  if (!body) return null
  const comment = clean({ id: newId(), path, text: body, at: now.toISOString(), x, y, anchor })
  if (!comment) return null
  save([...getComments(), comment])
  return comment
}

export function editComment(id, text, now = new Date()) {
  const body = text.trim().slice(0, MAX_LENGTH)
  if (!body) return removeComment(id)
  save(getComments().map((c) => (c.id === id && c.text !== body ? { ...c, text: body, edited: now.toISOString() } : c)))
  return getComments().find((c) => c.id === id) ?? null
}

export function setResolved(id, resolved) {
  save(getComments().map((c) => (c.id === id ? { ...c, resolved } : c)))
}

export function removeComment(id) {
  const removed = getComments().find((c) => c.id === id) ?? null
  if (removed) save(getComments().filter((c) => c.id !== id))
  return removed
}

export function restoreComments(comments) {
  const ids = new Set(getComments().map((c) => c.id))
  const back = comments.map(clean).filter((c) => c && !ids.has(c.id))
  if (!back.length) return
  save([...getComments(), ...back].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)))
}

export function clearComments(path, { resolvedOnly = false } = {}) {
  const gone = getComments().filter((c) => c.path === path && (!resolvedOnly || c.resolved))
  if (gone.length) save(getComments().filter((c) => !gone.includes(c)))
  return gone
}

export function setCommentsHidden(next) {
  hidden = next
  try {
    if (next) localStorage.setItem(HIDDEN_KEY, '1')
    else localStorage.removeItem(HIDDEN_KEY)
  } catch {
  }
  emit()
}

export const toggleCommentsHidden = () => setCommentsHidden(!commentsHidden())

export function startCommenting() {
  if (commentsHidden()) setCommentsHidden(false)
  placing = true
  emit()
}

export function stopCommenting() {
  if (!placing) return
  placing = false
  emit()
}

export function focusComment(id) {
  if (id && commentsHidden()) setCommentsHidden(false)
  focused = id
  emit()
}

export const commentsOn = (comments, path) => comments.filter((c) => c.path === path)

const SHORT = [
  ['y', 31536000],
  ['w', 604800],
  ['d', 86400],
  ['h', 3600],
  ['m', 60],
]

export function shortAgo(iso, now = Date.now()) {
  const seconds = (now - Date.parse(iso)) / 1000
  if (!(seconds >= 0)) return ''
  for (const [unit, size] of SHORT) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${unit}`
  }
  return 'now'
}

export function commentsMarkdown(comments, origin = '') {
  const byPath = new Map()
  for (const c of comments) {
    const items = byPath.get(c.path)
    if (items) items.push(c)
    else byPath.set(c.path, [c])
  }
  return [...byPath]
    .map(([path, items]) => {
      const lines = items.map((c, i) => {
        const date = new Date(c.at).toISOString().slice(0, 10)
        const body = c.text.replace(/\n/g, '\n   ')
        return `${i + 1}. ${c.resolved ? '~~' : ''}${body}${c.resolved ? '~~' : ''} _(${date})_`
      })
      return `## ${origin}${path}\n\n${lines.join('\n')}`
    })
    .join('\n\n')
}
