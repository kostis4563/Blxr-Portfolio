import { reducedMotion } from './memes'

const store = () => {
  const listeners = new Set()
  return {
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    emit: () => listeners.forEach((fn) => fn()),
  }
}

const grid = store()
let gridOn = false

export const onLayoutGrid = grid.subscribe
export const layoutGridOn = () => gridOn

export function toggleLayoutGrid() {
  gridOn = !gridOn
  grid.emit()
  toast(gridOn ? 'Layout grid on' : 'Layout grid off', '⇧G')
}

const toasts = store()
let current = null
let toastId = 0

export const onToast = toasts.subscribe
export const currentToast = () => current

export function toast(text, hint = '', action = null) {
  toastId += 1
  current = { id: toastId, text, hint, action }
  toasts.emit()
}

export function dismissToast(id) {
  if (current?.id !== id) return
  current = null
  toasts.emit()
}

export function follow(id) {
  const cursor = document.querySelector(`[data-cursor="${id}"]`)
  if (!cursor) return false
  cursor.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' })
  cursor.removeAttribute('data-ping')
  void cursor.offsetWidth
  cursor.setAttribute('data-ping', '')
  setTimeout(() => cursor.removeAttribute('data-ping'), 900)
  return true
}

const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

export function editedAgo(iso, now = Date.now()) {
  const seconds = (now - Date.parse(iso)) / 1000
  if (!(seconds >= 0)) return null
  const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return `Edited ${relative.format(-Math.floor(seconds / size), unit)}`
  }
  return 'Edited just now'
}
