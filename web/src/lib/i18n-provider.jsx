import { useState, useEffect, useCallback } from 'react'
import { LANGUAGES, LANG_CODES, DEFAULT_LANG, STORAGE_KEY } from './languages'
import { langOf, localizePath, navigate, routeOf, useRoutePath } from './router'
import en from './locales/en'
import { I18nContext, loadTable, readInitialLang, tableFor } from './i18n'


export function I18nProvider({ children }) {

  const urlLang = langOf(useRoutePath())

  const [prefLang, setPrefLang] = useState(DEFAULT_LANG)
  const lang = urlLang !== DEFAULT_LANG ? urlLang : prefLang

  const [table, setTable] = useState(() => tableFor(lang))

  useEffect(() => {
    const preferred = readInitialLang()
    if (preferred !== DEFAULT_LANG) setPrefLang(preferred)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadTable(lang).then((next) => {
      if (!cancelled) setTable(next)
    })
    return () => {
      cancelled = true
    }
  }, [lang])

  useEffect(() => {
    const meta = LANGUAGES.find((l) => l.code === lang)
    const el = document.documentElement
    el.lang = lang
    el.dir = meta?.dir === 'rtl' ? 'rtl' : 'ltr'
  }, [lang])

  // `redirect: false` keeps the URL as is — for pages that are not localized,
  // like the dashboard, where only the stored preference should change.
  const setLang = useCallback((code, { redirect = true } = {}) => {
    if (!LANG_CODES.includes(code)) return
    setPrefLang(code)
    try {
      window.localStorage.setItem(STORAGE_KEY, code)
    } catch {
    }

    loadTable(code)
    if (redirect) navigate(localizePath(routeOf(window.location.pathname), code))
  }, [])

  const t = useCallback((key, vars, fallback) => {
    let str = table[key]
    if (str == null) str = en[key]
    if (str == null) str = fallback != null ? fallback : key
    if (vars) {
      for (const k in vars) str = str.replaceAll(`{${k}}`, String(vars[k]))
    }
    return str
  }, [table])

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}
