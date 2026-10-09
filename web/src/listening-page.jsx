import { useCallback, useEffect, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { Bone } from './components/skeleton'
import { link, HOME_PATH, USES_PATH, CONTACT_PATH } from './lib/router'
import { relativeTime, absoluteTime } from './lib/reviews'
import {
  fetchSpotifyNow,
  fetchSpotifyRecent,
  fetchSpotifyTop,
  LISTENING_INTRO,
  LISTENING_RANGES,
  NOW_POLL_MS,
  RECENT_POLL_MS,
  RECENT_PREVIEW,
  TOP_TRACKS,
  TOP_ARTISTS,
  formatDuration,
  sampleNow,
  progressAt,
  trackEnded,
  nowStatus,
  clockTime,
  dayLabel,
  groupByDay,
  listeningStats,
  onRepeat,
} from './lib/listening'

const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-ink-subtle'
const META = 'font-mono text-[11px] tabular-nums text-ink-subtle'
const RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
const TEXT_LINK = `rounded-sm transition-colors duration-200 hover:text-ink-strong hover:underline decoration-line-strong underline-offset-4 ${RING}`
const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'

const loadNow = (_, opts) => fetchSpotifyNow(opts).then((data) => sampleNow(data))
const loadRecent = (_, opts) => fetchSpotifyRecent(opts)
const topCache = new Map()
const loadTop = async (range, opts) => {
  const hit = topCache.get(range)
  if (hit) return hit
  const data = await fetchSpotifyTop(range, opts)
  topCache.set(range, data)
  return data
}

function usePageVisible() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden')
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible
}

function useClock(every) {
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => {
    if (!every) return
    setClock(Date.now())
    const id = setInterval(() => setClock(Date.now()), every)
    return () => clearInterval(id)
  }, [every])
  return clock
}

function useLive(load, { key = '', every = 0, active = true } = {}) {
  const [state, setState] = useState({ key, data: null, error: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!active) return
    const ctrl = new AbortController()
    let timer = 0
    const run = async () => {
      try {
        const data = await load(key, { signal: ctrl.signal })
        if (ctrl.signal.aborted) return
        setState({ key, data, error: null })
      } catch (err) {
        if (ctrl.signal.aborted) return
        const code = err?.code || 'failed'
        setState((prev) => ({ key, data: prev.key === key ? prev.data : null, error: code }))
        if (code === 'spotify_disabled') return
      }
      if (every) timer = setTimeout(run, every)
    }
    run()
    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [load, key, every, active, nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  const current = state.key === key
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current || (state.data === null && state.error === null),
    refresh,
  }
}

function Art({ src, size, box = 'h-10 w-10', round = false, className = '' }) {
  const shape = round ? 'rounded-full' : 'rounded-md'
  if (!src) {
    return (
      <span aria-hidden="true" className={`flex shrink-0 items-center justify-center bg-surface-hover text-ink-faint ${box} ${shape} ${className}`}>
        <Icon name="music" className="h-4 w-4" />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={`shrink-0 bg-surface-hover object-cover ${box} ${shape} ${className}`}
    />
  )
}

function Out({ href, className = '', children, label }) {
  if (!href) return <span className={className}>{children}</span>
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={`${className} ${TEXT_LINK}`}>
      {children}
    </a>
  )
}

function Artists({ track, className = '' }) {
  const artists = track?.artists || []
  if (!artists.length) return <span className={className}>Unknown artist</span>
  return (
    <span className={className}>
      {artists.map((artist, index) => (
        <span key={`${artist.name}-${index}`}>
          {index > 0 && ', '}
          <Out href={artist.url}>{artist.name}</Out>
        </span>
      ))}
    </span>
  )
}

function Explicit({ track }) {
  if (!track?.explicit) return null
  return (
    <span title="Explicit" className="ml-1.5 inline-flex h-[15px] items-center rounded-[3px] bg-surface-hover-strong px-1 align-middle font-mono text-[9px] font-semibold text-ink-muted">
      E
    </span>
  )
}

function Equalizer({ playing }) {
  return (
    <span aria-hidden="true" className="flex h-[13px] items-end gap-[2px]">
      {[0, -0.3, -0.6].map((delay) => (
        <i
          key={delay}
          className={`w-[3px] rounded-sm ${playing ? 'animate-eq bg-emerald-400' : 'h-1 bg-ink-faint'}`}
          style={playing ? { animationDelay: `${delay}s` } : undefined}
        />
      ))}
    </span>
  )
}

function Progress({ now, clock }) {
  const at = progressAt(now, clock)
  const duration = now?.track?.durationMs
  if (at === null || !Number.isFinite(duration)) return null
  const pct = Math.min(100, Math.max(0, (at / duration) * 100))
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className={`${META} w-9 text-right`}>{formatDuration(at)}</span>
      <div
        role="progressbar"
        aria-label="Track progress"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration / 1000)}
        aria-valuenow={Math.round(at / 1000)}
        aria-valuetext={`${formatDuration(at)} of ${formatDuration(duration)}`}
        className="h-1 flex-1 overflow-hidden rounded-full bg-line-strong"
      >
        <div className="h-full rounded-full bg-ink-strong transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <span className={`${META} w-9`}>{formatDuration(duration)}</span>
    </div>
  )
}

function NowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 sm:p-5">
      <Bone className="h-28 w-28 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <Bone className="h-3 w-24" />
        <Bone className="h-5 w-56 max-w-full" />
        <Bone className="h-3.5 w-32" />
      </div>
    </div>
  )
}

function NowMessage({ icon, title, body }) {
  return (
    <div className="flex items-center gap-4 p-4 sm:p-5">
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-hover text-ink-muted">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-ink-strong">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{body}</p>
      </div>
    </div>
  )
}

function NowCard({ now, recent, clock }) {
  const status = nowStatus(now.data)
  const last = recent.data?.[0]

  let body
  if (now.loading) {
    body = <NowSkeleton />
  } else if (now.error === 'spotify_disabled') {
    body = <NowMessage icon="pause" title="Not connected right now" body="The Spotify link is switched off for the moment. Check back later." />
  } else if (!now.data && now.error) {
    body = <NowMessage icon="refresh" title="Could not reach Spotify" body="Trying again in a few seconds." />
  } else if (status === 'podcast') {
    body = <NowMessage icon="message" title="Listening to a podcast" body="Spotify does not share podcast episodes here, so the details stay private." />
  } else if (status === 'idle' && !last) {
    body = <NowMessage icon="music" title="Not playing anything" body={recent.loading ? 'Looking up the last song…' : 'Nothing played lately.'} />
  } else {
    const track = status === 'idle' ? last.track : now.data.track
    const label =
      status === 'playing' ? 'Now playing' : status === 'paused' ? 'Paused' : `Last played ${relativeTime(last.playedAt, clock)}`
    body = (
      <div className="relative flex items-center gap-4 p-4 sm:p-5">
        <a href={track.url || undefined} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true" className="shrink-0">
          <Art src={track.art} size={300} box="h-28 w-28" className="shadow-lg" />
        </a>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="flex items-center gap-2">
            <Equalizer playing={status === 'playing'} />
            <span className={`font-mono text-[11px] uppercase tracking-[0.16em] ${status === 'playing' ? 'text-emerald-500' : 'text-ink-subtle'}`}>
              {label}
            </span>
          </p>
          <h2 className="mt-1.5 truncate text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ink-strong">
            <Out href={track.url}>{track.title}</Out>
            <Explicit track={track} />
          </h2>
          <p className="mt-0.5 truncate text-[13.5px] text-ink-secondary">
            <Artists track={track} />
          </p>
          {track.album?.name && (
            <p className="mt-0.5 truncate text-[12.5px] text-ink-subtle">
              <Out href={track.album.url}>{track.album.name}</Out>
            </p>
          )}
          {status !== 'idle' && <Progress now={now.data} clock={clock} />}
        </div>
      </div>
    )
  }

  const backdrop = status === 'idle' ? last?.track?.art : now.data?.track?.art
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-line bg-surface-raised">
      {backdrop && !now.loading && (
        <img
          src={backdrop}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-3xl"
        />
      )}
      <div className="relative">{body}</div>
    </div>
  )
}

