import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import { Icon } from './components/dashboard-sidebar'
import { Segmented, Modal, ToastProvider, useToast, LABEL, INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER } from './components/settings-ui'
import { Chip, Empty, Note } from './components/boards/ui'
import { Bone, Loading } from './components/skeleton'
import { link, navigate, dashboardPath } from './lib/router'
import {
  fetchLogs, clearLogs, LEVELS, SOURCES, SOURCE_LABEL, RANGES, STATUS_CLASSES, LogsError,
  EMPTY_FILTER, BUILTIN_TABS, normalizeFilter, sameFilter, isEmptyFilter, toggleIn, describeFilter,
  readSavedTabs, writeSavedTabs, newTabId,
  formatTime, formatFull, dayLabel, dayKey, formatUptime, formatBytes, relativeTime, lineOf,
} from './lib/logs-api'

const CARD = 'rounded-xl border border-line bg-surface'
const PAGE = 200
const POLL_MS = 10_000

const MESSAGES = {
  unauthorized: 'The server did not accept this session as the owner. SITE_OWNER_EMAIL (or STATS_OWNER_EMAIL) in its env file has to be this account’s email, with SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY set beside it.',
  logs_disabled: 'The log is not switched on for this server yet — set SITE_OWNER_EMAIL in its env file and restart it.',
  offline: 'You appear to be offline.',
  failed: 'The server did not answer. Try again in a moment.',
}
const messageFor = (err) => MESSAGES[err?.code] || MESSAGES.failed

const LEVEL_DOT = { error: 'bg-red-500', warn: 'bg-amber-500', info: 'bg-ink-faint' }
const LEVEL_LABEL = { error: 'Error', warn: 'Warning', info: 'Info' }

const when = (e) => e.last || e.at

function Spinner({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function Tile({ label, value, hint, tone }) {
  return (
    <div className={`${CARD} flex flex-col gap-2 px-4 py-3.5`}>
      <span className={LABEL}>{label}</span>
      <span className={`text-[22px] font-semibold leading-none tracking-tight tabular-nums ${tone || 'text-ink-strong'}`}>{value}</span>
      {hint && <span className="text-[11.5px] text-ink-subtle">{hint}</span>}
    </div>
  )
}

function OnOff({ on, children }) {
  return (
    <span className="flex items-center justify-between gap-3 py-2">
      <span className="text-[13px] text-ink">{children}</span>
      <span className={`inline-flex h-5 items-center gap-1.5 rounded-md border px-1.5 text-[10.5px] font-medium uppercase tracking-wide ${on ? 'border-line-strong text-ink-strong' : 'border-line text-ink-faint'}`}>
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-ink-faint'}`} />
        {on ? 'on' : 'off'}
      </span>
    </span>
  )
}

function Panel({ title, description, children, className = '' }) {
  return (
    <section className={`${CARD} ${className}`}>
      <header className="border-b border-line px-5 py-3.5">
        <h2 className="text-[14px] font-semibold tracking-tight text-ink-strong">{title}</h2>
        {description && <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p>}
      </header>
      <div className="px-5 py-3">{children}</div>
    </section>
  )
}

function Fact({ label, children, mono = true }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-[12.5px] text-ink-muted">{label}</span>
      <span className={`min-w-0 truncate text-right text-[12.5px] text-ink-strong ${mono ? 'font-mono tabular-nums' : ''}`}>{children}</span>
    </div>
  )
}

function Skeleton({ list = true }) {
  return (
    <Loading label="Loading the log" className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`${CARD} flex flex-col gap-3 px-4 py-3.5`}>
            <Bone className="h-2.5 w-16" />
            <Bone className="h-5 w-10" />
            <Bone className="h-2 w-20" />
          </div>
        ))}
      </div>
      {list ? (
        <div className={CARD}>
          <div className="flex items-center gap-3 border-b border-line px-4 py-3"><Bone className="h-8 w-56 max-w-full rounded-lg" /><Bone className="ml-auto h-7 w-40 rounded-lg" /></div>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
              <Bone className="h-2.5 w-14" /><Bone className="h-2 w-2 rounded-full" /><Bone className="h-4 w-12 rounded-md" />
              <Bone className={`h-2.5 ${['w-64', 'w-40', 'w-80', 'w-52', 'w-72', 'w-36', 'w-60'][i]} max-w-full`} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className={`${CARD} h-[200px]`} />)}
        </div>
      )}
    </Loading>
  )
}

