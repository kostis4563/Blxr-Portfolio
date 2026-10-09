export const LISTENING_INTRO = 'Live from my Spotify. It updates on its own while the page is open.'

export const LISTENING_RANGES = [
  { id: 'short', label: '4 weeks', span: '4 weeks' },
  { id: 'medium', label: '6 months', span: '6 months' },
  { id: 'long', label: '1 year', span: 'year' },
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

export function hoursAndMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min'
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (!h) return `${m} min`
  return m ? `${h} hr ${m} min` : `${h} hr`
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

export function playsOn(items, clock = Date.now()) {
  const today = startOfDay(clock)
  return (items || []).filter((item) => {
    const then = Date.parse(item?.playedAt)
    return Number.isFinite(then) && startOfDay(then) === today
  }).length
}

export function hourly(items) {
  const counts = Array.from({ length: 24 }, () => 0)
  for (const item of items || []) {
    const then = Date.parse(item?.playedAt)
    if (Number.isFinite(then)) counts[new Date(then).getHours()] += 1
  }
  const max = Math.max(...counts)
  return { counts, max, peak: max ? counts.indexOf(max) : null }
}

export function artistCounts(items, limit = 8) {
  const counts = new Map()
  for (const item of items || []) {
    for (const artist of item?.track?.artists || []) {
      if (!artist?.name) continue
      const key = artist.url || artist.name.toLowerCase()
      const hit = counts.get(key)
      if (hit) hit.count += 1
      else counts.set(key, { name: artist.name, url: artist.url || null, count: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit)
}

export function albumsOf(items, limit = 24) {
  const seen = new Set()
  const out = []
  for (const item of items || []) {
    const track = item?.track
    const key = track?.album?.url || track?.art
    if (!key || !track.art || seen.has(key)) continue
    seen.add(key)
    out.push(track)
    if (out.length >= limit) break
  }
  return out
}

function toHsl(r, g, b) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return [h * 60, s, l]
}

export function heroColor(rgb) {
  if (!Array.isArray(rgb) || rgb.length < 3 || !rgb.every(Number.isFinite)) return null
  const [h, s, l] = toHsl(...rgb)
  const sat = s < 0.12 ? s : Math.min(0.7, Math.max(0.35, s))
  const light = Math.min(0.36, Math.max(0.2, l))
  return `hsl(${Math.round(h)} ${Math.round(sat * 100)}% ${Math.round(light * 100)}%)`
}

export function fallbackColor(seed = '') {
  let hash = 0
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return `hsl(${Math.abs(hash) % 360} 40% 28%)`
}

const colorCache = new Map()

export function coverColor(url) {
  if (!url || typeof document === 'undefined') return Promise.resolve(null)
  if (colorCache.has(url)) return colorCache.get(url)
  const job = new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      try {
        const size = 24
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        let r = 0
        let g = 0
        let b = 0
        let total = 0
        for (let i = 0; i < data.length; i += 4) {
          const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]]
          const max = Math.max(pr, pg, pb)
          const min = Math.min(pr, pg, pb)
          if (max < 24 || min > 235) continue
          const weight = 1 + ((max - min) / 255) * 4
          r += pr * weight
          g += pg * weight
          b += pb * weight
          total += weight
        }
        resolve(total ? heroColor([r / total, g / total, b / total]) : null)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
  colorCache.set(url, job)
  return job
}

export function topSummary(top) {
  const tracks = (top?.tracks || []).filter(Boolean)
  const artists = (top?.artists || []).filter(Boolean)

  const genres = new Map()
  artists.forEach((artist, index) => {
    for (const genre of artist.genres || []) {
      if (!genre) continue
      const hit = genres.get(genre) || { name: genre, count: 0, score: 0 }
      hit.count += 1
      hit.score += artists.length - index
      genres.set(genre, hit)
    }
  })

  const albums = new Map()
  for (const track of tracks) {
    const key = track.album?.url || track.album?.name
    if (!key) continue
    const hit = albums.get(key)
    if (hit) hit.count += 1
    else albums.set(key, { name: track.album.name, url: track.album.url || null, art: track.art || track.thumb || null, artists: track.artists || [], count: 1 })
  }
  const album = [...albums.values()].sort((a, b) => b.count - a.count)[0]

  const voices = new Set()
  for (const track of tracks) for (const artist of track.artists || []) if (artist?.name) voices.add(artist.url || artist.name.toLowerCase())

  return {
    artist: artists[0] || null,
    track: tracks[0] || null,
    genres: [...genres.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 3),
    album: album && album.count >= 2 ? album : null,
    artistCount: voices.size,
    trackCount: tracks.length,
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
