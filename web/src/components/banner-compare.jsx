import { useCallback, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { imageProps, SIZES } from '../lib/images'

const INITIAL = 50

const STEP = 2
const PAGE = 10

const clamp = (n) => Math.min(100, Math.max(0, n))

export default function BannerCompare({ className = '' }) {
  const { t } = useI18n()
  const [pos, setPos] = useState(INITIAL)
  const frameRef = useRef(null)
  const draggingRef = useRef(false)

  const posFromEvent = useCallback((e) => {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect || !rect.width) return null
    return clamp(((e.clientX - rect.left) / rect.width) * 100)
  }, [])

  const moveTo = useCallback((next) => {
    if (next === null)
      return
    const rounded = Math.round(next * 10) / 10
    setPos((current) => (current === rounded ? current : rounded))
  }, [])

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0)
      return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    draggingRef.current = true
    moveTo(posFromEvent(e))
  }, [moveTo, posFromEvent])

  const onPointerMove = useCallback((e) => {
    if (!draggingRef.current) return
    moveTo(posFromEvent(e))
  }, [moveTo, posFromEvent])

  const endDrag = useCallback((e) => {
    draggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {}
  }, [])

  const onKeyDown = useCallback((e) => {
    let next = null
    switch (e.key) {
      case 'ArrowLeft': next = pos - STEP; break
      case 'ArrowRight': next = pos + STEP; break
      case 'PageDown': next = pos - PAGE; break
      case 'PageUp': next = pos + PAGE; break
      case 'Home': next = 0; break
      case 'End': next = 100; break
      default: return
    }

    e.preventDefault()
    moveTo(clamp(next))
  }, [pos, moveTo])

  return (
    <div
      ref={frameRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`relative w-full aspect-[4/1] overflow-hidden rounded-xl bg-surface select-none cursor-ew-resize ${className}`}

      style={{ touchAction: 'pan-y' }}
    >
      {}
      <img
        {...imageProps('/banner-chrome.webp', SIZES.contentColumn)}
        alt=""
        width="1600"
        height="533"
        draggable={false}
        decoding="async"

        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      <img

        {...imageProps('/banner-crystal.webp', SIZES.contentColumn)}
        alt=""
        width="1600"
        height="565"
        draggable={false}
        decoding="async"
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />

      {}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 w-px -translate-x-1/2 bg-white/75 shadow-[0_0_6px_rgba(0,0,0,0.45)] pointer-events-none"
        style={{ left: `${pos}%` }}
      />

      {}
      <div
        role="slider"
        tabIndex={0}
        aria-label={t('a11y.bannerSlider')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${Math.round(pos)}%`}
        onKeyDown={onKeyDown}
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center w-6 h-6 rounded-full bg-black/25 backdrop-blur-[2px] border border-white/60 text-white cursor-ew-resize outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
        style={{ left: `${pos}%`, touchAction: 'none' }}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 8l-4 4 4 4M14 8l4 4-4 4" />
        </svg>
      </div>
    </div>
  )
}
