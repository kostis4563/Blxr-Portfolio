import { useSyncExternalStore } from 'react'
import { LANG_CODES, DEFAULT_LANG } from './languages'
import { projectsList } from './projects'
import { libraryList } from './library'
import { imageProps, SIZES } from './images'

export function normalizePath(pathname) {
  let p = (pathname || '/').replace(/\/index\.html$/, '/').replace(/\.html$/, '')
  if (p.length > 1) p = p.replace(/\/+$/, '')
  return p || '/'
}

const LOCALE_RE = new RegExp(
  `^/(${LANG_CODES.filter((code) => code !== DEFAULT_LANG).join('|')})(?=/|$)`,
)

export function splitLocale(pathname) {
  const p = normalizePath(pathname)
  const match = LOCALE_RE.exec(p)
  if (!match) return { lang: DEFAULT_LANG, route: p }
  return { lang: match[1], route: p.slice(match[0].length) || '/' }
}

export const langOf = (pathname) => splitLocale(pathname).lang
export const routeOf = (pathname) => splitLocale(pathname).route

export function localizePath(path, lang) {
  const { route } = splitLocale(path)
  if (lang === DEFAULT_LANG || !LANG_CODES.includes(lang)) return route
  return route === '/' ? `/${lang}` : `/${lang}${route}`
}

export function parseRoute(path) {
  const p = routeOf(path)
  if (p === '/') return { name: 'home' }
  if (p === '/projects') return { name: 'projects', projectId: null }
  if (p === '/library') return { name: 'library', itemId: null }

  const match = /^\/projects\/([^/]+)$/.exec(p)
  if (match) {
    const id = decodeURIComponent(match[1])
    if (projectsList.some((project) => project.id === id)) {
      return { name: 'projects', projectId: id }
    }
  }

  const libMatch = /^\/library\/([^/]+)$/.exec(p)
  if (libMatch) {
    const id = decodeURIComponent(libMatch[1])
    if (libraryList.some((entry) => entry.id === id)) {
      return { name: 'library', itemId: id }
    }
  }

  return { name: 'notFound' }
}

const warmed = new Set()

function heroImageFor(route) {
  if (route.name === 'projects' && route.projectId) {
    const src = projectsList.find((project) => project.id === route.projectId)?.image
    return src ? { src, sizes: '(min-width: 768px) 768px, 100vw' } : null
  }
  if (route.name === 'library' && route.itemId) {
    const src = libraryList.find((entry) => entry.id === route.itemId)?.image
    return src ? { src, sizes: SIZES.contentColumn } : null
  }
  return null
}

export function warmRoute(to) {
  if (typeof document === 'undefined') return
  const hero = heroImageFor(parseRoute(localizePath(to, currentLang())))
  if (!hero || warmed.has(hero.src)) return
  warmed.add(hero.src)

  const { src: href, srcSet, sizes } = imageProps(hero.src, hero.sizes)
  const el = document.createElement('link')
  el.rel = 'preload'
  el.as = 'image'
  el.href = href
  if (srcSet) el.imageSrcset = srcSet
  if (sizes) el.imageSizes = sizes
  el.fetchPriority = 'low'
  document.head.appendChild(el)
}

export const HOME_PATH = '/'
export const PROJECTS_PATH = '/projects'
export const projectPath = (id) => `/projects/${encodeURIComponent(id)}`
export const LIBRARY_PATH = '/library'
export const libraryPath = (id) => `/library/${encodeURIComponent(id)}`

export const staticPaths = () => [
  HOME_PATH,
  PROJECTS_PATH,
  ...projectsList.map((p) => projectPath(p.id)),
  LIBRARY_PATH,
  ...libraryList.map((entry) => libraryPath(entry.id)),
]

export const localizedPaths = () =>
  LANG_CODES.flatMap((lang) => staticPaths().map((path) => localizePath(path, lang)))

export const alternatesFor = (path) =>
  LANG_CODES.map((lang) => ({ lang, path: localizePath(path, lang) }))

const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())
const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let ssrPath = HOME_PATH
export const setServerPath = (path) => { ssrPath = normalizePath(path) }

const getSnapshot = () =>
  typeof window === 'undefined' ? ssrPath : normalizePath(window.location.pathname)

export const currentLang = () => langOf(getSnapshot())

let ownEntries = 0

if (typeof window !== 'undefined') {

  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  window.addEventListener('popstate', () => {
    ownEntries = Math.max(0, ownEntries - 1)
    emit()
  })
}

export function useRoutePath() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function navigate(to, { replace = false, lang = currentLang() } = {}) {
  const path = localizePath(to, lang)
  if (path === getSnapshot()) return
  if (replace) {
    window.history.replaceState(null, '', path)
  } else {
    window.history.pushState(null, '', path)
    ownEntries += 1
  }
  emit()
}

export function link(to, onNavigate) {
  return {
    href: localizePath(to, currentLang()),

    onPointerEnter: () => warmRoute(to),
    onFocus: () => warmRoute(to),
    onTouchStart: () => warmRoute(to),
    onClick: (event) => {

      event.stopPropagation()
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      event.preventDefault()
      if (onNavigate) onNavigate()
      else navigate(to)
    },
  }
}

export const canGoBack = () => ownEntries > 0

export function backOr(fallback) {
  if (ownEntries > 0) {
    window.history.back()
  } else {
    navigate(fallback, { replace: true })
  }
}
