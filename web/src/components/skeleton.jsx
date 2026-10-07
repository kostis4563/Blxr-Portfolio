import { useId, useLayoutEffect, useSyncExternalStore } from 'react'

export function Bone({ className = '', style }) {
  return <span aria-hidden="true" style={style} className={`skeleton block rounded-md ${className}`} />
}

export function Spinner({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={`spinner shrink-0 ${className}`} viewBox="0 0 50 50" fill="none" aria-hidden="true">
      <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="5" className="opacity-20" />
      <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="5" strokeLinecap="round" className="spinner-arc" />
    </svg>
  )
}

const LOADER_SVG =
  '<svg class="loader" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">' +
  '<rect class="loader-a" width="10" height="10" x="1" y="1" fill="currentColor" rx="1"/>' +
  '<rect class="loader-b" width="10" height="10" x="1" y="13" fill="currentColor" rx="1"/>' +
  '</svg>'

const SHOW_DELAY_MS = 1000
const MIN_VISIBLE_MS = 600
const HANDOVER_MS = 40
const FADE_MS = 700
const GIVE_UP_MS = 15_000

const claims = new Map()
const persistent = new Set()
let curtain = null
let shownAt = 0
let showTimer = 0
let hideTimer = 0
let giveUpTimer = 0

const currentLabel = () => [...claims.values()].at(-1)

function mountCurtain(fresh) {
  clearTimeout(showTimer)
  showTimer = 0
  curtain = document.createElement('div')
  curtain.className = fresh ? 'loading-screen is-fresh' : 'loading-screen'
  curtain.setAttribute('role', 'status')
  curtain.setAttribute('aria-live', 'polite')
  curtain.innerHTML = `<span class="sr-only"></span>${LOADER_SVG}`
  curtain.firstChild.textContent = currentLabel()
  document.body.append(curtain)
  shownAt = performance.now()
}

function showCurtain() {
  clearTimeout(hideTimer)
  clearTimeout(giveUpTimer)
  if (!persistent.size) giveUpTimer = setTimeout(dropCurtain, GIVE_UP_MS)
  if (curtain) {
    curtain.firstChild.textContent = currentLabel()
    return
  }
  if (persistent.size) return mountCurtain(true)
  if (showTimer) return
  const prerendered = document.querySelector('.loading-screen') !== null
  const wait = prerendered ? SHOW_DELAY_MS - performance.now() : SHOW_DELAY_MS
  if (wait <= 0) return mountCurtain(false)
  showTimer = setTimeout(() => mountCurtain(true), wait)
}

function dropCurtain() {
  clearTimeout(giveUpTimer)
  clearTimeout(showTimer)
  showTimer = 0
  if (!curtain) return
  const leaving = curtain
  curtain = null
  leaving.classList.add('is-leaving')
  leaving.addEventListener('animationend', (event) => event.target === leaving && leaving.remove())
  setTimeout(() => leaving.remove(), FADE_MS)
}

function hideCurtain() {
  clearTimeout(hideTimer)
  const linger = curtain ? shownAt + MIN_VISIBLE_MS - performance.now() : 0
  hideTimer = setTimeout(() => claims.size || dropCurtain(), Math.max(HANDOVER_MS, linger))
}

const noSubscribe = () => () => {}

export function Loading({ label = 'Loading', persist = false }) {
  const id = useId()
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false)

  useLayoutEffect(() => {
    claims.set(id, label)
    if (persist) persistent.add(id)
    showCurtain()
    return () => {
      claims.delete(id)
      persistent.delete(id)
      if (claims.size) showCurtain()
      else hideCurtain()
    }
  }, [id, label, persist])

  if (hydrated) return null
  return (
    <div className="loading-screen is-pending" style={persist ? undefined : { animationDelay: `${SHOW_DELAY_MS}ms` }} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <span className="contents" dangerouslySetInnerHTML={{ __html: LOADER_SVG }} />
    </div>
  )
}
