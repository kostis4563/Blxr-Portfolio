import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { link, navigate, dashboardPath } from '../lib/router'
import { isMacLike } from '../lib/palette'
import { navFor, NAV_FOOTER } from '../lib/dashboard'
import { useUnread } from '../lib/messages-unread'
import { badgeOf } from '../lib/messages'
import { imageProps } from '../lib/images'
import { Icon } from './icon'
import AccountMenu, { Avatar } from './account-menu'
import { Sensitive } from './sensitive'

export { Icon }

const RAIL_W = 'w-[64px]'
const FULL_W = 'w-[240px]'

const ITEM =
  'relative z-10 flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink-strong/30'
const IDLE = 'text-ink-muted hover:text-ink-strong'
const ACTIVE = 'text-ink-strong font-medium'
const COUNT =
  'inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-surface-hover-strong px-1.5 font-mono text-[11px] font-medium text-ink tabular-nums'
const TAG =
  'inline-flex h-[18px] items-center rounded-md border border-line-strong px-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted'
const GROUP = 'mb-1 px-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint'
const TIP =
  'pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-surface-inverted px-2 py-1 text-[12px] text-ink-on-inverted opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100'
const ICON_BTN =
  'grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-ink-subtle outline-none transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/30'

const BRANCH = 'relative before:absolute before:-left-3 before:inset-y-0 before:border-l before:border-line before:content-[""]'

function ChildLink({ item, parent, active, onNavigate }) {
  const path = `${parent.id}/${item.id}`
  return (
    <li className={BRANCH}>
      <a
        {...link(dashboardPath(path), () => onNavigate(path))}
        data-active={active || undefined}
        aria-current={active ? 'page' : undefined}
        className={`${ITEM} h-8 text-[13px] ${active ? ACTIVE : IDLE}`}
      >
        <span className="flex-1 truncate">{item.label}</span>
      </a>
    </li>
  )
}

