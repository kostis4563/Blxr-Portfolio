import { useState, useEffect, useRef, useId, useCallback } from 'react'
import { Icon } from './icon'
import { link, navigate, HOME_PATH, LOGIN_PATH } from '../lib/router'
import { authSignOut } from '../lib/auth'
import { CLAIM_PATH } from '../lib/guest'
import { Sensitive } from './sensitive'
const PROVIDER_LABEL = { email: 'Email', google: 'Google', discord: 'Discord', apple: 'Apple', github: 'GitHub', guest: 'Guest' }

export const MENU = 'absolute z-50 w-[240px] rounded-xl border border-line bg-surface shadow-xl animate-menu-in'
export const MENU_ITEM =
  'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-ink outline-none transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:bg-surface-hover'

const PANEL =
  'absolute z-50 flex w-[252px] max-h-[calc(100dvh-4.5rem)] flex-col overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface shadow-xl'

const PANEL_ITEM = `${MENU_ITEM} focus:bg-surface-hover focus:text-ink-strong`

const DANGER_ITEM =
  'group flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-ink outline-none transition-colors hover:bg-red-500/10 hover:text-red-500 focus:bg-red-500/10 focus:text-red-500 disabled:opacity-50'

const PLACE = {
  up: { at: 'bottom-full left-0 mb-2 origin-bottom-left', in: 'animate-menu-up-in' },
  right: { at: 'bottom-0 left-full ml-2 origin-bottom-left', in: 'animate-menu-right-in' },
  down: { at: 'right-0 top-full mt-2 origin-top-right', in: 'animate-menu-in' },
}

const ITEM_SELECTOR = '[role="menuitem"]:not(:disabled),[role="menuitemradio"]:not(:disabled)'
const CLOSE_MS = 120
const TYPEAHEAD_MS = 600

const THEMES = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
]

const closeThen = (close, path) => () => { close(); navigate(path) }

export function useDismiss(open, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const inPortal = (el) => Boolean(el?.closest?.('[data-menu-portal]'))
    const onDown = (e) => { if (!ref.current?.contains(e.target) && !inPortal(e.target)) onClose('outside') }
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('[data-menu-portal]')) onClose('escape') }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  return ref
}

function usePresence(open) {
  const [state, setState] = useState('closed')
  useEffect(() => {
    if (open) {
      setState('open')
      return undefined
    }
    setState((s) => (s === 'closed' ? 'closed' : 'closing'))
    const done = setTimeout(() => setState('closed'), CLOSE_MS)
    return () => clearTimeout(done)
  }, [open])
  return state
}

export function Avatar({ user, size }) {
  const [broken, setBroken] = useState(false)
  const px = `${size}px`
  if (user.avatar && !broken) {
    return (
      <img
        src={user.avatar}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        style={{ width: px, height: px }}
        className="shrink-0 rounded-full object-cover"
      />
    )
  }
  if (user.guest) {
    return (
      <span
        aria-hidden="true"
        style={{ width: px, height: px, fontSize: `${Math.round(size * 0.42)}px` }}
        className="grid shrink-0 place-items-center rounded-full border border-dashed border-line-strong font-semibold text-ink-subtle"
      >
        ?
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: px, height: px, fontSize: `${Math.round(size * 0.42)}px` }}
      className="grid shrink-0 place-items-center rounded-full bg-surface-inverted font-semibold uppercase text-ink-on-inverted"
    >
      {user.name.trim().charAt(0) || '?'}
    </span>
  )
}

function CopyEmail({ email }) {
  const [done, setDone] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email)
    } catch {
      return
    }
    setDone(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setDone(false), 1400)
  }

  return (
    <button
      role="menuitem"
      type="button"
      onClick={copy}
      aria-label={done ? 'Email copied' : 'Copy email address'}
      className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-subtle opacity-0 outline-none transition-[opacity,color,background-color] duration-150 hover:bg-surface-hover hover:text-ink-strong focus:opacity-100 group-hover:opacity-100"
    >
      <Icon name={done ? 'check' : 'copy'} className="h-3.5 w-3.5" />
    </button>
  )
}

