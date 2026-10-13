import { useEffect, useState } from 'react'
import { Icon } from './components/icon'
import { Bone } from './components/skeleton'
import { CAPS } from './components/boards/ui'
import { ADMIN } from './lib/dashboard'
import { link, dashboardPath } from './lib/router'
import { currentSession } from './lib/supabase'
import { plural } from './lib/boards'
import { fetchPanel } from './lib/api'
import { fetchSchedule } from './lib/schedule-api'
import { listPosts } from './lib/blog-admin'
import { listItems } from './lib/gallery-api'
import { listEvents } from './lib/volunteer-api'
import { listQuotes } from './lib/quote-api'
import { fetchLogs, relativeTime, EMPTY_FILTER } from './lib/logs-api'
import { visitorTimeZone, prefersTwelveHour, formatTime, shortDay } from './lib/booking'

const LOADERS = {
  reviewpanel: async () => (await fetchPanel({ bearer: currentSession()?.access_token })).stats,
  calls: async () => {
    const data = await fetchSchedule()
    const now = Date.now()
    const upcoming = data.calls.filter((c) => Date.parse(c.end) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    return { upcoming: upcoming.length, next: upcoming[0] ? Date.parse(upcoming[0].start) : null, paused: Boolean(data.paused) }
  },
  blog: async () => (await listPosts()).items.length,
  gallery: async () => (await listItems()).length,
  volunteer: async () => (await listEvents()).length,
  quotes: async () => (await listQuotes({ includeHidden: true })).length,
  logs: async () => (await fetchLogs(EMPTY_FILTER, { limit: 0 })).summary,
}

const META = {
  reviewpanel: (v) => plural(v.total, 'review'),
  calls: (v) => (v.paused ? 'Paused' : 'Open'),
  blog: (v) => plural(v, 'post'),
  gallery: (v) => plural(v, 'item'),
  volunteer: (v) => plural(v, 'event'),
  quotes: (v) => plural(v, 'quote'),
  logs: (v) => `${v.total} ${v.total === 1 ? 'entry' : 'entries'}`,
}

const TONE = { amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-[#0d99ff]' }

function useStats() {
  const [stats, setStats] = useState({})
  useEffect(() => {
    let alive = true
    for (const [id, load] of Object.entries(LOADERS)) {
      load().then(
        (value) => alive && setStats((s) => ({ ...s, [id]: { value } })),
        () => alive && setStats((s) => ({ ...s, [id]: { failed: true } })),
      )
    }
    return () => {
      alive = false
    }
  }, [])
  return stats
}

function Tile({ to, label, stat, read }) {
  const shown = stat?.value !== undefined ? read(stat.value) : stat?.failed ? { value: '—', caption: 'Could not load' } : null
  return (
    <a
      {...link(dashboardPath(to))}
      className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl border border-line bg-surface px-4 py-3 outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong sm:grid-cols-1 sm:items-start sm:py-3.5"
    >
      <span className="col-start-1 row-start-1 flex items-center gap-1.5 text-[12px] text-ink-muted">
        {shown?.tone && <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${TONE[shown.tone]}`} />}
        {label}
        <Icon name="arrowUpRight" className="ml-auto hidden h-3.5 w-3.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block" />
      </span>
      {shown ? (
        <>
          <span className="col-start-2 row-span-2 row-start-1 text-[18px] font-semibold leading-tight tracking-tight text-ink-strong tabular-nums sm:col-start-1 sm:row-span-1 sm:row-start-2 sm:mt-1.5 sm:text-[22px]">
            {shown.value}
          </span>
          <span className="col-start-1 row-start-2 mt-0.5 truncate text-[12px] text-ink-subtle sm:row-start-3">{shown.caption}</span>
        </>
      ) : (
        <>
          <Bone className="col-start-2 row-span-2 row-start-1 h-5 w-12 sm:col-start-1 sm:row-span-1 sm:row-start-2 sm:mt-2.5 sm:w-14" />
          <Bone className="col-start-1 row-start-2 mt-2 h-2.5 w-24 sm:row-start-3" />
        </>
      )}
    </a>
  )
}

function Tool({ tool, stat }) {
  return (
    <li>
      <a
        {...link(dashboardPath(tool.id))}
        className="group flex items-center gap-3.5 px-4 py-3 outline-none transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-bg text-ink-muted transition-colors group-hover:text-[#0d99ff]">
          <Icon name={tool.icon} className="h-[17px] w-[17px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-ink-strong">{tool.label}</span>
          <span className="block truncate text-[12.5px] text-ink-muted">{tool.hint}</span>
        </span>
        {stat?.value !== undefined ? (
          <span className="shrink-0 text-[12px] text-ink-subtle tabular-nums">{META[tool.id](stat.value)}</span>
        ) : stat?.failed ? (
          <span className="shrink-0 text-[12px] text-ink-faint">—</span>
        ) : (
          <Bone className="h-2.5 w-12" />
        )}
        <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-ink-faint transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-ink-muted" />
      </a>
    </li>
  )
}

export default function DashboardAdmin() {
  const stats = useStats()
  const [zone] = useState(visitorTimeZone)
  const [twelve] = useState(prefersTwelveHour)

  return (
    <div className="flex flex-col gap-8 animate-rise-in">
      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        <Tile
          to="reviewpanel"
          label="Pending reviews"
          stat={stats.reviewpanel}
          read={(v) => ({ value: v.pending, caption: v.pending ? 'Approve or hide them' : 'All caught up', tone: v.pending ? 'amber' : null })}
        />
        <Tile
          to="calls"
          label="Next call"
          stat={stats.calls}
          read={(v) => ({
            value: v.next ? formatTime(v.next, zone, twelve) : 'None',
            caption: v.paused ? 'Booking is paused' : v.next ? `${shortDay(v.next, zone)} · ${v.upcoming} booked` : 'Nothing booked yet',
            tone: v.paused ? 'amber' : v.next ? 'blue' : null,
          })}
        />
        <Tile
          to="logs"
          label="Errors · 24h"
          stat={stats.logs}
          read={(v) => ({
            value: v.recent.error,
            caption: v.recent.error && v.lastError ? `Last one ${relativeTime(v.lastError)}` : 'All quiet',
            tone: v.recent.error ? 'red' : null,
          })}
        />
      </div>

      {ADMIN.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className={`mb-2 px-1 ${CAPS}`}>{group.label}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {group.items.map((tool) => (
              <Tool key={tool.id} tool={tool} stat={stats[tool.id]} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
