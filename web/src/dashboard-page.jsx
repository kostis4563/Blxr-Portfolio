import { useState, useEffect, useCallback } from 'react'
import DashboardSidebar from './components/dashboard-sidebar'
import DashboardTopbar from './components/dashboard-topbar'
import DashboardSettings from './dashboard-settings'
import DashboardProfile from './dashboard-profile'
import DashboardStats from './dashboard-stats'
import DashboardBoards from './dashboard-boards'
import DashboardMessages from './dashboard-messages'
import DashboardReviewPanel from './dashboard-reviewpanel'
import DashboardLogs from './dashboard-logs'
import { navigate, useRouteHash, dashboardPath, DASHBOARD_PATH } from './lib/router'
import { Loading } from './components/skeleton'
import { useAuth, profileOf } from './lib/supabase'
import { loginUrlFor, mfaRequired, isGuest } from './lib/auth'
import { itemForHash, isSiteOwner, SIDEBAR_STORAGE_KEY, BLURBS } from './lib/dashboard'
import { CLAIM_HASH, lockedForGuest } from './lib/guest'
import { GuestBar, MembersOnly, ClaimDialog, useGuestWork } from './components/guest'

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

const Shell = () => <Loading label="Opening the dashboard" />

export default function DashboardPage({ theme, themePreference, onToggleTheme, onSetTheme }) {
  const hash = useRouteHash()
  const item = itemForHash(hash)
  const { session } = useAuth()
  const user = profileOf(session?.user)
  const guest = isGuest(session?.user)
  const [verified, setVerified] = useState(undefined)
  const [claiming, setClaiming] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)

  const setCollapsedPersist = useCallback((next) => {
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'rail' : 'full') } catch {}
    setCollapsed(next)
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, c ? 'full' : 'rail') } catch {}
      return !c
    })
  }, [])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

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

  useEffect(() => {
    if (hash !== CLAIM_HASH) return
    if (guest) setClaiming(true)
    navigate(dashboardPath(), { replace: true })
  }, [hash, guest])

  useEffect(() => {
    document.documentElement.dataset.view = 'dashboard'
    return () => { delete document.documentElement.dataset.view }
  }, [])

  useEffect(() => {
    if (session === null) navigate(loginUrlFor(DASHBOARD_PATH + hash), { replace: true })
  }, [session, hash])

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

  const top = item.parent || item
  const hidden = Boolean(top.owner) && Boolean(user) && !isSiteOwner(user)
  const locked = guest && lockedForGuest(item.path)
  const work = useGuestWork(guest ? hash : null)
  const openClaim = useCallback(() => setClaiming(true), [])
  const closeClaim = useCallback(() => setClaiming(false), [])

  useEffect(() => {
    if (hidden) navigate(dashboardPath(), { replace: true })
    else if (item.children) navigate(dashboardPath(`${item.id}/${item.children[0].id}`), { replace: true })
  }, [item, hidden])

  const inside = Boolean(top.bare) || (Boolean(top.deep) && /^[0-9a-f-]{36}$/i.test(hash.replace(/^#/, '').split('/')[1] || ''))
  const title = top.subnav ? top.label : item.label
  const blurb = top.subnav ? BLURBS[top.id] : BLURBS[item.path] || BLURBS[top.id]

  if (!user || !verified || item.children || hidden) return <Shell />

  return (
    <div className="flex min-h-dvh bg-bg text-ink selection:bg-selection selection:text-ink-strong antialiased font-sans">
      <DashboardSidebar
        activePath={item.path}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        user={user}
        theme={theme}
        onToggleTheme={onToggleTheme}
        themePreference={themePreference}
        onSetTheme={onSetTheme}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar item={item} user={session.user} theme={theme} onToggleTheme={onToggleTheme} onOpenMobile={() => setMobileOpen(true)} />

        <main className={`mx-auto w-full flex-1 px-4 py-6 sm:px-8 sm:py-8 ${top.subnav && !top.roomy ? 'max-w-[820px]' : top.wide ? 'max-w-[1440px]' : 'max-w-[1080px]'}`}>
          {guest && <GuestBar user={user} boards={work} onClaim={openClaim} />}
          {!inside && (
            <div key={top.id} className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 animate-rise-in">
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold tracking-tight text-ink-strong">{title}</h1>
                <p className="mt-0.5 text-[13.5px] text-ink-muted">{blurb}</p>
              </div>
            </div>
          )}
          {locked ? (
            <MembersOnly path={item.path} onClaim={openClaim} />
          ) : top.id === 'settings' ? (
            <DashboardSettings
              item={item}
              user={session.user}
              theme={theme}
              themePreference={themePreference}
              onSetTheme={onSetTheme}
              sidebarCollapsed={collapsed}
              onSetSidebarCollapsed={setCollapsedPersist}
            />
          ) : top.id === 'profile' ? (
            <DashboardProfile user={session.user} />
          ) : top.id === 'stats' ? (
            <DashboardStats />
          ) : top.id === 'boards' ? (
            <DashboardBoards hash={hash} guest={guest} onClaim={openClaim} />
          ) : top.id === 'messages' ? (
            <DashboardMessages hash={hash} user={session.user} />
          ) : top.id === 'reviewpanel' ? (
            <DashboardReviewPanel item={item} />
          ) : top.id === 'logs' ? (
            <DashboardLogs hash={hash} />
          ) : null}
        </main>
      </div>

      {guest && <ClaimDialog open={claiming} onClose={closeClaim} boards={work} />}
    </div>
  )
}

