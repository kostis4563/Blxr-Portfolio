import { useCallback, useEffect, useRef, useState } from 'react'
import { flashbang } from './memes'

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

const readPreference = () => (typeof window === 'undefined' ? DEFAULT_THEME : readStoredTheme() ?? DEFAULT_THEME)

let themeChanges = 0

function changeTheme(next, apply) {
  const change = ++themeChanges
  const applyIfLatest = () => {
    if (change === themeChanges) apply()
  }
  if (next === 'light' && document.documentElement.dataset.theme === 'dark') flashbang(applyIfLatest)
  else applyIfLatest()
}

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
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    storeTheme(next)
    setPreferenceState(next)
    changeTheme(next, () => setTheme(next))
  }, [])

  const setPreference = useCallback((pref) => {
    if (pref !== 'system' && pref !== 'light' && pref !== 'dark') return
    const next = pref === 'system' ? systemTheme() : pref
    storeTheme(pref)
    setPreferenceState(pref)
    changeTheme(next, () => setTheme(next))
  }, [])

  return { theme, preference, toggleTheme, setPreference }
}
