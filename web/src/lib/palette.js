import { useSyncExternalStore } from 'react'
import { navigate, parseRoute, HOME_PATH } from './router'

let open = false
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())
const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const getSnapshot = () => open

const getServerSnapshot = () => false

export function usePaletteOpen() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function set(next) {
  if (open === next) return
  open = next
  emit()
}

export const openPalette = () => set(true)
export const closePalette = () => set(false)
export const togglePalette = () => set(!open)

export function isMacLike() {
  if (typeof navigator === 'undefined') return false
  const platform = navigator.userAgentData?.platform || navigator.platform || ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

export const SECTIONS = [
  { id: 'projects', key: 'home.projects' },
  { id: 'skills', key: 'home.skills' },
  { id: 'education', key: 'home.education' },
  { id: 'contact', key: 'home.contact' },
]

export function jumpToSection(id) {
  const scroll = () => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })

    window.history.replaceState(null, '', `#${id}`)
  }

  if (parseRoute(window.location.pathname).name === 'home') {
    scroll()
    return
  }
  navigate(HOME_PATH)
  requestAnimationFrame(() => requestAnimationFrame(scroll))
}
