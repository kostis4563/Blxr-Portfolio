import { useSyncExternalStore } from 'react'
import { fetchUnread } from './messages-api'

const EVERY = 45_000

let count = 0
let timer = null
let inflight = null
const listeners = new Set()

function emit(next) {
  if (next === count) return
  count = next
  listeners.forEach((fn) => fn())
}

export function refreshUnread() {
  if (inflight) return inflight
  inflight = fetchUnread()
    .then((next) => emit(Number(next) || 0))
    .catch(() => {})
    .finally(() => {
      inflight = null
    })
  return inflight
}

export const setUnread = (next) => emit(Math.max(0, Number(next) || 0))

function onVisible() {
  if (document.visibilityState === 'visible') refreshUnread()
}

function subscribe(fn) {
  listeners.add(fn)
  if (listeners.size === 1) {
    refreshUnread()
    timer = setInterval(refreshUnread, EVERY)
    document.addEventListener('visibilitychange', onVisible)
  }
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0) {
      clearInterval(timer)
      timer = null
      document.removeEventListener('visibilitychange', onVisible)
    }
  }
}

const getSnapshot = () => count
const getServerSnapshot = () => 0

export function useUnread() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
