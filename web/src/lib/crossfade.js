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
