import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icon'
import Slide from './slide'
import { keyAction, formatClock, imagesOf, themeOf, SHORTCUTS } from '../../lib/presentations'
import { preloadImages } from '../../lib/presentations-api'

export function enterFullscreen() {
  const el = document.documentElement
  if (document.fullscreenElement) return
  try {
    const request = el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.()
    request?.catch?.(() => {})
  } catch {
  }
}

function leaveFullscreen() {
  if (!document.fullscreenElement) return
  try {
    document.exitFullscreen?.()?.catch?.(() => {})
  } catch {
  }
}

export function useDeckNav(count, start = 0, { end = false } = {}) {
  const max = end ? count : count - 1
  const [view, setView] = useState(() => ({ index: Math.max(0, Math.min(count - 1, start)), from: null, dir: 1, key: 0 }))

  const go = useCallback(
    (target) =>
      setView((held) => {
        const wanted = typeof target === 'function' ? target(held.index) : target
        const index = Math.max(0, Math.min(max, wanted))
        if (index === held.index) return held
        return { index, from: held.index, dir: index > held.index ? 1 : -1, key: held.key + 1 }
      }),
    [max],
  )
  const settle = useCallback(() => setView((held) => (held.from === null ? held : { ...held, from: null })), [])

  useEffect(() => {
    if (view.index > max) go(max)
  }, [view.index, max, go])

  return { view, go, settle }
}

export function Stage({ deck, view, onSettled, className = '', style, still = false }) {
  const { slides, transition } = deck
  const moving = !still && view.from !== null && transition !== 'none'
  const animIn = transition === 'slide' ? (view.dir > 0 ? 'deck-in-next' : 'deck-in-prev') : 'deck-fade'
  const animOut = transition === 'slide' ? (view.dir > 0 ? 'deck-out-next' : 'deck-out-prev') : ''
  const slideProps = (index) => ({ slide: slides[index], theme: deck.theme, slides, index, numbers: deck.numbers })

  return (
    <div className={`relative aspect-video overflow-hidden ${className}`} style={style}>
      {moving && slides[view.from] && (
        <div key={`from-${view.key}`} aria-hidden="true" className={`absolute inset-0 ${animOut}`}>
          <Slide {...slideProps(view.from)} />
        </div>
      )}
      {slides[view.index] ? (
        <div
          key={`at-${view.key}`}
          className={`absolute inset-0 ${moving ? animIn : ''}`}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) onSettled?.()
          }}
        >
          <Slide {...slideProps(view.index)} />
        </div>
      ) : (
        <div key={`end-${view.key}`} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-center deck-fade">
          <p className="text-[15px] font-medium text-white/80">End of presentation</p>
          <p className="text-[12.5px] text-white/45">Click or press Esc to leave</p>
        </div>
      )}
    </div>
  )
}

function Fitted({ children, className = '' }) {
  return (
    <div className={`flex min-h-0 min-w-0 items-center justify-center ${className}`} style={{ containerType: 'size' }}>
      <div style={{ width: 'min(100cqw, calc(100cqh * 16 / 9))' }}>{children}</div>
    </div>
  )
}

