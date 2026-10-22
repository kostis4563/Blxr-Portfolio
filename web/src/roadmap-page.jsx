import { Fragment, useEffect, useMemo, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { link, HOME_PATH, CHANGELOG_PATH, CV_PATH } from './lib/router'
import { GITHUB_URL } from './lib/profile'
import {
  ROADMAP_UPDATED,
  ROADMAP_INTRO,
  AREAS,
  STATUSES,
  GOALS,
  monthKey,
  monthLabel,
  dueOf,
  groupByYear,
  statusCounts,
  nextUp,
  todayBefore,
} from './lib/roadmap'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'

const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'

const RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

const ROW = 'grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-6'
const RAIL = 'relative min-w-0 border-l border-line pl-5'

const CSS = `
.roadmap-ui{--done:#10b981;--active:#f59e0b;--late:#f87171}
:root[data-theme='light'] .roadmap-ui{--done:#047857;--active:#b45309;--late:#b91c1c}
.status-ink[data-status=done]{color:var(--done)}
.status-ink[data-status=active]{color:var(--active)}
.status-ink[data-late]{color:var(--late)}
.goal-dot{background:var(--color-bg);border:1.5px solid var(--color-ink-faint)}
.goal-dot[data-status=done]{background:var(--done);border-color:var(--done)}
.goal-dot[data-status=active]{background:var(--active);border-color:var(--active)}
.goal-dot[data-late]{border-color:var(--late)}
.goal-bar[data-status=done]{background:var(--done)}
.goal-bar[data-status=active]{background:var(--active)}
.goal-bar[data-status=planned]{background:var(--color-line-strong)}
`

const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]))
const AREA_LABEL = Object.fromEntries(AREAS.map((a) => [a.id, a.label]))

const lateAttr = (late) => (late ? { 'data-late': '' } : {})

function formatUpdated(iso) {
  const date = new Date(`${iso}T00:00:00Z`)
  try {
    return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
  } catch {
    return iso
  }
}

function useToday() {
  const [today, setToday] = useState(ROADMAP_UPDATED.slice(0, 7))
  useEffect(() => setToday(monthKey(Date.now())), [])
  return today
}

function GoalTitle({ goal }) {
  if (!goal.href) return goal.title
  const internal = goal.href.startsWith('/')
  return (
    <a
      {...(internal ? link(goal.href) : { href: goal.href, target: '_blank', rel: 'noreferrer' })}
      className={`group/goal rounded transition-colors duration-200 hover:text-ink-secondary ${RING}`}
    >
      {goal.title}
      <span aria-hidden="true" className="ml-1 inline-block text-[12px] text-ink-faint transition-transform duration-200 group-hover/goal:translate-x-0.5 group-hover/goal:-translate-y-0.5">
        {internal ? '→' : '↗'}
      </span>
    </a>
  )
}

function When({ goal, short = false }) {
  const end = <time dateTime={goal.by} className="whitespace-nowrap">{monthLabel(goal.by, { short })}</time>
  if (!goal.from || goal.from === goal.by) return end
  return (
    <>
      <span className="whitespace-nowrap"><time dateTime={goal.from}>{monthLabel(goal.from, { short })}</time> –</span> {end}
    </>
  )
}

