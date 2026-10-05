const STALE_MARK = 'blxr:chunk-reload'
const MARKER = '_chunk'

const isStaleChunkError = (value) => {
  const message = typeof value === 'string' ? value : value?.message
  if (typeof message !== 'string') return false
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Unable to preload CSS/i.test(message)
  )
}

const attempted = () => {
  try {
    return sessionStorage.getItem(STALE_MARK) === window.location.pathname
  } catch {
    return false
  }
}

const remember = () => {
  try {
    sessionStorage.setItem(STALE_MARK, window.location.pathname)
  } catch {
  }
}

export function installChunkRecovery() {
  if (typeof window === 'undefined' || window.__blxrChunkRecovery) return
  window.__blxrChunkRecovery = true

  try {
    const here = new URL(window.location.href)
    if (here.searchParams.has(MARKER)) {
      here.searchParams.delete(MARKER)
      window.history.replaceState(null, '', here.toString())
    }
  } catch {
  }

  const recover = () => {
    if (attempted()) return
    remember()
    try {
      const url = new URL(window.location.href)
      url.searchParams.set(MARKER, '1')
      window.location.replace(url.toString())
    } catch {
      window.location.reload()
    }
  }

  window.addEventListener('unhandledrejection', (event) => {
    if (!isStaleChunkError(event.reason)) return
    event.preventDefault()
    recover()
  })

  window.addEventListener('error', (event) => {
    const target = event.target
    if (!target || target === window || !target.tagName) return
    const url = target.src || target.href || ''
    if (!url || !/\/assets\/|\.m?js(\?|$)|\.css(\?|$)/.test(url)) return
    if (!isStaleChunkError(event.message)) recover()
  }, true)
}