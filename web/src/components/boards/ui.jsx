import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../dashboard-sidebar'
import { shade, initials, ago } from '../../lib/boards'
import { signedUrl } from '../../lib/boards-api'

const BTN =
  'inline-flex h-8 shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-medium outline-none transition-[background-color,border-color,color,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-ink-strong/25 disabled:cursor-not-allowed disabled:opacity-45'
export const BTN_SOLID = `${BTN} bg-ink-strong text-ink-inverse hover:opacity-90`
export const BTN_QUIET = `${BTN} border border-line bg-surface text-ink-secondary hover:border-line-strong hover:text-ink-strong`
export const BTN_BARE = `${BTN} text-ink-subtle hover:text-ink-strong`
export const BTN_RISK = `${BTN} border border-line text-red-500 hover:border-red-500/40`

export const INPUT =
  'h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-ink-strong placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-line-strong focus:outline-none disabled:cursor-not-allowed disabled:opacity-60'
export const TEXTAREA = INPUT.replace('h-8 ', 'min-h-[80px] resize-y py-2 leading-relaxed ')

export const CAPS = 'text-[10.5px] font-mono font-semibold uppercase tracking-wider text-ink-subtle'
export const CARD = 'rounded-xl border border-line bg-surface'

export function Tag({ children, tone = 'neutral', title }) {
  const tones = {
    neutral: 'border-line text-ink-subtle',
    strong: 'border-line-strong text-ink-strong',
    red: 'border-red-500/40 text-red-500',
    amber: 'border-amber-500/40 text-amber-500',
  }
  return (
    <span title={title} className={`inline-flex shrink-0 items-center gap-1 rounded border px-1 py-px text-[9.5px] font-medium uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Dot({ colour, className = 'h-2 w-2' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ring-1 ring-inset ring-black/10 ${className}`}
      style={{ background: shade(colour).swatch }}
    />
  )
}

export function Chip({ active, onClick, children, title, disabled }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        active ? 'border-line-strong bg-surface-raised text-ink-strong' : 'border-line text-ink-subtle hover:border-line-strong hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function StoredImage({ path, alt = '', className = '', focus, draggable = false, onLoad }) {
  const [state, setState] = useState({ path: null, url: null, failed: false })
  const [shown, setShown] = useState(false)

  useEffect(() => {
    let live = true
    setShown(false)
    if (!path) {
      setState({ path: null, url: null, failed: true })
      return undefined
    }
    signedUrl(path).then((next) => {
      if (live) setState({ path, url: next, failed: !next })
    })
    return () => {
      live = false
    }
  }, [path])

  const ready = state.path === path && state.url
  if (!ready) {
    const idle = state.path === path && state.failed
    return <span className={`block bg-surface-raised ${idle ? '' : 'animate-pulse'} ${className}`} aria-hidden="true" />
  }
  return (
    <img
      src={state.url}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={draggable}
      onLoad={(event) => {
        setShown(true)
        onLoad?.(event)
      }}
      onError={() => setState((held) => ({ ...held, url: null, failed: true }))}
      style={focus ? { objectPosition: `${focus.x}% ${focus.y}%` } : undefined}
      className={`transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  )
}

const MARK_SIZE = { sm: 'h-5 w-5 text-[9.5px]', md: 'h-7 w-7 text-[11px]', lg: 'h-8 w-8 text-[12px]' }

export function BoardMark({ board, size = 'md' }) {
  const box = `${MARK_SIZE[size]} shrink-0 overflow-hidden rounded-md ring-1 ring-inset ring-line`
  if (board.art?.logo?.path) {
    return <StoredImage path={board.art.logo.path} alt="" className={`${box} object-cover`} focus={board.art.logo.focus} />
  }
  return (
    <span className={`${box} grid place-items-center font-semibold text-white ${shade(board.colour).dot}`} aria-hidden="true">
      {initials(board.name)}
    </span>
  )
}

export function BoardBanner({ board, className = 'h-32' }) {
  if (!board.art?.banner?.path) {
    return <span className={`block w-full rounded-xl border border-line bg-gradient-to-b ${shade(board.colour).wash} ${className}`} aria-hidden="true" />
  }
  return (
    <span className={`block w-full overflow-hidden rounded-xl ${className}`}>
      <StoredImage path={board.art.banner.path} alt="" focus={board.art.banner.focus} className="h-full w-full object-cover" />
    </span>
  )
}

export function Progress({ done, total }) {
  const share = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <span
      role="progressbar"
      aria-valuenow={share}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${done} of ${total} done`}
      className="block h-1 w-full overflow-hidden rounded-full bg-surface-raised"
    >
      <span className="block h-full rounded-full bg-ink-strong/60 transition-[width] duration-500 ease-out" style={{ width: `${share}%` }} />
    </span>
  )
}

