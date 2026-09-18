import { useEffect, useRef } from 'react'
import { captchaEnabled, mountCaptcha } from '../lib/captcha'

export function Captcha({ handle }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!captchaEnabled() || !ref.current) return undefined
    let widget = null
    let cancelled = false
    mountCaptcha(ref.current)
      .then((w) => {
        if (cancelled) w.remove()
        else {
          widget = w
          handle.current = w
        }
      })
      .catch(() => {
      })
    return () => {
      cancelled = true
      handle.current = null
      widget?.remove()
    }
  }, [handle])
  if (!captchaEnabled()) return null
  return <div ref={ref} className="empty:hidden" aria-live="polite" />
}
