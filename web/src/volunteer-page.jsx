import { Fragment, useCallback, useEffect, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import SiteFooter from './components/site-footer'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { Bone } from './components/skeleton'
import { link, HOME_PATH, dashboardPath } from './lib/router'
import { useAuth } from './lib/supabase'
import { isSiteOwner } from './lib/dashboard'
import { VOLUNTEER_INTRO, eventsByYear, totalsOf, formatRange, formatHours, photoUrl } from './lib/volunteer'
import { listEvents, errorText } from './lib/volunteer-api'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const GUTTER = 'px-6 sm:px-10'
const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]'

const CAS = [
  { letter: 'C', rest: 'reativity,', tilt: -7, lean: -3 },
  { letter: 'A', rest: 'ctivity,', tilt: 6, lean: 2.5 },
  { letter: 'S', rest: 'ervice', tilt: -5, lean: -2 },
]
const SCRIBBLE = 'M4 13C38 6 70 16 104 10s66-6 92 2M22 21c44-7 96-4 150-6'

function Title() {
  const [open, setOpen] = useState(false)
  return (
    <h1
      aria-label="CAS: Creativity, Activity, Service"
      className="volunteer-title mt-8 font-vergilia text-[34px] leading-[1.1] text-ink-strong sm:text-[48px] animate-fade-in-up"
      style={{ animationDelay: '60ms' }}
    >
      <span aria-hidden="true" data-open={open || undefined} onClick={() => setOpen((o) => !o)} className="vol-cas relative inline-block">
        {CAS.map(({ letter, rest, tilt, lean }, i) => (
          <Fragment key={letter}>
            {i > 0 && <span className="vol-gap"> </span>}
            <span className="whitespace-nowrap">
              <span className="vol-stamp" style={{ '--i': i, '--tilt': `${tilt}deg`, '--rest': `${lean}deg` }}>
                {letter}
              </span>
              <span className="vol-rest" style={{ '--i': i }}>
                <span>{rest}</span>
              </span>
            </span>
          </Fragment>
        ))}
        <svg viewBox="0 0 200 26" preserveAspectRatio="none" className="vol-scribble pointer-events-none absolute overflow-visible">
          <path vectorEffect="non-scaling-stroke" d={SCRIBBLE} />
        </svg>
      </span>
    </h1>
  )
}

function Stats({ events }) {
  const totals = totalsOf(events)
  const cells = [
    { label: 'Events', value: totals.events },
    { label: 'Hours', value: totals.hours },
    { label: 'Organizations', value: totals.organizations },
    { label: 'Days', value: totals.days },
  ]
  return (
    <dl className="grid grid-cols-2 border-y border-dashed border-line sm:grid-cols-4 animate-rise-in" style={{ animationDelay: '220ms' }}>
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={`flex flex-col gap-1 py-6 ${GUTTER} ${i % 2 ? 'border-l' : ''} ${i >= 2 ? 'border-t sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''} border-dashed border-line`}
        >
          <dt className={KICKER}>{cell.label}</dt>
          <dd className="text-[28px] font-semibold tabular-nums tracking-tight text-ink-strong">{cell.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Lightbox({ photos, index, title, onClose, onStep }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onStep(1)
      else if (e.key === 'ArrowLeft') onStep(-1)
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose, onStep])

  const many = photos.length > 1
  const ARROW = 'grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-black/50 text-white outline-none transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white/60'

  return (
    <div role="dialog" aria-modal="true" aria-label={`${title}, photo ${index + 1} of ${photos.length}`} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 animate-overlay-in" onClick={onClose}>
      <img
        key={photos[index]}
        src={photoUrl(photos[index])}
        alt={`${title}, photo ${index + 1}`}
        className="max-h-[86vh] max-w-full rounded-lg object-contain shadow-2xl animate-rise-in"
        onClick={(e) => e.stopPropagation()}
      />
      <button type="button" aria-label="Close" onClick={onClose} className={`${ARROW} absolute right-4 top-4`}>
        <Icon name="x" className="h-4 w-4" />
      </button>
      {many && (
        <>
          <button type="button" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); onStep(-1) }} className={`${ARROW} absolute left-4 top-1/2 -translate-y-1/2`}>
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); onStep(1) }} className={`${ARROW} absolute right-4 top-1/2 -translate-y-1/2`}>
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-[11px] tabular-nums text-white/70">
            {index + 1} / {photos.length}
          </p>
        </>
      )}
    </div>
  )
}

