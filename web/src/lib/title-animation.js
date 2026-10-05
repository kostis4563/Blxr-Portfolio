const TYPE_MS = 64
const START_DELAY = 180
const HOLD_MS = 1000
const ERASE_STEP = 26
const CARET_MS = 500
const CARET = '\u258c'
const INTRO_LABEL = 'Blxr'

const reducedMotion = () =>
  typeof document !== 'undefined' &&
  (document.documentElement.dataset.motion === 'reduced' ||
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))

let timers = new Set()

const waitAlive = (ms) =>
  new Promise((resolve) => {
    const entry = { id: 0, cancel: null }
    entry.cancel = () => {
      timers.delete(entry)
      clearTimeout(entry.id)
      resolve(false)
    }
    entry.id = setTimeout(() => {
      timers.delete(entry)
      resolve(true)
    }, ms)
    timers.add(entry)
  })

const abortWaits = () => {
  const pending = [...timers]
  timers = new Set()
  for (const entry of pending) entry.cancel()
}

const caretAt = () => (Math.floor(performance.now() / CARET_MS) % 2 === 0 ? CARET : '')

async function play({ final, label }) {
  abortWaits()

  const text = Array.from(label || '')
  if (!text.length || reducedMotion()) {
    document.title = final
    return
  }

  document.title = ''
  if (!(await waitAlive(START_DELAY))) return

  for (let i = 0; i < text.length; i += 1) {
    document.title = `${text.slice(0, i + 1).join('')}${caretAt()}`
    if (!(await waitAlive(TYPE_MS * (0.55 + Math.random())))) return
  }

  document.title = text.join('')
  if (!(await waitAlive(HOLD_MS))) return

  for (let n = text.length; n > 0; n -= 1) {
    document.title = text.slice(0, n - 1).join('')
    const done = 1 - n / text.length
    if (!(await waitAlive(ERASE_STEP * (1.45 - done * 0.85)))) return
  }

  document.title = final
}

let hasRun = false
let shown = null
let queued = null
let pumping = false

async function drain() {
  pumping = true
  while (queued) {
    const job = queued
    queued = null
    shown = job
    await play(job)
  }
  pumping = false
}

export function setTitleNow(final) {
  if (typeof document === 'undefined' || !final) return
  abortWaits()
  queued = null
  hasRun = true
  shown = { final, label: null }
  document.title = final
}

export function setDocumentTitle(final, label) {
  if (typeof document === 'undefined' || !final) return

  if (reducedMotion()) {
    setTitleNow(final)
    return
  }

  if (shown?.final === final && !queued) return

  const job = { final, label: hasRun ? label : INTRO_LABEL }
  hasRun = true
  shown = job
  queued = job

  if (!pumping) drain()
}