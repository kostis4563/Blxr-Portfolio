import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react'
import { Icon } from './components/dashboard-sidebar'
import GitHubContributions from './components/github-contribution'
import { Segmented, ToastProvider, DensityProvider, useToast, LABEL, BTN_SECONDARY, BTN_GHOST } from './components/settings-ui'
import { useDevicePrefs } from './lib/prefs'
import { fetchGithubStats, readStatsCache, formatCount, formatExact, formatDay, formatMonthYear, relativeTime } from './lib/github-stats'

// Dashboard → Stats: the site owner's GitHub activity, built by the server
// for whichever account its token belongs to. Nothing to connect.

const MESSAGES = {
  stats_disabled: 'Developer stats are not enabled on this server yet — GITHUB_TOKEN needs to be set in its environment.',
  rate_limited: 'GitHub is rate-limiting requests right now. Try again in a few minutes.',
  offline: 'You appear to be offline.',
  failed: 'GitHub did not answer. Try again in a moment.',
}
const messageFor = (err, fallback) => MESSAGES[err?.code] || fallback

const CARD = 'rounded-xl border border-line bg-surface'
const GITHUB_PATH = 'M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2 0 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.1 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3'
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']

// --- small pieces ----------------------------------------------------------------

function Spinner({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

const GitHubMark = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={GITHUB_PATH} /></svg>
)

function Skeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <div className="h-[92px] animate-pulse rounded-xl border border-line bg-surface" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-xl border border-line bg-surface" />)}
      </div>
      <div className="h-[210px] animate-pulse rounded-xl border border-line bg-surface" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[240px] animate-pulse rounded-xl border border-line bg-surface" />
        <div className="h-[240px] animate-pulse rounded-xl border border-line bg-surface" />
      </div>
    </div>
  )
}

// Width of a container, for charts drawn in pixels.
function useWidth(ref) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const sync = () => setWidth(el.clientWidth)
    sync()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}

