import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../dashboard-sidebar'
import { BTN_BARE, BTN_QUIET, BTN_SOLID } from './ui'

const SEEN_KEY = 'blxr:boards:tour'

export function tourSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
  }
}

const STEPS = [
  {
    spot: 'board-head',
    title: 'This is the board',
    body: 'Its name, what it is for, and how much of it is done. Everything on this page belongs to you alone — nobody else can open it.',
  },
  {
    spot: 'board-filters',
    title: 'Narrow it down',
    body: 'Search the cards, hide what is finished, pick a label, or bring the archive into view. The filters only change what you see — nothing moves.',
  },
  {
    spot: 'board-rail',
    title: 'Columns and cards',
    body: 'Drag a card between columns, or within one, to reorder it. A column can carry a limit, and the last one is the finish line: dropping a card there ticks it off.',
  },
  {
    spot: 'board-add-card',
    title: 'Add as you go',
    body: 'Type a title and press Enter. Shift+Enter keeps the box open so a whole list can go in at once.',
  },
  {
    spot: 'board-settings',
    title: 'Labels, look and reminders',
    body: 'Give the board a logo and a banner, define its labels, and say how far ahead it should chase a due card. The bin lives here too.',
  },
]

function useSpot(step) {
  const [box, setBox] = useState(null)

  const measure = useCallback(() => {
    const node = document.querySelector(`[data-tour="${step.spot}"]`)
    if (!node) {
      setBox(null)
      return
    }
    const rect = node.getBoundingClientRect()
    setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
  }, [step.spot])

  useLayoutEffect(() => {
    const node = document.querySelector(`[data-tour="${step.spot}"]`)
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure, step.spot])

  return box
}

function Callout({ box, step, at, total, onBack, onNext, onClose }) {
  const width = Math.min(320, typeof window === 'undefined' ? 320 : window.innerWidth - 24)
  const below = box ? box.top + box.height + 12 : 120
  const room = typeof window === 'undefined' || below + 190 < window.innerHeight
  const top = box ? (room ? below : Math.max(12, box.top - 190)) : 120
  const left = box ? Math.max(12, Math.min(box.left, (typeof window === 'undefined' ? 1200 : window.innerWidth) - width - 12)) : 12

  return (
    <div style={{ top, left, width }} className="fixed z-[102] rounded-xl border border-line bg-surface p-4 shadow-2xl animate-menu-in">
      <p className="text-[13.5px] font-semibold tracking-tight text-ink-strong">{step.title}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{step.body}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] tabular-nums text-ink-faint">
          {at + 1} of {total}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={onClose} className={BTN_BARE}>
          Skip
        </button>
        {at > 0 && (
          <button type="button" onClick={onBack} className={BTN_QUIET}>
            Back
          </button>
        )}
        <button type="button" onClick={onNext} className={BTN_SOLID}>
          {at === total - 1 ? 'Done' : 'Next'}
        </button>
      </div>
    </div>
  )
}

export default function Tour({ onClose }) {
  const [at, setAt] = useState(0)
  const steps = STEPS.filter((step) => (typeof document === 'undefined' ? true : document.querySelector(`[data-tour="${step.spot}"]`)))
  const step = steps[Math.min(at, steps.length - 1)]
  const box = useSpot(step || STEPS[0])

  const finish = useCallback(() => {
    markSeen()
    onClose()
  }, [onClose])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        finish()
      }
      if (event.key === 'ArrowRight') setAt((held) => Math.min(steps.length - 1, held + 1))
      if (event.key === 'ArrowLeft') setAt((held) => Math.max(0, held - 1))
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [finish, steps.length])

  if (!step || typeof document === 'undefined') return null

  return createPortal(
    <div data-nested-open>
      <button type="button" aria-label="Close the tour" onClick={finish} className="fixed inset-0 z-[100] cursor-default bg-black/60 animate-overlay-in" />
      {box && (
        <span
          aria-hidden="true"
          style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }}
          className="pointer-events-none fixed z-[101] rounded-xl outline-2 outline-ink-strong/70 outline-offset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
        />
      )}
      <Callout
        box={box}
        step={step}
        at={Math.min(at, steps.length - 1)}
        total={steps.length}
        onBack={() => setAt((held) => Math.max(0, held - 1))}
        onNext={() => (at >= steps.length - 1 ? finish() : setAt(at + 1))}
        onClose={finish}
      />
    </div>,
    document.body,
  )
}

export function TourButton({ onClick }) {
  return (
    <button type="button" aria-label="Show me around" title="Show me around" onClick={onClick} className={`${BTN_QUIET} w-8 px-0`}>
      <Icon name="info" className="h-3.5 w-3.5" />
    </button>
  )
}