function Row({ entry, open, onToggle, now }) {
  const toast = useToast()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText([lineOf(entry), entry.detail, entry.stack].filter(Boolean).join('\n'))
      toast('Copied')
    } catch {
      toast('Clipboard blocked', 'error')
    }
  }
  const hasMore = Boolean(entry.stack || entry.detail || entry.path || entry.client)

  return (
    <li className="animate-rise-in border-b border-line last:border-0">
      <div
        role={hasMore ? 'button' : undefined}
        tabIndex={hasMore ? 0 : undefined}
        aria-expanded={hasMore ? open : undefined}
        onClick={hasMore ? onToggle : undefined}
        onKeyDown={hasMore ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } } : undefined}
        className={`grid grid-cols-[auto_auto_1fr_auto] items-start gap-x-3 px-4 py-2.5 outline-none transition-colors sm:grid-cols-[64px_auto_auto_1fr_auto] ${hasMore ? 'cursor-pointer hover:bg-surface-hover/60 focus-visible:bg-surface-hover/60' : ''} ${open ? 'bg-surface-hover/40' : ''}`}
      >
        <time dateTime={when(entry)} title={formatFull(when(entry))} className="hidden pt-px font-mono text-[11.5px] text-ink-subtle tabular-nums sm:block">
          {formatTime(when(entry))}
        </time>
        <span className="flex h-[18px] items-center" title={LEVEL_LABEL[entry.level]}>
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${LEVEL_DOT[entry.level]}`} />
          <span className="sr-only">{LEVEL_LABEL[entry.level]}</span>
        </span>
        <span className="inline-flex h-[18px] w-[60px] items-center justify-center rounded border border-line px-1 font-mono text-[10px] uppercase tracking-wide text-ink-subtle">
          {SOURCE_LABEL[entry.source] || entry.source}
        </span>
        <span className="min-w-0">
          <span className={`block break-words text-[13px] leading-[18px] ${entry.level === 'error' ? 'text-ink-strong' : 'text-ink'}`}>{entry.message}</span>
          {(entry.path || entry.client) && !open && (
            <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-faint">
              {entry.method && `${entry.method} `}{entry.path}{entry.path && entry.client ? ' · ' : ''}{entry.client}
            </span>
          )}
          <time dateTime={when(entry)} className="mt-0.5 block font-mono text-[10.5px] text-ink-faint sm:hidden">{formatTime(when(entry))}</time>
        </span>
        <span className="flex items-center gap-2 pt-px">
          {entry.count > 1 && (
            <span title={`${entry.count} times, last ${relativeTime(entry.last, now)}`} className="inline-flex h-[18px] items-center rounded-md bg-surface-hover-strong px-1.5 font-mono text-[10.5px] font-medium text-ink tabular-nums">
              ×{entry.count}
            </span>
          )}
          {entry.status && (
            <span className={`font-mono text-[11px] tabular-nums ${entry.status >= 500 ? 'text-red-500' : 'text-ink-subtle'}`}>{entry.status}</span>
          )}
          {hasMore && <Icon name="chevronDown" className={`h-3.5 w-3.5 text-ink-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />}
        </span>
      </div>

      {open && hasMore && (
        <div className="border-t border-line bg-surface-raised/40 px-4 py-3 animate-menu-in sm:pl-[92px]">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
            <dt className="text-ink-subtle">First</dt>
            <dd className="font-mono text-ink tabular-nums">{formatFull(entry.at)}</dd>
            {entry.count > 1 && (
              <>
                <dt className="text-ink-subtle">Last</dt>
                <dd className="font-mono text-ink tabular-nums">{formatFull(entry.last)} · {entry.count} times</dd>
              </>
            )}
            {entry.path && (
              <>
                <dt className="text-ink-subtle">Request</dt>
                <dd className="font-mono text-ink break-all">{entry.method && `${entry.method} `}{entry.path}{entry.status && ` → ${entry.status}`}{entry.code && ` ${entry.code}`}</dd>
              </>
            )}
            {entry.client && (
              <>
                <dt className="text-ink-subtle">Client</dt>
                <dd className="text-ink">{entry.client}</dd>
              </>
            )}
            {entry.detail && (
              <>
                <dt className="text-ink-subtle">Detail</dt>
                <dd className="whitespace-pre-wrap break-words font-mono text-ink">{entry.detail}</dd>
              </>
            )}
          </dl>
          {entry.stack && (
            <pre className="mt-2.5 max-h-[320px] overflow-auto rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-ink-secondary">{entry.stack}</pre>
          )}
          <div className="mt-2.5 flex items-center gap-2">
            <button type="button" onClick={(e) => { e.stopPropagation(); copy() }} className={`${BTN_GHOST} h-7 px-2 text-[12px]`}>
              <Icon name="copy" className="h-3.5 w-3.5" /> Copy
            </button>
            <span className="font-mono text-[10.5px] text-ink-faint">#{entry.id}</span>
          </div>
        </div>
      )}
    </li>
  )
}

