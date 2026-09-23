import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

const GLYPHS = '/\\|-_=+*<>:;~^·×'
const SPREAD = 185
const JITTER = 50
const NOISE_MIN = 85
const NOISE_MAX = 195
const SWAP = 36
const CARET_TAIL = 85
const TAIL = 260

const glyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0]
const easeOut = (p) => 1 - (1 - p) ** 2.4

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  (document.documentElement.dataset.motion === 'reduced' ||
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))

let ctx = null
const measurer = (el) => {
  const cs = getComputedStyle(el)
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')
  ctx.font = cs.font || `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} / ${cs.lineHeight} ${cs.fontFamily}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing
  return (char) => (char && char !== '​' ? ctx.measureText(char).width : 0)
}

export default function ScrambleText({ text, alt, className = '' }) {
  const [shown, setShown] = useState(text)

  const stageRef = useRef(null)
  const hostRef = useRef(null)
  const shownRef = useRef(text)
  const heading = useRef(false)
  const frame = useRef(0)
  const run = useRef(null)

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    run.current = null
  }, [])

  useEffect(() => stop, [stop])

  useEffect(() => {
    if (run.current) return
    const at = heading.current ? alt : text
    if (shownRef.current === at) return
    shownRef.current = at
    setShown(at)
  }, [alt, text])

  const start = useCallback((toAlt) => {
    const stage = stageRef.current
    const host = hostRef.current
    if (!stage || !host) return

    const to = toAlt ? alt : text

    if (reducedMotion()) {
      stop()
      stage.replaceChildren()
      host.removeAttribute('data-run')
      shownRef.current = to
      setShown(to)
      return
    }

    const live = run.current
    const from = live ? live.chars.slice() : Array.from(shownRef.current)
    const length = Math.max(from.length, to.length)
    const width = measurer(host)

    const cells = new Array(length)
    const chars = new Array(length)
    const phases = new Array(length)
    const steps = new Array(length)
    const target = new Array(length)
    const swaps = new Array(length)

    let last = 0
    for (let i = 0; i < length; i += 1) {
      const startAt = (i / Math.max(length - 1, 1)) * SPREAD + Math.random() * JITTER
      const endAt = startAt + NOISE_MIN + Math.random() * (NOISE_MAX - NOISE_MIN)
      steps[i] = { startAt, endAt, frozen: from[i] === ' ' && to[i] === ' ' }
      if (endAt > last) last = endAt
      target[i] = width(to[i])
      chars[i] = from[i] ?? ''
      phases[i] = ''
      swaps[i] = 0
    }

    const held = live ? live.cells : null
    const fragment = document.createDocumentFragment()
    for (let i = 0; i < length; i += 1) {
      const cell = document.createElement('span')
      cell.className = 'scramble-cell'
      cell.style.setProperty('--fd', `${-i * 17}ms`)
      cell.style.width = `${Math.max(width(from[i]), target[i], held?.[i] ? parseFloat(held[i].style.width) || 0 : 0).toFixed(2)}px`
      cell.textContent = chars[i] === ' ' ? ' ' : chars[i] || '​'
      cells[i] = cell
      fragment.appendChild(cell)
    }

    const caret = document.createElement('span')
    caret.className = 'scramble-caret'
    fragment.appendChild(caret)

    stage.replaceChildren(fragment)
    host.setAttribute('data-run', '')

    const state = { cells, chars, phases, steps, target, swaps, caret, length, to, doneAt: last + TAIL, t0: performance.now() }
    run.current = state
    heading.current = toAlt

    const tick = (now) => {
      if (run.current !== state) return
      const t = now - state.t0

      const sweep = Math.min(t / (SPREAD + CARET_TAIL), 1)
      const caretX = easeOut(sweep) * stage.offsetWidth
      const fade = sweep > 0.8 ? Math.max((1 - sweep) / 0.2, 0) : Math.min(t / 70, 1)

      state.caret.style.transform = `translate3d(${caretX.toFixed(2)}px, 0, 0)`
      state.caret.style.opacity = fade.toFixed(3)

      for (let i = 0; i < state.length; i += 1) {
        const step = state.steps[i]
        if (step.frozen || t < step.startAt) continue

        const cell = state.cells[i]

        if (t < step.endAt) {
          if (state.phases[i] !== 'noise') {
            state.phases[i] = 'noise'
            cell.dataset.phase = 'noise'
          }
          if (now - state.swaps[i] > SWAP) {
            state.swaps[i] = now
            const next = glyph()
            state.chars[i] = next
            cell.textContent = next
          }
          continue
        }

        if (state.phases[i] !== 'set') {
          state.phases[i] = 'set'
          const char = state.to[i] ?? ''
          state.chars[i] = char
          cell.textContent = char === ' ' ? ' ' : char || '​'
          cell.dataset.phase = 'set'
          cell.style.width = `${state.target[i].toFixed(2)}px`
        }
      }

      if (t >= state.doneAt) {
        run.current = null
        frame.current = 0
        shownRef.current = state.to
        flushSync(() => setShown(state.to))
        stage.replaceChildren()
        host.removeAttribute('data-run')
        return
      }
      frame.current = requestAnimationFrame(tick)
    }

    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(tick)
  }, [alt, stop, text])

  const go = (toAlt) => {
    if (heading.current === toAlt) return
    start(toAlt)
  }

  return (
    <span
      ref={hostRef}
      className={className ? `scramble ${className}` : 'scramble'}
      tabIndex={0}
      role="button"
      aria-label={`${text}. ${alt}`}
      onMouseEnter={() => go(true)}
      onMouseLeave={() => go(false)}
      onFocus={() => go(true)}
      onBlur={() => go(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          go(!heading.current)
        }
      }}
      onPointerDown={(e) => { if (e.pointerType !== 'mouse') go(!heading.current) }}
    >
      <span aria-hidden="true" className="scramble-size">{text}</span>
      <span aria-hidden="true" className="scramble-size">{alt}</span>
      <span aria-hidden="true" className="scramble-rest">{shown}</span>
      <span aria-hidden="true" className="scramble-stage" ref={stageRef} />
    </span>
  )
}
