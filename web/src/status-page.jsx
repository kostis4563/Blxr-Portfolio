import { useEffect, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { link, HOME_PATH, USES_PATH, CONTACT_PATH } from './lib/router'
import { relativeTime, absoluteTime } from './lib/reviews'
import {
  fetchStatus,
  overallOf,
  dayTone,
  describeDay,
  describeCode,
  dayLabel,
  formatUptime,
  formatSpan,
  formatMs,
  stripSummary,
  STATUS_INTRO,
  POLL_MS,
  MOBILE_DAYS,
} from './lib/status'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'

const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'

const RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

const CSS = `
.uptime-ui{--up:#059669;--partial:#f59e0b;--down:#ef4444}
:root[data-theme='light'] .uptime-ui{--up:#047857;--partial:#d58a00;--down:#b91c1c}
.uptime-bar{border-radius:2px;background:var(--color-line-strong)}
.uptime-bar[data-tone=up]{background:var(--up)}
.uptime-bar[data-tone=partial]{background:var(--partial)}
.uptime-bar[data-tone=down]{background:var(--down)}
.uptime-ink{color:var(--color-ink-faint)}
.uptime-ink[data-tone=up]{color:var(--up)}
.uptime-ink[data-tone=partial]{color:var(--partial)}
.uptime-ink[data-tone=down]{color:var(--down)}
`

const STATE = {
  up: { label: 'Operational', icon: 'circleCheck', tone: 'up' },
  down: { label: 'Down', icon: 'xCircle', tone: 'down' },
  unknown: { label: 'Checking', icon: 'clock', tone: 'unknown' },
}

const OVERALL_ICON = { up: 'circleCheck', partial: 'alert', down: 'xCircle', unknown: 'clock' }

function useStatus() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(null)

  useEffect(() => {
    let controller = null
    const load = async () => {
      controller?.abort()
      controller = new AbortController()
      try {
        setData(await fetchStatus({ signal: controller.signal }))
        setError(null)
      } catch (err) {
        if (err?.name === 'AbortError') return
        setError(err)
      }
      setNow(Date.now())
    }
    const visible = () => document.visibilityState === 'visible'
    const onVisibility = () => {
      if (visible()) load()
    }

    load()
    const poll = setInterval(() => {
      if (visible()) load()
    }, POLL_MS)
    const tick = setInterval(() => setNow(Date.now()), 15_000)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      controller?.abort()
      clearInterval(poll)
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return { data, error, now }
}

function Overall({ data, error, now }) {
  const services = data?.services ?? []
  const overall = error && !data ? { tone: 'down', label: 'The status check is not answering' } : overallOf(services)
  const up = services.filter((s) => s.state === 'up').length

  let detail = 'Loading the latest checks…'
  if (error && !data) detail = 'The server behind this page did not reply. That usually means it is down itself.'
  else if (data && !data.checkedAt) detail = 'The first check has not finished yet.'
  else if (data) detail = `${up} of ${services.length} up · checked ${relativeTime(data.checkedAt, now ?? Date.now())}`

  return (
    <section
      aria-live="polite"
      className="w-full flex items-center gap-4 rounded-2xl border border-line bg-surface-raised px-5 py-5 sm:px-6 animate-rise-in"
      style={{ animationDelay: '240ms' }}
    >
      <span data-tone={overall.tone} className="uptime-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
        <Icon name={OVERALL_ICON[overall.tone]} className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <h2 className="text-[18px] sm:text-[20px] font-semibold tracking-[-0.02em] text-ink-strong">{overall.label}</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">{detail}</p>
        {error && data && (
          <p className="mt-1 text-[12px] text-ink-subtle">The last refresh failed, so this is the previous result.</p>
        )}
      </div>
    </section>
  )
}

function StatePill({ service }) {
  const state = STATE[service.state]
  const reason = service.state === 'down' ? describeCode(service.code) : ''
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-secondary">
      <span data-tone={state.tone} className="uptime-ink">
        <Icon name={state.icon} className="h-3.5 w-3.5" strokeWidth={2.2} />
      </span>
      <span>{state.label}</span>
      {reason && <span className="font-mono text-[10.5px] text-ink-subtle">{reason}</span>}
    </span>
  )
}

function Stat({ term, value, sub }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle">{term}</dt>
      <dd className="mt-1 truncate text-[15px] font-semibold tabular-nums tracking-tight text-ink-strong">{value}</dd>
      {sub && <dd className="truncate text-[11.5px] text-ink-subtle">{sub}</dd>}
    </div>
  )
}

