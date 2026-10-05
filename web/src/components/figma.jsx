import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { imageProps, SIZES } from '../lib/images'
import {
  currentToast,
  dismissToast,
  editedAgo,
  follow,
  layoutGridOn,
  onLayoutGrid,
  onToast,
  toast,
  toggleLayoutGrid,
} from '../lib/figma'
import { Icon } from './icon'

const CORNERS = ['tl', 'tr', 'br', 'bl']
const BUILT_AT = typeof __BUILT_AT__ === 'string' ? __BUILT_AT__ : null

export const isTyping = (el) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
export const finePointer =() => Boolean(window.matchMedia?.('(pointer: fine)').matches)

export function Handles({ className = 'fig-handle' }) {
  return CORNERS.map((corner, i) => (
    <span key={corner} className={className} data-corner={corner} style={{ '--i': i }} />
  ))
}

export function CursorMark({ name, arrowClassName = '' }) {
  return (
    <>
      <svg viewBox="0 0 16 16" className={arrowClassName ? `fig-arrow ${arrowClassName}` : 'fig-arrow'}>
        <path d="M2.5 1.5v12l3.6-3.2 5.9-.4z" />
      </svg>
      <span className="fig-tag">{name}</span>
    </>
  )
}

export function Facepile({ name }) {
  const [following, setFollowing] = useState(null)

  useEffect(() => {
    if (!following) return
    const timer = setTimeout(() => setFollowing(null), 2600)
    return () => clearTimeout(timer)
  }, [following])

  return (
    <>
      <div className="fig-facepile hidden md:flex" role="group" aria-label="On this page">
        <button
          type="button"
          className="fig-face"
          data-tip={name}
          aria-label={`Follow ${name}`}
          onClick={() => {
            if (follow('kostis')) setFollowing(Date.now())
          }}
        >
          <img {...imageProps('/pfp.webp', SIZES.avatar)} alt="" width="24" height="24" draggable={false} />
        </button>
        <span className="fig-face" data-tip="You · press / to comment" role="img" aria-label="You">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="9.5" r="3.5" />
            <path d="M5.5 19.5c1.3-3 3.7-4.5 6.5-4.5s5.2 1.5 6.5 4.5" />
          </svg>
        </span>
      </div>
      {following &&
        createPortal(
          <span key={following} aria-hidden="true" className="fig-spotlight">
            <span className="fig-spotlight-tag">Following {name}</span>
          </span>,
          document.body
        )}
    </>
  )
}

export function CommentPin({ name, initial, text, time, className = '' }) {
  const [open, setOpen] = useState(false)
  const [read, setRead] = useState(false)
  const avatar = <span className="fig-avatar">{initial}</span>

  return (
    <span
      className={`fig-comment ${className}`}
      data-open={open ? '' : undefined}
      onPointerEnter={() => setRead(true)}
      onPointerLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="fig-comment-pin"
        aria-label={`${read ? 'Comment' : 'Unread comment'} from ${name}: ${text}`}
        aria-expanded={open}
        onClick={() => {
          setRead(true)
          setOpen((v) => !v)
        }}
        onFocus={() => setRead(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        {avatar}
        {!read && <span aria-hidden="true" className="fig-comment-dot" />}
      </button>
      <span aria-hidden="true" className="fig-comment-card">
        <span className="fig-comment-head">
          {avatar}
          <span className="fig-comment-name">{name}</span>
          <span className="fig-comment-time">{time}</span>
        </span>
        <span className="fig-comment-text">{text}</span>
      </span>
    </span>
  )
}

export function Inspect({ size, children }) {
  return (
    <span className="fig-inspect">
      {children}
      <span aria-hidden="true" className="fig-inspect-box">
        <span className="fig-inspect-size">{size}</span>
      </span>
    </span>
  )
}

export function FrameLabel({ children, className = '' }) {
  return (
    <span aria-hidden="true" className={`fig-frame-label ${className}`}>
      <svg viewBox="0 0 12 12">
        <path d="M4 1v10M8 1v10M1 4h10M1 8h10" />
      </svg>
      {children}
    </span>
  )
}

export function Toasts() {
  const current = useSyncExternalStore(onToast, currentToast, () => null)

  useEffect(() => {
    if (!current) return
    const timer = setTimeout(() => dismissToast(current.id), current.action ? 5000 : 1800)
    return () => clearTimeout(timer)
  }, [current])

  return (
    <div role="status" aria-live="polite" className="fig-toast-region">
      {current && (
        <span key={current.id} className="fig-toast" data-action={current.action ? '' : undefined}>
          {current.text}
          {current.hint && <kbd className="fig-toast-hint">{current.hint}</kbd>}
          {current.action && (
            <button
              type="button"
              className="fig-toast-action"
              onClick={() => {
                current.action.run()
                dismissToast(current.id)
              }}
            >
              {current.action.label}
            </button>
          )}
        </span>
      )}
    </div>
  )
}

export function CanvasLayer() {
  const grid = useSyncExternalStore(onLayoutGrid, layoutGridOn, () => false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return
      if (e.key === 'G' && e.shiftKey) {
        e.preventDefault()
        toggleLayoutGrid()
      }
    }
    const onCopy = () => toast('Copied to clipboard')
    window.addEventListener('keydown', onKey)
    document.addEventListener('copy', onCopy)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('copy', onCopy)
    }
  }, [])

  return (
    <>
      {grid && (
        <div aria-hidden="true" className="fig-grid">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ '--i': i }} />
          ))}
        </div>
      )}
    </>
  )
}

export function GridToggle({ className = '' }) {
  const on = useSyncExternalStore(onLayoutGrid, layoutGridOn, () => false)

  return (
    <button
      type="button"
      onClick={toggleLayoutGrid}
      aria-pressed={on}
      aria-label="Layout grid"
      title="Layout grid (Shift G)"
      className={className}
    >
      <Icon name="grid" className="h-3.5 w-3.5" />
      <kbd className="hidden font-sans text-[10px] text-ink-faint pointer-fine:inline">⇧G</kbd>
    </button>
  )
}

export function EditedAgo() {
  const [label, setLabel] = useState(null)

  useEffect(() => {
    if (!BUILT_AT) return
    const update = () => setLabel(editedAgo(BUILT_AT))
    update()
    const timer = setInterval(update, 60000)
    return () => clearInterval(timer)
  }, [])

  if (!label) return null
  return (
    <>
      <span aria-hidden="true" className="mx-2 text-ink-faint">·</span>
      <time dateTime={BUILT_AT} title={new Date(BUILT_AT).toLocaleString()}>
        {label}
      </time>
    </>
  )
}
