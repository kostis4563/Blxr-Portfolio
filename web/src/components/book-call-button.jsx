import { useEffect, useRef, useState } from 'react'
import { Icon } from './icon'
import { link, navigate, BOOK_PATH } from '../lib/router'

const ARROW = [
  [2, 0],
  [3, 1],
  [0, 2],
  [1, 2],
  [2, 2],
  [3, 2],
  [4, 2],
  [3, 3],
  [2, 4],
]
const GAP = 3.25
const HOLD_MS = 640

const calm = () =>
  document.documentElement.dataset.motion === 'reduced' || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

function DotArrow() {
  return (
    <svg className="call-cta-arrow" viewBox="-1.5 -1.5 16 16" width="16" height="16" aria-hidden="true">
      {ARROW.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x * GAP} cy={y * GAP} r="1.2" style={{ '--i': 4 - x }} />
      ))}
    </svg>
  )
}

export default function BookCallButton({ className = '' }) {
  const [going, setGoing] = useState(false)
  const timer = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])

  const go = () => {
    if (timer.current) return
    if (calm()) return navigate(BOOK_PATH)
    setGoing(true)
    timer.current = setTimeout(() => navigate(BOOK_PATH), HOLD_MS)
  }

  return (
    <a
      {...link(BOOK_PATH, go)}
      data-component="Button / Book a call"
      data-state={going ? 'going' : undefined}
      className={`call-cta ${className}`}
    >
      <span className="call-cta-bubble" aria-hidden="true">Pick a time</span>
      <span className="call-cta-knob" aria-hidden="true">
        <DotArrow />
        <Icon name="phoneCall" className="call-cta-phone h-4 w-4" strokeWidth={1.9} />
      </span>
      <span className="call-cta-label">Book a call</span>
    </a>
  )
}