function NavItem({ item: given, activePath, rail, open, onToggle, onNavigate, pinned = false }) {
  const unread = useUnread()
  const item = given.id === 'messages' ? { ...given, count: unread > 0 ? badgeOf(unread) : undefined } : given
  const hasChildren = Boolean(item.children) && !item.subnav
  const inside = activePath === item.id || activePath.startsWith(`${item.id}/`)
  const isActive = item.subnav ? inside : activePath === item.id
  const childActive = hasChildren && inside
  const lit = isActive || (childActive && (rail || !open))
  const firstChild = item.children ? `${item.id}/${item.children[0].id}` : null
  const target = item.subnav ? firstChild : item.id

  const inner = (
    <>
      <Icon name={item.icon} className="h-[17px] w-[17px]" />
      {!rail && (
        <>
          <span className="flex-1 truncate text-left">{item.label}</span>
          {item.count !== undefined && <span className={COUNT}>{item.count}</span>}
          {item.tag && <span className={TAG}>{item.tag}</span>}
          {hasChildren && (
            <Icon
              name="chevronDown"
              className={`h-3.5 w-3.5 text-ink-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          )}
        </>
      )}
    </>
  )

  const base = `${ITEM} ${rail ? 'justify-center px-0' : ''} ${lit ? ACTIVE : IDLE} ${pinned && lit ? 'bg-surface-hover' : ''}`

  return (
    <li className="group relative">
      {hasChildren ? (
        <button
          type="button"
          data-active={!pinned && lit ? true : undefined}
          aria-expanded={!rail ? open : undefined}
          onClick={() => (rail ? onNavigate(firstChild) : onToggle(item.id))}
          className={base}
        >
          {inner}
        </button>
      ) : (
        <a
          {...link(dashboardPath(target), () => onNavigate(target))}
          data-active={!pinned && isActive ? true : undefined}
          aria-current={isActive ? 'page' : undefined}
          className={base}
        >
          {inner}
        </a>
      )}

      {hasChildren && !rail && (
        <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="min-h-0 overflow-hidden">
            <ul className="mb-1 ml-[19px] mt-1 flex flex-col gap-px pl-3">
              {item.children.map((child) => (
                <ChildLink
                  key={child.id}
                  item={child}
                  parent={item}
                  active={activePath === `${item.id}/${child.id}`}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        </div>
      )}

      {rail && !hasChildren && (
        <span role="tooltip" className={TIP}>
          {item.label}
          {item.count !== undefined && <span className="ml-1.5 text-ink-on-inverted/60">{item.count}</span>}
        </span>
      )}
      {rail && hasChildren && (
        <div className="pointer-events-none absolute left-full top-0 z-50 pl-2 opacity-0 transition-opacity duration-100 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <div className="w-[196px] rounded-xl border border-line bg-surface p-1.5 shadow-xl">
            <p className="px-2.5 pb-1 pt-1.5 text-[12px] text-ink-subtle">{item.label}</p>
            <ul className="flex flex-col gap-px">
              {item.children.map((child) => {
                const path = `${item.id}/${child.id}`
                const on = activePath === path
                return (
                  <li key={child.id}>
                    <a
                      {...link(dashboardPath(path), () => onNavigate(path))}
                      aria-current={on ? 'page' : undefined}
                      className={`${ITEM} h-8 text-[13px] ${on ? `${ACTIVE} bg-surface-hover` : IDLE}`}
                    >
                      {child.label}
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </li>
  )
}

export default function DashboardSidebar({
  activePath,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  user,
  theme,
  onToggleTheme,
}) {
  const [mobile, setMobile] = useState(false)
  const [mac, setMac] = useState(true)
  const [openGroups, setOpenGroups] = useState(() => new Set())
  const [pill, setPill] = useState(null)
  const navRef = useRef(null)

  const rail = collapsed && !mobile
  const mod = mac ? '⌘' : 'Ctrl '

  useEffect(() => {
    setMac(isMacLike())
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const parent = activePath.split('/')[0]
    if (activePath.includes('/')) setOpenGroups((prev) => (prev.has(parent) ? prev : new Set(prev).add(parent)))
  }, [activePath])

  const toggleGroup = useCallback((id) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const go = useCallback((path) => {
    navigate(dashboardPath(path))
    onCloseMobile?.()
  }, [onCloseMobile])

  const measure = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const el = nav.querySelector('[data-active]')
    if (!el) return setPill(null)
    const r = el.getBoundingClientRect()
    const n = nav.getBoundingClientRect()
    setPill({ top: r.top - n.top + nav.scrollTop, left: r.left - n.left, width: r.width, height: r.height })
  }, [])

  useLayoutEffect(measure, [measure, activePath, rail, openGroups, mobileOpen])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const aside = nav.closest('aside')
    aside?.addEventListener('transitionend', measure)
    window.addEventListener('resize', measure)
    return () => {
      aside?.removeEventListener('transitionend', measure)
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  const toggleLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar'

  const accountTrigger = ({ open, toggle }) =>
    rail ? (
      <div className="group relative flex justify-center">
        <button
          type="button"
          onClick={toggle}
          aria-label="Account menu"
          aria-expanded={open}
          aria-haspopup="menu"
          className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/30 aria-expanded:bg-surface-hover"
        >
          <Avatar user={user} size={24} />
        </button>
        {!open && <span role="tooltip" className={TIP}>{user.name}</span>}
      </div>
    ) : (
      <button
        type="button"
        onClick={toggle}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 text-left outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/30 aria-expanded:bg-surface-hover"
      >
        <Avatar user={user} size={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-tight text-ink-strong">{user.name}</span>
          <Sensitive interactive={false} className="block truncate text-[11.5px] leading-tight text-ink-subtle">{user.email}</Sensitive>
        </span>
        <Icon name="chevronsUpDown" className="h-3.5 w-3.5 text-ink-faint" />
      </button>
    )

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/50 animate-overlay-in md:hidden"
        />
      )}

      <aside
        aria-label="Dashboard navigation"
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh flex-col bg-surface transition-[width,transform] duration-200 ease-out md:sticky md:top-0 md:translate-x-0 md:border-r md:border-line ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        } ${rail ? RAIL_W : FULL_W}`}
      >
        <div className={`flex h-14 shrink-0 items-center ${rail ? 'justify-center' : 'pl-4 pr-3'}`}>
          {rail ? (
            <div className="group relative">
              <button type="button" onClick={onToggleCollapsed} aria-label={toggleLabel} className={ICON_BTN}>
                <Icon name="panelLeft" className="h-[17px] w-[17px]" />
              </button>
              <span role="tooltip" className={TIP}>
                {toggleLabel} <span className="ml-1 text-ink-on-inverted/60">{mod}B</span>
              </span>
            </div>
          ) : (
            <>
              <a
                {...link(dashboardPath())}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/30"
                aria-label="Dashboard"
              >
                <img
                  {...imageProps('/blxr-logo.webp')}
                  alt="blxr"
                  width="96"
                  height="96"
                  decoding="async"
                  className="h-6 w-6 shrink-0 rounded-md object-contain select-none"
                />
                <span className="truncate text-[14px] font-semibold tracking-tight text-ink-strong">blxr</span>
              </a>
              {mobile ? (
                <button type="button" onClick={onCloseMobile} aria-label="Close menu" className={ICON_BTN}>
                  <Icon name="x" className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  aria-label={toggleLabel}
                  title={`${toggleLabel} · ${mod}B`}
                  className={ICON_BTN}
                >
                  <Icon name="panelLeft" className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>

        <nav ref={navRef} className={`relative flex-1 px-3 pt-1 ${rail ? 'overflow-visible' : 'overflow-y-auto'}`}>
          {pill && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute z-0 rounded-lg bg-surface-hover transition-[top,left,width,height] duration-200 ease-out"
              style={{ top: pill.top, left: pill.left, width: pill.width, height: pill.height }}
            />
          )}
          {navFor(user).map((group, gi) => (
            <div key={group.label} className={gi > 0 ? (rail ? 'mt-2' : 'mt-5') : ''}>
              {rail ? (
                gi > 0 && <div className="mx-2 mb-2 border-t border-line" aria-hidden="true" />
              ) : (
                <p className={GROUP}>{group.label}</p>
              )}
              <ul className="flex flex-col gap-px">
                {group.items.map((item) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    activePath={activePath}
                    rail={rail}
                    open={openGroups.has(item.id)}
                    onToggle={toggleGroup}
                    onNavigate={go}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-line px-3 py-2">
          <ul className="mb-1 flex flex-col gap-px">
            {NAV_FOOTER.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                activePath={activePath}
                rail={rail}
                open={openGroups.has(item.id)}
                onToggle={toggleGroup}
                onNavigate={go}
                pinned
              />
            ))}
          </ul>
          <AccountMenu
            user={user}
            theme={theme}
            onToggleTheme={onToggleTheme}
            placement={rail ? 'right' : 'up'}
            trigger={accountTrigger}
          />
        </div>
      </aside>
    </>
  )
}