function Control({ icon, label, onClick, active, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60 ${
        active ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
      }`}
    >
      {icon && <Icon name={icon} className="h-4 w-4" />}
      {children}
    </button>
  )
}

function Grid({ deck, current, onPick, onClose }) {
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-black/90 px-5 py-6 backdrop-blur-sm animate-overlay-in sm:px-10" onPointerUp={(event) => event.stopPropagation()}>
      <div className="mx-auto flex max-w-[1440px] items-center justify-between pb-5">
        <p className="text-[13px] font-medium text-white/80">All slides · {deck.slides.length}</p>
        <Control icon="x" label="Close (Esc)" onClick={onClose} />
      </div>
      <ul className="mx-auto grid max-w-[1440px] grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {deck.slides.map((slide, i) => (
          <li key={slide.id}>
            <button
              type="button"
              onClick={() => onPick(i)}
              className="block w-full cursor-pointer text-left outline-none"
              aria-current={i === current ? 'true' : undefined}
            >
              <span className="deck-thumb pointer-events-none" inert>
                <Slide slide={slide} theme={deck.theme} slides={deck.slides} index={i} numbers={deck.numbers} />
              </span>
              <span className="mt-1.5 block font-mono text-[11px] tabular-nums text-white/55">{String(i + 1).padStart(2, '0')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Help({ speaker, onClose }) {
  const rows = SHORTCUTS.filter(([, what]) => speaker || !what.startsWith('Speaker'))
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 animate-overlay-in" onPointerUp={(event) => { event.stopPropagation(); onClose() }}>
      <div className="w-full max-w-[420px] rounded-2xl bg-black p-5 text-white shadow-2xl ring-1 ring-white/15 animate-panel-in" onPointerUp={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold">Keyboard shortcuts</p>
          <Control icon="x" label="Close" onClick={onClose} />
        </div>
        <dl className="mt-3 text-[12.5px]">
          {rows.map(([keys, what]) => (
            <div key={keys} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-white/70">{what}</dt>
              <dd className="shrink-0 font-mono text-[11.5px] text-white">{keys}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function useClock(running) {
  const [elapsed, setElapsed] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const startedAt = useRef(Date.now())
  const banked = useRef(0)

  useEffect(() => {
    if (!running) {
      banked.current += Date.now() - startedAt.current
      return undefined
    }
    startedAt.current = Date.now()
    const tick = () => {
      setNow(Date.now())
      setElapsed(banked.current + Date.now() - startedAt.current)
    }
    tick()
    const timer = setInterval(tick, 500)
    return () => clearInterval(timer)
  }, [running])

  const reset = () => {
    banked.current = 0
    startedAt.current = Date.now()
    setElapsed(0)
  }
  return { elapsed, now, reset }
}

const CLOCK = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const NOTE_SIZES = ['text-[14px]', 'text-[16px]', 'text-[19px]', 'text-[24px]', 'text-[28px]']

function SpeakerView({ deck, view, go, onSettled, onExit, onEnd }) {
  const [running, setRunning] = useState(true)
  const [size, setSize] = useState(2)
  const { elapsed, now, reset } = useClock(running)
  const { slides } = deck
  const index = Math.min(view.index, slides.length - 1)
  const atEnd = view.index >= slides.length
  const next = slides[view.index + 1]
  const notes = atEnd ? '' : slides[index]?.notes

  return (
    <div className="flex h-full flex-col bg-black text-white" onPointerUp={(event) => event.stopPropagation()}>
      <div className="deck-speaker">
        <section className="flex min-h-0 flex-col gap-2.5" aria-label="Current slide">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
            Now · {atEnd ? 'End' : `${index + 1} of ${slides.length}`}
          </p>
          <Fitted className="flex-1">
            <Stage deck={deck} view={view} onSettled={onSettled} className="rounded-lg ring-1 ring-white/15" />
          </Fitted>
        </section>
        <div className="flex min-h-0 flex-col gap-4">
          <section className="flex flex-col gap-2.5" aria-label="Next slide">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">Next</p>
            {next ? (
              <button type="button" onClick={() => go(view.index + 1)} className="block cursor-pointer overflow-hidden rounded-lg opacity-90 ring-1 ring-white/15 transition-opacity hover:opacity-100">
                <span className="pointer-events-none block" inert>
                  <Slide slide={next} theme={deck.theme} slides={slides} index={view.index + 1} numbers={deck.numbers} />
                </span>
              </button>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-white/10 text-[12.5px] text-white/45">
                {atEnd ? 'Nothing after this' : 'End of presentation'}
              </div>
            )}
          </section>
          <section className="flex min-h-0 flex-1 flex-col gap-2.5" aria-label="Speaker notes">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">Notes</p>
              <div className="flex items-center">
                <Control label="Smaller notes" onClick={() => setSize((held) => Math.max(0, held - 1))}>A−</Control>
                <Control label="Bigger notes" onClick={() => setSize((held) => Math.min(NOTE_SIZES.length - 1, held + 1))}>A+</Control>
              </div>
            </div>
            <div className={`min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/10 p-4 leading-relaxed ${NOTE_SIZES[size]} ${notes ? 'text-white' : 'text-white/45'}`}>
              {notes || 'No notes for this slide.'}
            </div>
          </section>
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/20 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className={`font-mono text-[22px] tabular-nums ${running ? 'text-white' : 'text-white/45'}`} aria-label="Time elapsed">{formatClock(elapsed)}</span>
          <Control icon={running ? 'pause' : 'play'} label={running ? 'Pause timer' : 'Resume timer'} onClick={() => setRunning((held) => !held)} />
          <Control icon="refresh" label="Reset timer" onClick={reset} />
          <span className="ml-2 hidden font-mono text-[13px] tabular-nums text-white/45 sm:inline">{CLOCK.format(now)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Control icon="chevronLeft" label="Previous slide" onClick={() => go((at) => at - 1)} />
          <span className="px-1 font-mono text-[12.5px] tabular-nums text-white/70">{atEnd ? '—' : index + 1} / {slides.length}</span>
          <Control icon="chevronRight" label="Next slide" onClick={() => go((at) => at + 1)} />
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
          <Control icon="eyeOff" label="Leave speaker view (S)" onClick={onExit}>
            <span className="hidden sm:inline">Audience view</span>
          </Control>
          <Control label="End show (Esc)" onClick={onEnd}>End show</Control>
        </div>
      </footer>
    </div>
  )
}

export default function Presenter({ deck, start = 0, speaker: allowSpeaker = false, speakerFirst = false, onClose }) {
  const { slides } = deck
  const { view, go, settle } = useDeckNav(slides.length, start, { end: true })
  const [screen, setScreen] = useState(null)
  const [panel, setPanel] = useState(null)
  const [speaker, setSpeaker] = useState(allowSpeaker && speakerFirst)
  const [digits, setDigits] = useState('')
  const [idle, setIdle] = useState(false)
  const [full, setFull] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement))
  const wasFull = useRef(full)
  const leaving = useRef(false)
  const pointer = useRef(null)
  const state = useRef({})
  state.current = { view, screen, panel, speaker, digits, slides, onClose }

  const close = useCallback(() => state.current.onClose?.(Math.min(state.current.view.index, state.current.slides.length - 1)), [])

  useEffect(() => {
    const onChange = () => {
      const now = Boolean(document.fullscreenElement)
      setFull(now)
      if (now) wasFull.current = true
      else if (wasFull.current && !leaving.current) close()
      leaving.current = false
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [close])

  useEffect(() => () => leaveFullscreen(), [])

  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    let lock = null
    navigator.wakeLock?.request?.('screen').then((held) => { lock = held }).catch(() => {})
    return () => {
      document.body.style.overflow = overflow
      lock?.release?.().catch?.(() => {})
    }
  }, [])

  useEffect(() => {
    preloadImages(imagesOf(slides))
  }, [slides])

  useEffect(() => {
    if (!digits) return undefined
    const timer = setTimeout(() => setDigits(''), 2200)
    return () => clearTimeout(timer)
  }, [digits])

  const poke = useCallback(() => setIdle(false), [])
  useEffect(() => {
    if (idle) return undefined
    const timer = setTimeout(() => setIdle(true), 2600)
    return () => clearTimeout(timer)
  }, [idle])

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) {
      leaving.current = true
      leaveFullscreen()
    } else {
      enterFullscreen()
    }
  }, [])

  const forward = useCallback(() => {
    const { view: at, screen: shown, slides: all } = state.current
    if (shown) return setScreen(null)
    if (at.index >= all.length) return close()
    go(at.index + 1)
  }, [go, close])

  const back = useCallback(() => {
    if (state.current.screen) return setScreen(null)
    go((at) => at - 1)
  }, [go])

  useEffect(() => {
    const onKey = (event) => {
      const { panel: open, digits: typed, slides: all } = state.current
      const action = keyAction(event)
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      setIdle(true)
      if (action === 'digit') return setDigits((held) => `${held}${event.key}`.slice(-3))
      if (action === 'next' && event.key === 'Enter' && typed) {
        go(Number(typed) - 1)
        setDigits('')
        return
      }
      if (open && action !== 'close' && action !== open && action !== 'fullscreen') return
      switch (action) {
        case 'next': return forward()
        case 'prev': return back()
        case 'first': return go(0)
        case 'last': return go(all.length - 1)
        case 'black': return setScreen((held) => (held === 'black' ? null : 'black'))
        case 'white': return setScreen((held) => (held === 'white' ? null : 'white'))
        case 'grid': return setPanel((held) => (held === 'grid' ? null : 'grid'))
        case 'help': return setPanel((held) => (held === 'help' ? null : 'help'))
        case 'speaker': return allowSpeaker && setSpeaker((held) => !held)
        case 'fullscreen': return toggleFull()
        case 'close':
          if (open) return setPanel(null)
          if (state.current.screen) return setScreen(null)
          return close()
        default:
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [go, forward, back, close, toggleFull, allowSpeaker])

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointer.current = { x: event.clientX, y: event.clientY }
  }
  const onPointerUp = (event) => {
    const from = pointer.current
    pointer.current = null
    if (!from || panel) return
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? forward() : back()
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return undefined
    if (event.clientX < window.innerWidth / 3) back()
    else forward()
  }

  const shown = !idle || Boolean(panel)
  const accent = themeOf(deck.theme).accent
  const atEnd = view.index >= slides.length
  const progress = slides.length ? Math.min(1, (view.index + 1) / slides.length) : 0

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Presenting ${deck.title}`}
      className="deck-show fixed inset-0 z-[100] select-none overflow-hidden bg-black"
      data-idle={shown ? undefined : ''}
      onPointerMove={poke}
      onPointerDown={poke}
    >
      {speaker ? (
        <SpeakerView deck={deck} view={view} go={go} onSettled={settle} onExit={() => setSpeaker(false)} onEnd={close} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          <Stage deck={deck} view={view} onSettled={settle} style={{ width: 'min(100vw, calc(100dvh * 16 / 9))' }} />
        </div>
      )}

      <p className="sr-only" aria-live="polite">{atEnd ? 'End of presentation' : `Slide ${view.index + 1} of ${slides.length}`}</p>

      {screen && (
        <button
          type="button"
          aria-label="Back to the slide"
          onClick={() => setScreen(null)}
          className={`absolute inset-0 z-10 cursor-pointer deck-fade ${screen === 'black' ? 'bg-black' : 'bg-white'}`}
        />
      )}

      {digits && (
        <div className="pointer-events-none absolute left-1/2 top-6 z-30 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 font-mono text-[13px] text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-md animate-menu-in">
          Go to slide {digits} <span className="text-white/50">· Enter</span>
        </div>
      )}

      {panel === 'grid' && <Grid deck={deck} current={view.index} onClose={() => setPanel(null)} onPick={(i) => { go(i); setPanel(null); setScreen(null) }} />}
      {panel === 'help' && <Help speaker={allowSpeaker} onClose={() => setPanel(null)} />}

      {!speaker && (
        <>
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[3px] bg-white/10 transition-opacity duration-300 ${shown && !panel ? 'opacity-100' : 'opacity-0'}`}
          >
            <span className="block h-full transition-[width] duration-500 ease-out" style={{ width: `${progress * 100}%`, background: accent }} />
          </div>
          <div
            className={`absolute inset-x-0 bottom-5 z-10 flex justify-center px-4 transition-[opacity,transform] duration-300 ${shown && !panel ? 'opacity-100' : 'pointer-events-none translate-y-1 opacity-0'}`}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-1 text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-md">
              <Control icon="chevronLeft" label="Previous slide" onClick={back} />
              <span className="w-16 text-center font-mono text-[12.5px] tabular-nums text-white/80">
                {atEnd ? 'End' : `${view.index + 1} / ${slides.length}`}
              </span>
              <Control icon="chevronRight" label="Next slide" onClick={forward} />
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
              <Control icon="grid" label="All slides (G)" onClick={() => setPanel('grid')} />
              {allowSpeaker && <Control icon="message" label="Speaker view (S)" onClick={() => setSpeaker(true)} />}
              <Control icon="maximize" label={full ? 'Leave full screen (F)' : 'Full screen (F)'} active={full} onClick={toggleFull} />
              <Control icon="info" label="Shortcuts (?)" onClick={() => setPanel('help')} />
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
              <Control label="End show (Esc)" onClick={close}>
                <Icon name="x" className="h-4 w-4" />
                <span className="hidden pr-1 sm:inline">End</span>
              </Control>
            </div>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
