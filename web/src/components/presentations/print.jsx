import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Slide from './slide'
import { imagesOf } from '../../lib/presentations'
import { slideImageUrl } from '../../lib/presentations-api'

const PAGE_RULE = '@page { size: 13.333in 7.5in; margin: 0; }'

function settled(root, timeout = 5000) {
  const pending = [...root.querySelectorAll('img')].filter((image) => !image.complete)
  const loads = pending.map((image) => new Promise((resolve) => {
    image.addEventListener('load', resolve, { once: true })
    image.addEventListener('error', resolve, { once: true })
  }))
  return Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, timeout))])
}

export default function DeckPrint({ deck, onDone }) {
  const root = useRef(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    let live = true
    const style = document.createElement('style')
    style.textContent = PAGE_RULE
    const finish = () => {
      if (!live) return
      live = false
      delete document.documentElement.dataset.printDeck
      style.remove()
      window.removeEventListener('afterprint', finish)
      done.current?.()
    }

    ;(async () => {
      await Promise.all(imagesOf(deck.slides).map(slideImageUrl))
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      if (!live || !root.current) return
      await settled(root.current)
      await document.fonts?.ready
      if (!live) return
      document.head.appendChild(style)
      document.documentElement.dataset.printDeck = ''
      window.addEventListener('afterprint', finish)
      window.print()
    })()

    return () => {
      if (!live) return
      live = false
      delete document.documentElement.dataset.printDeck
      style.remove()
      window.removeEventListener('afterprint', finish)
    }
  }, [deck])

  return createPortal(
    <div ref={root} className="deck-print" aria-hidden="true">
      {deck.slides.map((slide, i) => (
        <div key={slide.id} className="deck-print-page">
          <Slide slide={slide} theme={deck.theme} slides={deck.slides} index={i} numbers={deck.numbers} />
        </div>
      ))}
    </div>,
    document.body,
  )
}
