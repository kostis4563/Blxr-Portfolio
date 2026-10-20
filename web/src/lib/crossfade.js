import { reducedMotion } from './memes'

const STILL = '*,*::before,*::after{transition:none!important}'

function swap(update) {
  const still = document.createElement('style')
  still.textContent = STILL
  document.head.append(still)
  update()
  void getComputedStyle(document.body).color
  setTimeout(() => still.remove())
}

export function crossfade(update) {
  if (!document.startViewTransition || reducedMotion()) {
    swap(update)
    return
  }
  document.startViewTransition(() => swap(update))
}

export function reveal(update, x, y) {
  if (!document.startViewTransition || reducedMotion()) {
    swap(update)
    return
  }
  const root = document.documentElement
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  root.dataset.sweep = ''
  const transition = document.startViewTransition(() => swap(update))
  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 760, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
    .catch(() => {})
  transition.finished.finally(() => delete root.dataset.sweep)
}
