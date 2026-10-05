import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'

const beacons = []
const listeners = { error: [], unhandledrejection: [] }

function setDoc({ reduced = false, href = 'https://blxr.net/library' } = {}) {
  const replace = vi.fn()
  const reload = vi.fn()
  const replaceState = vi.fn()
  const store = new Map()

  vi.stubGlobal('Blob', class {
    constructor(parts = []) { this.text = parts.join('') }
  })
  vi.stubGlobal('navigator', {
    sendBeacon: (url, blob) => {
      let body = null
      try { body = JSON.parse(blob?.text ?? '{}') } catch { /* not json */ }
      beacons.push({ url, body })
      return true
    },
  })
  globalThis.window = {
    location: {
      href,
      origin: 'https://blxr.net',
      pathname: '/library',
      replace,
      reload,
    },
    history: { replaceState },
    matchMedia: () => ({ matches: reduced }),
    addEventListener: (type, fn) => { listeners[type]?.push(fn) },
  }
  globalThis.document = { documentElement: { dataset: {} } }
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  }

  return { replace, reload, replaceState }
}

const fireError = (event) => { for (const fn of [...listeners.error]) fn(event) }
const fireRejection = (event) => { for (const fn of [...listeners.unhandledrejection]) fn(event) }

const resource = (tag, url) => ({ target: { tagName: tag.toUpperCase(), src: url, href: url } })
const messages = () => beacons.map((b) => b.body?.message).filter(Boolean)

beforeEach(() => {
  beacons.length = 0
  listeners.error.length = 0
  listeners.unhandledrejection.length = 0
  vi.resetModules()
})

afterEach(() => {
  delete globalThis.window
  delete globalThis.document
  delete globalThis.sessionStorage
  delete globalThis.navigator
})

describe('report-errors: only our own failures reach the log', () => {
  test('a blocked third-party beacon is dropped, not reported', async () => {
    setDoc()
    const { installErrorReporting } = await import('../../src/lib/report-errors.js')
    installErrorReporting()

    for (const url of [
      'https://static.cloudflareinsights.com/beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495',
      'https://www.googletagmanager.com/gtag/js?id=G-123',
      'https://www.google-analytics.com/collect',
      'https://challenges.cloudflare.com/turnstile/v0/api.js',
    ]) fireError(resource('script', url))

    expect(messages()).toEqual([])
  })

  test('a same-origin asset failure is still reported', async () => {
    setDoc()
    const { installErrorReporting } = await import('../../src/lib/report-errors.js')
    installErrorReporting()

    fireError(resource('script', 'https://blxr.net/assets/library-page-DkNFiZy9.js'))

    expect(messages()).toHaveLength(1)
    expect(messages()[0]).toBe('script https://blxr.net/assets/library-page-DkNFiZy9.js')
  })

  test('a same-origin public image is still reported', async () => {
    setDoc()
    const { installErrorReporting } = await import('../../src/lib/report-errors.js')
    installErrorReporting()

    fireError(resource('img', 'https://blxr.net/pfp.webp'))
    expect(messages()).toHaveLength(1)
  })

  test('a genuine uncaught error is reported', async () => {
    setDoc()
    const { installErrorReporting } = await import('../../src/lib/report-errors.js')
    installErrorReporting()

    fireError({ target: globalThis.window, error: new Error('real bug'), message: 'real bug' })
    expect(messages()).toEqual(['Error: real bug'])
  })

  test('a stale-chunk rejection is not reported, since chunk-recovery heals it', async () => {
    setDoc()
    const { installErrorReporting } = await import('../../src/lib/report-errors.js')
    installErrorReporting()

    for (const message of [
      'Failed to fetch dynamically imported module: https://blxr.net/src/lib/memes.js',
      'error loading dynamically imported module: https://blxr.net/assets/x.js',
      'Importing a module script failed.',
      'Unable to preload CSS for /assets/x.css',
    ]) fireRejection({ reason: new TypeError(message), preventDefault: () => {} })

    expect(messages()).toEqual([])
  })

  test('an ordinary rejection is still reported', async () => {
    setDoc()
    const { installErrorReporting } = await import('../../src/lib/report-errors.js')
    installErrorReporting()

    fireRejection({ reason: new Error('fetch blew up'), preventDefault: () => {} })
    expect(messages()).toEqual(['Error: fetch blew up'])
  })

  test('AbortError stays silent, as before', async () => {
    setDoc()
    const { installErrorReporting } = await import('../../src/lib/report-errors.js')
    installErrorReporting()

    const abort = new Error('aborted')
    abort.name = 'AbortError'
    fireRejection({ reason: abort, preventDefault: () => {} })
    expect(messages()).toEqual([])
  })

  test('it installs only once', async () => {
    setDoc()
    const { installErrorReporting } = await import('../../src/lib/report-errors.js')
    installErrorReporting()
    const before = listeners.error.length
    installErrorReporting()
    expect(listeners.error.length).toBe(before)
  })
})