function EventCard({ event, index, onOpenPhoto }) {
  const meta = [event.organization, event.role, event.location].filter(Boolean)
  return (
    <li
      className={`grid gap-x-8 gap-y-3 border-t border-dashed border-line py-8 first:border-t-0 sm:grid-cols-[150px_1fr] animate-rise-in`}
      style={{ animationDelay: `${300 + Math.min(index, 6) * 60}ms` }}
    >
      <div className="flex flex-row items-baseline gap-3 sm:flex-col sm:gap-1.5">
        <time dateTime={event.startedOn} className="font-mono text-[12px] tabular-nums text-ink-secondary">
          {formatRange(event.startedOn, event.endedOn)}
        </time>
        {event.hours != null && <span className="font-mono text-[11px] tabular-nums text-ink-faint">{formatHours(event.hours)}</span>}
      </div>

      <article className="min-w-0">
        <h3 className="text-[18px] font-semibold leading-snug tracking-tight text-ink-strong">
          {event.title}
          {!event.published && (
            <span className="ml-2 inline-flex translate-y-[-2px] items-center rounded border border-amber-500/40 px-1.5 py-px align-middle text-[10px] font-medium uppercase tracking-wide text-amber-500">
              Hidden
            </span>
          )}
        </h3>
        {meta.length > 0 && (
          <p className="mt-1 text-[13px] text-ink-muted">
            {meta.map((part, i) => (
              <span key={i}>
                {i > 0 && <span aria-hidden="true" className="mx-1.5 text-ink-faint">·</span>}
                {part}
              </span>
            ))}
          </p>
        )}
        {event.summary && <p className="mt-3 max-w-[62ch] whitespace-pre-line text-[14px] leading-[1.65] text-ink-secondary">{event.summary}</p>}

        {event.photos.length > 0 && (
          <ul className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label="Photos">
            {event.photos.map((path, i) => (
              <li key={path} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenPhoto(event, i)}
                  aria-label={`Open photo ${i + 1} of ${event.title}`}
                  className={`group block h-24 w-32 cursor-zoom-in overflow-hidden rounded-lg border border-line bg-surface-raised outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/40 sm:h-28 sm:w-40`}
                >
                  <img
                    src={photoUrl(path)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-cover transition-transform duration-500 ${EASE} group-hover:scale-[1.04]`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        {(event.tags.length > 0 || event.url) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            {event.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-line px-2 py-0.5 text-[11.5px] text-ink-subtle">
                {tag}
              </span>
            ))}
            {event.url && (
              <a href={event.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink-strong">
                Event page <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        )}
      </article>
    </li>
  )
}

function Timeline({ events, onOpenPhoto }) {
  let index = 0
  return (
    <div className={`${GUTTER} pb-16`}>
      {eventsByYear(events).map(({ year, events: items }) => (
        <section key={year} aria-labelledby={`volunteer-${year}`} className="pt-12">
          <h2 id={`volunteer-${year}`} className={`${KICKER} flex items-baseline gap-2 pb-2`}>
            {year}
            <span className="text-ink-faint">· {items.length}</span>
          </h2>
          <ol>
            {items.map((event) => (
              <EventCard key={event.id} event={event} index={index++} onOpenPhoto={onOpenPhoto} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading events">
      <div className="grid grid-cols-2 border-y border-dashed border-line sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`flex flex-col gap-2 py-6 ${GUTTER}`}>
            <Bone className="h-3 w-16" />
            <Bone className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className={`${GUTTER} flex flex-col gap-10 pt-14 pb-16`}>
        {[0, 1].map((i) => (
          <div key={i} className="grid gap-4 sm:grid-cols-[150px_1fr]">
            <Bone className="h-3 w-24" />
            <div className="flex flex-col gap-2.5">
              <Bone className="h-5 w-2/3" />
              <Bone className="h-3 w-1/3" />
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Blank({ children, action }) {
  return (
    <div className={`${GUTTER} pb-20`}>
      <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center animate-rise-in">
        <Icon name="calendar" className="mx-auto h-5 w-5 text-ink-faint" />
        <p className="mx-auto mt-3 max-w-[40ch] text-[13.5px] leading-relaxed text-ink-muted">{children}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}

export default function VolunteerPage({ theme, onToggleTheme }) {
  const { session } = useAuth()
  const owner = isSiteOwner(session?.user)
  const [state, setState] = useState({ status: 'loading', events: [], error: null })
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    let cancelled = false
    listEvents()
      .then((events) => { if (!cancelled) setState({ status: 'ready', events, error: null }) })
      .catch((error) => { if (!cancelled) setState({ status: 'error', events: [], error }) })
    return () => { cancelled = true }
  }, [])

  const openPhoto = useCallback((event, index) => setViewing({ event, index }), [])
  const closePhoto = useCallback(() => setViewing(null), [])
  const stepPhoto = useCallback(
    (by) => setViewing((v) => v && { ...v, index: (v.index + by + v.event.photos.length) % v.event.photos.length }),
    [],
  )

  const addLink = owner && (
    <a
      {...link(dashboardPath('volunteer/new'))}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[12.5px] font-medium text-ink-secondary transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink-strong"
    >
      <Icon name="plus" className="h-3.5 w-3.5" /> Add an event
    </a>
  )

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-x border-dashed border-line top-0 flex items-center px-6 sm:px-10">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="group inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
            <span>Back to Home</span>
          </a>
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

      <main className="w-full max-w-[960px] mx-auto flex flex-col min-h-screen pt-14 border-x border-dashed border-line bg-bg">
        <section className={`${GUTTER} pt-16 pb-14 sm:pt-24 sm:pb-16`}>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 animate-rise-in">
            <p className={KICKER}>/ volunteer</p>
            {addLink}
          </div>
          <Title />
          <p className="mt-6 max-w-[46ch] text-[15px] leading-[1.6] text-ink-muted animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            {VOLUNTEER_INTRO}
          </p>
        </section>

        {state.status === 'loading' && <Skeleton />}
        {state.status === 'error' && <Blank>{errorText(state.error)}</Blank>}
        {state.status === 'ready' && state.events.length === 0 && (
          <Blank action={addLink}>Nothing logged here yet. The first event is on its way.</Blank>
        )}
        {state.status === 'ready' && state.events.length > 0 && (
          <>
            <Stats events={state.events} />
            <Timeline events={state.events} onOpenPhoto={openPhoto} />
          </>
        )}

        <SiteFooter gutter={GUTTER} className="mt-auto" />
      </main>

      {viewing && (
        <Lightbox photos={viewing.event.photos} index={viewing.index} title={viewing.event.title} onClose={closePhoto} onStep={stepPhoto} />
      )}
    </div>
  )
}
