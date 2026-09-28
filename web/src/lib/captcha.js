const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const LOAD_TIMEOUT_MS = 8000
const RUN_TIMEOUT_MS = 20_000

const TEST_SITE_KEY = '1x00000000000000000000AA'
const GATE_SITE_KEY = SITE_KEY || (import.meta.env.DEV ? TEST_SITE_KEY : '')
const GATE_PASSED_KEY = 'blxr-verified'

export const captchaEnabled = () => Boolean(SITE_KEY)
export const gateEnabled = () => Boolean(GATE_SITE_KEY)

let loading = null

export function loadTurnstile() {
  if (typeof window === 'undefined' || !GATE_SITE_KEY) return Promise.reject(new Error('captcha off'))
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT
    el.async = true
    el.defer = true
    const timer = setTimeout(() => fail(new Error('captcha script timed out')), LOAD_TIMEOUT_MS)
    const fail = (err) => {
      clearTimeout(timer)
      loading = null
      el.remove()
      reject(err)
    }
    el.onload = () => {
      clearTimeout(timer)
      if (window.turnstile) resolve(window.turnstile)
      else fail(new Error('captcha script did not initialise'))
    }
    el.onerror = () => fail(new Error('captcha script failed to load'))
    document.head.appendChild(el)
  })
  return loading
}

export function gatePassed() {
  try {
    return sessionStorage.getItem(GATE_PASSED_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberGatePassed() {
  try {
    sessionStorage.setItem(GATE_PASSED_KEY, '1')
  } catch {
  }
}

export async function mountGate(container, { theme, onPass, onFail }) {
  const ts = await loadTurnstile()
  let widgetId
  try {
    widgetId = ts.render(container, {
      sitekey: GATE_SITE_KEY,
      action: 'page-gate',
      theme,
      retry: 'never',
      callback: () => onPass(),
      'error-callback': () => {
        onFail()
        return true
      },
    })
  } catch {
    onFail()
  }
  return {
    remove() {
      try {
        if (widgetId !== undefined) ts.remove(widgetId)
      } catch {
      }
    },
  }
}

export async function mountCaptcha(container) {
  const ts = await loadTurnstile()
  let settle = null
  const widgetId = ts.render(container, {
    sitekey: SITE_KEY,
    execution: 'execute',
    appearance: 'interaction-only',
    theme: 'auto',
    callback: (token) => settle?.(token),
    'error-callback': () => settle?.(null),
    'timeout-callback': () => settle?.(null),
    'expired-callback': () => settle?.(null),
  })
  return {
    run() {
      return new Promise((resolve) => {
        let done = false
        const timer = setTimeout(() => finish(null), RUN_TIMEOUT_MS)
        const finish = (token) => {
          if (done) return
          done = true
          clearTimeout(timer)
          settle = null
          resolve(typeof token === 'string' && token ? token : null)
        }
        settle = finish
        try {
          ts.reset(widgetId)
          ts.execute(widgetId)
        } catch {
          finish(null)
        }
      })
    },
    remove() {
      settle = null
      try {
        ts.remove(widgetId)
      } catch {
      }
    },
  }
}
