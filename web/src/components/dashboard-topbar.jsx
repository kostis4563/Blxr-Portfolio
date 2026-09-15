import { useState, useEffect, useRef, useCallback } from 'react'
import { Icon } from './dashboard-sidebar'
import { link, navigate, dashboardPath, HOME_PATH, LOGIN_PATH } from '../lib/router'
import { openPalette, isMacLike } from '../lib/palette'
import { NOTIFICATIONS } from '../lib/dashboard'
import { authSignOut } from '../lib/auth'

const ICON_BTN =
  'relative grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-ink-muted outline-none transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/30 aria-expanded:bg-surface-hover aria-expanded:text-ink-strong'
const MENU = 'absolute right-0 top-full z-40 mt-2 origin-top-right rounded-xl border border-line bg-surface shadow-xl animate-menu-in'
const MENU_ITEM =
  'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-ink outline-none transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:bg-surface-hover'
const CRUMB = 'truncate text-[13px] text-ink-muted transition-colors hover:text-ink-strong'

// link() hands navigation to its callback, so menu links close first, then go.
const closeThen = (close, path) => () => { close(); navigate(path) }

// Closes on outside pointer-down or Escape; the trigger owns the `open` state.
function useDismiss(open, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  return ref
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(NOTIFICATIONS)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const unread = items.filter((n) => n.unread).length

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={ICON_BTN}
      >
        <Icon name="bell" className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-ink-strong ring-2 ring-surface" />
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className={`${MENU} w-[340px] max-w-[calc(100vw-2rem)]`}>
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <p className="text-[13.5px] font-semibold text-ink-strong">Notifications</p>
            <button
              type="button"
              disabled={!unread}
              onClick={() => setItems((list) => list.map((n) => ({ ...n, unread: false })))}
              className="cursor-pointer text-[12px] text-ink-muted transition-colors hover:text-ink-strong disabled:cursor-default disabled:text-ink-faint"
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-[360px] overflow-y-auto border-t border-line">
            {items.map((n) => (
              <li key={n.id} className="flex gap-3 border-b border-line px-4 py-3 last:border-0">
                <span
                  aria-hidden="true"
                  className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${n.unread ? 'bg-ink-strong' : 'bg-transparent'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13px] ${n.unread ? 'font-medium text-ink-strong' : 'text-ink'}`}>{n.title}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">{n.body}</p>
                </div>
                <span className="shrink-0 text-[11.5px] text-ink-subtle">{n.time}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const PROVIDER_LABEL = { email: 'Email', google: 'Google', discord: 'Discord', apple: 'Apple', github: 'GitHub' }

// Provider picture when there is one, otherwise the first letter of the name.
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

function Account({ user, theme, onToggleTheme }) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)

  const signOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    close()
    await authSignOut()
    // The dashboard guard also redirects once the session is gone; this covers a failed sign-out.
    navigate(LOGIN_PATH, { replace: true })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 cursor-pointer items-center gap-2 rounded-lg pl-1 pr-1 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/30 aria-expanded:bg-surface-hover sm:pr-2"
      >
        <Avatar user={user} size={28} />
        <span className="hidden max-w-[140px] truncate text-[13.5px] font-medium text-ink-strong sm:block">{user.name}</span>
        <Icon name="chevronsUpDown" className="hidden h-3.5 w-3.5 text-ink-subtle sm:block" />
      </button>

      {open && (
        <div role="menu" aria-label="Account" className={`${MENU} w-[240px]`}>
          <div className="flex items-center gap-3 px-3 pb-3 pt-3">
            <Avatar user={user} size={36} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-strong">
                <span className="truncate">{user.name}</span>
                <span className="shrink-0 rounded-md border border-line-strong px-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  {PROVIDER_LABEL[user.provider] || user.provider}
                </span>
              </p>
              <p className="truncate text-[12px] text-ink-muted">{user.email}</p>
            </div>
          </div>
          <div className="border-t border-line p-1.5">
            <button role="menuitem" type="button" onClick={onToggleTheme} className={MENU_ITEM}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4 text-ink-muted" />
              <span className="flex-1 text-left">Theme</span>
              <span className="text-[12px] text-ink-subtle">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
          <div className="border-t border-line p-1.5">
            <a role="menuitem" {...link(HOME_PATH, closeThen(close, HOME_PATH))} className={MENU_ITEM}>
              <Icon name="arrowUpRight" className="h-4 w-4 text-ink-muted" /> View site
            </a>
            <button role="menuitem" type="button" onClick={signOut} disabled={signingOut} className={`${MENU_ITEM} disabled:opacity-50`}>
              <Icon name="logout" className="h-4 w-4 text-ink-muted" /> {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardTopbar({ item, user, theme, onToggleTheme, onOpenMobile }) {
  const [mac, setMac] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMac(isMacLike())
    setMounted(true)
  }, [])

  // Prerendered HTML is always dark; hydration keeps server attributes, so match it until mounted.
  const shownTheme = mounted ? theme : 'dark'
  const mod = mac ? '⌘' : 'Ctrl '
  const top = item.parent || item

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open menu"
          className={`${ICON_BTN} -ml-2 md:hidden`}
        >
          <Icon name="menu" className="h-[18px] w-[18px]" />
        </button>

        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5">
          <a {...link(dashboardPath())} className={`${CRUMB} hidden sm:block`}>Dashboard</a>
          <span aria-hidden="true" className="hidden text-ink-faint sm:block">/</span>
          {item.parent ? (
            <>
              <a {...link(dashboardPath(top.path))} className={CRUMB}>{top.label}</a>
              <span aria-hidden="true" className="text-ink-faint">/</span>
            </>
          ) : null}
          <span aria-current="page" className="truncate text-[13px] font-medium text-ink-strong">{item.label}</span>
        </nav>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openPalette}
            className="hidden h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-bg/60 pl-3 pr-2 text-[13px] text-ink-subtle outline-none transition-colors hover:border-line-strong hover:text-ink focus-visible:border-line-strong md:flex"
          >
            <Icon name="search" className="h-4 w-4" />
            <span className="w-28 text-left">Search</span>
            <kbd className="rounded-md border border-line px-1.5 py-0.5 font-sans text-[11px] text-ink-faint">{mod}K</kbd>
          </button>
          <button type="button" onClick={openPalette} aria-label="Search" className={`${ICON_BTN} md:hidden`}>
            <Icon name="search" className="h-[18px] w-[18px]" />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={shownTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className={`${ICON_BTN} hidden sm:grid`}
          >
            <Icon name={shownTheme === 'dark' ? 'sun' : 'moon'} className="h-[17px] w-[17px]" />
          </button>

          <Notifications />

          <div className="mx-1 hidden h-5 border-l border-line sm:block" aria-hidden="true" />

          <Account user={user} theme={shownTheme} onToggleTheme={onToggleTheme} />
        </div>
      </div>
    </header>
  )
}
