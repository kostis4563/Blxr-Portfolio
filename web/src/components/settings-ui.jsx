import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './dashboard-sidebar'
import { link, dashboardPath } from '../lib/router'

export const LABEL = 'text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-subtle'
export const INPUT =
  'h-9 w-full rounded-lg border border-line bg-surface-raised/60 px-3 text-[13.5px] text-ink-strong placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-line-strong focus:bg-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 read-only:cursor-default read-only:hover:border-line aria-[invalid=true]:border-red-500/60'
export const TEXTAREA = INPUT.replace('h-9 ', 'min-h-[92px] resize-y py-2 leading-relaxed ')

const BTN =
  'inline-flex h-8 shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium outline-none transition-[background-color,border-color,color,opacity,transform] duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ink-strong/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50'
export const BTN_PRIMARY = `${BTN} bg-ink-strong text-ink-inverse hover:opacity-90`
export const BTN_SECONDARY = `${BTN} border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-hover hover:text-ink-strong`
export const BTN_DANGER = `${BTN} border border-red-500/30 text-red-500 hover:bg-red-500/10`
export const BTN_GHOST = `${BTN} text-ink-muted hover:bg-surface-hover hover:text-ink-strong`

const DensityContext = createContext('comfortable')
export const DensityProvider = DensityContext.Provider
const useCompact = () => useContext(DensityContext) === 'compact'

export function Section({ title, description, children, footer, tone = 'default', id }) {
  const compact = useCompact()
  const ring = tone === 'danger' ? 'border-red-500/30' : 'border-line'
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`rounded-xl border bg-surface ${ring}`}>
      <header className={`border-b border-line px-5 ${compact ? 'py-3' : 'py-4'}`}>
        <h2 id={id ? `${id}-title` : undefined} className="text-[14px] font-semibold tracking-tight text-ink-strong">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">{description}</p>}
      </header>
      <div className="divide-y divide-line">{children}</div>
      {footer && (
        <footer className={`flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-line bg-surface-raised/40 px-5 ${compact ? 'py-2.5' : 'py-3'}`}>
          {footer}
        </footer>
      )}
    </section>
  )
}

