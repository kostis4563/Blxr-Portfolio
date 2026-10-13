import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { canvasOpen, fitFrames, onCanvas, setCanvas } from '../lib/figma'
import { reducedMotion } from '../lib/memes'
import { FrameLabel, Handles, isTyping } from './figma'

const ZOOM_MS = 520
const STEPS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

const sizeLabel = (size) => `${Math.round(size.width)} × ${Math.round(size.height)}`

function still(els, fn) {
  els.forEach((el) => { el.style.transition = 'none' })
  const result = fn()
  void els[0].offsetWidth
  els.forEach((el) => { el.style.transition = '' })
  return result
}

function measure(page, frames) {
  page.style.translate = ''
  page.style.scale = ''
  frames.forEach((el) => { el.style.translate = '' })
  const box = page.getBoundingClientRect()
  const sizes = frames.map((el) => {
    const rect = el.getBoundingClientRect()
    const lift = parseFloat(getComputedStyle(el).getPropertyValue('--frame-lift')) || 0
    return { x: rect.left - box.left, y: rect.top - box.top - lift, width: rect.width, height: rect.height + lift, lift }
  })
  const fit = fitFrames(sizes, { width: document.documentElement.clientWidth, height: window.innerHeight })
  return { box, sizes, fit, scrollY: window.scrollY }
}

function zoomOut(page, frames, { box, sizes, fit }) {
  page.style.translate = `${-box.left}px ${-box.top}px`
  page.style.scale = String(fit.scale)
  frames.forEach((el, i) => {
    const to = fit.frames[i]
    el.style.translate = `${to.x / fit.scale - sizes[i].x}px ${to.y / fit.scale - sizes[i].y}px`
  })
}

function zoomIn(page, frames) {
  page.style.translate = ''
  page.style.scale = ''
  frames.forEach((el) => { el.style.translate = '' })
}

const viewOf = ({ sizes, fit }, frames) => ({
  scale: fit.scale,
  frames: fit.frames.map((rect, i) => ({ ...rect, name: frames[i].dataset.frame, size: sizeLabel(sizes[i]) })),
})

function focusFrame(el) {
  if (!el.hasAttribute('tabindex')) {
    el.setAttribute('tabindex', '-1')
    el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true })
  }
  el.focus({ preventScroll: true })
}

export default function CanvasView() {
  const open = useSyncExternalStore(onCanvas, canvasOpen, () => false)
  const [view, setView] = useState(null)
  const live = useRef(null)
  const target = useRef(null)
  const buttons = useRef([])

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return
      if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault()
        setCanvas(!canvasOpen())
      } else if (canvasOpen() && (e.key === 'Escape' || (e.shiftKey && e.code === 'Digit0'))) {
        e.preventDefault()
        setCanvas(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const root = document.documentElement

    if (open) {
      const page = document.querySelector('main.canvas-page')
      const frames = page ? [...page.querySelectorAll(':scope > [data-frame]')] : []
      if (!frames.length) {
        setCanvas(false)
        return
      }
      const prior = live.current
      clearTimeout(prior?.timer)
      const maxScroll = prior ? prior.maxScroll : root.scrollHeight - window.innerHeight
      const header = document.getElementById('main-header')

      root.dataset.canvas = 'open'
      const measured = still([page, ...frames], () => measure(page, frames))
      zoomOut(page, frames, measured)

      const middle = window.innerHeight / 2
      const below = measured.sizes.findIndex((size) => measured.box.top + size.y + size.height > middle)
      page.inert = true
      if (header) header.inert = true
      target.current = null
      live.current = { page, frames, header, measured, maxScroll, focus: prior ? prior.focus : document.activeElement }
      setView({ ...viewOf(measured, frames), current: below === -1 ? frames.length - 1 : below, state: 'open' })
      return
    }

    const session = live.current
    if (!session || session.timer) return
    const { page, frames, header, measured } = session
    const index = target.current

    if (index !== null) {
      const el = frames[index]
      const offset =
        (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) + (parseFloat(getComputedStyle(el).scrollMarginTop) || 0)
      const { y: frameY, lift } = measured.sizes[index]
      const top = measured.box.top + measured.scrollY + frameY + lift - offset
      const y = index === 0 ? 0 : Math.min(session.maxScroll, Math.max(0, top))
      const dy = y - measured.scrollY
      if (dy) {
        still([page, ...frames], () => {
          window.scrollTo({ top: y, behavior: 'instant' })
          page.style.translate = `${-measured.box.left}px ${dy - measured.box.top}px`
        })
      }
    }

    root.dataset.canvas = 'closing'
    zoomIn(page, frames)
    setView((current) => current && { ...current, state: 'closing' })

    session.timer = setTimeout(() => {
      delete root.dataset.canvas
      page.inert = false
      if (header) header.inert = false
      live.current = null
      setView(null)
      if (index !== null) focusFrame(frames[index])
      else session.focus?.focus?.({ preventScroll: true })
    }, reducedMotion() ? 0 : ZOOM_MS)
  }, [open])

  useEffect(() => () => {
    const session = live.current
    if (session) {
      clearTimeout(session.timer)
      if (session.header) session.header.inert = false
    }
    delete document.documentElement.dataset.canvas
    live.current = null
    setCanvas(false)
  }, [])

  const state = view?.state
  const current = view?.current

  useEffect(() => {
    if (state !== 'open') return
    buttons.current[current]?.focus({ preventScroll: true })

    const onResize = () => {
      const session = live.current
      if (!session || session.timer) return
      const { page, frames } = session
      session.measured = still([page, ...frames], () => {
        const measured = measure(page, frames)
        zoomOut(page, frames, measured)
        return measured
      })
      setView((now) => now && { ...now, ...viewOf(session.measured, frames) })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [state, current])

  const pick = (index) => {
    target.current = index
    setCanvas(false)
  }

  const onKeyDown = (e) => {
    const count = view.frames.length
    const at = buttons.current.indexOf(document.activeElement)
    let next = null
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = count - 1
    else if (STEPS[e.key]) next = at === -1 ? (STEPS[e.key] > 0 ? 0 : count - 1) : (at + STEPS[e.key] + count) % count
    if (next === null) return
    e.preventDefault()
    buttons.current[next]?.focus()
  }

  return (
    <>
      <div aria-hidden="true" className="cv-backdrop" />
      {state === 'open' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Canvas overview. Pick a frame to zoom into it."
          className="cv"
          onClick={(e) => e.target === e.currentTarget && setCanvas(false)}
          onKeyDown={onKeyDown}
        >
          <div className="cv-hud">
            <span>{view.frames.length} frames</span>
            <span aria-hidden="true" className="cv-hud-sep" />
            <span className="cv-hud-zoom">{Math.round(view.scale * 100)}%</span>
            <span aria-hidden="true" className="cv-hud-sep" />
            <button type="button" className="cv-hud-button" onClick={() => setCanvas(false)}>
              Zoom to 100%
              <kbd>⇧0</kbd>
            </button>
          </div>

          {view.frames.map((frame, i) => (
            <button
              key={frame.name}
              ref={(el) => { buttons.current[i] = el }}
              type="button"
              className="cv-frame"
              data-current={i === current ? '' : undefined}
              aria-label={`${frame.name}, ${frame.size}${i === current ? ', where you were' : ''}`}
              style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
              onClick={() => pick(i)}
            >
              <FrameLabel className="cv-label">{frame.name}</FrameLabel>
              <span aria-hidden="true" className="fig-inspect-size">{frame.size}</span>
              <Handles />
            </button>
          ))}
        </div>
      )}
    </>
  )
}
