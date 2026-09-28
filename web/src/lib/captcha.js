const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const LOAD_TIMEOUT_MS = 8000
const RUN_TIMEOUT_MS = 20_000

export const captchaEnabled = () => Boolean(SITE_KEY)

let loading = null

export function loadTurnstile() {
  if (typeof window === 'undefined' || !SITE_KEY) return Promise.reject(new Error('captcha off'))
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

export async function mountCaptcha(container, { visible = false, theme = 'auto' } = {}) {
  const ts = await loadTurnstile()
  const el = document.createElement('div')
  container.append(el)
  let settle = null
  let ready = null
  const drop = () => {
    ready = null
    settle?.(null)
  }
  const widgetId = ts.render(el, {
    sitekey: SITE_KEY,
    execution: visible ? 'render' : 'execute',
    appearance: visible ? 'always' : 'interaction-only',
    size: visible ? 'flexible' : 'normal',
    theme,
    callback: (token) => {
      if (settle) settle(token)
      else ready = token
    },
    'error-callback': drop,
    'timeout-callback': drop,
    'expired-callback': drop,
  })
  const take = (token) => {
    if (visible && token) {
      try {
        ts.reset(widgetId)
      } catch {
      }
    }
    return token
  }
  return {
    run() {
      if (ready) {
        const token = ready
        ready = null
        return Promise.resolve(take(token))
      }
      return new Promise((resolve) => {
        let done = false
        const timer = setTimeout(() => finish(null), RUN_TIMEOUT_MS)
        const finish = (token) => {
          if (done) return
          done = true
          clearTimeout(timer)
          settle = null
          resolve(take(typeof token === 'string' && token ? token : null))
        }
        settle = finish
        if (visible) return
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
      el.remove()
    },
  }
}
