import { useEffect, useRef, useState } from 'react'
import { captchaEnabled, mountCaptcha } from '../lib/captcha'

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
  useEffect(() => {
    if (!captchaEnabled() || !ref.current) return undefined
    let widget = null
    let cancelled = false
    mountCaptcha(ref.current, { visible, theme })
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
  }, [handle, visible, theme])
  if (!captchaEnabled()) return null
  return <div ref={ref} className={`scheme-light ${visible ? 'mt-5 mx-[min(0px,calc((100%-300px)/2))] min-h-[65px] leading-none' : 'empty:hidden'}`} aria-live="polite" />
}
