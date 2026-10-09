export const LISTENING_INTRO =
  'What is playing on my Spotify right now, what I have played lately, and what has been on repeat. It updates on its own while the page is open.'

export const LISTENING_RANGES = [
  { id: 'short', label: '4 weeks' },
  { id: 'medium', label: '6 months' },
  { id: 'long', label: '1 year' },
]

export const NOW_POLL_MS = 15_000
export const RECENT_POLL_MS = 90_000
export const TRACK_END_GRACE_MS = 2_500
export const MAX_SAMPLE_AGE_MS = 15_000
export const RECENT_PREVIEW = 12
export const TOP_TRACKS = 10
export const TOP_ARTISTS = 8

const pad = (n) => String(n).padStart(2, '0')

export class SpotifyError extends Error {
  constructor(code, status = 0) {
    super(code)
    this.code = code
    this.status = status
  }
}

async function spotifyRequest(path, signal) {
  let res
  try {
    res = await fetch(`/api/spotify${path}`, { signal, headers: { accept: 'application/json' } })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new SpotifyError('offline')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new SpotifyError(typeof data?.error === 'string' ? data.error : `http_${res.status}`, res.status)
  return data
}

export function fetchSpotifyNow({ signal } = {}) {
  return spotifyRequest('/now', signal)
}

export async function fetchSpotifyRecent({ signal } = {}) {
  const data = await spotifyRequest('/recent', signal)
  return Array.isArray(data?.items) ? data.items : []
}

export function fetchSpotifyTop(range, { signal } = {}) {
  return spotifyRequest(`/top?range=${encodeURIComponent(range)}`, signal)
}

export function artistLine(track) {
  const names = (track?.artists || []).map((a) => a?.name).filter(Boolean)
  return names.join(', ') || 'Unknown artist'
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function sampleNow(data, receivedAt = Date.now()) {
  if (!data || typeof data !== 'object') return null
  const age = Number.isFinite(data.at) ? Math.min(Math.max(0, receivedAt - data.at), MAX_SAMPLE_AGE_MS) : 0
  return { ...data, sampledAt: receivedAt - age }
}

export function progressAt(now, clock = Date.now()) {
  if (!now?.track || !Number.isFinite(now.progressMs)) return null
  const elapsed = now.playing && Number.isFinite(now.sampledAt) ? Math.max(0, clock - now.sampledAt) : 0
  const at = now.progressMs + elapsed
  return Number.isFinite(now.track.durationMs) ? Math.min(at, now.track.durationMs) : at
}

export function trackEnded(now, clock = Date.now()) {
  if (!now?.playing || !now.track || !Number.isFinite(now.track.durationMs) || !Number.isFinite(now.progressMs)) return false
  return now.progressMs + (clock - now.sampledAt) >= now.track.durationMs + TRACK_END_GRACE_MS
}

export function nowStatus(now) {
  if (now?.playing && now.track) return 'playing'
  if (now?.playing && now.kind === 'episode') return 'podcast'
  if (now?.track) return 'paused'
  return 'idle'
}

function startOfDay(ms) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function dayLabel(iso, clock = Date.now()) {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''
  const days = Math.round((startOfDay(clock) - startOfDay(then)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  try {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(then))
  } catch {
    return new Date(then).toDateString()
  }
}

export function clockTime(iso) {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''
  const d = new Date(then)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function groupByDay(items, clock = Date.now()) {
  const groups = []
  for (const item of items || []) {
    const then = Date.parse(item?.playedAt)
    if (Number.isNaN(then)) continue
    const key = startOfDay(then)
    let group = groups.at(-1)
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(item.playedAt, clock), items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}

export function listeningStats(items) {
  const list = (items || []).filter((item) => item?.track)
  const artists = new Set()
  let ms = 0
  for (const { track } of list) {
    for (const artist of track.artists || []) if (artist?.name) artists.add(artist.name.toLowerCase())
    if (Number.isFinite(track.durationMs)) ms += track.durationMs
  }
  const times = list.map((item) => Date.parse(item.playedAt)).filter(Number.isFinite)
  return {
    plays: list.length,
    artists: artists.size,
    minutes: Math.round(ms / 60_000),
    since: times.length ? new Date(Math.min(...times)).toISOString() : null,
  }
}

export function onRepeat(items, min = 2) {
  const counts = new Map()
  for (const item of items || []) {
    const id = item?.track?.id
    if (!id) continue
    const hit = counts.get(id)
    if (hit) hit.count += 1
    else counts.set(id, { track: item.track, count: 1 })
  }
  return [...counts.values()].filter((entry) => entry.count >= min).sort((a, b) => b.count - a.count)
}
