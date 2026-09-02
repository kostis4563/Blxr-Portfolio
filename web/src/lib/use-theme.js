import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'blxr-theme'

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
  }
}

export function resolveInitialTheme() {

  if (typeof window === 'undefined') return 'dark'
  return (
    readStoredTheme() ??
    (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  )
}

export function useTheme() {
  const [theme, setTheme] = useState(resolveInitialTheme)
  const isFirstApply = useRef(true)

  useEffect(() => {
    const root = document.documentElement
    const isInitialPaint = isFirstApply.current
    isFirstApply.current = false

    if (!isInitialPaint) root.dataset.themeTransition = ''

    root.dataset.theme = theme
    root.style.colorScheme = theme

    if (isInitialPaint) return

    const done = setTimeout(() => {
      delete root.dataset.themeTransition
    }, 300)
    return () => clearTimeout(done)
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: light)')
    if (!media) return

    const onChange = (event) => {
      if (readStoredTheme()) return
      setTheme(event.matches ? 'light' : 'dark')
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      storeTheme(next)
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
