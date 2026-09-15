import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { link, navigate, dashboardPath } from '../lib/router'
import { isMacLike } from '../lib/palette'
import { ICONS, NAV } from '../lib/dashboard'
import { imageProps } from '../lib/images'

const RAIL_W = 'w-[64px]'
const FULL_W = 'w-[260px]'

const ITEM =
  'relative z-10 flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-[14px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink-strong/30'
const IDLE = 'text-ink-secondary hover:text-ink-strong'
const ACTIVE = 'text-ink-strong font-medium'
const COUNT =
  'inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-md bg-surface-hover-strong px-1.5 text-[12px] text-ink tabular-nums'
const TAG =
  'inline-flex h-[20px] items-center rounded-md border border-line-strong px-1.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-muted'
const TIP =
  'pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-surface-inverted px-2 py-1 text-[12px] text-ink-on-inverted opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100'
const ICON_BTN =
  'grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-ink-muted outline-none transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/30'

export function Icon({ name, className = 'h-[18px] w-[18px]', strokeWidth = 1.7 }) {
  return (
    <svg
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

// Vertical guide for nested rows, aligned under the parent icon.
const BRANCH = 'relative before:absolute before:-left-3 before:inset-y-0 before:border-l before:border-line before:content-[""]'

function ChildLink({ item, parent, active, onNavigate }) {
  const path = `${parent.id}/${item.id}`
  return (
    <li className={BRANCH}>
      <a
        {...link(dashboardPath(path), () => onNavigate(path))}
        data-active={active || undefined}
        aria-current={active ? 'page' : undefined}
        className={`${ITEM} h-9 text-[13.5px] ${active ? ACTIVE : IDLE}`}
      >
        <span className="flex-1 truncate">{item.label}</span>
      </a>
    </li>
  )
}

function NavItem({ item, activePath, rail, open, onToggle, onNavigate }) {
  // `subnav` items keep their children off the sidebar; the page shows tabs.
  const hasChildren = Boolean(item.children) && !item.subnav
  const inside = activePath === item.id || activePath.startsWith(`${item.id}/`)
  const isActive = item.subnav ? inside : activePath === item.id
  const childActive = hasChildren && inside
  const lit = isActive || (childActive && (rail || !open))
  const firstChild = item.children ? `${item.id}/${item.children[0].id}` : null
  const target = item.subnav ? firstChild : item.id

  const inner = (
    <>
      <Icon name={item.icon} />
      {!rail && (
        <>
          <span className="flex-1 truncate text-left">{item.label}</span>
          {item.count !== undefined && <span className={COUNT}>{item.count}</span>}
          {item.tag && <span className={TAG}>{item.tag}</span>}
          {hasChildren && (
            <Icon
              name="chevronDown"
              className={`h-4 w-4 text-ink-subtle transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          )}
        </>
      )}
    </>
  )

  const base = `${ITEM} ${rail ? 'justify-center px-0' : ''} ${lit ? ACTIVE : IDLE}`

  return (
    <li className="group relative">
      {hasChildren ? (
        <button
          type="button"
          data-active={lit || undefined}
          aria-expanded={!rail ? open : undefined}
          onClick={() => (rail ? onNavigate(firstChild) : onToggle(item.id))}
          className={base}
        >
          {inner}
        </button>
      ) : (
        <a
          {...link(dashboardPath(target), () => onNavigate(target))}
          data-active={isActive || undefined}
          aria-current={isActive ? 'page' : undefined}
          className={base}
        >
          {inner}
        </a>
      )}

      {hasChildren && !rail && (
        <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="min-h-0 overflow-hidden">
            <ul className="mb-1 ml-[21px] mt-1 flex flex-col gap-px pl-3">
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
            <p className="px-3 pb-1 pt-1.5 text-[12px] text-ink-subtle">{item.label}</p>
            <ul className="flex flex-col gap-px">
              {item.children.map((child) => {
                const path = `${item.id}/${child.id}`
                const on = activePath === path
                return (
                  <li key={child.id}>
                    <a
                      {...link(dashboardPath(path), () => onNavigate(path))}
                      aria-current={on ? 'page' : undefined}
                      className={`${ITEM} h-9 text-[13.5px] ${on ? `${ACTIVE} bg-surface-hover` : IDLE}`}
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

  // One background that slides to whichever row is active.
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
        {/* Brand */}
        <div className={`flex h-14 shrink-0 items-center ${rail ? 'justify-center' : 'px-3'}`}>
          {rail ? (
            <div className="group relative">
              <button type="button" onClick={onToggleCollapsed} aria-label={toggleLabel} className={ICON_BTN}>
                <Icon name="panelLeft" />
              </button>
              <span role="tooltip" className={TIP}>
                {toggleLabel} <span className="ml-1 text-ink-on-inverted/60">{mod}B</span>
              </span>
            </div>
          ) : (
            <>
              <a
                {...link(dashboardPath())}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/30"
                aria-label="Dashboard overview"
              >
                <img
                  {...imageProps('/blxr-logo.webp')}
                  alt="blxr"
                  width="96"
                  height="96"
                  decoding="async"
                  className="h-6 w-6 shrink-0 rounded-md object-contain select-none"
                />
                <span className="truncate text-[15px] font-semibold tracking-tight text-ink-strong">blxr</span>
                <span className="ml-auto text-[11px] text-ink-subtle">Dashboard</span>
              </a>
              {mobile ? (
                <button type="button" onClick={onCloseMobile} aria-label="Close menu" className={`${ICON_BTN} ml-1`}>
                  <Icon name="x" className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  aria-label={toggleLabel}
                  title={`${toggleLabel} · ${mod}B`}
                  className={`${ICON_BTN} ml-1 text-ink-subtle`}
                >
                  <Icon name="panelLeft" className="h-[17px] w-[17px]" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Nav */}
        <nav ref={navRef} className={`relative flex-1 px-3 pt-2 ${rail ? 'overflow-visible' : 'overflow-y-auto'}`}>
          {pill && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute z-0 rounded-lg bg-surface-hover transition-[top,left,width,height] duration-200 ease-out"
              style={{ top: pill.top, left: pill.left, width: pill.width, height: pill.height }}
            />
          )}
          {NAV.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
              {rail ? (
                gi > 0 && <div className="mx-2 mb-3 border-t border-line" aria-hidden="true" />
              ) : (
                <p className="mb-1.5 px-3 text-[12.5px] text-ink-subtle">{group.label}</p>
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

        {/* Footer */}
        {!rail && (
          <div className="flex shrink-0 items-center justify-between border-t border-line px-5 py-3 text-[11px] text-ink-faint">
            <span>blxr.net</span>
            <span className="tabular-nums">v1.0</span>
          </div>
        )}
      </aside>
    </>
  )
}
