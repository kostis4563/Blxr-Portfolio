import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'blxr-theme'
const DEFAULT_THEME = 'dark'

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : null
  } catch {
    return null
  }
}

const systemTheme = () => (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')

function storeTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
  }
}

export function resolveInitialTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const stored = readStoredTheme()
  if (stored === 'system') return systemTheme()
  return stored ?? DEFAULT_THEME
}

// 'system' | 'light' | 'dark' — what the user picked, not what is showing.
const readPreference = () => (typeof window === 'undefined' ? DEFAULT_THEME : readStoredTheme() ?? DEFAULT_THEME)

export function useTheme() {
  const [theme, setTheme] = useState(resolveInitialTheme)
  const [preference, setPreferenceState] = useState(readPreference)
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
      if (readStoredTheme() !== 'system') return
      setTheme(event.matches ? 'light' : 'dark')
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      storeTheme(next)
      setPreferenceState(next)
      return next
    })
  }, [])

  const setPreference = useCallback((pref) => {
    if (pref === 'system') {
      storeTheme('system')
      setPreferenceState('system')
      setTheme(systemTheme())
      return
    }
    if (pref !== 'light' && pref !== 'dark') return
    storeTheme(pref)
    setPreferenceState(pref)
    setTheme(pref)
  }, [])

  return { theme, preference, toggleTheme, setPreference }
}