export function Row({ label, description, htmlFor, children, wide = false, align = 'center' }) {
  const compact = useCompact()
  const pad = compact ? 'py-3' : 'py-4'
  const Tag = htmlFor ? 'label' : 'p'
  const head = (
    <div className="min-w-0">
      <Tag htmlFor={htmlFor} className="block text-[13.5px] font-medium text-ink-strong">
        {label}
      </Tag>
      {description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">{description}</p>}
    </div>
  )
  if (wide) {
    return (
      <div className={`flex flex-col gap-3 px-5 ${pad}`}>
        {head}
        {children}
      </div>
    )
  }
  return (
    <div className={`flex flex-col gap-3 px-5 sm:flex-row sm:justify-between sm:gap-8 ${align === 'start' ? 'sm:items-start' : 'sm:items-center'} ${pad}`}>
      {head}
      <div className="flex shrink-0 items-center gap-2 sm:max-w-[360px]">{children}</div>
    </div>
  )
}

export function Field({ label, hint, error, htmlFor, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex min-h-4 items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className={LABEL}>{label}</label>
        {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
      </div>
      {children}
      {error && <p role="alert" className="text-[12px] text-red-500">{error}</p>}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }) {
  const look =
    tone === 'ok' ? 'border-emerald-500/40 text-emerald-500'
    : tone === 'warn' ? 'border-amber-500/40 text-amber-500'
    : 'border-line-strong text-ink-muted'
  return (
    <span className={`inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-[10.5px] font-medium uppercase tracking-wide animate-menu-in ${look}`}>
      {children}
    </span>
  )
}

export function ErrorNote({ children }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[12.5px] text-red-500">
      {children}
    </p>
  )
}

export function InfoNote({ children, icon = 'info' }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-line bg-surface-raised/50 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Toggle({ checked, onChange, disabled, label, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full outline-none transition-colors duration-200 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ink-strong/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-ink-strong' : 'bg-surface-hover-strong'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-4 w-4 rounded-full shadow-sm transition-[transform,background-color] duration-250 ease-[cubic-bezier(0.34,1.4,0.64,1)] group-active:scale-90 ${checked ? 'translate-x-[18px] bg-bg' : 'translate-x-0.5 bg-white'}`}
      />
    </button>
  )
}

export function Segmented({ value, onChange, options, label, size = 'sm' }) {
  const h = size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]'
  const ref = useRef(null)
  const [thumb, setThumb] = useState(null)

  const measure = useCallback(() => {
    const el = ref.current?.querySelector('[aria-checked="true"]')
    if (!el) return setThumb(null)
    setThumb({ left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight, top: el.offsetTop })
  }, [])
  useLayoutEffect(measure, [measure, value, options.length])

  return (
    <div ref={ref} role="radiogroup" aria-label={label} className="relative inline-flex rounded-lg border border-line bg-surface-raised/60 p-0.5">
      {thumb && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-md bg-surface shadow-sm ring-1 ring-line transition-[left,width] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={thumb}
        />
      )}
      {options.map((opt) => {
        const on = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`relative z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-md font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ink-strong/30 disabled:cursor-not-allowed disabled:opacity-50 ${h} ${
              on ? 'text-ink-strong' : 'text-ink-muted hover:text-ink-strong'
            }`}
          >
            {opt.icon && <Icon name={opt.icon} className="h-3.5 w-3.5" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function TabStrip({ tabs, value, onChange, label }) {
  const listRef = useRef(null)
  const [bar, setBar] = useState(null)

  const measure = useCallback(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]')
    if (!el) return setBar(null)
    setBar({ left: el.offsetLeft, width: el.offsetWidth })
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [])
  useLayoutEffect(measure, [measure, value])
  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const onKeyDown = (e) => {
    const i = tabs.findIndex((t) => t.id === value)
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
      onChange(next.id)
      listRef.current?.querySelector(`[data-tab="${next.id}"]`)?.focus()
    }
  }

  return (
    <div className="-mx-4 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <div ref={listRef} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="relative flex w-max gap-1">
        {tabs.map((tab) => {
          const on = tab.id === value
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-tab={tab.id}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-[13px] outline-none transition-colors duration-200 focus-visible:text-ink-strong ${on ? 'font-medium text-ink-strong' : 'text-ink-muted hover:text-ink-strong'}`}
            >
              {tab.label}
              {tab.badge ? <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-label="needs attention" /> : null}
            </button>
          )
        })}
        {bar && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-px h-0.5 rounded-full bg-ink-strong transition-[left,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ left: bar.left, width: bar.width }}
          />
        )}
      </div>
    </div>
  )
}

export function SubTabs({ item, label, badges }) {
  const parent = item.parent
  const listRef = useRef(null)
  const [bar, setBar] = useState(null)

  const measure = useCallback(() => {
    const list = listRef.current
    const el = list?.querySelector('[aria-current="page"]')
    if (!el) return setBar(null)
    setBar({ left: el.offsetLeft, width: el.offsetWidth })
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [])

  useLayoutEffect(measure, [measure, item.id])
  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <ul ref={listRef} className="relative flex w-max gap-1">
        {parent.children.map((tab) => {
          const on = tab.id === item.id
          return (
            <li key={tab.id}>
              <a
                {...link(dashboardPath(`${parent.id}/${tab.id}`))}
                aria-current={on ? 'page' : undefined}
                className={`block rounded-md px-3 py-2.5 text-[13px] whitespace-nowrap outline-none transition-colors duration-200 focus-visible:text-ink-strong ${on ? 'font-medium text-ink-strong' : 'text-ink-muted hover:text-ink-strong'}`}
              >
                {tab.label}
                {badges?.[tab.id] > 0 && <span className="ms-1.5 font-mono text-[10px] text-amber-500 tabular-nums">{badges[tab.id]}</span>}
              </a>
            </li>
          )
        })}
        {bar && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-px h-0.5 rounded-full bg-ink-strong transition-[left,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ left: bar.left, width: bar.width }}
          />
        )}
      </ul>
    </nav>
  )
}

export function Select({ value, onChange, children, id, disabled, className = '', ariaLabel }) {
  return (
    <span className={`relative block ${className}`}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT} cursor-pointer appearance-none pr-8`}
      >
        {children}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
    </span>
  )
}

export function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch {
    }
  }
  return (
    <button type="button" onClick={copy} className={`${BTN_GHOST} h-7 px-2 text-[12px]`} aria-live="polite">
      <Icon name={done ? 'check' : 'copy'} className="h-3.5 w-3.5" />
      {done ? 'Copied' : label}
    </button>
  )
}

export function Modal({ open, title, description, onClose, children, footer, tone = 'default', busy = false, size = 'default' }) {
  const panel = useRef(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const first = panel.current?.querySelector('[data-autofocus]') || panel.current?.querySelector('input, button:not([data-close])')
    first?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose()
      if (e.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')]
      if (!items.length) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [open, onClose, busy])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close"
        data-close
        onClick={busy ? undefined : onClose}
        className="absolute inset-0 cursor-default bg-black/50 animate-overlay-in"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        className={`relative flex w-full max-h-[calc(100dvh-2rem)] flex-col rounded-2xl border bg-surface shadow-2xl animate-panel-in ${size === 'wide' ? 'max-w-[840px]' : 'max-w-[440px]'} ${tone === 'danger' ? 'border-red-500/30' : 'border-line'}`}
      >
        <div className="px-5 pt-5">
          <h2 id={titleId} className="text-[15px] font-semibold tracking-tight text-ink-strong">{title}</h2>
          {description && <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>}
        </div>
        {children && <div className="min-h-0 overflow-y-auto px-5 pt-4">{children}</div>}
        <div className="flex flex-wrap items-center justify-end gap-2 px-5 pb-5 pt-5">{footer}</div>
      </div>
    </div>,
    document.body,
  )
}

const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(0)

  const show = useCallback((message, tone = 'ok') => {
    clearTimeout(timer.current)
    setToast({ message, tone, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), tone === 'error' ? 4000 : 1800)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {typeof document !== 'undefined' && createPortal(
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
        {toast && (
          <div
            key={toast.key}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] shadow-xl animate-menu-in ${
              toast.tone === 'error' ? 'border border-red-500/30 bg-surface text-red-500' : 'bg-ink-strong text-ink-inverse'
            }`}
          >
            <Icon name={toast.tone === 'error' ? 'alert' : 'check'} className="h-3.5 w-3.5" />
            {toast.message}
          </div>
        )}
      </div>,
      document.body,
      )}
    </ToastContext.Provider>
  )
}
