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
  const p = routeOf(path).split('#')[0]
  if (p === '/') return { name: 'home' }
  if (p === '/projects') return { name: 'projects', projectId: null }
  if (p === '/library') return { name: 'library', itemId: null }
  if (p === '/reviews') return { name: 'reviews' }
  if (p === '/login') return { name: 'login' }
  if (p === '/dashboard') return { name: 'dashboard' }
  if (p === PROFILE_BASE_PATH) return { name: 'profile', handle: null }

  const profileMatch = /^\/u\/([^/]+)$/.exec(p)
  if (profileMatch) return { name: 'profile', handle: decodeURIComponent(profileMatch[1]).toLowerCase() }

  const match = /^\/projects\/([^/]+)$/.exec(p)
  if (match) {
    const id = decodeURIComponent(match[1])
    if (projectsList.some((project) => project.id === id)) {
      return { name: 'projects', projectId: id, redirect: projectPath(id) }
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
  if (route.name === 'projects') {
    const src = projectsList[0]?.image
    return src ? { src, sizes: SIZES.archiveCover } : null
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
export const projectPath = (id) => `${PROJECTS_PATH}#${encodeURIComponent(id)}`
export const LIBRARY_PATH = '/library'
export const libraryPath = (id) => `/library/${encodeURIComponent(id)}`
export const REVIEWS_PATH = '/reviews'
export const WRITE_REVIEW_PATH = `${REVIEWS_PATH}#write`
export const LOGIN_PATH = '/login'
export const REGISTER_PATH = `${LOGIN_PATH}#register`
export const RESET_PATH = `${LOGIN_PATH}#reset`
export const UPDATE_PASSWORD_PATH = `${LOGIN_PATH}#update`
export const VERIFY_PATH = `${LOGIN_PATH}#verify`
export const DASHBOARD_PATH = '/dashboard'
export const dashboardPath = (id) => (id ? `${DASHBOARD_PATH}#${id}` : DASHBOARD_PATH)
export const PROFILE_BASE_PATH = '/u'
export const profilePath = (handle) => `${PROFILE_BASE_PATH}/${encodeURIComponent(handle)}`

export const staticPaths = () => [
  HOME_PATH,
  PROJECTS_PATH,
  LIBRARY_PATH,
  ...libraryList.map((entry) => libraryPath(entry.id)),
  REVIEWS_PATH,
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

const getHash = () => (typeof window === 'undefined' ? '' : window.location.hash)

export const currentLang = () => langOf(getSnapshot())

let ownEntries = 0

if (typeof window !== 'undefined') {

  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  window.addEventListener('popstate', () => {
    ownEntries = Math.max(0, ownEntries - 1)
    emit()
  })
  window.addEventListener('hashchange', emit)
}

export function useRoutePath() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useRouteHash() {
  return useSyncExternalStore(subscribe, getHash, () => '')
}

export function navigate(to, { replace = false, lang = currentLang() } = {}) {
  const path = localizePath(to, lang)
  if (path === getSnapshot() + getHash()) return
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