function Panel({ title, aside, children, className = '' }) {
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 ${className}`}>
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-strong">{title}</h2>
        {aside && <span className="text-[11.5px] text-ink-subtle">{aside}</span>}
      </header>
      {children}
    </section>
  )
}

function Tile({ label, value, sub, icon, title, className = '' }) {
  return (
    <div className={`${CARD} flex min-w-0 flex-col gap-2 px-4 py-3.5 ${className}`}>
      <span className="flex items-center justify-between gap-2">
        <span className={LABEL}>{label}</span>
        <Icon name={icon} className="h-3.5 w-3.5 text-ink-faint" />
      </span>
      <span title={title} className="truncate font-mono text-[24px] font-semibold leading-none tracking-tight text-ink-strong tabular-nums">{value}</span>
      <span className="truncate text-[12px] text-ink-muted">{sub}</span>
    </div>
  )
}

const LanguageDot = ({ color }) => (
  <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-black/10" style={{ background: color || 'var(--color-ink-faint)' }} />
)

// A tooltip anchored inside a chart, kept within the chart's width.
function ChartTip({ x, width, children }) {
  const clamped = Math.max(0, Math.min(x, width))
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line-strong bg-surface-inverted/95 px-2.5 py-1.5 text-[11px] leading-snug text-ink-on-inverted shadow-lg backdrop-blur-sm animate-menu-in"
      style={{ left: clamped }}
    >
      {children}
    </div>
  )
}

// --- charts ---------------------------------------------------------------------

const PERIODS = [
  { id: 'today', label: 'Today', short: 'Today' },
  { id: 'week', label: '7 days', short: 'This week' },
  { id: 'month', label: '30 days', short: 'This month' },
  { id: 'year', label: 'Year', short: 'Past year' },
  { id: 'all', label: 'All time', short: 'All time' },
]
const METRICS = [
  { id: 'c', label: 'Commits', of: (b) => b.c, format: formatCount },
  { id: 'f', label: 'Files', of: (b) => b.f, format: formatCount },
  { id: 'l', label: 'Lines', of: (b) => b.a + b.d, format: formatCount },
]
const monthLabel = new Intl.DateTimeFormat('en', { month: 'short' })
const monthYearLabel = new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' })

// One series of bars with a hover tooltip. `points` = [{ key, label, value, tip }].
function Bars({ points, ticks, ariaLabel, height = 150, empty = 'Nothing in this range.' }) {
  const ref = useRef(null)
  const width = useWidth(ref)
  const [hover, setHover] = useState(null)
  const pad = { top: 8, bottom: 20 }
  const max = Math.max(1, ...points.map((p) => p.value))
  const n = points.length
  const gap = n > 40 ? 2 : 4
  const bw = n ? Math.max(1, (width - gap * (n - 1)) / n) : 0
  const plotH = height - pad.top - pad.bottom
  const yOf = (v) => pad.top + plotH - (v / max) * plotH
  const isEmpty = points.every((p) => p.value === 0)
  const hovered = hover != null ? points[hover] : null

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {hovered && (
        <ChartTip x={hover * (bw + gap) + bw / 2} width={width}>
          <span className="block text-ink-on-inverted/70">{hovered.label}</span>
          {hovered.tip}
        </ChartTip>
      )}
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible" role="img" aria-label={ariaLabel}>
          <line x1={0} x2={width} y1={yOf(0) + 0.5} y2={yOf(0) + 0.5} stroke="var(--color-line)" />
          {points.map((p, i) => {
            const x = i * (bw + gap)
            const y = yOf(p.value)
            const h = Math.max(p.value > 0 ? 2 : 0, yOf(0) - y)
            const dim = hover != null && hover !== i
            return (
              <g key={p.key} onMouseEnter={() => setHover(i)}>
                <rect x={x - gap / 2} y={pad.top} width={bw + gap} height={plotH} fill="transparent" />
                {p.value > 0 && (
                  <rect x={x} y={y} width={bw} height={h} rx={Math.min(2, bw / 2)} fill="var(--color-ink-strong)" className="transition-opacity duration-150" style={{ opacity: dim ? 0.35 : hover === i ? 1 : 0.8 }} />
                )}
              </g>
            )
          })}
          {ticks.map((t) => (
            <text key={t.i} x={t.i * (bw + gap)} y={height - 6} className="fill-[var(--color-ink-faint)] text-[10px]">{t.label}</text>
          ))}
        </svg>
      )}
      {isEmpty && <p className="pointer-events-none absolute inset-0 grid place-items-center text-[12.5px] text-ink-subtle">{empty}</p>}
    </div>
  )
}

const TipRow = ({ b }) => (
  <span className="block tabular-nums">
    {b.c} commit{b.c === 1 ? '' : 's'} · {b.f} file{b.f === 1 ? '' : 's'} · <span className="text-emerald-400">+{formatExact(b.a)}</span> <span className="text-rose-400">−{formatExact(b.d)}</span>
  </span>
)

// Daily for short ranges, weekly for the year, monthly for all time.
function Activity({ data, period }) {
  const [metric, setMetric] = useState('c')
  const m = METRICS.find((x) => x.id === metric)
  const { points, ticks, unit } = useMemo(() => {
    if (period === 'year') {
      const pts = data.weekly.map((w) => ({ key: w.week, label: `Week of ${formatDay(w.week)}`, value: m.of(w), tip: <TipRow b={w} /> }))
      const tk = []
      let last = ''
      data.weekly.forEach((w, i) => { const mo = w.week.slice(0, 7); if (mo !== last) { last = mo; if (i > 0 && i < pts.length - 3) tk.push({ i, label: monthLabel.format(new Date(`${w.week}T00:00:00`)) }) } })
      return { points: pts, ticks: tk, unit: 'per week, past year' }
    }
    if (period === 'all') {
      const pts = data.monthly.map((mo) => ({ key: mo.month, label: monthYearLabel.format(new Date(`${mo.month}-01T00:00:00`)), value: m.of(mo), tip: <TipRow b={mo} /> }))
      const step = Math.max(1, Math.ceil(pts.length / 8))
      const tk = data.monthly.map((mo, i) => ({ i, label: i % step === 0 && i < pts.length - 1 ? monthYearLabel.format(new Date(`${mo.month}-01T00:00:00`)) : '' })).filter((t) => t.label)
      return { points: pts, ticks: tk, unit: 'per month, all time' }
    }
    const days = period === 'today' ? data.daily.slice(-14) : period === 'week' ? data.daily.slice(-14) : data.daily
    const pts = days.map((d) => ({ key: d.date, label: formatDay(d.date), value: m.of(d), tip: <TipRow b={d} /> }))
    const tk = days.map((d, i) => ({ i, label: i % (days.length > 20 ? 5 : 2) === 0 ? formatDay(d.date) : '' })).filter((t) => t.label)
    return { points: pts, ticks: tk, unit: `per day, last ${days.length} days` }
  }, [data, period, m])

  return (
    <Panel
      title="Activity"
      aside={
        <Segmented size="sm" label="Metric" value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.id, label: x.label }))} />
      }
    >
      <Bars points={points} ticks={ticks} ariaLabel={`${m.label} ${unit}`} />
      <p className="mt-2 text-[11.5px] text-ink-subtle">{m.label} {unit}.</p>
    </Panel>
  )
}

// Commits by local weekday and hour, from the UTC grid the server sends.
function useLocalGrid(grid) {
  return useMemo(() => {
    const offset = -new Date().getTimezoneOffset() // minutes east of UTC
    const days = new Array(7).fill(0)
    const hours = new Array(24).fill(0)
    grid.forEach((row, wd) => row.forEach((n, h) => {
      if (!n) return
      const local = h * 60 + 30 + offset
      const dayShift = Math.floor(local / 1440)
      const lh = Math.floor(((local % 1440) + 1440) % 1440 / 60)
      days[(wd + dayShift + 7) % 7] += n
      hours[lh] += n
    }))
    return { days, hours }
  }, [grid])
}

function Rhythm({ grid }) {
  const { days, hours } = useLocalGrid(grid)
  const total = days.reduce((s, n) => s + n, 0)
  const busiest = days.indexOf(Math.max(...days))
  const peakHour = hours.indexOf(Math.max(...hours))
  const dayMax = Math.max(1, ...days)
  const hourMax = Math.max(1, ...hours)
  const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`
  const slot = peakHour < 5 ? 'a night owl' : peakHour < 12 ? 'a morning person' : peakHour < 18 ? 'an afternoon coder' : 'an evening coder'
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-[88px] items-end gap-1.5">
        {days.map((n, i) => (
          <div key={i} className="group/bar flex min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch" title={`${WEEKDAY_NAMES[i]}: ${formatExact(n)} commits`}>
            <div className="flex w-full flex-1 items-end">
              <div className={`w-full rounded-[3px] ${i === busiest && total ? 'bg-ink-strong' : 'bg-ink-strong/40 group-hover/bar:bg-ink-strong/70'}`} style={{ height: `${Math.max(n > 0 ? 3 : 1, (n / dayMax) * 100)}%` }} />
            </div>
            <span className={`text-[10.5px] ${i === busiest && total ? 'font-medium text-ink-strong' : 'text-ink-faint'}`}>{WEEKDAY_LABELS[i]}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="flex h-[40px] items-end gap-px" title="Commits by hour of day, your time zone">
          {hours.map((n, h) => (
            <div key={h} className={`min-w-0 flex-1 rounded-t-[2px] ${h === peakHour && total ? 'bg-ink-strong' : 'bg-ink-strong/35'}`} style={{ height: `${Math.max(n > 0 ? 6 : 2, (n / hourMax) * 100)}%` }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-ink-faint"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>12am</span></div>
      </div>
      <p className="text-[12px] text-ink-muted">
        {total
          ? <>Mostly on <span className="text-ink-strong">{WEEKDAY_NAMES[busiest]}</span>, peaking around <span className="text-ink-strong">{hourLabel(peakHour)}</span> — {slot}.</>
          : 'No commits found yet.'}
      </p>
    </div>
  )
}

function Languages({ languages }) {
  const top = languages.slice(0, 6)
  const rest = languages.slice(6)
  const other = rest.reduce((s, l) => s + l.share, 0)
  const rows = other > 0 ? [...top, { name: `Other (${rest.length})`, color: null, share: other }] : top
  if (!rows.length) return <p className="text-[12.5px] text-ink-subtle">No commits found yet.</p>
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((l) => (
        <li key={l.name} className="flex flex-col gap-1">
          <span className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="flex min-w-0 items-center gap-2 text-ink-strong"><LanguageDot color={l.color} /><span className="truncate">{l.name}</span></span>
            <span className="shrink-0 tabular-nums text-ink-muted">{l.share < 0.005 ? '<1' : Math.round(l.share * 100)}%</span>
          </span>
          <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
            <span className="block h-full rounded-full bg-ink-strong/70" style={{ width: `${Math.max(1.5, l.share * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function Owners({ owners }) {
  if (!owners.length) return <p className="text-[12.5px] text-ink-subtle">No commits found yet.</p>
  const total = owners.reduce((s, o) => s + o.c, 0)
  return (
    <ul className="-my-2.5 divide-y divide-line">
      {owners.slice(0, 6).map((o) => (
        <li key={o.login || 'private'} className="flex items-center gap-3 py-2.5">
          {o.avatar ? (
            <img src={o.avatar} alt="" width={28} height={28} className={`h-7 w-7 shrink-0 bg-surface-raised object-cover ${o.type === 'org' ? 'rounded-md' : 'rounded-full'}`} />
          ) : (
            <span className={`grid h-7 w-7 shrink-0 place-items-center bg-surface-raised text-[11px] font-semibold uppercase text-ink-subtle ${o.type === 'org' ? 'rounded-md' : 'rounded-full'}`}>
              {o.login ? o.login[0] : <Icon name="lock" className="h-3.5 w-3.5" />}
            </span>
          )}
          <span className="min-w-0 flex-1">
            {o.login ? (
              <a href={`https://github.com/${o.login}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 truncate text-[13px] font-medium text-ink-strong hover:underline">
                {o.type === 'self' ? 'Your repositories' : o.login}
                {o.private && <Icon name="lock" className="h-3 w-3 text-ink-subtle" />}
              </a>
            ) : (
              <span className="block truncate text-[13px] font-medium text-ink-strong">Private repositories</span>
            )}
            <span className="block text-[11.5px] leading-snug text-ink-subtle">
              {o.type === 'org' ? 'Organization' : o.type === 'self' ? `@${o.login}` : o.type === 'private' ? 'Names hidden' : 'User'} · {o.repos} {o.repos === 1 ? 'repo' : 'repos'} · {formatCount(o.f)} files
            </span>
          </span>
          <span className="shrink-0 text-right text-[12px] tabular-nums text-ink-muted">
            <span className="block text-ink-strong">{formatCount(o.c)} commits</span>
            <span className="block text-[11px]">{total ? Math.round((o.c / total) * 100) : 0}%</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function RepoTable({ repos }) {
  const [all, setAll] = useState(false)
  const rows = all ? repos : repos.slice(0, 8)
  if (!repos.length) return <p className="text-[12.5px] text-ink-subtle">No commits found on any default branch.</p>
  return (
    <div className="-mx-5 -mb-5 overflow-x-auto">
      <table className="w-full min-w-[560px] text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] font-mono uppercase tracking-wider text-ink-subtle">
            <th className="px-5 pb-2 font-semibold">Repository</th>
            <th className="px-3 pb-2 text-right font-semibold">Commits</th>
            <th className="px-3 pb-2 text-right font-semibold">Files</th>
            <th className="px-3 pb-2 text-right font-semibold">Lines</th>
            <th className="px-5 pb-2 text-right font-semibold">Last commit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-t border-line">
          {rows.map((r, i) => (
            <tr key={r.fullName || `private-${i}`} className="transition-colors hover:bg-surface-hover/60">
              <td className="max-w-[260px] px-5 py-2.5">
                {r.name ? (
                  <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 truncate font-medium text-ink-strong hover:underline">
                    <span className="truncate"><span className="text-ink-muted">{r.owner}/</span>{r.name}</span>
                    {r.private && <Icon name="lock" className="h-3 w-3 shrink-0 text-ink-subtle" />}
                  </a>
                ) : (
                  <span className="flex items-center gap-1.5 font-medium text-ink-muted">
                    <Icon name="lock" className="h-3 w-3 shrink-0" />
                    {r.owner ? <span><span className="text-ink-muted">{r.owner}/</span>private repository</span> : 'Private repository'}
                  </span>
                )}
                <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-subtle">
                  {r.language && <span className="flex items-center gap-1"><LanguageDot color={r.languageColor} />{r.language}</span>}
                  {r.stars > 0 && <span>★ {formatCount(r.stars)}</span>}
                  {r.ownerType === 'org' && <span className="rounded border border-line px-1 text-[9.5px] uppercase tracking-wide">org</span>}
                  {r.archived && <span className="rounded border border-line px-1 text-[9.5px] uppercase tracking-wide">archived</span>}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-strong">{formatExact(r.commits)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatExact(r.files)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums"><span className="text-emerald-500">+{formatCount(r.additions)}</span> <span className="text-rose-500">−{formatCount(r.deletions)}</span></td>
              <td className="whitespace-nowrap px-5 py-2.5 text-right text-ink-muted">{formatDay(r.last)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {repos.length > 8 && (
        <div className="border-t border-line px-5 py-2.5">
          <button type="button" onClick={() => setAll((v) => !v)} className={`${BTN_GHOST} -ml-2 h-7 px-2`}>
            {all ? 'Show fewer' : `Show all ${repos.length} repositories`}
          </button>
        </div>
      )}
    </div>
  )
}

function Mini({ label, value, sub }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 py-1">
      <span className="truncate text-[11px] text-ink-subtle">{label}</span>
      <span className="truncate font-mono text-[17px] font-semibold tracking-tight text-ink-strong tabular-nums">{value}</span>
      {sub && <span className="truncate text-[11px] text-ink-muted">{sub}</span>}
    </div>
  )
}

function StatsView({ data, onRefresh, refreshing, stale }) {
  const { user, periods, calendar, general, coverage } = data
  const [period, setPeriod] = useState('month')
  const p = periods[period]
  const meta = PERIODS.find((x) => x.id === period)
  const net = p.a - p.d

  return (
    <div className="settings-stagger flex flex-col gap-5">
      <section className={`${CARD} flex flex-wrap items-center gap-4 px-5 py-4`}>
        {user.avatar ? (
          <img src={user.avatar} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full bg-surface-raised object-cover" />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface-raised text-ink-subtle"><GitHubMark className="h-5 w-5" /></span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 className="truncate text-[16px] font-semibold tracking-tight text-ink-strong">{user.name || user.login}</h2>
            <a href={user.url} target="_blank" rel="noreferrer" className="font-mono text-[12.5px] text-ink-muted hover:text-ink-strong">@{user.login}</a>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-ink-muted">
            {user.createdAt && <span>On GitHub since {formatMonthYear(user.createdAt)}</span>}
            <span><span className="text-ink-strong">{formatCount(user.followers)}</span> followers</span>
            <span><span className="text-ink-strong">{formatCount(user.following)}</span> following</span>
            {user.location && <span>{user.location}</span>}
          </p>
        </div>
        <div className="flex w-full items-center justify-end gap-2 border-t border-line pt-3 sm:w-auto sm:border-0 sm:pt-0">
          <span className="mr-auto text-[11.5px] text-ink-subtle sm:mr-0" title={data.fetchedAt}>
            {stale ? 'Cached · ' : ''}Updated {relativeTime(data.fetchedAt)}
          </span>
          <button type="button" onClick={onRefresh} disabled={refreshing} className={BTN_SECONDARY} aria-label="Refresh stats">
            {refreshing ? <Spinner /> : <Icon name="refresh" className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink-strong">{meta.short}</h2>
          <Segmented label="Period" value={period} onChange={setPeriod} options={PERIODS.map((x) => ({ value: x.id, label: x.label }))} />
        </div>
        <div key={period} className="settings-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile label="Commits" icon="terminal" value={formatCount(p.c)} title={formatExact(p.c)} sub={p.repos ? `in ${p.repos} ${p.repos === 1 ? 'repository' : 'repositories'}` : 'nothing yet'} />
          <Tile label="Files edited" icon="folder" value={formatCount(p.f)} title={formatExact(p.f)} sub={p.c ? `${(p.f / p.c).toFixed(1)} per commit` : '—'} />
          <Tile label="Lines added" icon="plus" value={`+${formatCount(p.a)}`} title={formatExact(p.a)} sub={p.c ? `${formatCount(Math.round(p.a / p.c))} per commit` : '—'} />
          <Tile label="Lines removed" icon="x" value={`−${formatCount(p.d)}`} title={formatExact(p.d)} sub={`net ${net >= 0 ? '+' : '−'}${formatCount(Math.abs(net))}`} />
          <Tile className="col-span-2 sm:col-span-1" label="Repos touched" icon="activity" value={formatCount(p.repos)} title={formatExact(p.repos)} sub={period === 'all' ? `of ${coverage.reposFound} you've committed to` : `of ${periods.all.repos} all time`} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Activity data={data} period={period} />
        <Panel title="Breakdown" aside="click a row">
          <table className="-mx-2 w-[calc(100%+16px)] text-[12.5px]">
            <thead>
              <tr className="text-[10.5px] font-mono uppercase tracking-wider text-ink-subtle">
                <th className="px-2 pb-1.5 text-left font-semibold">Period</th>
                <th className="px-2 pb-1.5 text-right font-semibold">Commits</th>
                <th className="px-2 pb-1.5 text-right font-semibold">Files</th>
                <th className="px-2 pb-1.5 text-right font-semibold">Lines</th>
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((x) => {
                const b = periods[x.id]
                const on = x.id === period
                return (
                  <tr key={x.id} onClick={() => setPeriod(x.id)} className={`cursor-pointer transition-colors ${on ? 'bg-surface-hover text-ink-strong' : 'hover:bg-surface-hover/60'}`}>
                    <td className={`rounded-l-md px-2 py-1.5 ${on ? 'font-medium' : ''}`}>{x.short}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(b.c)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(b.f)}</td>
                    <td className="whitespace-nowrap rounded-r-md px-2 py-1.5 text-right tabular-nums"><span className="text-emerald-500">+{formatCount(b.a)}</span> <span className="text-rose-500">−{formatCount(b.d)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>
      </div>

      <GitHubContributions username={user.login} since={user.createdAt ? user.createdAt.slice(0, 10) : undefined} />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Languages" aside="by your commits">
          <Languages languages={data.languages} />
        </Panel>
        <Panel title="When you commit" aside="your time zone">
          <Rhythm grid={data.grid} />
        </Panel>
        <Panel title="Where you commit" aside="by owner" className="md:col-span-2 xl:col-span-1">
          <Owners owners={data.owners} />
        </Panel>
      </div>

      <Panel title="Repositories" aside={`${data.repos.length} with your commits · all time`}>
        <RepoTable repos={data.repos} />
      </Panel>

      <Panel title="General" aside="GitHub-wide">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Mini label="Contributions, past year" value={formatCount(calendar.contributions)} sub={`${calendar.activeDays} active days`} />
          <Mini label="Commits on GitHub" value={formatCount(general.commitsAllYears)} sub={general.firstYear ? `since ${general.firstYear}` : undefined} />
          <Mini label="Current streak" value={`${calendar.streak.current}d`} sub={`longest ${calendar.streak.longest} days`} />
          <Mini label="Busiest day" value={calendar.busiestDay?.count ? formatCount(calendar.busiestDay.count) : '—'} sub={calendar.busiestDay?.count ? formatDay(calendar.busiestDay.date) : 'nothing this year'} />
          <Mini label="Stars on your repos" value={formatCount(general.stars)} sub={`${formatCount(general.forks)} forks`} />
          <Mini label="Public repos" value={formatCount(general.ownRepos)} sub="that you own" />
          <Mini label="Pull requests" value={formatCount(general.pullRequests)} sub={`${formatCount(calendar.pullRequests)} this year`} />
          <Mini label="Issues" value={formatCount(general.issues)} sub={`${formatCount(calendar.issues)} this year`} />
        </div>
      </Panel>

      <p className="px-0.5 text-[11.5px] leading-relaxed text-ink-subtle">
        Counted from the default branch of {coverage.reposScanned === 1 ? 'the one repository' : `${coverage.reposScanned} repositories`} you have committed to since {general.firstYear || 'you joined'} — yours, other people's and organisations' alike
        {coverage.privateRepos > 0 ? `, ${coverage.privateRepos} of them private (${data.access?.owner ? 'only you see their names' : 'shown without names'}).` : '.'}
        {coverage.reposFound > coverage.reposScanned && ` The ${coverage.reposFound - coverage.reposScanned} you committed to least were skipped.`}
        {coverage.truncated && ' Some very large histories were cut short, so all-time totals are a floor.'}
        {coverage.privateSkipped > 0 && ` ${formatCount(coverage.privateSkipped)} contributions in private repositories the server cannot read are not included.`}
        {' '}Commits on other branches are not counted until they land on the default branch.
      </p>
    </div>
  )
}

function Stats() {
  const toast = useToast()
  const { density } = useDevicePrefs()
  const [data, setData] = useState(readStatsCache)
  const [stale, setStale] = useState(Boolean(data))
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const abortRef = useRef(null)

  const load = useCallback(async (refresh = false) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    if (refresh) setRefreshing(true)
    setError(null)
    try {
      const next = await fetchGithubStats({ signal: ctrl.signal, refresh })
      if (ctrl.signal.aborted) return
      setData(next)
      setStale(false)
    } catch (err) {
      if (err?.name === 'AbortError') return
      // Cached numbers stay on screen when a refresh fails.
      setError(err)
      if (refresh) toast(messageFor(err, 'Could not refresh.'), 'error')
    } finally {
      if (!ctrl.signal.aborted) setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  return (
    <DensityProvider value={density}>
      {data ? (
        <StatsView data={data} stale={stale} onRefresh={() => load(true)} refreshing={refreshing} />
      ) : error ? (
        <div className={`${CARD} flex flex-col items-center gap-4 px-6 py-14 text-center animate-rise-in`}>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-raised text-ink-subtle"><GitHubMark className="h-5 w-5" /></span>
          <div>
            <p className="text-[15px] font-medium text-ink-strong">Could not load your stats</p>
            <p className="mx-auto mt-1 max-w-[46ch] text-[13px] leading-relaxed text-ink-muted">{messageFor(error, MESSAGES.failed)}</p>
          </div>
          {error.code !== 'stats_disabled' && (
            <button type="button" onClick={() => load()} className={BTN_SECONDARY}><Icon name="refresh" className="h-3.5 w-3.5" /> Try again</button>
          )}
        </div>
      ) : (
        <Skeleton />
      )}
    </DensityProvider>
  )
}

export default function DashboardStats() {
  return (
    <ToastProvider>
      <Stats />
    </ToastProvider>
  )
}
