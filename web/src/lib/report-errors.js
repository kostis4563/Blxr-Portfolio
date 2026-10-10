import { willRecover } from './chunk-recovery'

const ENDPOINT = '/api/logs/client'
const MAX_PER_PAGE = 6
const STACK_MAX = 3000

let sent = 0
const seen = new Set()

function post(report) {
  if (sent >= MAX_PER_PAGE) return
  const key = `${report.kind}|${report.message}`
  if (seen.has(key)) return
  seen.add(key)
  sent += 1
  const body = JSON.stringify({ ...report, path: window.location.pathname })
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' }))) return
  } catch {
  }
  fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

const describe = (value) => {
  if (value instanceof Error) return { message: `${value.name}: ${value.message}`, stack: (value.stack || '').slice(0, STACK_MAX) }
  if (typeof value === 'string') return { message: value.slice(0, 500) }
  try {
    return { message: JSON.stringify(value).slice(0, 500) }
  } catch {
    return { message: String(value).slice(0, 500) }
  }
}

const chunkMessage = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

const isStaleChunk = (message) => typeof message === 'string' && chunkMessage.test(message)

const sameOrigin = (url) => {
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

const isOurs = (url) => Boolean(url) && sameOrigin(url)

const FRAME = /^\s+at\s|^[^\s@]*@\S+:\d+:\d+$/
const EXTENSION = /(chrome|moz|safari|safari-web|ms-browser)-extension:\/\//

const isForeign = (stack) => {
  if (typeof stack !== 'string' || !stack) return false
  if (EXTENSION.test(stack)) return true
  const frames = stack.split('\n').filter((line) => FRAME.test(line))
  if (!frames.length || frames.some((line) => line.includes(window.location.origin))) return false
  return frames.some((line) => /https?:\/\//.test(line)) || frames.every((line) => line.includes('<anonymous>'))
}

export function installErrorReporting() {
  if (typeof window === 'undefined' || window.__blxrErrorsInstalled) return
  window.__blxrErrorsInstalled = true

  window.addEventListener('error', (event) => {
    const target = event.target
    if (target && target !== window && target.tagName) {
      const url = target.src || target.href
      if (!url) return
      if (!isOurs(String(url))) return
      if (willRecover(String(url))) return
      post({ kind: 'resource', message: `${target.tagName.toLowerCase()} ${String(url).slice(0, 300)}` })
      return
    }
    if (event.filename && !isOurs(event.filename)) return
    if (!event.error && !event.filename && /^Script error\.?$/.test(event.message || '')) return
    const { message, stack } = event.error ? describe(event.error) : { message: event.message }
    if (isStaleChunk(message) || isForeign(stack)) return
    post({ kind: 'error', message, stack, detail: event.filename ? `${event.filename.split('/').pop()}:${event.lineno}:${event.colno}` : undefined })
  }, true)

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    if (reason?.name === 'AbortError') return
    const described = describe(reason)
    if (isStaleChunk(described.message) || isForeign(described.stack)) return
    post({ kind: 'rejection', ...described })
  })
}
