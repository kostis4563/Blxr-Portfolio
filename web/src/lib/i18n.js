
import { createContext, useContext } from 'react'
import { LANG_CODES, STORAGE_KEY, DEFAULT_LANG } from './languages'
import { currentLang } from './router'
import en from './locales/en'

export { LANGUAGES, LOCALE_TAGS } from './languages'

const loaders = import.meta.glob('./locales/*.js')

const loaded = { en }

const pending = new Map()

export function loadTable(code) {
  if (loaded[code]) return Promise.resolve(loaded[code])
  const already = pending.get(code)
  if (already) return already
  const load = loaders[`./locales/${code}.js`]

  if (!load) return Promise.resolve(en)
  const promise = load().then((mod) => {
    loaded[code] = mod.default
    pending.delete(code)
    return mod.default
  })
  pending.set(code, promise)
  return promise
}

export const preloadTable = loadTable

export const tableFor = (code) => loaded[code] || en

export function translate(code, key, vars, fallback) {
  const table = tableFor(code)
  let str = table[key]
  if (str == null) str = en[key]
  if (str == null) str = fallback != null ? fallback : key
  if (vars) for (const k in vars) str = str.replaceAll(`{${k}}`, String(vars[k]))
  return str
}

export function readInitialLang() {
  const fromUrl = currentLang()
  if (fromUrl !== DEFAULT_LANG) return fromUrl
  if (typeof window === 'undefined') return DEFAULT_LANG
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved && LANG_CODES.includes(saved)) return saved

    const nav = (window.navigator.languages || [window.navigator.language || ''])
    for (const tag of nav) {
      let base = String(tag).toLowerCase().split('-')[0]
      if (base === 'nb' || base === 'nn')
        base = 'no'

      if (base === 'iw') base = 'he'
      if (base === 'in') base = 'id'
      if (base === 'sh') base = 'sr'
      if (LANG_CODES.includes(base)) return base
    }
  } catch {
  }
  return DEFAULT_LANG
}

if (typeof window !== 'undefined') loadTable(readInitialLang())

export const I18nContext = createContext(null)

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>')
  return ctx
}
