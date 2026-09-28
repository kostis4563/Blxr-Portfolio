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

const HANDOVER_MS = 40
const FADE_MS = 700
const GIVE_UP_MS = 15_000

const claims = new Map()
let curtain = null
let hideTimer = 0
let giveUpTimer = 0

function showCurtain() {
  clearTimeout(hideTimer)
  if (!curtain) {
    const adopting = document.querySelector('.loading-screen') !== null
    curtain = document.createElement('div')
    curtain.className = adopting ? 'loading-screen' : 'loading-screen is-fresh'
    curtain.setAttribute('role', 'status')
    curtain.setAttribute('aria-live', 'polite')
    curtain.innerHTML = '<span class="sr-only"></span><span class="loader" aria-hidden="true"></span>'
    document.body.append(curtain)
    clearTimeout(giveUpTimer)
    giveUpTimer = setTimeout(dropCurtain, GIVE_UP_MS)
  }
  curtain.firstChild.textContent = [...claims.values()].at(-1)
}

function dropCurtain() {
  clearTimeout(giveUpTimer)
  if (!curtain) return
  const leaving = curtain
  curtain = null
  leaving.classList.add('is-leaving')
  leaving.addEventListener('animationend', (event) => event.target === leaving && leaving.remove())
  setTimeout(() => leaving.remove(), FADE_MS)
}

function hideCurtain() {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => claims.size || dropCurtain(), HANDOVER_MS)
}

const noSubscribe = () => () => {}

export function Loading({ label = 'Loading' }) {
  const id = useId()
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false)

  useLayoutEffect(() => {
    claims.set(id, label)
    showCurtain()
    return () => {
      claims.delete(id)
      if (claims.size) showCurtain()
      else hideCurtain()
    }
  }, [id, label])

  if (hydrated) return null
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <span className="loader" aria-hidden="true" />
    </div>
  )
}