function Section({ id, title, children }) {
  return (
    <section aria-labelledby={id} className="grid w-full grid-cols-1 gap-3 border-t border-line py-8 sm:grid-cols-[8.5rem_1fr] sm:gap-6">
      <h2 id={id} className={`${LABEL} sm:pt-[3px]`}>
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function Unavailable({ error, onRetry }) {
  if (error === 'spotify_disabled') return <p className="text-[13px] text-ink-muted">Not connected right now.</p>
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
      <span>Could not load this from Spotify.</span>
      <button type="button" onClick={onRetry} className={`font-medium text-ink-secondary ${TEXT_LINK}`}>
        Try again
      </button>
    </p>
  )
}

function RowsSkeleton({ rows }) {
  return (
    <ul aria-hidden="true" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3">
          <Bone className="h-10 w-10 shrink-0" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Bone className="h-3.5" style={{ width: `${55 - (i % 3) * 12}%` }} />
            <Bone className="h-3 w-24" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function TrackRow({ track, lead, trail, trailTitle }) {
  return (
    <li className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-200 hover:bg-surface-hover">
      {lead}
      <Art src={track.thumb || track.art} size={64} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink-strong">
          <Out href={track.url}>{track.title}</Out>
          <Explicit track={track} />
        </p>
        <p className="truncate text-[12.5px] text-ink-muted">
          <Artists track={track} />
        </p>
      </div>
      {trail && (
        <span title={trailTitle} className={`${META} shrink-0`}>
          {trail}
        </span>
      )}
    </li>
  )
}

function Recent({ recent, clock }) {
  const [all, setAll] = useState(false)
  if (recent.loading) return <RowsSkeleton rows={6} />
  if (!recent.data) return <Unavailable error={recent.error} onRetry={recent.refresh} />
  if (!recent.data.length) return <p className="text-[13px] text-ink-muted">Nothing played lately.</p>

  const items = all ? recent.data : recent.data.slice(0, RECENT_PREVIEW)
  const stats = listeningStats(recent.data)
  const [top] = onRepeat(recent.data, 3)
  const sinceDay = stats.since ? dayLabel(stats.since, clock) : ''

  return (
    <div className="flex flex-col gap-5">
      <p className={META}>
        {stats.plays} plays · {stats.artists} artists · {stats.minutes} min
        {stats.since && ` · since ${clockTime(stats.since)} ${sinceDay === 'Today' || sinceDay === 'Yesterday' ? sinceDay.toLowerCase() : `on ${sinceDay}`}`}
        {top && (
          <>
            {' · '}
            <span className="text-ink-muted">“{top.track.title}” ×{top.count}</span>
          </>
        )}
      </p>
      {groupByDay(items, clock).map((group) => (
        <div key={group.key}>
          <h3 className={`${LABEL} mb-2 text-ink-faint`}>{group.label}</h3>
          <ul className="flex flex-col">
            {group.items.map((item) => (
              <TrackRow key={`${item.playedAt}-${item.track.id}`} track={item.track} trail={clockTime(item.playedAt)} trailTitle={absoluteTime(item.playedAt)} />
            ))}
          </ul>
        </div>
      ))}
      {recent.data.length > RECENT_PREVIEW && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className={`self-start rounded-md border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors duration-200 hover:border-line-strong hover:text-ink-strong ${RING}`}
        >
          {all ? 'Show less' : `Show all ${recent.data.length}`}
        </button>
      )}
    </div>
  )
}

function RangePicker({ value, onChange }) {
  return (
    <div role="group" aria-label="Time range" className="mb-6 inline-flex gap-1 rounded-lg border border-line p-0.5">
      {LISTENING_RANGES.map((range) => {
        const on = range.id === value
        return (
          <button
            key={range.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(range.id)}
            className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors duration-200 ${RING} ${
              on ? 'bg-surface-hover-strong text-ink-strong' : 'text-ink-subtle hover:text-ink-strong'
            }`}
          >
            {range.label}
          </button>
        )
      })}
    </div>
  )
}

function Top({ top }) {
  if (top.loading) {
    return (
      <div className="flex flex-col gap-8">
        <RowsSkeleton rows={6} />
      </div>
    )
  }
  if (!top.data) return <Unavailable error={top.error} onRetry={top.refresh} />

  const tracks = top.data.tracks.slice(0, TOP_TRACKS)
  const artists = top.data.artists.slice(0, TOP_ARTISTS)
  if (!tracks.length && !artists.length) return <p className="text-[13px] text-ink-muted">Not enough listening in this range yet.</p>

  return (
    <div className="flex flex-col gap-8">
      {tracks.length > 0 && (
        <div>
          <h3 className="mb-2 text-[13px] font-medium text-ink-strong">Tracks</h3>
          <ol className="flex flex-col">
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id || index}
                track={track}
                lead={<span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-faint">{index + 1}</span>}
                trail={track.durationMs ? formatDuration(track.durationMs) : null}
              />
            ))}
          </ol>
        </div>
      )}
      {artists.length > 0 && (
        <div>
          <h3 className="mb-3 text-[13px] font-medium text-ink-strong">Artists</h3>
          <ol className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
            {artists.map((artist, index) => (
              <li key={artist.id || index} className="min-w-0">
                <a
                  href={artist.url || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`group flex flex-col items-center gap-2 rounded-lg p-1 text-center ${RING}`}
                >
                  <Art src={artist.art || artist.thumb} size={160} box="h-[72px] w-[72px]" round className="transition-transform duration-300 group-hover:scale-[1.04]" />
                  <span className="w-full min-w-0">
                    <span className="block truncate text-[12.5px] font-medium text-ink-strong">
                      <span className="mr-1 font-mono text-[10.5px] text-ink-faint">{index + 1}</span>
                      {artist.name}
                    </span>
                    {artist.genres?.[0] && <span className="block truncate text-[11.5px] text-ink-subtle">{artist.genres[0]}</span>}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export default function ListeningPage({ theme, onToggleTheme }) {
  const visible = usePageVisible()
  const [range, setRange] = useState(LISTENING_RANGES[0].id)
  const now = useLive(loadNow, { key: 'now', every: NOW_POLL_MS, active: visible })
  const recent = useLive(loadRecent, { key: 'recent', every: RECENT_POLL_MS, active: visible })
  const top = useLive(loadTop, { key: range })
  const status = nowStatus(now.data)
  const clock = useClock(status === 'playing' && visible ? 1000 : 30_000)

  const trackId = now.data?.track?.id
  const refreshRecent = recent.refresh
  const seenTrack = useRef(trackId)
  useEffect(() => {
    if (!trackId || seenTrack.current === trackId) return
    if (seenTrack.current) refreshRecent()
    seenTrack.current = trackId
  }, [trackId, refreshRecent])

  const refreshNow = now.refresh
  const endedSample = useRef(0)
  useEffect(() => {
    if (!now.data || !trackEnded(now.data, clock) || endedSample.current === now.data.sampledAt) return
    endedSample.current = now.data.sampledAt
    refreshNow()
  }, [now.data, clock, refreshNow])

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[720px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
            <span>Home</span>
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

      <main className="w-full max-w-[720px] mx-auto px-5 sm:px-8 pt-28 pb-24 flex flex-col items-start bg-bg">
        <section aria-labelledby="listening-title" className="w-full pb-10">
          <p className={`${LABEL} mb-3 animate-rise-in`}>/ listening</p>
          <h1
            id="listening-title"
            className="text-[30px] sm:text-[34px] font-semibold text-ink-strong tracking-[-0.03em] leading-tight animate-rise-in"
            style={{ animationDelay: '60ms' }}
          >
            Listening
          </h1>
          <p className="mt-3 max-w-[560px] text-[14.5px] leading-relaxed text-ink-muted animate-rise-in" style={{ animationDelay: '120ms' }}>
            {LISTENING_INTRO}
          </p>
          <div className="mt-8 w-full animate-rise-in" style={{ animationDelay: '180ms' }}>
            <NowCard now={now} recent={recent} clock={clock} />
          </div>
        </section>

        <Section id="listening-recent" title="Recently played">
          <Recent recent={recent} clock={clock} />
        </Section>

        <Section id="listening-top" title="On repeat">
          <RangePicker value={range} onChange={setRange} />
          <Top top={top} />
        </Section>

        <footer className="flex w-full flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] text-ink-faint">Live from Spotify · refreshes every {NOW_POLL_MS / 1000}s</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(USES_PATH)} className={FOOT_LINK}>
              <span>What I use</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a {...link(CONTACT_PATH)} className={FOOT_LINK}>
              <span>Send me a song</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
