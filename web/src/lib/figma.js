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

const canvas = store()
let canvasOn = false

export const onCanvas = canvas.subscribe
export const canvasOpen = () => canvasOn

export function setCanvas(next) {
  if (canvasOn === next) return
  canvasOn = next
  canvas.emit()
}

export const openCanvas = () => setCanvas(true)

export const CANVAS_FIT = { gap: 40, top: 88, bottom: 52, side: 32, maxScale: 0.6, minScale: 0.04, rowBias: 1.15 }

const sum = (values) => values.reduce((total, value) => total + value, 0)

export function fitFrames(sizes, viewport, fit = CANVAS_FIT) {
  const { gap, top, bottom, side, maxScale, minScale, rowBias } = { ...CANVAS_FIT, ...fit }
  if (!sizes.length) return { scale: 1, columns: 0, frames: [] }

  const roomX = viewport.width - side * 2
  const roomY = viewport.height - top - bottom
  let best = null

  for (let columns = sizes.length; columns >= 1; columns -= 1) {
    const rows = []
    for (let i = 0; i < sizes.length; i += columns) rows.push(sizes.slice(i, i + columns))
    const widths = rows.map((row) => sum(row.map((size) => size.width)))
    const heights = rows.map((row) => Math.max(...row.map((size) => size.height)))
    const scale = Math.min(
      maxScale,
      ...rows.map((row, r) => (roomX - (row.length - 1) * gap) / widths[r]),
      (roomY - (rows.length - 1) * gap) / sum(heights)
    )
    if (!best || scale > best.scale * rowBias) best = { scale, columns, rows, widths, heights }
  }

  const scale = Math.max(minScale, best.scale)
  const width = Math.max(...best.rows.map((row, r) => best.widths[r] * scale + (row.length - 1) * gap))
  const height = sum(best.heights) * scale + (best.rows.length - 1) * gap
  const left = (viewport.width - width) / 2
  let y = top + Math.max(0, (roomY - height) / 2)
  const frames = []

  best.rows.forEach((row, r) => {
    let x = left
    for (const size of row) {
      frames.push({ x, y, width: size.width * scale, height: size.height * scale })
      x += size.width * scale + gap
    }
    y += best.heights[r] * scale + gap
  })

  return { scale, columns: best.columns, frames }
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