function List({ items, now }) {
  const [openIds, setOpenIds] = useState(() => new Set())
  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const groups = useMemo(() => {
    const sorted = [...items].sort((a, b) => Date.parse(when(b)) - Date.parse(when(a)) || b.id - a.id)
    const out = []
    for (const e of sorted) {
      const key = dayKey(when(e))
      const last = out[out.length - 1]
      if (last && last.key === key) last.items.push(e)
      else out.push({ key, label: dayLabel(when(e)), items: [e] })
    }
    return out
  }, [items])

  return (
    <div>
      {groups.map((group) => (
        <div key={group.key}>
          <p className="sticky top-14 z-10 border-b border-line bg-surface/95 px-4 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint backdrop-blur-sm">
            {group.label} <span className="font-normal normal-case tracking-normal">· {group.items.length}</span>
          </p>
          <ul>
            {group.items.map((entry) => (
              <Row key={entry.id} entry={entry} open={openIds.has(entry.id)} onToggle={() => toggle(entry.id)} now={now} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function SystemView({ system, summary, now }) {
  const { process: proc, features, state, caches, mirrors, reviews, chart } = system
  return (
    <div className="settings-stagger grid gap-4 md:grid-cols-2">
      <Panel title="Process" description="The Node server behind /api.">
        <Fact label="Node">{proc.node}</Fact>
        <Fact label="Platform">{proc.platform}</Fact>
        <Fact label="PID">{proc.pid}</Fact>
        <Fact label="Started">{formatFull(proc.startedAt)} <span className="text-ink-subtle">· {relativeTime(proc.startedAt, now)}</span></Fact>
        <Fact label="Uptime">{formatUptime(proc.uptime)}</Fact>
        <Fact label="Memory">{formatBytes(proc.rss)} rss <span className="text-ink-subtle">· heap {formatBytes(proc.heapUsed)} / {formatBytes(proc.heapTotal)}</span></Fact>
      </Panel>

      <Panel title="Switched on" description="What the environment file enables. Values are never shown, only whether they are set.">
        <div className="divide-y divide-line">
          <OnOff on={features.supabase}>Supabase session checks</OnOff>
          <OnOff on={features.owner}>Owner account (SITE_OWNER_EMAIL)</OnOff>
          <OnOff on={features.github}>Developer stats (GITHUB_TOKEN)</OnOff>
          <OnOff on={features.mail}>Account mail (Resend)</OnOff>
          <OnOff on={features.accountDelete}>Account deletion (SUPABASE_SECRET_KEY)</OnOff>
        </div>
      </Panel>

      <Panel title="State on disk" description={<span className="font-mono">{state.dir}</span>}>
        <table className="w-full text-[12.5px]">
          <tbody>
            {state.files.map((f) => (
              <tr key={f.name} className="border-b border-line last:border-0">
                <td className="py-1.5 pr-3 font-mono text-ink">{f.name}</td>
                <td className="py-1.5 pr-3 text-right font-mono text-ink-muted tabular-nums">{formatBytes(f.size)}</td>
                <td className="py-1.5 text-right text-ink-subtle">{f.modified ? relativeTime(f.modified, now) : 'not written yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
          <Fact label="Reviews">{state.reviews}</Fact>
          <Fact label="Invites">{state.invites}</Fact>
          <Fact label="Log entries">{state.logs}</Fact>
          <Fact label="Hit days">{state.hitDays}</Fact>
          <Fact label="Vitals days">{state.vitalDays}</Fact>
          <Fact label="Pending reviews">{reviews.pending}</Fact>
        </div>
      </Panel>

      <Panel title="Caches" description="Entries held in memory right now.">
        <Fact label="Search results">{caches.search}</Fact>
        <Fact label="Top charts">{caches.top} <span className="text-ink-subtle">· default {chart.warm ? `warm, ${formatUptime(chart.age / 1000)} old` : 'cold'}</span></Fact>
        <Fact label="Contribution graphs">{caches.contributions}</Fact>
        <Fact label="Developer stats">{caches.stats}</Fact>
        <div className="mt-2 border-t border-line pt-2">
          <Fact label="Review form">{reviews.paused ? 'paused' : 'open'} <span className="text-ink-subtle">· approval {reviews.approval ? 'on' : 'off'} · {reviews.blockedTerms} blocked terms</span></Fact>
        </div>
      </Panel>

      <Panel title="Log" description="What the ring buffer holds. It keeps the last 3,000 events; repeats within a minute fold into one.">
        <Fact label="Entries">{summary.total}</Fact>
        <Fact label="Oldest">{summary.oldest ? `${formatFull(summary.oldest)} · ${relativeTime(summary.oldest, now)}` : '—'}</Fact>
        <Fact label="Last error">{summary.lastError ? relativeTime(summary.lastError, now) : 'none'}</Fact>
        <div className="mt-2 grid grid-cols-2 gap-x-4 border-t border-line pt-2 sm:grid-cols-4">
          {SOURCES.map((s) => (
            <Fact key={s} label={SOURCE_LABEL[s]}>{summary.bySource[s]}</Fact>
          ))}
        </div>
      </Panel>
      <Panel title="Upstream mirrors" description="Search fans out across these. A mirror that errors is skipped for five minutes." className="md:col-span-2">
        <ul className="divide-y divide-line">
          {mirrors.map((m) => (
            <li key={m.base} className="flex items-center gap-3 py-2">
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${m.down ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">{m.base.replace(/^https:\/\//, '')}</span>
              <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">{m.kind}</span>
              <span className={`w-[140px] text-right text-[12px] ${m.down ? 'text-red-500' : 'text-ink-subtle'}`}>
                {m.down ? `skipped, back ${relativeTime(m.until, now).replace(' ago', '')}` : 'in rotation'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

    </div>
  )
}

function TabBar({ tabs, current, dirty, onSave, onRemove }) {
  const listRef = useRef(null)
  const [bar, setBar] = useState(null)

  const measure = useCallback(() => {
    const list = listRef.current
    const el = list?.querySelector('[aria-current="page"]')
    if (!el) return setBar(null)
    const r = el.getBoundingClientRect()
    setBar({ left: r.left - list.getBoundingClientRect().left, width: r.width })
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [])
  useLayoutEffect(measure, [measure, current, tabs.length])
  useEffect(() => {
    document.fonts?.ready.then(measure)
  }, [measure])
  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  return (
    <nav aria-label="Log views" className="-mx-4 mb-5 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <ul ref={listRef} className="relative flex w-max items-center gap-1">
        {tabs.map((tab, i) => {
          const on = tab.id === current
          const firstSaved = tab.saved && !tabs[i - 1]?.saved
          return (
            <li key={tab.id} className={`group/tab relative ${firstSaved ? 'ml-2 border-l border-line pl-2' : ''}`}>
              <a
                {...link(dashboardPath(`logs/${tab.id}`))}
                aria-current={on ? 'page' : undefined}
                title={tab.saved ? describeFilter(tab.filter) : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-[13px] outline-none transition-colors duration-200 focus-visible:text-ink-strong ${on ? 'font-medium text-ink-strong' : 'text-ink-muted hover:text-ink-strong'} ${tab.saved ? 'pr-7' : ''}`}
              >
                {tab.saved && <Icon name="bookmark" className="h-3 w-3 text-ink-faint" />}
                {tab.label}
                {on && dirty && <span aria-label="filters changed" className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
              </a>
              {tab.saved && (
                <button
                  type="button"
                  onClick={() => onRemove(tab)}
                  aria-label={`Remove tab ${tab.label}`}
                  title="Remove this tab"
                  className="absolute right-1 top-1/2 grid h-5 w-5 -translate-y-1/2 cursor-pointer place-items-center rounded text-ink-faint opacity-0 transition-opacity hover:bg-surface-hover hover:text-ink-strong focus-visible:opacity-100 group-hover/tab:opacity-100"
                >
                  <Icon name="x" className="h-3 w-3" />
                </button>
              )}
            </li>
          )
        })}
        <li className="ml-1">
          <button type="button" onClick={onSave} title="Save the current filters as a tab" className={`${BTN_GHOST} h-7 px-2 text-[12px] text-ink-subtle`}>
            <Icon name="plus" className="h-3.5 w-3.5" /> Save tab
          </button>
        </li>
        {bar && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-px h-0.5 rounded-full bg-ink-strong transition-[left,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ left: bar.left, width: bar.width }}
          />
        )}
      </ul>
    </nav>
  )
}

function Count({ n }) {
  return <span className="font-mono text-[10.5px] text-ink-faint tabular-nums">{n}</span>
}

function FilterBar({ filter, onChange, facets, dirty, presetEmpty, onReset, live, onLive, busy, onRefresh, onExport, onClear, canClear, canExport, inputRef }) {
  const set = (patch) => onChange({ ...filter, ...patch })

  return (
    <div className="border-b border-line">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            ref={inputRef}
            type="search"
            value={filter.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search messages, paths, stacks…  ( / )"
            aria-label="Search the log"
            className={`${INPUT} h-8 pl-8 text-[13px] [&::-webkit-search-cancel-button]:hidden`}
          />
          {filter.q && (
            <button type="button" onClick={() => set({ q: '' })} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 cursor-pointer place-items-center rounded text-ink-faint hover:text-ink-strong">
              <Icon name="x" className="h-3 w-3" />
            </button>
          )}
        </div>
        <Segmented label="Time range" value={filter.range} onChange={(range) => set({ range })} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} />
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onLive} aria-pressed={live} title={live ? 'Refreshing every 10 seconds — click to pause' : 'Paused — click to refresh live'} className={`${BTN_GHOST} gap-2 px-2.5 ${live ? 'text-ink-strong' : ''}`}>
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-emerald-500' : 'bg-ink-faint'}`} />
            {live ? 'Live' : 'Paused'}
          </button>
          <button type="button" onClick={onRefresh} disabled={busy} aria-label="Refresh" title="Refresh" className={`${BTN_GHOST} w-8 px-0`}>
            {busy ? <Spinner /> : <Icon name="refresh" className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={onExport} disabled={!canExport} aria-label="Export as JSON" title="Export what is shown as JSON" className={`${BTN_GHOST} w-8 px-0`}>
            <Icon name="download" className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onClear} disabled={!canClear} aria-label="Clear the log" title="Clear the log" className={`${BTN_GHOST} w-8 px-0 hover:text-red-500`}>
            <Icon name="trash" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className={`${LABEL} mr-1`}>Level</span>
          {LEVELS.map((l) => (
            <Chip key={l} active={filter.levels.includes(l)} onClick={() => set({ levels: toggleIn(filter.levels, l) })}>
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${LEVEL_DOT[l]}`} />
              {LEVEL_LABEL[l]}
              <Count n={facets.levels[l]} />
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className={`${LABEL} mr-1`}>Source</span>
          {SOURCES.map((s) => (
            <Chip key={s} active={filter.sources.includes(s)} onClick={() => set({ sources: toggleIn(filter.sources, s) })} disabled={!facets.sources[s] && !filter.sources.includes(s)}>
              {SOURCE_LABEL[s]}
              <Count n={facets.sources[s]} />
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`${LABEL} mr-1`}>Status</span>
          {STATUS_CLASSES.map((c) => (
            <Chip key={c} active={filter.status === c} onClick={() => set({ status: filter.status === c ? '' : c })} disabled={!facets.statuses[c] && filter.status !== c}>
              <span className="font-mono">{c}</span>
              <Count n={facets.statuses[c]} />
            </Chip>
          ))}
        </div>
        {dirty && (
          <button type="button" onClick={onReset} className={`${BTN_GHOST} ml-auto h-7 px-2 text-[12px]`}>
            <Icon name="undo" className="h-3.5 w-3.5" />
            {presetEmpty ? 'Clear filters' : 'Reset to tab'}
          </button>
        )}
      </div>
    </div>
  )
}

function SaveTabDialog({ open, filter, busy, onSave, onClose }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (open) setLabel('')
  }, [open])
  const submit = (e) => {
    e.preventDefault()
    if (label.trim()) onSave(label.trim())
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save as a tab"
      description={<>Keeps <span className="text-ink">{describeFilter(filter)}</span> one click away, in this browser.</>}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button type="submit" form="save-tab" disabled={!label.trim()} className={BTN_PRIMARY}>
            <Icon name="bookmark" className="h-3.5 w-3.5" /> Save tab
          </button>
        </>
      }
    >
      <form id="save-tab" onSubmit={submit}>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Name</span>
          <input data-autofocus value={label} maxLength={24} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 5xx this week" className={INPUT} />
        </label>
      </form>
    </Modal>
  )
}

const tabFromHash = (hash) => (hash || '').replace(/^#/, '').split('/')[1] || ''

function LogsBody({ hash }) {
  const toast = useToast()
  const [saved, setSaved] = useState(readSavedTabs)
  const tabs = useMemo(() => [...BUILTIN_TABS, ...saved], [saved])
  const tab = tabs.find((t) => t.id === tabFromHash(hash)) || tabs[0]
  const isSystem = Boolean(tab.system)
  const preset = useMemo(() => normalizeFilter(tab.filter), [tab])

  const [filter, setFilter] = useState(preset)
  const [applied, setApplied] = useState(preset)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [more, setMore] = useState(false)
  const [live, setLive] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const abort = useRef(null)
  const searchRef = useRef(null)
  const dirty = !isSystem && !sameFilter(filter, preset)

  useEffect(() => {
    setFilter(preset)
    setApplied(preset)
  }, [preset])

  useEffect(() => {
    const t = setTimeout(() => setApplied((held) => (sameFilter(held, filter) ? held : filter)), 250)
    return () => clearTimeout(t)
  }, [filter])

  const load = useCallback(async ({ quiet = false } = {}) => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    if (!quiet) setBusy(true)
    try {
      const next = await fetchLogs(applied, { limit: isSystem ? 0 : PAGE, signal: ctrl.signal })
      if (ctrl.signal.aborted) return
      setData(next)
      setError(null)
      setNow(Date.now())
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(err instanceof LogsError ? err : new LogsError('failed'))
    } finally {
      if (!ctrl.signal.aborted) setBusy(false)
    }
  }, [applied, isSystem])

  useEffect(() => {
    load()
    return () => abort.current?.abort()
  }, [load])

  useEffect(() => {
    if (!live) return undefined
    const tick = () => document.visibilityState === 'visible' && load({ quiet: true })
    const timer = setInterval(tick, POLL_MS)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', tick)
    }
  }, [live, load])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape' && e.target === searchRef.current) {
        searchRef.current.blur()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const loadMore = async () => {
    if (!data?.items.length) return
    setMore(true)
    try {
      const before = Math.min(...data.items.map((e) => e.id))
      const next = await fetchLogs(applied, { limit: PAGE, before })
      setData((held) => ({ ...next, items: [...held.items, ...next.items] }))
    } catch (err) {
      toast(messageFor(err), 'error')
    } finally {
      setMore(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    try {
      const { removed } = await clearLogs()
      setClearing(false)
      toast(`Cleared ${removed} entries`)
      await load()
    } catch (err) {
      toast(messageFor(err), 'error')
      setBusy(false)
    }
  }

  const saveTab = (label) => {
    const next = [...saved, { id: newTabId(), label, filter: normalizeFilter(filter), saved: true }]
    setSaved(next)
    writeSavedTabs(next)
    setSaving(false)
    toast(`Saved “${label}”`)
    navigate(dashboardPath(`logs/${next[next.length - 1].id}`))
  }

  const removeTab = (gone) => {
    const next = saved.filter((t) => t.id !== gone.id)
    setSaved(next)
    writeSavedTabs(next)
    toast(`Removed “${gone.label}”`)
    if (gone.id === tab.id) navigate(dashboardPath('logs'), { replace: true })
  }

  const exportJson = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), filter: applied, items: data.items }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: `blxr-logs-${new Date().toISOString().slice(0, 10)}.json` })
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabBar = (
    <TabBar tabs={tabs} current={tab.id} dirty={dirty} onSave={() => setSaving(true)} onRemove={removeTab} />
  )

  if (error && !data) {
    return (
      <div>
        {tabBar}
        <div className={`${CARD} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
          <Icon name="alert" className="h-5 w-5 text-ink-faint" />
          <p className="max-w-[440px] text-[13px] leading-relaxed text-ink-muted">{messageFor(error)}</p>
          <button type="button" onClick={() => load()} className={BTN_SECONDARY}>Try again</button>
        </div>
      </div>
    )
  }
  if (!data) return <div>{tabBar}<Skeleton list={!isSystem} /></div>

  const { summary, system, items, facets } = data
  const recent = summary.recent

  const tiles = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Tile label="Errors · 24h" value={recent.error} tone={recent.error ? 'text-red-500' : undefined} hint={summary.lastError ? `last ${relativeTime(summary.lastError, now)}` : 'none yet'} />
      <Tile label="Warnings · 24h" value={recent.warn} tone={recent.warn ? 'text-amber-500' : undefined} hint={`${summary.byLevel.warn} all time`} />
      <Tile label="API failures · 24h" value={recent.api} hint={`${summary.bySource.api} all time`} />
      <Tile label="Browser · 24h" value={recent.client} hint={`${summary.bySource.client} all time`} />
      <Tile label="Uptime" value={formatUptime(system.process.uptime)} hint={`since ${formatFull(system.process.startedAt)}`} />
    </div>
  )

  if (isSystem) {
    return (
      <div>
        {tabBar}
        <div className="flex flex-col gap-5">
          {tiles}
          <SystemView system={system} summary={summary} now={now} />
          <p className="text-right font-mono text-[10.5px] text-ink-faint">{live ? 'refreshing every 10 s' : 'paused'} · as of {formatTime(data.now)}</p>
        </div>
      </div>
    )
  }

  const narrowed = !isEmptyFilter(applied)

  return (
    <div>
      {tabBar}
      <div className="flex flex-col gap-5">
        {tiles}
        {error && <Note tone="error">{messageFor(error)} Showing what was loaded before.</Note>}

        <div className={CARD}>
          <FilterBar
            filter={filter}
            onChange={setFilter}
            facets={facets}
            dirty={dirty}
            presetEmpty={isEmptyFilter(preset)}
            onReset={() => setFilter(preset)}
            live={live}
            onLive={() => setLive((v) => !v)}
            busy={busy}
            onRefresh={() => load()}
            onExport={exportJson}
            canExport={items.length > 0}
            onClear={() => setClearing(true)}
            canClear={summary.total > 0}
            inputRef={searchRef}
          />

          {items.length === 0 ? (
            <div className="px-4 py-2">
              <Empty
                icon={narrowed ? 'search' : tab.id === 'errors' ? 'circleCheck' : 'logs'}
                title={narrowed ? 'Nothing matches' : tab.id === 'errors' ? 'No errors' : 'Nothing logged yet'}
                body={
                  narrowed
                    ? 'Try a different search, a wider time range or fewer chips.'
                    : tab.id === 'errors'
                      ? 'Nothing has gone wrong on the server since the log was last cleared.'
                      : 'The server writes here as things happen: failed requests, exceptions, upstream trouble, browser errors.'
                }
                action={narrowed ? <button type="button" onClick={() => setFilter(EMPTY_FILTER)} className={BTN_SECONDARY}>Clear filters</button> : null}
              />
            </div>
          ) : (
            <List items={items} now={now} />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5">
            <p className="font-mono text-[11px] text-ink-subtle tabular-nums">
              {items.length} of {data.matched} {data.matched === 1 ? 'entry' : 'entries'}
              {narrowed && <span className="text-ink-faint"> · {describeFilter(applied)}</span>}
              <span className="text-ink-faint"> · as of {formatTime(data.now)}</span>
            </p>
            {items.length < data.matched && (
              <button type="button" onClick={loadMore} disabled={more} className={`${BTN_GHOST} h-7 px-2 text-[12px]`}>
                {more ? <Spinner /> : <Icon name="arrowDown" className="h-3.5 w-3.5" />}
                Load older
              </button>
            )}
          </div>
        </div>
      </div>

      <SaveTabDialog open={saving} filter={filter} busy={false} onSave={saveTab} onClose={() => setSaving(false)} />

      <Modal
        open={clearing}
        onClose={() => setClearing(false)}
        title="Clear the log?"
        description={`All ${summary.total} entries on the server go. New events start filling it again straight away.`}
        tone="danger"
        busy={busy}
        footer={
          <>
            <button type="button" onClick={() => setClearing(false)} className={BTN_SECONDARY}>Keep</button>
            <button type="button" data-autofocus onClick={clear} disabled={busy} className={BTN_DANGER}>
              {busy ? <Spinner /> : <Icon name="trash" className="h-3.5 w-3.5" />} Clear everything
            </button>
          </>
        }
      />
    </div>
  )
}

export default function DashboardLogs({ hash }) {
  return (
    <ToastProvider>
      <LogsBody hash={hash} />
    </ToastProvider>
  )
}
