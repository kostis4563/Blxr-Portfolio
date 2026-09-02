const ENDPOINT = '/api/vitals'

const CLS_SESSION_GAP_MS = 1000
const CLS_SESSION_MAX_MS = 5000

const INP_DURATION_THRESHOLD_MS = 40

const supported = () =>
  typeof window !== 'undefined' &&
  typeof PerformanceObserver === 'function' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.sendBeacon === 'function'

const optedOut = () =>
  navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl

function observe(type, callback, options) {
  try {
    const observer = new PerformanceObserver((list) => callback(list.getEntries(), observer))

    observer.observe({ type, buffered: true, ...options })
    return observer
  } catch {

    return null
  }
}

export function reportWebVitals() {
  if (!supported() || optedOut()) return

  const metrics = new Map()
  const set = (name, value) => metrics.set(name, value)

  const nav = performance.getEntriesByType('navigation')[0]
  if (nav) {

    const start = nav.activationStart || 0
    set('TTFB', Math.max(0, nav.responseStart - start))
  }
  observe('paint', (entries) => {
    for (const entry of entries) {
      if (entry.name !== 'first-contentful-paint') continue
      set('FCP', Math.max(0, entry.startTime - (performance.getEntriesByType('navigation')[0]?.activationStart || 0)))
    }
  })

  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1]
    if (last) set('LCP', Math.max(0, last.startTime - (performance.getEntriesByType('navigation')[0]?.activationStart || 0)))
  })

  let clsValue = 0
  let windowValue = 0
  let windowStart = 0
  let windowLast = 0
  observe('layout-shift', (entries) => {
    for (const entry of entries) {

      if (entry.hadRecentInput) continue
      if (
        windowValue &&
        entry.startTime - windowLast < CLS_SESSION_GAP_MS &&
        entry.startTime - windowStart < CLS_SESSION_MAX_MS
      ) {
        windowValue += entry.value
      } else {
        windowValue = entry.value
        windowStart = entry.startTime
      }
      windowLast = entry.startTime
      if (windowValue > clsValue) {
        clsValue = windowValue
        set('CLS', clsValue)
      }
    }
  })

  const interactions = new Map()
  observe('event', (entries) => {
    for (const entry of entries) {
      if (!entry.interactionId) continue
      const previous = interactions.get(entry.interactionId) || 0
      if (entry.duration > previous) interactions.set(entry.interactionId, entry.duration)
    }
  }, { durationThreshold: INP_DURATION_THRESHOLD_MS })

  const currentInp = () => {
    if (!interactions.size) return null
    const sorted = [...interactions.values()].sort((a, b) => b - a)
    return sorted[Math.min(sorted.length - 1, Math.floor(interactions.size / 50))]
  }

  let sent = false
  const send = () => {
    if (sent) return
    const inp = currentInp()
    if (inp !== null) set('INP', inp)
    if (!metrics.size) return
    sent = true

    const payload = [...metrics].map(([m, v]) => ({ m, v: Math.round(v * 1000) / 1000 }))
    try {
      navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(payload)], { type: 'application/json' }))
    } catch {

    }
  }

  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send()
  })
  addEventListener('pagehide', send)
}