function ThemeSwitch({ preference, onSelect }) {
  return (
    <div role="group" aria-label="Theme" className="flex gap-0.5 rounded-lg border border-line bg-surface-raised/60 p-0.5">
      {THEMES.map((t) => {
        const on = preference === t.value
        return (
          <button
            key={t.value}
            role="menuitemradio"
            aria-checked={on}
            type="button"
            onClick={() => onSelect(t.value)}
            className={`flex h-7 flex-1 cursor-pointer items-center justify-center gap-1 rounded-md text-[11.5px] font-medium outline-none transition-colors duration-150 focus:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/30 ${
              on ? 'bg-surface text-ink-strong shadow-sm ring-1 ring-line' : 'text-ink-muted hover:text-ink-strong'
            }`}
          >
            <Icon name={t.icon} className="h-3.5 w-3.5" />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

const SITE_ITEMS = [{ path: HOME_PATH, icon: 'arrowUpRight', label: 'View site' }]
const CLAIM_ITEM = { path: CLAIM_PATH, icon: 'key', label: 'Keep my work' }

export default function AccountMenu({
  user,
  theme,
  onToggleTheme,
  themePreference,
  onSetTheme,
  placement = 'down',
  items = SITE_ITEMS,
  trigger,
}) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [landOn, setLandOn] = useState(null)
  const [cycle, setCycle] = useState(0)
  const panelRef = useRef(null)
  const typed = useRef({ text: '', at: 0 })
  const menuId = useId()
  const state = usePresence(open)

  const focusTrigger = useCallback(() => {
    const root = panelRef.current?.closest('[data-account-menu]') || null
    root?.querySelector('[aria-haspopup="menu"]')?.focus()
  }, [])

  const close = useCallback((reason) => {
    if (reason === 'escape') focusTrigger()
    setOpen(false)
  }, [focusTrigger])

  const show = useCallback((landing = null) => {
    setCycle((c) => c + 1)
    setLandOn(landing)
    setOpen(true)
  }, [])

  const toggle = useCallback(() => {
    if (open) setOpen(false)
    else show()
  }, [open, show])

  const ref = useDismiss(open, close)

  const itemsOf = useCallback(() => Array.from(panelRef.current?.querySelectorAll(ITEM_SELECTOR) || []), [])

  useEffect(() => { setOpen(false) }, [placement])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      const list = itemsOf()
      if (!list.length) return
      const at = list.indexOf(document.activeElement)
      const go = (i) => { e.preventDefault(); list[(i + list.length) % list.length].focus() }
      if (e.key === 'ArrowDown') go(at + 1)
      else if (e.key === 'ArrowUp') go(at < 0 ? -1 : at - 1)
      else if (e.key === 'Home') go(0)
      else if (e.key === 'End') go(-1)
      else if (e.key === 'Tab') setOpen(false)
      else if (e.key.length === 1 && e.key !== ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const now = Date.now()
        typed.current.text = now - typed.current.at > TYPEAHEAD_MS ? e.key : typed.current.text + e.key
        typed.current.at = now
        const q = typed.current.text.toLowerCase()
        const hit = list.find((el) => el.textContent.trim().toLowerCase().startsWith(q))
        if (hit) { e.preventDefault(); hit.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      typed.current = { text: '', at: 0 }
    }
  }, [open, itemsOf])

  useEffect(() => {
    if (!open || !landOn) return
    const list = itemsOf()
    ;(landOn === 'last' ? list[list.length - 1] : list[0])?.focus()
    setLandOn(null)
  }, [open, landOn, itemsOf])

  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse') return
    const item = e.target.closest?.(ITEM_SELECTOR)
    if (item && item !== document.activeElement) item.focus()
  }

  const onTriggerKeyDown = (e) => {
    if (open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
    e.preventDefault()
    show(e.key === 'ArrowUp' ? 'last' : 'first')
  }

  const signOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    setOpen(false)
    await authSignOut()
    navigate(LOGIN_PATH, { replace: true })
  }

  const place = PLACE[placement]
  const closing = state === 'closing'
  const provider = PROVIDER_LABEL[user.provider] || user.provider
  const themed = Boolean(onSetTheme)

  return (
    <div ref={ref} data-account-menu className="relative">
      {trigger({ open, toggle, onKeyDown: onTriggerKeyDown, controls: open ? menuId : undefined })}

      {state !== 'closed' && (
        <div
          key={cycle}
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label="Account"
          inert={closing}
          onPointerMove={onPointerMove}
          className={`${PANEL} ${place.at} ${closing ? 'pointer-events-none animate-menu-out' : place.in}`}
        >
          <div className="group flex items-center gap-3 border-b border-line bg-surface-raised/40 py-3 pl-3 pr-2">
            <Avatar user={user} size={36} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-strong">
                <span className="truncate" title={user.name}>{user.name}</span>
                <span className="shrink-0 rounded-md border border-line-strong px-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  {provider}
                </span>
              </p>
              {user.guest ? (
                <p className="truncate text-[12px] text-ink-muted">Nothing saved to a name yet</p>
              ) : (
                <Sensitive as="p" className="truncate text-[12px] text-ink-muted">{user.email}</Sensitive>
              )}
            </div>
            {!user.guest && user.email && <CopyEmail email={user.email} />}
          </div>

          <div className="border-b border-line p-1.5">
            {themed ? (
              <ThemeSwitch preference={themePreference} onSelect={onSetTheme} />
            ) : (
              <button role="menuitem" type="button" onClick={onToggleTheme} className={PANEL_ITEM}>
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4 text-ink-muted" />
                <span className="flex-1 text-left">Theme</span>
                <span className="text-[12px] text-ink-subtle">{theme === 'dark' ? 'Dark' : 'Light'}</span>
              </button>
            )}
          </div>

          <div className="p-1.5">
            {(user.guest ? [CLAIM_ITEM, ...items] : items).map((item) => (
              <a key={item.path} role="menuitem" {...link(item.path, closeThen(() => setOpen(false), item.path))} className={PANEL_ITEM}>
                <Icon name={item.icon} className="h-4 w-4 text-ink-muted" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-ink-strong px-1.5 font-mono text-[10px] font-semibold leading-[15px] text-ink-inverse">{item.badge}</span>
                )}
              </a>
            ))}
          </div>

          <div className="border-t border-line p-1.5">
            <button
              role="menuitem"
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className={DANGER_ITEM}
            >
              <Icon name="logout" className="h-4 w-4 text-ink-muted transition-colors group-hover:text-red-500 group-focus:text-red-500" />
              {signingOut ? 'Leaving…' : user.guest ? 'Leave guest session' : 'Sign out'}
            </button>
            {user.guest && <p className="px-2.5 pb-1 pt-0.5 text-[11px] leading-snug text-ink-faint">Leaving ends the session; the guest board goes with it.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
