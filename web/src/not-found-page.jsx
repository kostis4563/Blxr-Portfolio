import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import NotFoundMatrix from './components/not-found-matrix'
import { useI18n } from './lib/i18n'
import {
  link,
  navigate,
  normalizePath,
  localizePath,
  splitLocale,
  currentLang,
  canGoBack,
  backOr,
  HOME_PATH,
  PROJECTS_PATH,
  LIBRARY_PATH,
  projectPath,
  libraryPath,
} from './lib/router'
import { openPalette, usePaletteOpen, isMacLike, jumpToSection, SECTIONS } from './lib/palette'
import { suggestRoutes, splitKnownPrefix } from './lib/route-suggest'
import { readRecent } from './lib/recent'
import { projectsList } from './lib/projects'
import { libraryList } from './lib/library'
import { CONTACT_EMAIL, GITHUB_URL } from './lib/profile'
import { SITE_NAME, SITE_URL } from './lib/seo'

const REDIRECT_SECONDS = 5

function obviousFix(route) {
  return normalizePath(
    route
      .toLowerCase()
      .replace(/\/{2,}/g, '/')
      .replace(/[.,;:!?)\]}'"»”’]+$/g, ''),
  )
}

export default function NotFoundPage({ theme, onToggleTheme }) {
  const { t } = useI18n()
  const paletteOpen = usePaletteOpen()

  const catalogue = useMemo(
    () => [
      { path: HOME_PATH, label: t('cmd.home') },
      { path: PROJECTS_PATH, label: t('proj.archiveTitle') },
      ...projectsList.map((p) => ({ path: projectPath(p.id), label: p.title })),
      { path: LIBRARY_PATH, label: t('lib.title') },
      ...libraryList.map((entry) => ({ path: libraryPath(entry.id), label: entry.title })),
      ...SECTIONS.map((s) => ({ path: `/${s.id}`, label: t(s.key), section: s.id })),
    ],
    [t],
  )

  const pages = useMemo(() => catalogue.filter((e) => !e.section), [catalogue])

  const [asked, setAsked] = useState(null)

  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState(0)
  const [mac, setMac] = useState(false)
  const [back, setBack] = useState(false)
  const [recent, setRecent] = useState([])
  const [showAll, setShowAll] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const { route } = splitLocale(window.location.pathname)
    let referrer = null
    try {
      if (document.referrer) {
        const from = new URL(document.referrer)
        referrer = { host: from.host, internal: from.host === window.location.host }
      }
    } catch {}
    setAsked({ host: window.location.host, route, referrer })
    setValue(route)
    setMac(isMacLike())
    setBack(canGoBack())
    setRecent(readRecent())
    try {
      console.info(
        `%c404%c nothing at ${route} — the site's source is at ${GITHUB_URL}/blxr`,
        'font-weight:700;padding:1px 6px;border-radius:3px;background:#6366f1;color:#fff',
        'font-weight:400',
      )
    } catch {
    }
  }, [])

  const route = normalizePath(value || '/')
  const split = useMemo(() => splitKnownPrefix(route, pages), [route, pages])
  const exact = useMemo(() => pages.find((e) => e.path === route) || null, [route, pages])
  const matches = useMemo(() => (asked ? suggestRoutes(route, catalogue) : []), [asked, route, catalogue])
  const hasMatches = matches.length > 0

  const suggestions = hasMatches
    ? matches
    : pages.filter((e) => [HOME_PATH, PROJECTS_PATH, LIBRARY_PATH].includes(e.path))

  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, suggestions.length - 1)))
  }, [suggestions.length])

  const wasAt = useMemo(
    () =>
      recent
        .filter((r) => r !== (asked?.route ?? null))
        .map((r) => catalogue.find((e) => !e.section && e.path === r))
        .filter(Boolean)
        .slice(0, 2),
    [recent, asked, catalogue],
  )

  useEffect(() => {
    if (asked) document.title = `404 · ${asked.route} — ${SITE_NAME}`
  }, [asked])

  const obvious = useMemo(() => {
    if (!asked) return null
    const fixed = obviousFix(asked.route)
    if (fixed === asked.route) return null
    return catalogue.find((e) => e.path === fixed) || null
  }, [asked, catalogue])

  useEffect(() => {
    if (!obvious) return
    setCountdown(REDIRECT_SECONDS)
    let left = REDIRECT_SECONDS
    const tick = window.setInterval(() => {
      left -= 1
      setCountdown(left)
      if (left <= 0) {
        window.clearInterval(tick)
        if (obvious.section) jumpToSection(obvious.section)
        else navigate(obvious.path)
      }
    }, 1000)
    const cancel = () => {
      window.clearInterval(tick)
      setCountdown(null)
    }

    const arm = requestAnimationFrame(() => {
      document.addEventListener('keydown', cancel, { once: true })
      document.addEventListener('pointerdown', cancel, { once: true })
    })
    return () => {
      cancelAnimationFrame(arm)
      window.clearInterval(tick)
      document.removeEventListener('keydown', cancel)
      document.removeEventListener('pointerdown', cancel)
    }
  }, [obvious])
  const redirecting = obvious && countdown !== null

  const open = useCallback((entry) => {
    if (!entry) return
    if (entry.section) jumpToSection(entry.section)
    else navigate(entry.path)
  }, [])

  const go = useCallback(() => {
    if (redirecting) open(obvious)
    else if (exact) navigate(exact.path)
    else open(suggestions[selected])
  }, [redirecting, obvious, exact, open, suggestions, selected])

  const startEditing = useCallback(() => {
    setEditing(true)

    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }, [])

  useEffect(() => {
    if (!asked || paletteOpen) return
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target
      const inField = target === inputRef.current
      if (!inField && target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const n = suggestions.length
        if (!n) return
        setSelected((s) => (e.key === 'ArrowDown' ? (s + 1) % n : (s - 1 + n) % n))
        return
      }
      if (e.key === 'Enter') {
        if (!inField && target instanceof HTMLElement && target.closest('a, button')) return
        e.preventDefault()
        go()
        return
      }
      if (inField) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setValue(asked.route)
          setEditing(false)
          inputRef.current?.blur()
        }
        return
      }
      if (/^[1-9]$/.test(e.key)) {
        const entry = suggestions[Number(e.key) - 1]
        if (entry) {
          e.preventDefault()
          open(entry)
        }
        return
      }
      if (e.key === '/' || e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        startEditing()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [asked, paletteOpen, suggestions, go, open, startEditing])

  const reportHref = asked
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Broken link: ${asked.route}`)}&body=${encodeURIComponent(
        `Page: ${SITE_URL}${asked.route}\n` +
        (asked.referrer ? `Came from: ${document.referrer}\n` : '') +
        '\n',
      )}`
    : '#'

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">

      <header className="w-full max-w-[768px] bg-bg/90 backdrop-blur-md text-ink h-[52px] fixed left-1/2 -translate-x-1/2 z-40 border-b border-l border-dashed border-r border-line top-4 flex items-center px-6">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
            <span>{t('proj.backHome')}</span>
          </a>
          {}
          <div className="flex items-center gap-4">
            <CommandButton className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-strong transition-colors duration-200" />
            <ThemeToggle
              theme={theme}
              onToggle={onToggleTheme}
              className="text-ink-muted hover:text-ink-strong transition-colors duration-200"
            />
          </div>
        </div>
      </header>

      <main className="w-full max-w-[768px] mx-auto px-6 pt-32 pb-16 flex flex-col items-start justify-center border-l border-dashed border-r border-line min-h-screen bg-bg animate-rise-in">

        {}
        <NotFoundMatrix figure={exact ? '200' : '404'} className="mb-4" />

        <h1 className="text-[28px] sm:text-[34px] font-extrabold text-ink-strong tracking-[-0.03em] leading-[1.15] mb-3">
          {t('nf.title')}
        </h1>

        <p className="text-[15px] text-ink-muted font-normal leading-relaxed max-w-[46ch]">
          {t('nf.body')}
        </p>

        {}
        <div className="mt-8 w-full min-h-[4.5rem]">
          {asked && (
            <div className="animate-fade-in-up">
              <div className="flex items-center justify-between gap-4 mb-2">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
                  {t('nf.asked')}
                </p>
                {!editing && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle hover:text-ink-strong transition-colors cursor-pointer"
                  >
                    <svg className="w-[11px] h-[11px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    <span>{t('nf.fix')}</span>
                    <kbd aria-hidden="true" className="hidden sm:inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded border border-line-strong text-[9.5px] text-ink-faint normal-case tracking-normal">/</kbd>
                  </button>
                )}
              </div>

              {}
              <p dir="ltr" className="font-mono text-[13px] sm:text-[14px] leading-[1.9] break-all text-left rtl:text-right">
                <span className="text-ink-faint">{asked.host}</span>
                {editing ? (
                  <span className="nf-field" data-value={value}>
                    <input
                      ref={inputRef}
                      type="text"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      onBlur={() => setEditing(false)}
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      aria-label={t('nf.fix')}
                      className="nf-input text-ink-strong"
                    />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={startEditing}
                    title={t('nf.fix')}
                    className="text-left cursor-text"
                  >
                    <span className="text-ink-subtle">{split.known}</span>
                    {split.unknown && (
                      <span className={`text-ink-strong ${exact ? '' : 'nf-unknown'}`}>{split.unknown}</span>
                    )}
                  </button>
                )}
              </p>

              {}
              <p className="mt-1.5 text-[13px] leading-relaxed min-h-[1.25rem]" aria-live="polite">
                {redirecting ? (
                  <span className="text-brand-indigo">
                    {t('nf.redirecting', { label: obvious.label, n: countdown })}
                    {' · '}
                    <button
                      type="button"
                      onClick={() => setCountdown(null)}
                      className="underline underline-offset-4 decoration-brand-indigo/50 hover:decoration-brand-indigo cursor-pointer"
                    >
                      {t('nf.stay')}
                    </button>
                  </span>
                ) : exact ? (
                  <span className="text-brand-indigo">{t('nf.exists')}</span>
                ) : asked.referrer ? (
                  <span className="text-ink-subtle">
                    {asked.referrer.internal
                      ? t('nf.fromInternal')
                      : t('nf.fromExternal', { host: asked.referrer.host })}
                  </span>
                ) : null}
              </p>
            </div>
          )}
        </div>

        {}
        <div className="mt-8 w-full min-h-[5.5rem]">
          {asked && (
            <div className="animate-fade-in-up delay-150 w-full">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint mb-2" aria-live="polite">
                {hasMatches ? t('nf.didYouMean') : t('nf.instead')}
              </p>
              <ul className="w-full border-t border-dashed border-line">
                {suggestions.map((entry, i) => (
                  <li key={entry.path} className="border-b border-dashed border-line">
                    <SuggestionLink
                      entry={entry}
                      index={i}
                      selected={i === selected}
                      onHover={() => setSelected(i)}
                    />
                  </li>
                ))}
              </ul>

              {}
              {wasAt.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
                    {t('nf.recent')}
                  </span>
                  {wasAt.map((entry) => (
                    <a
                      key={entry.path}
                      {...link(entry.path)}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-line-strong bg-surface-raised text-[12.5px] font-medium text-ink-secondary hover:text-ink-strong transition-colors cursor-pointer"
                    >
                      <span>{entry.label}</span>
                      <span dir="ltr" className="font-mono text-[11px] text-ink-faint">
                        {localizePath(entry.path, currentLang())}
                      </span>
                    </a>
                  ))}
                </div>
              )}

              {}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  aria-expanded={showAll}
                  className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle hover:text-ink-strong transition-colors cursor-pointer"
                >
                  <span aria-hidden="true" className={`inline-block transition-transform duration-200 ${showAll ? 'rotate-90' : ''}`}>›</span>
                  <span>{showAll ? t('nf.hidePages') : t('nf.allPages')}</span>
                </button>
                {showAll && (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 animate-fade-in-up">
                    <PageGroup title={t('nf.pages')} entries={pages.filter((e) => [HOME_PATH, PROJECTS_PATH, LIBRARY_PATH].includes(e.path))} />
                    <PageGroup title={t('nf.sections')} entries={catalogue.filter((e) => e.section)} />
                    <PageGroup title={t('home.projects')} entries={pages.filter((e) => e.path.startsWith(PROJECTS_PATH + '/'))} />
                    <PageGroup title={t('lib.title')} entries={pages.filter((e) => e.path.startsWith(LIBRARY_PATH + '/'))} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a
            {...link(HOME_PATH)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ink-strong text-ink-inverse text-[13px] font-semibold hover:bg-ink-secondary transition-colors cursor-pointer"
          >
            <span>{t('proj.backHome')}</span>
            <span>→</span>
          </a>
          <button
            type="button"
            onClick={openPalette}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-raised border border-line-strong text-ink-secondary hover:text-ink-strong text-[13px] font-semibold transition-colors cursor-pointer"
          >
            <span>{t('nf.search')}</span>
            <kbd dir="ltr" aria-hidden="true" className="hidden sm:inline font-mono text-[10px] tracking-[0.04em] text-ink-subtle">
              {mac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
          {}
          {back && (
            <button
              type="button"
              onClick={() => backOr(HOME_PATH)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-raised border border-line-strong text-ink-secondary hover:text-ink-strong text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <span aria-hidden="true">←</span>
              <span>{t('nf.back')}</span>
            </button>
          )}
          {}
          {asked && (
            <a
              href={reportHref}
              className="ml-1 text-[13px] font-medium text-ink-subtle hover:text-ink-strong underline decoration-line-strong underline-offset-4 transition-colors"
            >
              {t('nf.report')}
            </a>
          )}
        </div>

      </main>
    </div>
  )
}

function SuggestionLink({ entry, index, selected, onHover }) {
  const href = entry.section
    ? `${localizePath(HOME_PATH, currentLang())}#${entry.section}`
    : localizePath(entry.path, currentLang())
  const props = entry.section
    ? {
        href,
        onClick: (e) => {
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          jumpToSection(entry.section)
        },
      }
    : link(entry.path)

  return (
    <a
      {...props}
      onPointerEnter={(e) => {
        props.onPointerEnter?.(e)
        onHover()
      }}
      aria-current={selected ? 'true' : undefined}
      className={`group flex items-center justify-between gap-4 py-3 -mx-2 px-2 rounded-md transition-colors cursor-pointer ${
        selected ? 'bg-surface-raised' : ''
      }`}
    >
      <span className="flex items-center gap-3 min-w-0">
        {}
        <kbd
          aria-hidden="true"
          className={`hidden sm:inline-flex items-center justify-center w-[18px] h-[18px] rounded border font-mono text-[10px] transition-colors ${
            selected ? 'border-line-strong text-ink-secondary' : 'border-line text-ink-faint'
          }`}
        >
          {index + 1}
        </kbd>
        <span className="text-[14px] font-medium text-ink-strong truncate">{entry.label}</span>
      </span>
      <span className="flex items-center gap-3 shrink-0">
        {}
        <span dir="ltr" className="font-mono text-[12px] text-ink-subtle">{href}</span>
        <span
          aria-hidden="true"
          className={`hidden sm:inline font-mono text-[11px] transition-all duration-200 ${
            selected ? 'opacity-100 translate-x-0 text-ink-muted' : 'opacity-0 -translate-x-1'
          }`}
        >
          ↵
        </span>
      </span>
    </a>
  )
}

function PageGroup({ title, entries }) {
  if (!entries.length) return null
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-2">{title}</p>
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => {
          const props = entry.section
            ? {
                href: `${localizePath(HOME_PATH, currentLang())}#${entry.section}`,
                onClick: (e) => {
                  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                  e.preventDefault()
                  jumpToSection(entry.section)
                },
              }
            : link(entry.path)
          return (
            <li key={entry.path}>
              <a
                {...props}
                className="group inline-flex items-baseline gap-2 text-[13px] text-ink-secondary hover:text-ink-strong transition-colors cursor-pointer"
              >
                <span className="text-ink-faint group-hover:text-ink-muted transition-colors" aria-hidden="true">→</span>
                <span>{entry.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
