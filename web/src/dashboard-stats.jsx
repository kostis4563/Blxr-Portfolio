import { Fragment, useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect, useId } from 'react'
import { Icon } from './components/dashboard-sidebar'
import GitHubContributions from './components/github-contribution'
import { Segmented, ToastProvider, DensityProvider, useToast, LABEL, BTN_SECONDARY, BTN_GHOST } from './components/settings-ui'
import { Bone, Dot, Figure, Loading } from './components/skeleton'
import { useDevicePrefs } from './lib/prefs'
import { fetchGithubStats, readStatsCache, formatCount, formatExact, formatDay, formatMonthYear, relativeTime } from './lib/github-stats'

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

const sumBy = (arr, of) => arr.reduce((s, x) => s + of(x), 0)
const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`
const plural = (n, word) => `${formatExact(n)} ${word}${n === 1 ? '' : 's'}`

const useSvgId = () => `g${useId().replace(/\W/g, '')}`

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  (document.documentElement.dataset.motion === 'reduced' || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))

function niceCeil(v) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const f = v / p
  return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8].find((m) => f <= m) || 10) * p
}

function barPath(x, y, w, h, up = true) {
  if (h <= 0 || w <= 0) return ''
  const r = Math.min(3, w / 2, h)
  if (up) return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
  const b = y + h
  return `M${x},${y} V${b - r} Q${x},${b} ${x + r},${b} H${x + w - r} Q${x + w},${b} ${x + w},${b - r} V${y} Z`
}

function useCountUp(target, ms = 650) {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)
  useEffect(() => {
    const from = shownRef.current
    if (from === target) return undefined
    const dur = reducedMotion() ? 0 : ms
    const t0 = performance.now()
    let raf = 0
    const tick = (t) => {
      const k = dur ? Math.min(1, Math.max(0, (t - t0) / dur)) : 1
      const v = Math.round(from + (target - from) * (1 - (1 - k) ** 3))
      shownRef.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return shown
}

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
  const bars = [38, 62, 44, 80, 56, 70, 48, 90, 64, 42, 76, 58, 66, 50, 84, 40, 72, 60]
  return (
    <Loading label="Loading your stats" className="flex flex-col gap-5">
      <div className={`${CARD} flex flex-wrap items-center gap-x-5 gap-y-4 px-5 py-4`}>
        <Dot size={56} />
        <div className="min-w-0 flex-1 basis-[240px]">
          <div className="flex items-center gap-2"><Bone className="h-4 w-36" /><Bone className="h-3 w-20" /></div>
          <Bone className="mt-2.5 h-2.5 w-72 max-w-full" />
          <Bone className="mt-2 h-2.5 w-52 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Figure />
          <Bone className="h-[34px] w-24" />
        </div>
        <Bone className="ml-auto h-8 w-24 rounded-lg" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-0.5">
          <Bone className="h-3 w-24" />
          <Bone className="h-7 w-56 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`${CARD} flex flex-col gap-3 p-4 ${i === 4 ? 'col-span-2 sm:col-span-1' : ''}`}>
              <div className="flex items-start justify-between"><Figure /><Bone className="h-7 w-7 rounded-md" /></div>
              <Bone className="h-7 w-full" />
              <Bone className="h-2.5 w-20" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className={`${CARD} p-5`}>
          <div className="mb-4 flex items-center justify-between"><Bone className="h-3 w-24" /><Bone className="h-3 w-32" /></div>
          <div className="flex h-[184px] items-end gap-1.5">
            {bars.map((h, i) => <Bone key={i} style={{ height: `${h}%` }} className="flex-1 rounded-sm" />)}
          </div>
        </div>
        <div className={`${CARD} p-5`}>
          <div className="mb-4 flex items-center justify-between"><Bone className="h-3 w-20" /><Bone className="h-3 w-16" /></div>
          <div className="flex flex-col divide-y divide-line">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <Bone className="h-2.5 w-20" />
                <div className="flex gap-4"><Bone className="h-2.5 w-8" /><Bone className="h-2.5 w-8" /><Bone className="h-2.5 w-14" /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`${CARD} p-5`}>
        <div className="mb-4 flex items-center justify-between"><Bone className="h-3 w-28" /><Bone className="h-3 w-24" /></div>
        <div className="grid grid-flow-col grid-rows-7 gap-[3px] overflow-hidden">
          {Array.from({ length: 7 * 52 }, (_, i) => <Bone key={i} className="h-[10px] w-[10px] rounded-[2px]" />)}
        </div>
      </div>
    </Loading>
  )
}

function Panel({ title, aside, children, className = '' }) {
  return (
    <section className={`${CARD} flex min-w-0 flex-col p-5 ${className}`}>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-strong">{title}</h2>
        {aside && <span className="text-[11.5px] text-ink-subtle">{aside}</span>}
      </header>
      {children}
    </section>
  )
}

function Sparkline({ values, width: fixed, height = 28, className = '' }) {
  const gid = useSvgId()
  const ref = useRef(null)
  const measured = useWidth(ref)
  const width = fixed || measured
  if (values.length < 2) return null
  if (!width) return <div ref={ref} className="w-full" style={{ height }} />
  const max = Math.max(1, ...values)
  const step = width / (values.length - 1)
  const pts = values.map((v, i) => [i * step, height - 2 - (v / max) * (height - 5)])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <div ref={ref} className={`${fixed ? 'shrink-0' : 'w-full'} transition-colors ${className}`} style={{ height }}>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="block overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2" fill="currentColor" />
    </svg>
    </div>
  )
}

function Delta({ now, before, than }) {
  if (before == null) return null
  let text
  let tone = 'text-ink-faint'
  if (now === before) text = 'same'
  else if (before === 0) { text = 'new'; tone = 'bg-emerald-500/10 text-emerald-500' }
  else {
    const ratio = now / before
    const r = Math.round((ratio - 1) * 100)
    if (r === 0) text = 'same'
    else {
      const up = r > 0
      text = ratio >= 4 ? `↑ ×${Math.round(ratio)}` : `${up ? '↑' : '↓'} ${Math.abs(r)}%`
      tone = up ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
    }
  }
  return (
    <span title={`${formatExact(before)} ${than}`} className={`inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[10.5px] font-medium tabular-nums ${tone}`}>
      {text}
    </span>
  )
}

function Tile({ label, icon, value, format = formatCount, prefix = '', sub, spark, delta, bar, className = '' }) {
  const shown = useCountUp(value)
  return (
    <div className={`${CARD} group/tile flex min-w-0 flex-col gap-2.5 px-4 py-3.5 transition-colors duration-200 hover:border-line-strong ${className}`}>
      <span className="flex items-center justify-between gap-2">
        <span className={`${LABEL} flex min-w-0 items-center gap-1.5`}>
          <Icon name={icon} className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <span className="truncate">{label}</span>
        </span>
        {delta && <Delta {...delta} />}
      </span>
      <span title={formatExact(value)} className="truncate font-mono text-[25px] font-semibold leading-none tracking-tight text-ink-strong tabular-nums">
        {prefix}{format(shown)}
      </span>
      {spark && <Sparkline values={spark} height={24} className="text-ink-strong/50 group-hover/tile:text-ink-strong/80" />}
      {bar != null && (
        <span className="flex h-[24px] items-center">
          <span className="block h-1 w-full overflow-hidden rounded-full bg-surface-raised">
            <span className="block h-full rounded-full bg-ink-strong/60 transition-[width] duration-500 ease-out" style={{ width: `${Math.max(3, Math.min(100, bar * 100))}%` }} />
          </span>
        </span>
      )}
      <span className="truncate text-[12px] text-ink-muted">{sub}</span>
    </div>
  )
}

const LanguageDot = ({ color, className = 'h-2 w-2' }) => (
  <span aria-hidden="true" className={`inline-block shrink-0 rounded-full ring-1 ring-inset ring-black/10 ${className}`} style={{ background: color || 'var(--color-ink-faint)' }} />
)

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

const PERIODS = [
  { id: 'today', label: 'Today', short: 'Today' },
  { id: 'week', label: '7 days', short: 'This week' },
  { id: 'month', label: '30 days', short: 'This month' },
  { id: 'year', label: 'Year', short: 'Past year' },
  { id: 'all', label: 'All time', short: 'All time' },
]
const METRICS = [
  { id: 'c', label: 'Commits', of: (b) => b.c },
  { id: 'f', label: 'Files', of: (b) => b.f },
  { id: 'l', label: 'Lines', of: (b) => b.a + b.d, diverging: true },
]
const monthLabel = new Intl.DateTimeFormat('en', { month: 'short' })
const monthYearLabel = new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' })

function Bars({ points, ticks, ariaLabel, height = 184, diverging = false, empty = 'Nothing in this range.' }) {
  const ref = useRef(null)
  const width = useWidth(ref)
  const [hover, setHover] = useState(null)
  const gid = useSvgId()
  const pad = { top: 16, bottom: 22 }
  const n = points.length
  const gap = n > 40 ? 2 : n > 20 ? 3 : 5
  const bw = n ? Math.max(1, (width - gap * (n - 1)) / n) : 0
  const plotH = height - pad.top - pad.bottom
  const upMax = niceCeil(Math.max(0, ...points.map((p) => (diverging ? p.up : p.value))))
  const downMax = diverging ? niceCeil(Math.max(0, ...points.map((p) => p.down))) : 0
  const scale = plotH / (upMax + downMax)
  const base = pad.top + upMax * scale
  const xOf = (i) => i * (bw + gap)
  const isEmpty = points.every((p) => !p.value)
  const avg = !diverging && n ? sumBy(points, (p) => p.value) / n : 0
  const hovered = hover != null ? points[hover] : null

  const grid = diverging
    ? [
        { y: pad.top, label: `+${formatCount(upMax)}` },
        { y: base, label: '', solid: true },
        { y: base + downMax * scale, label: `−${formatCount(downMax)}` },
      ]
    : [
        { y: pad.top, label: formatCount(upMax) },
        ...(Number.isInteger(upMax / 2) ? [{ y: pad.top + plotH / 2, label: formatCount(upMax / 2) }] : []),
        { y: base, label: '', solid: true },
      ]

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {hovered && (
        <ChartTip x={xOf(hover) + bw / 2} width={width}>
          <span className="block text-ink-on-inverted/70">{hovered.label}</span>
          {hovered.tip}
        </ChartTip>
      )}
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible" role="img" aria-label={ariaLabel}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--color-ink-strong)', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: 'var(--color-ink-strong)', stopOpacity: 0.45 }} />
            </linearGradient>
          </defs>
          {grid.map((g) => (
            <g key={g.y}>
              <line x1={0} x2={width} y1={g.y + 0.5} y2={g.y + 0.5} stroke={g.solid ? 'var(--color-line-strong)' : 'var(--color-line)'} strokeDasharray={g.solid ? undefined : '2 3'} />
              {g.label && <text x={width} y={g.y - 3} textAnchor="end" className="fill-[var(--color-ink-faint)] text-[9.5px] tabular-nums">{g.label}</text>}
            </g>
          ))}
          {points.map((p, i) => {
            const x = xOf(i)
            const on = hover === i
            const opacity = hover != null && !on ? 0.35 : on ? 1 : 0.85
            const upH = diverging ? p.up * scale : p.value * scale
            const downH = diverging ? p.down * scale : 0
            return (
              <g key={p.key} onMouseEnter={() => setHover(i)}>
                <rect x={x - gap / 2} y={pad.top} width={bw + gap} height={plotH} fill="var(--color-ink-strong)" opacity={on ? 0.05 : 0} />
                {upH > 0 && (
                  <path
                    d={barPath(x, base - Math.max(2, upH), bw, Math.max(2, upH), true)}
                    fill={diverging ? undefined : `url(#${gid})`}
                    className={`transition-opacity duration-150 ${diverging ? 'fill-emerald-500' : ''}`}
                    opacity={opacity}
                  />
                )}
                {downH > 0 && (
                  <path d={barPath(x, base, bw, Math.max(2, downH), false)} className="fill-rose-500 transition-opacity duration-150" opacity={opacity} />
                )}
              </g>
            )
          })}
          {avg > 0 && n > 1 && (
            <g className="pointer-events-none">
              <line x1={0} x2={width} y1={base - avg * scale} y2={base - avg * scale} stroke="var(--color-ink-muted)" strokeDasharray="3 3" opacity={0.7} />
              {avg * scale < plotH - 14 && (
                <text x={width} y={base - avg * scale - 3} textAnchor="end" className="fill-[var(--color-ink-subtle)] text-[9.5px] tabular-nums">avg {avg >= 10 ? formatCount(Math.round(avg)) : avg.toFixed(1)}</text>
              )}
            </g>
          )}
          {ticks.map((t) => (
            <text key={t.i} x={xOf(t.i)} y={height - 6} className="fill-[var(--color-ink-faint)] text-[10px]">{t.label}</text>
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

function Activity({ data, period }) {
  const [metric, setMetric] = useState('c')
  const m = METRICS.find((x) => x.id === metric)
  const { points, ticks, unit } = useMemo(() => {
    const toPoint = (key, label, b) => ({ key, label, value: m.of(b), up: b.a, down: b.d, tip: <TipRow b={b} /> })
    if (period === 'year') {
      const pts = data.weekly.map((w) => toPoint(w.week, `Week of ${formatDay(w.week)}`, w))
      const tk = []
      let last = ''
      data.weekly.forEach((w, i) => { const mo = w.week.slice(0, 7); if (mo !== last) { last = mo; if (i > 0 && i < pts.length - 3) tk.push({ i, label: monthLabel.format(new Date(`${w.week}T00:00:00`)) }) } })
      return { points: pts, ticks: tk, unit: 'per week, past year' }
    }
    if (period === 'all') {
      const pts = data.monthly.map((mo) => toPoint(mo.month, monthYearLabel.format(new Date(`${mo.month}-01T00:00:00`)), mo))
      const step = Math.max(1, Math.ceil(pts.length / 8))
      const tk = pts.map((p, i) => ({ i, label: i % step === 0 && i < pts.length - 1 ? p.label : '' })).filter((t) => t.label)
      return { points: pts, ticks: tk, unit: 'per month, all time' }
    }
    const days = period === 'month' ? data.daily : data.daily.slice(-14)
    const pts = days.map((d) => toPoint(d.date, formatDay(d.date), d))
    const tk = pts.map((p, i) => ({ i, label: i % (days.length > 20 ? 5 : 2) === 0 ? p.label : '' })).filter((t) => t.label)
    return { points: pts, ticks: tk, unit: `per day, last ${days.length} days` }
  }, [data, period, m])

  const peak = points.reduce((best, p) => (p.value > (best?.value || 0) ? p : best), null)

  return (
    <Panel
      title="Activity"
      aside={<Segmented size="sm" label="Metric" value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.id, label: x.label }))} />}
    >
      <Bars key={`${period}-${metric}`} points={points} ticks={ticks} diverging={m.diverging} ariaLabel={`${m.label} ${unit}`} />
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-subtle">
        <span>{m.label} {unit}.</span>
        {peak && <span>Peak <span className="text-ink-muted tabular-nums">{formatCount(peak.value)}</span> · {peak.label}</span>}
        {m.diverging && (
          <span className="ml-auto flex items-center gap-2.5">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-[2px] bg-emerald-500" />added</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-[2px] bg-rose-500" />removed</span>
          </span>
        )}
      </p>
    </Panel>
  )
}

