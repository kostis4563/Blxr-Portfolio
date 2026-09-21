import { normalizePath, parseRoute } from './router.js'

const KEY = 'blxr-recent'
const MAX = 6

export function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((r) => typeof r === 'string') : []
  } catch {
    return []
  }
}

export function rememberVisit(pathname) {
  const route = normalizePath(pathname)
  if (parseRoute(route).name === 'notFound') return
  try {
    const list = [route, ...readRecent().filter((r) => r !== route)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
  }
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY)
  } catch {
  }
}
