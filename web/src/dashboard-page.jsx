import { useState, useEffect, useCallback } from 'react'
import DashboardSidebar from './components/dashboard-sidebar'
import DashboardTopbar from './components/dashboard-topbar'
import DashboardSettings from './dashboard-settings'
import DashboardProfile from './dashboard-profile'
import DashboardStats from './dashboard-stats'
import { link, navigate, useRouteHash, dashboardPath, DASHBOARD_PATH } from './lib/router'
import { useAuth, profileOf } from './lib/supabase'
import { loginUrlFor, mfaRequired } from './lib/auth'
import { itemForHash, SIDEBAR_STORAGE_KEY, BLURBS } from './lib/dashboard'

const CARD = 'rounded-xl border border-line bg-surface'

function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'rail'
  } catch {
    return false
  }
}

function isTyping(target) {
  const tag = target?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable
}

function Placeholder({ item }) {
  const parent = item.parent
  const tabs = parent ? parent.children : item.children

  return (
    <div className="flex flex-col gap-4">
      {tabs && (
        <div className="flex gap-1 border-b border-line">
          {tabs.map((tab) => {
            const path = `${(parent || item).id}/${tab.id}`
            const on = parent && tab.id === item.id
            return (
              <a
                key={tab.id}
                {...link(dashboardPath(path))}
                aria-current={on ? 'page' : undefined}
                className={`-mb-px border-b-2 px-3 py-2 text-[13px] transition-colors ${on ? 'border-ink-strong font-medium text-ink-strong' : 'border-transparent text-ink-muted hover:text-ink-strong'}`}
              >
                {tab.label}
              </a>
            )
          })}
        </div>
      )}

      <div className={`${CARD} flex min-h-[320px] flex-col items-center justify-center px-6 text-center`}>
        <p className="text-[14px] font-medium text-ink-strong">No data yet</p>
        <p className="mt-1 max-w-[340px] text-[13px] text-ink-muted">This section fills in once the API is connected.</p>
      </div>
    </div>
  )
}

export default function DashboardPage({ theme, themePreference, onToggleTheme, onSetTheme }) {
  const hash = useRouteHash()
  const item = itemForHash(hash)
  const { session } = useAuth()
  const user = profileOf(session?.user)
  // undefined until the session's MFA level is known; false sends to /login#verify.
  const [verified, setVerified] = useState(undefined)
  // Safe to read here: until the session is known the page renders the same
  // empty shell the prerender emitted, so hydration never sees the sidebar.
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)

  const setCollapsedPersist = useCallback((next) => {
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'rail' : 'full') } catch { /* private mode */ }
    setCollapsed(next)
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, c ? 'full' : 'rail') } catch { /* private mode */ }
      return !c
    })
  }, [])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  // ⌘B / Ctrl+B toggles the sidebar.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b' && !isTyping(e.target)) {
        e.preventDefault()
        toggleCollapsed()
      } else if (e.key === 'Escape') {
        setMobileOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [toggleCollapsed])

  useEffect(() => { setMobileOpen(false) }, [hash])

  // Lets global chrome (the music widget) know it should keep clear of the sidebar.
  useEffect(() => {
    document.documentElement.dataset.view = 'dashboard'
    return () => { delete document.documentElement.dataset.view }
  }, [])

  // Signed out (or the session expired): back to /login, which returns here after.
  useEffect(() => {
    if (session === null) navigate(loginUrlFor(DASHBOARD_PATH + hash), { replace: true })
  }, [session, hash])

  // Two-factor is on but this session has not passed it: finish that first.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    mfaRequired().then((needed) => {
      if (cancelled) return
      if (needed) navigate(`${loginUrlFor(DASHBOARD_PATH + hash)}#verify`, { replace: true })
      else setVerified(true)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // A group on its own (`#settings`) opens its first page.
  useEffect(() => {
    if (item.children) navigate(dashboardPath(`${item.id}/${item.children[0].id}`), { replace: true })
  }, [item])

  const top = item.parent || item
  // Tabbed sections title the page after the parent; the tab names the page.
  const title = top.subnav ? top.label : item.label
  const blurb = top.subnav ? BLURBS[top.id] : BLURBS[item.path] || BLURBS[top.id]

  // Nothing to show until the session is known — also what the prerender emits.
  if (!user || !verified || item.children) return <div className="min-h-dvh bg-bg" aria-busy="true" />

  return (
    <div className="flex min-h-dvh bg-bg text-ink selection:bg-selection selection:text-ink-strong antialiased font-sans">
      <DashboardSidebar
        activePath={item.path}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar item={item} user={user} theme={theme} onToggleTheme={onToggleTheme} onOpenMobile={() => setMobileOpen(true)} />

        <main className={`mx-auto w-full flex-1 px-4 py-6 sm:px-8 sm:py-8 ${top.subnav ? 'max-w-[820px]' : 'max-w-[1080px]'}`}>
          <div key={top.id} className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 animate-rise-in">
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold tracking-tight text-ink-strong">{title}</h1>
              <p className="mt-0.5 text-[13.5px] text-ink-muted">{blurb}</p>
            </div>
          </div>
          {top.id === 'settings' ? (
            <DashboardSettings
              item={item}
              user={session.user}
              themePreference={themePreference}
              onSetTheme={onSetTheme}
              sidebarCollapsed={collapsed}
              onSetSidebarCollapsed={setCollapsedPersist}
            />
          ) : top.id === 'profile' ? (
            <DashboardProfile user={session.user} />
          ) : top.id === 'stats' ? (
            <DashboardStats />
          ) : (
            <div key={item.path} className="animate-rise-in">
              <Placeholder item={item} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
