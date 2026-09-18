import { useState, useEffect, useRef, useCallback } from 'react'
import { Icon } from './icon'
import { link, navigate, HOME_PATH, LOGIN_PATH } from '../lib/router'
import { authSignOut } from '../lib/auth'
import { Sensitive } from './sensitive'
const PROVIDER_LABEL = { email: 'Email', google: 'Google', discord: 'Discord', apple: 'Apple', github: 'GitHub' }

const MENU = 'absolute z-50 w-[240px] rounded-xl border border-line bg-surface shadow-xl animate-menu-in'
const MENU_ITEM =
  'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-ink outline-none transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:bg-surface-hover'

const PLACE = {
  up: 'bottom-full left-0 mb-2 origin-bottom-left',
  right: 'bottom-0 left-full ml-2 origin-bottom-left',
  down: 'right-0 top-full mt-2 origin-top-right',
}

const closeThen = (close, path) => () => { close(); navigate(path) }

export function useDismiss(open, onClose) {
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

const SITE_ITEMS = [{ path: HOME_PATH, icon: 'arrowUpRight', label: 'View site' }]

export default function AccountMenu({ user, theme, onToggleTheme, placement = 'down', items = SITE_ITEMS, trigger }) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])
  const ref = useDismiss(open, close)

  const signOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    close()
    await authSignOut()
    navigate(LOGIN_PATH, { replace: true })
  }

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle })}

      {open && (
        <div role="menu" aria-label="Account" className={`${MENU} ${PLACE[placement]}`}>
          <div className="flex items-center gap-3 px-3 pb-3 pt-3">
            <Avatar user={user} size={36} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-strong">
                <span className="truncate">{user.name}</span>
                <span className="shrink-0 rounded-md border border-line-strong px-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  {PROVIDER_LABEL[user.provider] || user.provider}
                </span>
              </p>
              <Sensitive as="p" className="truncate text-[12px] text-ink-muted">{user.email}</Sensitive>
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
            {items.map((item) => (
              <a key={item.path} role="menuitem" {...link(item.path, closeThen(close, item.path))} className={MENU_ITEM}>
                <Icon name={item.icon} className="h-4 w-4 text-ink-muted" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-ink-strong px-1.5 font-mono text-[10px] font-semibold leading-[15px] text-ink-inverse">{item.badge}</span>
                )}
              </a>
            ))}
            <button role="menuitem" type="button" onClick={signOut} disabled={signingOut} className={`${MENU_ITEM} disabled:opacity-50`}>
              <Icon name="logout" className="h-4 w-4 text-ink-muted" /> {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