function UptimeStrip({ service, every }) {
  const [active, setActive] = useState(null)
  const { days } = service
  const shown = active == null ? null : days[active]
  const firstMobile = Math.max(0, days.length - MOBILE_DAYS)

  const onKeyDown = (event) => {
    const last = days.length - 1
    const start = active ?? last
    let next = null
    if (event.key === 'ArrowLeft') next = Math.max(window.matchMedia('(max-width: 639px)').matches ? firstMobile : 0, start - 1)
    else if (event.key === 'ArrowRight') next = Math.min(last, start + 1)
    else if (event.key === 'Home') next = window.matchMedia('(max-width: 639px)').matches ? firstMobile : 0
    else if (event.key === 'End') next = last
    else if (event.key === 'Escape') {
      setActive(null)
      return
    }
    if (next == null) return
    event.preventDefault()
    setActive(next)
  }

  return (
    <div className="mt-5">
      <div
        tabIndex={0}
        role="group"
        aria-label={`Daily uptime for ${service.name}. ${stripSummary(days)} Use the arrow keys to read each day.`}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'touch') setActive(null)
        }}
        className={`flex h-9 items-stretch gap-[2px] rounded-[3px] ${RING}`}
      >
        {days.map((day, i) => (
          <span
            key={day.day}
            data-tone={dayTone(day)}
            onPointerEnter={() => setActive(i)}
            onPointerDown={() => setActive(i)}
            className={`uptime-bar min-w-0 flex-1 transition-opacity duration-150 ${i < firstMobile ? 'max-sm:hidden' : ''} ${active != null && active !== i ? 'opacity-45' : ''}`}
          />
        ))}
      </div>
      <p aria-live="polite" className="mt-2 flex min-h-4 items-center justify-between gap-3 font-mono text-[10.5px] text-ink-subtle">
        {shown ? (
          <>
            <span className="text-ink-secondary">{dayLabel(shown.day, 'long')}</span>
            <span className="truncate">{describeDay(shown, every)}</span>
          </>
        ) : (
          <>
            <span>
              <span className="sm:hidden">{MOBILE_DAYS} days ago</span>
              <span className="max-sm:hidden">{days.length} days ago</span>
            </span>
            <span>Today</span>
          </>
        )}
      </p>
    </div>
  )
}

function ServiceCard({ service, every, now }) {
  const since = service.since && now ? formatSpan(now - Date.parse(service.since)) : '—'
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface-raised p-5 transition-colors duration-300 hover:border-line-strong">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-ink-strong">{service.name}</h3>
          {service.link ? (
            <a
              href={service.link}
              target="_blank"
              rel="noreferrer"
              className={`group/app mt-0.5 inline-flex items-center gap-1 rounded font-mono text-[11px] text-ink-subtle transition-colors duration-200 hover:text-ink-strong ${RING}`}
            >
              <span className="truncate">{service.host}</span>
              <span aria-hidden="true" className="transition-transform duration-200 group-hover/app:translate-x-0.5 group-hover/app:-translate-y-0.5">↗</span>
            </a>
          ) : (
            <p className="mt-0.5 truncate font-mono text-[11px] text-ink-subtle">{service.host}</p>
          )}
        </div>
        <StatePill service={service} />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <Stat term="Uptime" value={formatUptime(service.uptime)} sub={`${service.days.length} days`} />
        <Stat term="Response" value={formatMs(service.ms)} sub={service.avgMs != null ? `avg ${formatMs(service.avgMs)}` : null} />
        <Stat term={service.state === 'down' ? 'Down for' : 'Up for'} value={service.state === 'unknown' ? '—' : since} />
      </dl>

      <UptimeStrip service={service} every={every} />
    </article>
  )
}

function ServiceSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-2xl border border-line bg-surface-raised p-5">
      <div className="h-4 w-32 rounded skeleton" />
      <div className="mt-2 h-3 w-24 rounded skeleton" />
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 rounded skeleton" />
        ))}
      </div>
      <div className="mt-5 h-9 rounded skeleton" />
    </div>
  )
}

