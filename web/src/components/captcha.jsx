import { useEffect, useRef, useState } from 'react'
import { captchaEnabled, mountCaptcha } from '../lib/captcha'

export const TICK_FIRST = 'Tick “Verify you are human” above first.'

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
  const [lost, setLost] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!captchaEnabled() || !ref.current) return undefined
    let widget = null
    let cancelled = false
    const onState = (state) => {
      if (!cancelled) setLost(state === 'load')
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

  const retry = () => {
    setLost(false)
    setAttempt((n) => n + 1)
  }
  return (
    <div className="mt-5">
      <div ref={ref} className={`scheme-light mx-[min(0px,calc((100%-300px)/2))] leading-none ${lost ? 'hidden' : 'min-h-[65px]'}`} />
      {lost && (
        <p role="alert" className="text-center text-[12.5px] text-ink-muted">
          The security check didn’t load.{' '}
          <button type="button" onClick={retry} className="cursor-pointer font-semibold text-ink-strong underline-offset-4 hover:underline">
            Try again
          </button>
        </p>
      )}
    </div>
  )
}
