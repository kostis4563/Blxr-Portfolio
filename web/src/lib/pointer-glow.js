const rects = new WeakMap()

let epoch = 0
const bump = () => { epoch += 1 }

let listening = false
function listen() {
  if (listening) return
  listening = true

  window.addEventListener('scroll', bump, { passive: true, capture: true })
  window.addEventListener('resize', bump, { passive: true })
}

let hoverCapable = null
const canHover = () => {
  if (hoverCapable === null) {
    hoverCapable = window.matchMedia?.('(hover: hover)').matches ?? true
  }
  return hoverCapable
}

let queued = null
let frame = 0
let lastEl = null

function commit() {
  frame = 0
  const job = queued
  queued = null
  if (!job) return

  const { el, clientX, clientY, tilt } = job
  let box = rects.get(el)

  if (!box || box.epoch !== epoch || el !== lastEl) {
    const rect = el.getBoundingClientRect()
    box = { epoch, left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    rects.set(el, box)
    lastEl = el
  }

  const x = clientX - box.left
  const y = clientY - box.top
  const style = el.style

  style.setProperty('--mouse-x', `${Math.round(x)}px`)
  style.setProperty('--mouse-y', `${Math.round(y)}px`)
  if (tilt && box.width && box.height) {
    style.setProperty('--tilt-x', (x / box.width - 0.5).toFixed(3))
    style.setProperty('--tilt-y', (y / box.height - 0.5).toFixed(3))
  }
}

export function trackPointerGlow(event, { tilt = false } = {}) {
  if (typeof window === 'undefined' || !canHover()) return
  listen()

  queued = { el: event.currentTarget, clientX: event.clientX, clientY: event.clientY, tilt }
  if (!frame) frame = requestAnimationFrame(commit)
}

export function resetPointerTilt(event) {
  const style = event.currentTarget.style
  style.setProperty('--tilt-x', '0')
  style.setProperty('--tilt-y', '0')
}