function Incidents({ incidents, now }) {
  return (
    <section aria-labelledby="incidents-title" className="w-full">
      <h2 id="incidents-title" className={`${KICKER} mb-4`}>Incidents</h2>
      {incidents.length ? (
        <ol className="flex flex-col border-t border-dashed border-line">
          {incidents.map((incident) => {
            const lasted = (incident.end ? Date.parse(incident.end) : now ?? Date.parse(incident.start)) - Date.parse(incident.start)
            return (
              <li key={`${incident.service}-${incident.start}`} className="flex flex-col gap-1 border-b border-dashed border-line py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span data-tone={incident.end ? 'unknown' : 'down'} className="uptime-ink">
                    <Icon name={incident.end ? 'circleCheck' : 'xCircle'} className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="truncate text-[13.5px] font-semibold tracking-tight text-ink-strong">{incident.name} {incident.end ? 'was' : 'is'} down</span>
                  {incident.code && <span className="shrink-0 font-mono text-[10.5px] text-ink-subtle">{describeCode(incident.code)}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-3 pl-6.5 text-[12px] text-ink-muted sm:pl-0">
                  <time dateTime={incident.start}>{absoluteTime(incident.start)}</time>
                  <span aria-hidden="true" className="text-ink-faint">·</span>
                  {incident.end ? (
                    <span className="tabular-nums">{formatSpan(lasted)}</span>
                  ) : (
                    <span className="font-medium text-ink-strong">Ongoing{now ? `, ${formatSpan(lasted)} so far` : ''}</span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="border-t border-dashed border-line pt-4 text-[13px] text-ink-muted">No incidents in the last 90 days.</p>
      )}
    </section>
  )
}

export default function StatusPage({ theme, onToggleTheme }) {
  const { data, error, now } = useStatus()
  const every = data?.every ?? 300
  const minutes = Math.max(1, Math.round(every / 60))

  return (
    <div className="uptime-ui min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <style>{CSS}</style>
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
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

      <main className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-24 pb-20 flex flex-col items-start gap-8 min-h-screen bg-bg">
        <div className="w-full flex flex-col gap-3 text-left sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[560px]">
            <p className={`${KICKER} mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 animate-rise-in`}>
              <span>/ status</span>
              <span aria-hidden="true">·</span>
              <span>every {minutes} min</span>
            </p>
            <h1 className="text-[32px] sm:text-[36px] font-bold text-ink-strong tracking-[-0.035em] leading-tight mb-2 animate-rise-in" style={{ animationDelay: '60ms' }}>
              Status
            </h1>
            <p className="text-[14.5px] sm:text-[15px] text-ink-muted font-normal leading-relaxed animate-rise-in" style={{ animationDelay: '120ms' }}>
              {STATUS_INTRO}
            </p>
          </div>
          {data?.checkedAt && (
            <dl className="flex shrink-0 items-center gap-2 text-[12px] text-ink-subtle animate-rise-in">
              <dt className="font-mono uppercase tracking-wider text-[10.5px]">Checked</dt>
              <dd>
                <time dateTime={data.checkedAt} title={absoluteTime(data.checkedAt)}>
                  {relativeTime(data.checkedAt, now ?? Date.now())}
                </time>
              </dd>
            </dl>
          )}
        </div>

        <Overall data={data} error={error} now={now} />

        <section aria-label="Services" className="grid w-full grid-cols-1 gap-3 animate-rise-in" style={{ animationDelay: '300ms' }}>
          {data
            ? data.services.map((service) => <ServiceCard key={service.id} service={service} every={every} now={now} />)
            : !error && [0, 1].map((i) => <ServiceSkeleton key={i} />)}
        </section>

        {data && <Incidents incidents={data.incidents} now={now} />}

        <footer className="w-full max-w-[640px] border-t border-dashed border-line pt-7">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            How this works: the kostis.wtf server requests the site and the API every {minutes} minutes and counts any answer under HTTP 400 as up. A failed check is tried once more before it counts as down. Days are in UTC. If the server itself goes down, this page goes with it, so a grey bar means nothing was checking that day.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(USES_PATH)} className={FOOT_LINK}>
              <span>What it runs on</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a {...link(CONTACT_PATH)} className={FOOT_LINK}>
              <span>Report a problem</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
