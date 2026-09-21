import { useState, useEffect, useCallback } from 'react'
import { Icon } from './icon'
import { Avatar, useDismiss, MENU, MENU_ITEM } from './account-menu'
import { Sensitive } from './sensitive'
import { useAuth, profileOf } from '../lib/supabase'
import { loginUrlFor, authSignOut } from '../lib/auth'
import { useUnread } from '../lib/messages-unread'
import { badgeOf } from '../lib/messages'
import { link, navigate, DASHBOARD_PATH, LOGIN_PATH, dashboardPath } from '../lib/router'
import { CLAIM_PATH } from '../lib/guest'
import { openPalette, isMacLike } from '../lib/palette'
import { DISCORD_URL, SOCIAL_ICON_PATHS } from '../lib/profile'

const MESSAGES_PATH = dashboardPath('messages')
const BADGE = 'rounded-full bg-ink-strong font-mono font-semibold leading-none text-ink-inverse'
const HINT = 'font-mono text-[10px] tracking-[0.04em] text-ink-subtle'

const closeThen = (close, fn) => () => { close(); fn() }
const go = (close, path) => link(path, closeThen(close, () => navigate(path)))

function Menu({ trigger, children }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])
  const ref = useDismiss(open, close)

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle })}
      {open && (
        <div role="menu" aria-label="More" className={`${MENU} right-0 top-full mt-2 origin-top-right`}>
          {children(close)}
        </div>
      )}
    </div>
  )
}

// The header's text links, shown here only while the bar is too narrow to hold them.
function PageItems({ pages, close }) {
  if (!pages.length) return null
  return (
    <div className="border-b border-line p-1.5 md:hidden">
      {pages.map(({ id, label, external, onClick, ...props }) => (
        <a
          key={id}
          role="menuitem"
          {...props}
          {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          onClick={(event) => { onClick?.(event); close() }}
          className={MENU_ITEM}
        >
          <span className="flex-1 text-left">{label}</span>
          {external && <Icon name="arrowUpRight" className="h-3.5 w-3.5 text-ink-faint" />}
        </a>
      ))}
    </div>
  )
}

function SiteItems({ close }) {
  const [mac, setMac] = useState(null)
  useEffect(() => { setMac(isMacLike()) }, [])

  return (
    <div className="border-b border-line p-1.5">
      <button role="menuitem" type="button" onClick={closeThen(close, openPalette)} className={MENU_ITEM}>
        <Icon name="search" className="h-4 w-4 text-ink-muted" />
        <span className="flex-1 text-left">Command palette</span>
        <kbd aria-hidden="true" className={HINT}>{mac === null ? '' : mac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <a role="menuitem" href={DISCORD_URL} target="_blank" rel="noreferrer" onClick={close} className={MENU_ITEM}>
        <svg className="h-4 w-4 text-ink-muted" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d={SOCIAL_ICON_PATHS.Discord} />
        </svg>
        <span className="flex-1 text-left">Discord</span>
        <Icon name="arrowUpRight" className="h-3.5 w-3.5 text-ink-faint" />
      </a>
    </div>
  )
}

function DotsButton({ className, open, toggle, label }) {
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="menu"
      className={`${className} cursor-pointer rounded-lg outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/30 aria-expanded:bg-surface-hover`}
    >
      <Icon name="dots" className="h-[16px] w-[16px]" strokeWidth={2.4} />
    </button>
  )
}

function SignedOut({ itemClass, pages }) {
  return (
    <Menu trigger={({ open, toggle }) => <DotsButton className={itemClass} open={open} toggle={toggle} label="More" />}>
      {(close) => (
        <>
          <PageItems pages={pages} close={close} />
          <SiteItems close={close} />
          <div className="p-1.5">
            <a role="menuitem" {...go(close, loginUrlFor(DASHBOARD_PATH))} className={MENU_ITEM}>
              <Icon name="user" className="h-4 w-4 text-ink-muted" />
              <span className="flex-1 text-left">Sign in</span>
            </a>
          </div>
        </>
      )}
    </Menu>
  )
}

function SignedIn({ user, itemClass, pages }) {
  const unread = useUnread()
  const [signingOut, setSigningOut] = useState(false)

  const items = [
    { path: DASHBOARD_PATH, icon: 'grid', label: 'Dashboard' },
    { path: MESSAGES_PATH, icon: 'message', label: 'Messages', badge: unread > 0 ? badgeOf(unread) : null },
  ]
  if (user.guest) items.unshift({ path: CLAIM_PATH, icon: 'key', label: 'Keep my work' })

  const signOut = (close) => async () => {
    if (signingOut) return
    setSigningOut(true)
    close()
    await authSignOut()
    navigate(LOGIN_PATH, { replace: true })
  }

  const trigger = ({ open, toggle }) => (
    <button
      type="button"
      title={user.name}
      onClick={toggle}
      aria-label={unread > 0 ? `Account, ${unread} unread` : 'Account'}
      aria-expanded={open}
      aria-haspopup="menu"
      className={`${itemClass} relative cursor-pointer rounded-lg outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/30 aria-expanded:bg-surface-hover`}
    >
      <Avatar user={user} size={24} />
      {unread > 0 && (
        <span className={`${BADGE} absolute right-1 top-1 grid h-[15px] min-w-[15px] place-items-center px-1 text-[9px] ring-2 ring-bg`}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )

  return (
    <div className="animate-menu-in">
    <Menu trigger={trigger}>
      {(close) => (
        <>
          <div className="flex items-center gap-3 border-b border-line px-3 pb-3 pt-3">
            <Avatar user={user} size={36} />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-ink-strong">{user.name}</p>
              {user.guest ? (
                <p className="truncate text-[12px] text-ink-muted">Nothing saved to a name yet</p>
              ) : (
                <Sensitive as="p" className="truncate text-[12px] text-ink-muted">{user.email}</Sensitive>
              )}
            </div>
          </div>
          <PageItems pages={pages} close={close} />
          <SiteItems close={close} />
          <div className="p-1.5">
            {items.map((item) => (
              <a key={item.path} role="menuitem" {...go(close, item.path)} className={MENU_ITEM}>
                <Icon name={item.icon} className="h-4 w-4 text-ink-muted" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && <span className={`${BADGE} px-1.5 text-[10px] leading-[15px]`}>{item.badge}</span>}
              </a>
            ))}
            <button role="menuitem" type="button" onClick={signOut(close)} disabled={signingOut} className={`${MENU_ITEM} disabled:opacity-50`}>
              <Icon name="logout" className="h-4 w-4 text-ink-muted" />
              {signingOut ? 'Leaving…' : user.guest ? 'Leave guest session' : 'Sign out'}
            </button>
          </div>
        </>
      )}
    </Menu>
    </div>
  )
}

export default function NavMenu({ itemClass = '', pages = [] }) {
  const { session } = useAuth()
  const user = profileOf(session?.user)

  if (!user) return <SignedOut itemClass={itemClass} pages={pages} />
  return <SignedIn user={user} itemClass={itemClass} pages={pages} />
}
