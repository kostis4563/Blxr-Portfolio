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

export function installErrorReporting() {
  if (typeof window === 'undefined' || window.__blxrErrorsInstalled) return
  window.__blxrErrorsInstalled = true

  window.addEventListener('error', (event) => {
    const target = event.target
    if (target && target !== window && target.tagName) {
      const url = target.src || target.href
      if (url) post({ kind: 'resource', message: `${target.tagName.toLowerCase()} ${String(url).slice(0, 300)}` })
      return
    }
    const { message, stack } = event.error ? describe(event.error) : { message: event.message }
    post({ kind: 'error', message, stack, detail: event.filename ? `${event.filename.split('/').pop()}:${event.lineno}:${event.colno}` : undefined })
  }, true)

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    if (reason?.name === 'AbortError') return
    post({ kind: 'rejection', ...describe(reason) })
  })
}