function useLocalGrid(grid) {
  return useMemo(() => {
    const offset = -new Date().getTimezoneOffset()
    const cells = Array.from({ length: 7 }, () => new Array(24).fill(0))
    grid.forEach((row, wd) => row.forEach((n, h) => {
      if (!n) return
      const local = h * 60 + 30 + offset
      const dayShift = Math.floor(local / 1440)
      const lh = Math.floor((((local % 1440) + 1440) % 1440) / 60)
      cells[(wd + dayShift + 7) % 7][lh] += n
    }))
    const days = cells.map((r) => r.reduce((s, n) => s + n, 0))
    const hours = Array.from({ length: 24 }, (_, h) => cells.reduce((s, r) => s + r[h], 0))
    return { cells, days, hours }
  }, [grid])
}

function Rhythm({ grid }) {
  const { cells, days, hours } = useLocalGrid(grid)
  const total = days.reduce((s, n) => s + n, 0)
  const busiest = days.indexOf(Math.max(...days))
  const peakHour = hours.indexOf(Math.max(...hours))
  const max = Math.max(1, ...cells.flat())
  let peak = { wd: -1, h: -1, n: 0 }
  cells.forEach((row, wd) => row.forEach((n, h) => { if (n > peak.n) peak = { wd, h, n } }))
  const slot = peakHour < 5 ? 'a night owl' : peakHour < 12 ? 'a morning person' : peakHour < 18 ? 'an afternoon coder' : 'an evening coder'

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: '26px repeat(24, minmax(0, 1fr))' }} role="img" aria-label="Commits by weekday and hour">
        {cells.map((row, wd) => (
          <Fragment key={wd}>
            <span className={`self-center text-[10px] leading-none ${wd === busiest && total ? 'font-medium text-ink-strong' : 'text-ink-faint'}`}>{WEEKDAY_LABELS[wd]}</span>
            {row.map((n, h) => (
              <span
                key={h}
                title={`${WEEKDAY_NAMES[wd]} around ${hourLabel(h)}: ${plural(n, 'commit')}`}
                className={`aspect-square rounded-[2px] transition-transform duration-150 hover:scale-125 ${n ? '' : 'bg-surface-raised'} ${wd === peak.wd && h === peak.h ? 'ring-1 ring-ink-strong ring-offset-1 ring-offset-surface' : ''}`}
                style={n ? { background: `color-mix(in srgb, var(--color-ink-strong) ${Math.round(16 + 84 * (n / max))}%, var(--color-surface-raised))` } : undefined}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="ml-[29px] flex justify-between text-[10px] text-ink-faint" aria-hidden="true"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>12am</span></div>
      <p className="text-[12px] leading-relaxed text-ink-muted">
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
  const rows = other > 0 ? [...top, { name: `Other (${rest.length})`, color: null, share: other, commits: sumBy(rest, (l) => l.commits) }] : top
  if (!rows.length) return <p className="text-[12.5px] text-ink-subtle">No commits found yet.</p>
  const pct = (share) => (share < 0.005 ? '<1' : Math.round(share * 100))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
        {rows.map((l) => (
          <span key={l.name} title={`${l.name} ${pct(l.share)}%`} className="h-full min-w-[3px] rounded-[1px] first:rounded-l-full last:rounded-r-full" style={{ width: `${l.share * 100}%`, background: l.color || 'var(--color-ink-faint)' }} />
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((l) => (
          <li key={l.name} className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="flex min-w-0 items-center gap-2 text-ink-strong"><LanguageDot color={l.color} /><span className="truncate">{l.name}</span></span>
            <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
              <span className="text-[11px] text-ink-subtle">{plural(l.commits, 'commit')}</span>
              <span className="w-8 text-right text-ink-muted">{pct(l.share)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Owners({ owners }) {
  if (!owners.length) return <p className="text-[12.5px] text-ink-subtle">No commits found yet.</p>
  const total = owners.reduce((s, o) => s + o.c, 0)
  return (
    <ul className="-my-2.5 divide-y divide-line">
      {owners.slice(0, 6).map((o) => {
        const share = total ? o.c / total : 0
        return (
          <li key={o.login || 'private'} className="flex items-center gap-3 py-2.5">
            {o.avatar ? (
              <img src={o.avatar} alt="" width={30} height={30} className={`h-[30px] w-[30px] shrink-0 bg-surface-raised object-cover ring-1 ring-line ${o.type === 'org' ? 'rounded-md' : 'rounded-full'}`} />
            ) : (
              <span className={`grid h-[30px] w-[30px] shrink-0 place-items-center bg-surface-raised text-[11px] font-semibold uppercase text-ink-subtle ring-1 ring-line ${o.type === 'org' ? 'rounded-md' : 'rounded-full'}`}>
                {o.login ? o.login[0] : <Icon name="lock" className="h-3.5 w-3.5" />}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                {o.login ? (
                  <a href={`https://github.com/${o.login}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium text-ink-strong hover:underline">
                    <span className="truncate">{o.type === 'self' ? 'Your repositories' : o.login}</span>
                    {o.private && <Icon name="lock" className="h-3 w-3 shrink-0 text-ink-subtle" />}
                  </a>
                ) : (
                  <span className="truncate text-[13px] font-medium text-ink-strong">Private repositories</span>
                )}
                <span className="shrink-0 text-[12px] tabular-nums text-ink-strong">{formatCount(o.c)} <span className="text-ink-subtle">commits</span></span>
              </span>
              <span className="mt-1 flex items-center gap-2">
                <span className="block h-1 flex-1 overflow-hidden rounded-full bg-surface-raised">
                  <span className="block h-full rounded-full bg-ink-strong/60" style={{ width: `${Math.max(1.5, share * 100)}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-ink-muted">{Math.round(share * 100)}%</span>
              </span>
              <span className="mt-0.5 block truncate text-[11px] leading-snug text-ink-subtle">
                {o.type === 'org' ? 'Organization' : o.type === 'self' ? `@${o.login}` : o.type === 'private' ? 'Names hidden' : 'User'} · {plural(o.repos, 'repo')} · {formatCount(o.f)} files
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

const REPO_COLS = [
  { id: 'name', label: 'Repository', of: (r) => (r.fullName || '￿').toLowerCase(), left: true },
  { id: 'commits', label: 'Commits', of: (r) => r.commits },
  { id: 'files', label: 'Files', of: (r) => r.files },
  { id: 'lines', label: 'Lines', of: (r) => r.additions + r.deletions },
  { id: 'last', label: 'Last commit', of: (r) => r.last || '' },
]

function RepoTable({ repos }) {
  const [all, setAll] = useState(false)
  const [sort, setSort] = useState({ id: 'commits', desc: true })
  const sorted = useMemo(() => {
    const col = REPO_COLS.find((c) => c.id === sort.id)
    return [...repos].sort((x, y) => {
      const a = col.of(x)
      const b = col.of(y)
      const r = a < b ? -1 : a > b ? 1 : 0
      return sort.desc ? -r : r
    })
  }, [repos, sort])
  const max = Math.max(1, ...repos.map((r) => r.commits))
  const rows = all ? sorted : sorted.slice(0, 8)
  const toggle = (id) => setSort((s) => (s.id === id ? { id, desc: !s.desc } : { id, desc: id !== 'name' }))
  if (!repos.length) return <p className="text-[12.5px] text-ink-subtle">No commits found on any default branch.</p>

  return (
    <div className="-mx-5 -mb-5 overflow-x-auto">
      <table className="w-full min-w-[600px] text-[12.5px]">
        <thead>
          <tr className="text-[10.5px] font-mono uppercase tracking-wider text-ink-subtle">
            {REPO_COLS.map((c, i) => {
              const on = sort.id === c.id
              return (
                <th key={c.id} scope="col" aria-sort={on ? (sort.desc ? 'descending' : 'ascending') : undefined} className={`pb-2 font-semibold ${c.left ? 'px-5 text-left' : i === REPO_COLS.length - 1 ? 'px-5 text-right' : 'px-3 text-right'}`}>
                  <button type="button" onClick={() => toggle(c.id)} className={`group/sort inline-flex cursor-pointer items-center gap-1 rounded-sm outline-none transition-colors hover:text-ink-strong focus-visible:text-ink-strong ${on ? 'text-ink-strong' : ''}`}>
                    {c.label}
                    <Icon name="chevronDown" className={`h-3 w-3 transition-[opacity,transform] duration-200 ${on ? 'opacity-100' : 'opacity-0 group-hover/sort:opacity-50'} ${on && !sort.desc ? 'rotate-180' : ''}`} />
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-t border-line">
          {rows.map((r, i) => (
            <tr key={r.fullName || `private-${i}`} className="transition-colors hover:bg-surface-hover/60">
              <td className="max-w-[280px] px-5 py-2.5">
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
              <td className="relative px-3 py-2.5 text-right tabular-nums text-ink-strong">
                <span aria-hidden="true" className="absolute bottom-1.5 right-3 h-[3px] rounded-full bg-ink-strong/25" style={{ width: `calc((100% - 24px) * ${r.commits / max})` }} />
                <span className="relative">{formatExact(r.commits)}</span>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatExact(r.files)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums"><span className="text-emerald-500">+{formatCount(r.additions)}</span> <span className="text-rose-500">−{formatCount(r.deletions)}</span></td>
              <td className="whitespace-nowrap px-5 py-2.5 text-right text-ink-muted">
                {formatDay(r.last)}
                {r.first && r.first !== r.last && <span className="block text-[11px] text-ink-subtle">since {formatDay(r.first)}</span>}
              </td>
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

function Mini({ label, icon, value, sub }) {
  return (
    <div className="flex min-w-0 gap-3 py-1.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface-raised text-ink-subtle"><Icon name={icon} className="h-3.5 w-3.5" /></span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[11px] text-ink-subtle">{label}</span>
        <span className="truncate font-mono text-[17px] font-semibold leading-tight tracking-tight text-ink-strong tabular-nums">{value}</span>
        {sub && <span className="truncate text-[11px] text-ink-muted">{sub}</span>}
      </span>
    </div>
  )
}

function useDelta(data, period) {
  return useMemo(() => {
    const d = data.daily
    if (period === 'today' && d.length >= 2) return { than: 'yesterday', before: d[d.length - 2] }
    if (period === 'week' && d.length >= 14) {
      const prev = d.slice(-14, -7)
      return { than: 'the 7 days before', before: { c: sumBy(prev, (x) => x.c), f: sumBy(prev, (x) => x.f), a: sumBy(prev, (x) => x.a), d: sumBy(prev, (x) => x.d) } }
    }
    return null
  }, [data, period])
}

function StatsView({ data, onRefresh, refreshing, stale }) {
  const { user, periods, calendar, general, coverage } = data
  const [period, setPeriod] = useState('month')
  const p = periods[period]
  const meta = PERIODS.find((x) => x.id === period)
  const net = p.a - p.d
  const delta = useDelta(data, period)
  const series = period === 'year' ? data.weekly : period === 'all' ? data.monthly : period === 'month' ? data.daily : data.daily.slice(-14)
  const spark = (of) => series.map(of)
  const vs = (now, before) => (delta ? { now, before, than: delta.than } : null)
  const month30 = data.daily.map((d) => d.c)
  const company = (user.company || '').trim()
  const location = (user.location || '').trim()

  return (
    <div className="settings-stagger flex flex-col gap-5">
      <section className={CARD}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4 px-5 py-4">
          {user.avatar ? (
            <img src={user.avatar} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-full bg-surface-raised object-cover ring-1 ring-line" />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-surface-raised text-ink-subtle ring-1 ring-line"><GitHubMark className="h-6 w-6" /></span>
          )}
          <div className="min-w-0 flex-1 basis-[240px]">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h2 className="truncate text-[18px] font-semibold tracking-tight text-ink-strong">{user.name || user.login}</h2>
              <a href={user.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[12.5px] text-ink-muted transition-colors hover:text-ink-strong">
                <GitHubMark className="h-3 w-3" />{user.login}
              </a>
              {data.access?.owner && (
                <span className="inline-flex h-5 items-center gap-1 rounded-md border border-line-strong px-1.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-muted" title="Signed in as this account — private repository names are visible to you only">
                  <Icon name="lock" className="h-3 w-3" />owner view
                </span>
              )}
            </div>
            {user.bio && <p className="mt-1 truncate text-[12.5px] text-ink">{user.bio}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-ink-muted">
              {user.createdAt && <span className="flex items-center gap-1"><Icon name="calendar" className="h-3 w-3 text-ink-faint" />Since {formatMonthYear(user.createdAt)}</span>}
              <span><span className="text-ink-strong tabular-nums">{formatCount(user.followers)}</span> followers</span>
              <span><span className="text-ink-strong tabular-nums">{formatCount(user.following)}</span> following</span>
              {company && <span className="truncate">{company}</span>}
              {location && <span className="flex items-center gap-1 truncate"><Icon name="globe" className="h-3 w-3 text-ink-faint" />{location}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3 text-ink-strong" title="Commits per day, last 30 days">
            <span className="flex flex-col">
              <span className={LABEL}>Last 30 days</span>
              <span className="font-mono text-[17px] font-semibold leading-tight tabular-nums">{formatCount(periods.month.c)} <span className="text-[11.5px] font-normal text-ink-subtle">commits</span></span>
            </span>
            <Sparkline values={month30} width={96} height={34} className="text-ink-strong/70" />
          </div>
          <div className="flex w-full items-center justify-end gap-2 border-t border-line pt-3 lg:w-auto lg:border-0 lg:pt-0">
            <span className="mr-auto text-[11.5px] text-ink-subtle lg:mr-0" title={data.fetchedAt}>
              {stale ? 'Cached · ' : ''}Updated {relativeTime(data.fetchedAt)}
            </span>
            <button type="button" onClick={onRefresh} disabled={refreshing} className={BTN_SECONDARY} aria-label="Refresh stats">
              {refreshing ? <Spinner /> : <Icon name="refresh" className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink-strong">
            {meta.short}
            {delta && <span className="ml-2 font-normal text-ink-subtle">vs {delta.than}</span>}
          </h2>
          <Segmented label="Period" value={period} onChange={setPeriod} options={PERIODS.map((x) => ({ value: x.id, label: x.label }))} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile label="Commits" icon="terminal" value={p.c} spark={spark((b) => b.c)} delta={vs(p.c, delta?.before.c)} sub={p.repos ? `in ${p.repos} ${p.repos === 1 ? 'repository' : 'repositories'}` : 'nothing yet'} />
          <Tile label="Files edited" icon="folder" value={p.f} spark={spark((b) => b.f)} delta={vs(p.f, delta?.before.f)} sub={p.c ? `${(p.f / p.c).toFixed(1)} per commit` : '—'} />
          <Tile label="Lines added" icon="plus" value={p.a} prefix="+" spark={spark((b) => b.a)} delta={vs(p.a, delta?.before.a)} sub={p.c ? `${formatCount(Math.round(p.a / p.c))} per commit` : '—'} />
          <Tile label="Lines removed" icon="x" value={p.d} prefix="−" spark={spark((b) => b.d)} delta={vs(p.d, delta?.before.d)} sub={`net ${net >= 0 ? '+' : '−'}${formatCount(Math.abs(net))}`} />
          <Tile className="col-span-2 sm:col-span-1" label="Repos touched" icon="activity" value={p.repos} bar={periods.all.repos ? p.repos / periods.all.repos : 0} sub={period === 'all' ? `of ${coverage.reposFound} you've committed to` : `of ${periods.all.repos} all time`} />
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
                const share = periods.all.c ? b.c / periods.all.c : 0
                return (
                  <tr key={x.id} onClick={() => setPeriod(x.id)} className={`cursor-pointer transition-colors ${on ? 'bg-surface-hover text-ink-strong' : 'hover:bg-surface-hover/60'}`}>
                    <td className={`rounded-l-md px-2 py-2 ${on ? 'font-medium' : ''}`}>
                      <span className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full transition-colors ${on ? 'bg-ink-strong' : 'bg-line-strong'}`} aria-hidden="true" />
                        {x.short}
                      </span>
                    </td>
                    <td className="relative px-2 py-2 text-right tabular-nums">
                      <span aria-hidden="true" className={`absolute bottom-1 right-2 h-[3px] rounded-full ${on ? 'bg-ink-strong/40' : 'bg-ink-strong/20'}`} style={{ width: `calc((100% - 16px) * ${share})` }} />
                      <span className="relative">{formatCount(b.c)}</span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCount(b.f)}</td>
                    <td className="whitespace-nowrap rounded-r-md px-2 py-2 text-right tabular-nums"><span className="text-emerald-500">+{formatCount(b.a)}</span> <span className="text-rose-500">−{formatCount(b.d)}</span></td>
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

      <Panel title="On GitHub" aside="account-wide">
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
          <Mini icon="calendar" label="Contributions, past year" value={formatCount(calendar.contributions)} sub={`${calendar.activeDays} active days`} />
          <Mini icon="terminal" label="Commits on GitHub" value={formatCount(general.commitsAllYears)} sub={general.firstYear ? `since ${general.firstYear}` : undefined} />
          <Mini icon="zap" label="Current streak" value={`${calendar.streak.current} ${calendar.streak.current === 1 ? 'day' : 'days'}`} sub={calendar.streak.longest ? `longest ${calendar.streak.longest}${calendar.streak.longestFrom ? ` · ${formatDay(calendar.streak.longestFrom)} – ${formatDay(calendar.streak.longestTo)}` : ' days'}` : undefined} />
          <Mini icon="activity" label="Busiest day" value={calendar.busiestDay?.count ? formatCount(calendar.busiestDay.count) : '—'} sub={calendar.busiestDay?.count ? `contributions on ${formatDay(calendar.busiestDay.date)}` : 'nothing this year'} />
          <Mini icon="star" label="Stars on your repos" value={formatCount(general.stars)} sub={`${formatCount(general.forks)} forks`} />
          <Mini icon="folder" label="Repositories you own" value={formatCount(general.ownRepos)} sub={coverage.privateRepos > 0 ? 'public and private' : 'public'} />
          <Mini icon="inbox" label="Pull requests" value={formatCount(general.pullRequests)} sub={`${formatCount(calendar.pullRequests)} this year`} />
          <Mini icon="alert" label="Issues" value={formatCount(general.issues)} sub={`${formatCount(calendar.issues)} this year`} />
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