function Goal({ goal, today }) {
  const due = dueOf(goal, today)
  const when = <When goal={goal} short />
  const dueText = (
    <span data-status={goal.status} {...lateAttr(due.late)} className="status-ink">
      {due.text}
    </span>
  )

  return (
    <li className={ROW}>
      <div className="hidden flex-col gap-1 py-5 sm:flex">
        <span className={`${KICKER} tracking-[0.14em] pt-0.5`}>{when}</span>
        <span className="font-mono text-[11px] text-ink-subtle">{dueText}</span>
      </div>
      <div className={`${RAIL} py-5`}>
        <span
          aria-hidden="true"
          data-status={goal.status}
          {...lateAttr(due.late)}
          className="goal-dot absolute -left-[5px] top-[24px] h-[9px] w-[9px] rounded-full ring-4 ring-bg sm:top-[26px]"
        />
        <p className="mb-1.5 font-mono text-[11px] text-ink-subtle sm:hidden">
          {when}
          <span aria-hidden="true" className="text-ink-faint"> · </span>
          {dueText}
        </p>
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-ink-strong">
          <GoalTitle goal={goal} />
        </h3>
        {goal.note && <p className="mt-1 max-w-[560px] text-[13.5px] leading-relaxed text-ink-muted">{goal.note}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle">
          <span data-status={goal.status} className="status-ink">{STATUS_LABEL[goal.status]}</span>
          <span aria-hidden="true" className="text-ink-faint">·</span>
          <span>{AREA_LABEL[goal.area]}</span>
        </p>
      </div>
    </li>
  )
}

function TodayMark({ today }) {
  return (
    <li className={ROW}>
      <div className="hidden py-3 sm:block">
        <span className={`${KICKER} tracking-[0.14em] text-ink-strong`}>Today</span>
      </div>
      <div className={`${RAIL} flex items-center gap-3 py-3`}>
        <span aria-hidden="true" className="absolute -left-[4.5px] top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-ink-strong ring-4 ring-bg" />
        <span className="font-mono text-[11px] text-ink-strong sm:hidden">Today</span>
        <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-line-strong" />
        <time dateTime={today} className="font-mono text-[11px] text-ink-subtle">{monthLabel(today)}</time>
      </div>
    </li>
  )
}

function Progress({ goals, counts, next, today }) {
  const due = next && dueOf(next, today)
  const legend = [
    ...STATUSES.filter((s) => counts[s.id]).map((s) => ({ id: s.id, n: counts[s.id], label: s.label.toLowerCase() })),
    ...(counts.late ? [{ id: 'late', n: counts.late, label: 'late' }] : []),
  ]

  return (
    <section aria-label="Progress" className="w-full rounded-2xl border border-line bg-surface-raised p-5 sm:p-6 animate-rise-in" style={{ animationDelay: '180ms' }}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={KICKER}>Progress</p>
          <p className="mt-2 text-[30px] font-bold leading-none tracking-[-0.03em] text-ink-strong tabular-nums">
            {counts.done}
            <span className="text-ink-faint"> / {goals.length}</span>
          </p>
          <p className="mt-1.5 text-[13px] text-ink-muted">goals done</p>
        </div>
        {next && (
          <div className="min-w-0 sm:max-w-[360px] sm:text-right">
            <p className={KICKER}>Next up</p>
            <p className="mt-2 truncate text-[14.5px] font-semibold tracking-tight text-ink-strong">{next.title}</p>
            <p className="mt-1 font-mono text-[11px] text-ink-subtle">
              <When goal={next} />
              <span aria-hidden="true" className="text-ink-faint"> · </span>
              <span data-status={next.status} {...lateAttr(due.late)} className="status-ink">{due.text}</span>
            </p>
          </div>
        )}
      </div>
      <div
        role="img"
        aria-label={`${counts.done} of ${goals.length} goals done, ${counts.active} in progress, ${counts.planned} planned`}
        className="mt-6 flex h-1.5 w-full gap-1"
      >
        {STATUSES.filter((s) => counts[s.id]).map((s) => (
          <span key={s.id} data-status={s.id} className="goal-bar h-full rounded-full" style={{ flexGrow: counts[s.id] }} />
        ))}
      </div>
      <ul aria-hidden="true" className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-ink-muted">
        {legend.map((item) => (
          <li key={item.id} className="inline-flex items-center gap-2">
            <span
              data-status={item.id === 'late' ? 'planned' : item.id}
              {...lateAttr(item.id === 'late')}
              className="goal-dot h-2 w-2 rounded-full"
            />
            <span className="font-medium tabular-nums text-ink-secondary">{item.n}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function RoadmapPage({ theme, onToggleTheme }) {
  const today = useToday()
  const years = useMemo(() => groupByYear(GOALS), [])
  const counts = statusCounts(GOALS, today)
  const next = nextUp(GOALS, today)
  const markBefore = todayBefore(GOALS, today)
  const first = years[0]?.year
  const last = years.at(-1)?.year

  return (
    <div className="roadmap-ui min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
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
          <div className="max-w-[580px]">
            <p className={`${KICKER} mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 animate-rise-in`}>
              <span>/ roadmap</span>
              {first && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{first === last ? first : `${first} – ${last}`}</span>
                </>
              )}
            </p>
            <h1 className="text-[32px] sm:text-[36px] font-bold text-ink-strong tracking-[-0.035em] leading-tight mb-2 animate-rise-in" style={{ animationDelay: '60ms' }}>
              Roadmap
            </h1>
            <p className="text-[14.5px] sm:text-[15px] text-ink-muted font-normal leading-relaxed animate-rise-in" style={{ animationDelay: '120ms' }}>
              {ROADMAP_INTRO}
            </p>
          </div>
          <dl className="flex shrink-0 items-center gap-2 text-[12px] text-ink-subtle animate-rise-in" style={{ animationDelay: '180ms' }}>
            <dt className="font-mono uppercase tracking-wider text-[10.5px]">Updated</dt>
            <dd>
              <time dateTime={ROADMAP_UPDATED}>{formatUpdated(ROADMAP_UPDATED)}</time>
            </dd>
          </dl>
        </div>

        {GOALS.length > 0 && <Progress goals={GOALS} counts={counts} next={next} today={today} />}

        <div className="flex w-full flex-col gap-12 animate-rise-in" style={{ animationDelay: '240ms' }}>
          {years.map(({ year, goals }) => (
            <section key={year} aria-labelledby={`year-${year}`} className="w-full">
              <h2 id={`year-${year}`} className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
                <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink-strong">{year}</span>
                <span className="font-mono text-[11px] text-ink-subtle">
                  {goals.filter((g) => g.status === 'done').length} of {goals.length} done
                </span>
              </h2>
              <ol className="flex flex-col">
                {goals.map((goal) => (
                  <Fragment key={goal.id}>
                    {markBefore === goal.id && <TodayMark today={today} />}
                    <Goal goal={goal} today={today} />
                  </Fragment>
                ))}
                {markBefore === null && year === last && <TodayMark today={today} />}
              </ol>
            </section>
          ))}
          {!years.length && <p className="w-full border-t border-dashed border-line pt-5 text-[13px] text-ink-muted">Nothing on the roadmap yet.</p>}
        </div>

        <footer className="w-full max-w-[640px] border-t border-dashed border-line pt-7">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            How this works: each goal has the month it should be done by. Finished goals stay on the list and say whether they landed on time, and open goals that pass their month are marked late instead of quietly moving.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(CHANGELOG_PATH)} className={FOOT_LINK}>
              <span>What already shipped</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a {...link(CV_PATH)} className={FOOT_LINK}>
              <span>CV</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={FOOT_LINK}>
              <span>GitHub</span>
              <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
