import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import DashboardSidebar from './components/dashboard-sidebar'
import DashboardTopbar from './components/dashboard-topbar'
import DashboardSettings from './dashboard-settings'
import DashboardProfile from './dashboard-profile'
import DashboardStats from './dashboard-stats'
import DashboardBoards from './dashboard-boards'
import DashboardMessages from './dashboard-messages'
import DashboardReviewPanel from './dashboard-reviewpanel'
import DashboardLogs from './dashboard-logs'
import DashboardHome from './dashboard-home'
import { CanvasLayer, Toasts } from './components/figma'
const DashboardBlog = lazy(() => import('./dashboard-blog'))
const DashboardVolunteer = lazy(() => import('./dashboard-volunteer'))
const DashboardGallery = lazy(() => import('./dashboard-gallery'))
import { navigate, useRouteHash, dashboardPath, DASHBOARD_PATH } from './lib/router'
import { Loading } from './components/skeleton'
import { useAuth, profileOf } from './lib/supabase'
import { loginUrlFor, mfaRequired, isGuest } from './lib/auth'
import { itemForHash, isSiteOwner, SIDEBAR_STORAGE_KEY, BLURBS, OWNER_EMAIL } from './lib/dashboard'
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

// Local dev only: lets `npm run dev` open the dashboard without signing in. Stripped from production builds.
const PREVIEW_SESSION = import.meta.env.DEV
  ? {
      user: {
        id: '00000000-0000-4000-8000-000000000000',
        email: OWNER_EMAIL,
        user_metadata: { name: 'Local preview' },
        app_metadata: { provider: 'email' },
        is_anonymous: false,
      },
    }
  : null

export default function DashboardPage({ theme, themePreference, onToggleTheme, onSetTheme }) {
  const hash = useRouteHash()
  const item = itemForHash(hash)
  const { session: signedIn } = useAuth()
  const session = signedIn === null && PREVIEW_SESSION ? PREVIEW_SESSION : signedIn
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
    if (session === PREVIEW_SESSION) {
      setVerified(true)
      return
    }
    let cancelled = false
    mfaRequired().then((needed) => {
      if (cancelled) return
      if (needed) navigate(`${loginUrlFor(DASHBOARD_PATH + hash)}#verify`, { replace: true })
      else setVerified(true)
    })
    return () => { cancelled = true }
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

  const sub = hash.replace(/^#/, '').split('/')[1] || ''
  const inside = Boolean(top.bare) || (Boolean(top.deep) && /^[0-9a-f-]{36}$/i.test(sub)) || ((top.id === 'blog' || top.id === 'volunteer' || top.id === 'gallery') && Boolean(sub))
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
          ) : top.id === 'home' ? (
            <DashboardHome user={user} guest={guest} />
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
          ) : top.id === 'blog' ? (
            <Suspense fallback={<Loading label="Opening the blog editor" />}>
              <DashboardBlog hash={hash} />
            </Suspense>
          ) : top.id === 'gallery' ? (
            <Suspense fallback={<Loading label="Opening the gallery" />}>
              <DashboardGallery hash={hash} />
            </Suspense>
          ) : top.id === 'volunteer' ? (
            <Suspense fallback={<Loading label="Opening your events" />}>
              <DashboardVolunteer hash={hash} />
            </Suspense>
          ) : null}
        </main>
      </div>

      {guest && <ClaimDialog open={claiming} onClose={closeClaim} boards={work} />}

      <CanvasLayer />
      <Toasts />

    </div>
  )
}

