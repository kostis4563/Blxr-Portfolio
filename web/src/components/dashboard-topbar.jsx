import { useState, useEffect, useCallback } from 'react'
import { Icon } from './icon'
import { useDismiss } from './account-menu'
import { link, dashboardPath } from '../lib/router'
import { openPalette, isMacLike } from '../lib/palette'
import { NOTIFICATIONS } from '../lib/dashboard'

const ICON_BTN =
  'relative grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-ink-muted outline-none transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/30 aria-expanded:bg-surface-hover aria-expanded:text-ink-strong'
const MENU = 'absolute right-0 top-full z-40 mt-2 origin-top-right rounded-xl border border-line bg-surface shadow-xl animate-menu-in'
const CRUMB = 'truncate text-[13px] text-ink-muted transition-colors hover:text-ink-strong'

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

export default function DashboardTopbar({ item, theme, onToggleTheme, onOpenMobile }) {
  const [mac, setMac] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMac(isMacLike())
    setMounted(true)
  }, [])

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
        </div>
      </div>
    </header>
  )
}