export function Swatch({ colour, active, onPick, disabled, size = 'h-6 w-6' }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={colour}
      aria-pressed={active}
      onClick={() => onPick(colour)}
      style={{ background: shade(colour).swatch }}
      className={`${size} cursor-pointer rounded-full ring-1 ring-inset ring-black/10 transition-shadow disabled:cursor-not-allowed disabled:opacity-45 ${
        active ? 'ring-2 ring-ink-strong ring-offset-2 ring-offset-surface' : ''
      }`}
    />
  )
}

export function SaveMark({ state, at, now = Date.now() }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
        <Icon name="refresh" className="h-3 w-3 animate-spin" />
        Saving
      </span>
    )
  }
  if (state === 'saved' && at) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-faint" title={new Date(at).toLocaleString()}>
        <Icon name="check" className="h-3 w-3" />
        Saved {ago(at, now)}
      </span>
    )
  }
  return null
}

export function UndoBar({ what, onUndo, onClose, seconds = 10, busy }) {
  const [left, setLeft] = useState(seconds)

  useEffect(() => {
    setLeft(seconds)
    const timer = setInterval(() => {
      setLeft((held) => {
        if (held <= 1) {
          clearInterval(timer)
          onClose()
          return 0
        }
        return held - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [what, seconds, onClose])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[65] flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-[12.5px] text-ink-secondary shadow-xl animate-menu-in">
        <span className="max-w-[240px] truncate">{what}</span>
        <button type="button" disabled={busy} onClick={onUndo} className="cursor-pointer font-medium text-ink-strong underline-offset-2 hover:underline disabled:opacity-50">
          Undo
        </button>
        <span className="font-mono text-[11px] tabular-nums text-ink-faint">{left}s</span>
        <button type="button" aria-label="Dismiss" onClick={onClose} className="cursor-pointer text-ink-faint hover:text-ink-strong">
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>,
    document.body,
  )
}

export function Menu({ trigger, children, align = 'end', width = 'w-56', label }) {
  const [open, setOpen] = useState(false)
  const [spot, setSpot] = useState(null)
  const anchor = useRef(null)
  const panel = useRef(null)

  const place = useCallback(() => {
    const box = anchor.current?.getBoundingClientRect()
    if (!box) return
    setSpot({ top: box.bottom + 6, left: box.left, right: window.innerWidth - box.right })
  }, [])

  useLayoutEffect(() => {
    if (!open) return undefined
    place()
    const close = (event) => {
      if (panel.current?.contains(event.target) || anchor.current?.contains(event.target)) return
      setOpen(false)
    }
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  return (
    <>
      <span ref={anchor} className="inline-flex">
        {trigger({ open, toggle: () => setOpen((held) => !held), label })}
      </span>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panel}
          role="menu"
          aria-label={label}
          style={spot ? { top: spot.top, ...(align === 'end' ? { right: spot.right } : { left: spot.left }) } : undefined}
          className={`fixed z-[70] ${width} max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-2xl animate-menu-in`}
          onClick={(event) => {
            if (event.target.closest('[data-keep-open]')) return
            setOpen(false)
          }}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  )
}

export function MenuItem({ icon, children, onClick, tone = 'default', disabled, checked, keepOpen }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      data-keep-open={keepOpen || undefined}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === 'danger' ? 'text-red-500 hover:bg-surface-hover' : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-strong'
      }`}
    >
      {icon && <Icon name={icon} className="h-3.5 w-3.5 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {checked && <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-ink-strong" />}
    </button>
  )
}

export const MenuLabel = ({ children }) => <p className={`px-2 pb-1 pt-2 ${CAPS}`}>{children}</p>

export const MenuLine = () => <span className="my-1 block h-px bg-line" />

export function PointerMenu({ at, onClose, children, width = 'w-56' }) {
  const panel = useRef(null)
  const [spot, setSpot] = useState(at)

  useLayoutEffect(() => {
    const box = panel.current?.getBoundingClientRect()
    if (!box) return
    setSpot({
      x: Math.min(at.x, window.innerWidth - box.width - 8),
      y: Math.min(at.y, window.innerHeight - box.height - 8),
    })
  }, [at])

  useEffect(() => {
    const close = (event) => {
      if (!panel.current?.contains(event.target)) onClose()
    }
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={panel}
      role="menu"
      style={{ top: spot.y, left: spot.x }}
      onClick={(event) => {
        if (!event.target.closest('[data-keep-open]')) onClose()
      }}
      className={`fixed z-[70] ${width} rounded-xl border border-line bg-surface p-1 shadow-2xl animate-menu-in`}
    >
      {children}
    </div>,
    document.body,
  )
}

export function Sheet({ title, subtitle, onClose, children, footer, size = 'md', head, busy }) {
  const panel = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const prev = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) {
        if (document.querySelector('[data-nested-open]')) return
        onClose()
      }
      if (event.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [onClose, busy])

  const widths = { sm: 'max-w-[440px]', md: 'max-w-[620px]', lg: 'max-w-[860px]' }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Close" onClick={busy ? undefined : onClose} className="absolute inset-0 cursor-default bg-black/60 animate-overlay-in" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl animate-panel-in sm:max-h-[88dvh] sm:rounded-2xl ${widths[size]}`}
      >
        {head}
        <header className="flex items-start gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold leading-tight tracking-tight text-ink-strong">{title}</h2>
            {subtitle && <div className="mt-1 text-[12px] leading-relaxed text-ink-muted">{subtitle}</div>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="-mr-1 -mt-1 cursor-pointer rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink-strong">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-raised/40 px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function Note({ tone = 'info', icon, children, onDismiss }) {
  const tones = {
    info: 'border-line bg-surface-raised/50 text-ink-muted',
    error: 'border-red-500/30 bg-red-500/[0.06] text-red-500',
    warn: 'border-line bg-surface-raised/50 text-ink-muted',
  }
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed ${tones[tone]}`}>
      <Icon name={icon || (tone === 'info' ? 'info' : 'alert')} className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'error' ? '' : 'text-ink-subtle'}`} />
      <span className="min-w-0 flex-1">{children}</span>
      {onDismiss && (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="cursor-pointer opacity-70 hover:opacity-100">
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export function Empty({ icon = 'kanban', title, body, action }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-line bg-surface px-6 py-12 text-center">
      <Icon name={icon} className="mb-3 h-5 w-5 text-ink-faint" />
      <p className="text-[13px] font-semibold tracking-tight text-ink-strong">{title}</p>
      {body && <p className="mt-1 max-w-[380px] text-[12.5px] leading-relaxed text-ink-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SearchField({ value, onChange, placeholder = 'Search', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Icon name="search" className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${INPUT} h-7 pl-7 ${value ? 'pr-7' : ''} [&::-webkit-search-cancel-button]:hidden`}
      />
      {value && (
        <button type="button" aria-label="Clear" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-ink-faint hover:text-ink-strong">
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export function InlineEdit({ value, onSave, className = '', maxLength, placeholder, ariaLabel }) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  const field = useRef(null)

  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (editing) field.current?.select()
  }, [editing])

  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (next && next !== value) onSave(next)
    else setDraft(value)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={ariaLabel}
        className={`min-w-0 cursor-text truncate rounded px-1 -mx-1 text-left transition-colors hover:bg-surface-hover ${className}`}
      >
        {value || <span className="text-ink-faint">{placeholder}</span>}
      </button>
    )
  }
  return (
    <input
      ref={field}
      value={draft}
      maxLength={maxLength}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        }
        if (event.key === 'Escape') {
          setDraft(value)
          setEditing(false)
        }
      }}
      className={`${INPUT} h-7 ${className}`}
    />
  )
}
