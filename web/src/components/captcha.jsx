import { useEffect, useRef, useState } from 'react'
import { captchaEnabled, mountCaptcha } from '../lib/captcha'
import { Icon } from './icon'

export const TICK_FIRST = 'Tick “Verify you are human” above first.'

const STATUS = {
  checking: { icon: 'refresh', tone: 'text-ink-faint motion-safe:animate-spin', text: 'Checking you’re human…' },
  ok: { icon: 'circleCheck', tone: 'text-emerald-500', text: 'You’re verified' },
  error: { icon: 'alert', tone: 'text-amber-500', text: 'Security check failed' },
  load: { icon: 'alert', tone: 'text-amber-500', text: 'Security check didn’t load' },
}

const readTheme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

function useSiteTheme() {
  const [theme, setTheme] = useState(() => (typeof document === 'undefined' ? 'dark' : readTheme()))
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

export function Captcha({ handle, visible = false }) {
  const ref = useRef(null)
  const theme = useSiteTheme()
  const [status, setStatus] = useState({ state: 'checking', code: null, shown: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!captchaEnabled() || !ref.current) return undefined
    let widget = null
    let cancelled = false
    let fresh = true
    const onState = (state, code = null) => {
      if (cancelled) return
      const keep = !fresh
      fresh = false
      setStatus((s) => ({ state, code, shown: state === 'interactive' || (keep && s.shown) }))
    }
    mountCaptcha(ref.current, { visible, theme, onState })
      .then((w) => {
        if (cancelled) w.remove()
        else {
          widget = w
          handle.current = w
        }
      })
      .catch(() => onState('load'))
    return () => {
      cancelled = true
      handle.current = null
      widget?.remove()
    }
  }, [handle, visible, theme, attempt])
  if (!captchaEnabled()) return null
  if (!visible) return <div ref={ref} className="scheme-light empty:hidden" aria-live="polite" />

  const { state, code, shown } = status
  const row = STATUS[state] || STATUS.checking
  const failed = state === 'error' || state === 'load'
  const retry = () => {
    if (handle.current) handle.current.retry()
    else {
      setStatus({ state: 'checking', code: null, shown: false })
      setAttempt((n) => n + 1)
    }
  }
  return (
    <div className="mt-5">
      {!shown && (
        <div role="status" className="flex h-10 items-center gap-2.5 rounded-xl border border-dashed border-line-strong px-3.5 text-[12.5px]">
          <Icon name={row.icon} className={`h-[14px] w-[14px] ${row.tone}`} strokeWidth={2} />
          <span className={`min-w-0 flex-1 truncate ${state === 'ok' ? 'text-ink-strong' : 'text-ink-muted'}`}>
            {row.text}
            {code && <span className="ms-1.5 font-mono text-[10px] text-ink-faint">{code}</span>}
          </span>
          {failed ? (
            <button
              type="button"
              onClick={retry}
              className="cursor-pointer font-medium text-ink-strong underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink-strong"
            >
              Try again
            </button>
          ) : (
            <span title="Protected by Cloudflare Turnstile" className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              <Icon name="cloud" className="h-[13px] w-[13px]" />
              Cloudflare
            </span>
          )}
        </div>
      )}
      <div className={shown ? 'relative mx-[min(0px,calc((100%-300px)/2))] h-[65px] overflow-hidden rounded-xl border border-line bg-surface-raised/60' : undefined}>
        <div ref={ref} className={`scheme-light leading-none ${shown ? 'absolute -inset-px' : ''}`} />
      </div>
    </div>
  )
}