describe('chunk-recovery: a deploy cannot leave a tab on a dead chunk', () => {
  test('a failed dynamic import reloads onto the fresh HTML', async () => {
    const { replace, reload } = setDoc()
    const { installChunkRecovery } = await import('../../src/lib/chunk-recovery.js')
    installChunkRecovery()

    fireRejection({
      reason: new TypeError('Failed to fetch dynamically imported module: https://blxr.net/assets/library-page-DkNFiZy9.js'),
      preventDefault: () => {},
    })

    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace.mock.calls[0][0]).toContain('_chunk=1')
    expect(reload).not.toHaveBeenCalled()
  })

  test('the reported rejection is suppressed so it is not logged twice', async () => {
    setDoc()
    const { installChunkRecovery } = await import('../../src/lib/chunk-recovery.js')
    installChunkRecovery()

    const preventDefault = vi.fn()
    fireRejection({ reason: new TypeError('Failed to fetch dynamically imported module: https://blxr.net/assets/x.js'), preventDefault })
    expect(preventDefault).toHaveBeenCalledTimes(1)
  })

  test('it reloads at most once per route, so a permanently missing chunk cannot loop', async () => {
    const { replace } = setDoc()
    const { installChunkRecovery } = await import('../../src/lib/chunk-recovery.js')
    installChunkRecovery()

    const reason = new TypeError('Failed to fetch dynamically imported module: https://blxr.net/assets/gone.js')
    for (let i = 0; i < 5; i += 1) fireRejection({ reason, preventDefault: () => {} })

    expect(replace).toHaveBeenCalledTimes(1)
  })

  test('an unrelated rejection is left alone', async () => {
    const { replace } = setDoc()
    const { installChunkRecovery } = await import('../../src/lib/chunk-recovery.js')
    installChunkRecovery()

    fireRejection({ reason: new Error('real bug in a component'), preventDefault: () => {} })
    expect(replace).not.toHaveBeenCalled()
  })

  test('a third-party script failure does not reload the page', async () => {
    const { replace } = setDoc()
    const { installChunkRecovery } = await import('../../src/lib/chunk-recovery.js')
    installChunkRecovery()

    fireError(resource('script', 'https://static.cloudflareinsights.com/beacon.min.js/v1'))
    expect(replace).not.toHaveBeenCalled()
  })

  test('a failed stylesheet recovers too', async () => {
    const { replace } = setDoc()
    const { installChunkRecovery } = await import('../../src/lib/chunk-recovery.js')
    installChunkRecovery()

    fireRejection({ reason: new Error('Unable to preload CSS for /assets/index-old.css'), preventDefault: () => {} })
    expect(replace).toHaveBeenCalledTimes(1)
  })

  test('it installs only once', async () => {
    setDoc()
    const { installChunkRecovery } = await import('../../src/lib/chunk-recovery.js')
    installChunkRecovery()
    const before = listeners.unhandledrejection.length
    installChunkRecovery()
    expect(listeners.unhandledrejection.length).toBe(before)
  })

  test('the reload marker is scrubbed from the address bar on the fresh load', async () => {
    const { replaceState } = setDoc({ href: 'https://blxr.net/library?_chunk=1' })
    const { installChunkRecovery } = await import('../../src/lib/chunk-recovery.js')
    installChunkRecovery()

    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(replaceState.mock.calls[0][2]).toBe('https://blxr.net/library')
  })

  test('a normal load without the marker leaves the URL alone', async () => {
    const { replaceState } = setDoc({ href: 'https://blxr.net/library?utm_source=x' })
    const { installChunkRecovery } = await import('../../src/lib/chunk-recovery.js')
    installChunkRecovery()

    expect(replaceState).not.toHaveBeenCalled()
  })
})