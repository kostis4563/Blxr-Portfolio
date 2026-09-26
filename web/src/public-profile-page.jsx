import { useEffect, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import ProfileCard from './components/profile-card'
import { Icon } from './components/dashboard-sidebar'
import { link, HOME_PATH, LOGIN_PATH, dashboardPath } from './lib/router'
import { useAuth } from './lib/supabase'
import { fetchProfileByHandle, HANDLE_RE } from './lib/profiles'
import { SITE_NAME } from './lib/seo'

const BTN =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium outline-none transition-[background-color,border-color,color,opacity,transform] duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ink-strong/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

function useForcedTheme(forced) {
  useEffect(() => {
    if (!forced) return undefined
    const root = document.documentElement
    const prev = { theme: root.dataset.theme, scheme: root.style.colorScheme }
    root.dataset.theme = forced
    root.style.colorScheme = forced
    return () => {
      if (prev.theme) root.dataset.theme = prev.theme
      else delete root.dataset.theme
      root.style.colorScheme = prev.scheme
    }
  }, [forced])
}

function Shell({ theme, onToggleTheme, forced, wide, children }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
        <div className="w-full flex items-center justify-between">
          <a {...link(HOME_PATH)} className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer">
            <span>←</span>
            <span>{SITE_NAME}</span>
          </a>
          {forced ? (
            <span className="text-[11.5px] text-ink-faint">{forced === 'dark' ? 'Dark' : 'Light'} page</span>
          ) : (
            <ThemeToggle theme={theme} onToggle={onToggleTheme} className="text-ink-muted hover:text-ink-strong transition-colors duration-200" />
          )}
        </div>
      </header>
      <main className={`flex w-full flex-1 flex-col items-center pb-16 ${wide ? 'px-0 pt-14' : 'px-5 pt-24 sm:pt-28'}`}>{children}</main>
    </div>
  )
}

function Missing({ handle }) {
  return (
    <div className="w-full max-w-[560px] rounded-2xl border border-dashed border-line px-6 py-14 text-center animate-rise-in">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-raised text-ink-subtle">
        <Icon name="user" className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-[20px] font-semibold tracking-tight text-ink-strong">Nobody here</h1>
      <p className="mx-auto mt-1.5 max-w-[36ch] text-[13.5px] leading-relaxed text-ink-muted">
        {handle && HANDLE_RE.test(handle)
          ? <>There is no public profile at <span className="font-mono text-ink">@{handle}</span>. It may be private, or the handle may have changed.</>
          : 'That is not a valid profile address.'}
      </p>
      <a {...link(HOME_PATH)} className={`${BTN} mt-6 border border-line bg-surface text-ink hover:border-line-strong hover:text-ink-strong`}>
        Back to {SITE_NAME}
      </a>
    </div>
  )
}

function Loading() {
  return (
    <div aria-busy="true" className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="h-28 animate-pulse bg-surface-raised sm:h-32" />
      <div className="px-6 pb-8 sm:px-8">
        <div className="-mt-11 h-[96px] w-[96px] animate-pulse rounded-full bg-surface-hover ring-4 ring-surface" />
        <div className="mt-4 h-6 w-48 animate-pulse rounded-md bg-surface-raised" />
        <div className="mt-2 h-4 w-28 animate-pulse rounded-md bg-surface-raised" />
        <div className="mt-5 h-4 w-full animate-pulse rounded-md bg-surface-raised" />
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded-md bg-surface-raised" />
      </div>
    </div>
  )
}

export default function PublicProfilePage({ handle, theme, onToggleTheme }) {
  const [state, setState] = useState({ status: 'loading', profile: null })
  const { session } = useAuth()
  const isOwner = Boolean(session?.user?.id && state.profile && session.user.id === state.profile.ownerId)
  const profile = state.profile
  const forced = profile && profile.theme !== 'system' ? profile.theme : null
  const layout = profile?.layout || 'card'
  useForcedTheme(forced)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', profile: null })
    if (!handle || !HANDLE_RE.test(handle)) {
      setState({ status: 'missing', profile: null })
      return undefined
    }
    fetchProfileByHandle(handle)
      .then((profile) => { if (!cancelled) setState(profile ? { status: 'ready', profile } : { status: 'missing', profile: null }) })
      .catch(() => { if (!cancelled) setState({ status: 'missing', profile: null }) })
    return () => { cancelled = true }
  }, [handle])

  useEffect(() => {
    if (state.status !== 'ready') return undefined
    const prev = document.title
    document.title = `${state.profile.name} (@${state.profile.handle}) — ${SITE_NAME}`
    return () => { document.title = prev }
  }, [state])

  return (
    <Shell theme={theme} onToggleTheme={onToggleTheme} forced={forced} wide={state.status === 'ready' && layout === 'cover'}>
      {state.status === 'loading' && <Loading />}
      {state.status === 'missing' && <Missing handle={handle} />}
      {state.status === 'ready' && (
        <div className={`flex w-full flex-col items-center animate-rise-in ${layout === 'cover' ? 'gap-10' : 'gap-8'} ${layout === 'cover' ? '' : layout === 'minimal' ? 'max-w-[560px] pt-2' : 'max-w-[560px]'}`}>
          <ProfileCard profile={profile} className={layout === 'card' ? 'w-full shadow-[0_24px_60px_-32px_var(--shadow-cast)]' : 'w-full'} />
          <p className="flex flex-wrap items-center justify-center gap-x-2 px-5 text-[12.5px] text-ink-subtle">
            {isOwner ? (
              <a {...link(dashboardPath('profile'))} className="inline-flex items-center gap-1 text-ink-muted transition-colors hover:text-ink-strong">
                <Icon name="settings" className="h-3.5 w-3.5" /> Edit your profile
              </a>
            ) : (
              <>
                <span>A member of {SITE_NAME}.</span>
                <a {...link(session ? dashboardPath('profile') : LOGIN_PATH)} className="inline-flex items-center gap-1 text-ink-muted transition-colors hover:text-ink-strong">
                  Create yours <span aria-hidden="true">→</span>
                </a>
              </>
            )}
          </p>
        </div>
      )}
    </Shell>
  )
}
