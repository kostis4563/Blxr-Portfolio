function cleanTitle(t) {
  return (t || '')
    .replace(/\((?:official\s+)?(?:music\s+)?(?:video|audio|lyrics?|lyric video|visuali[sz]er|mv|hd|4k|hq|remaster(?:ed)?[^)]*)\)/gi, '')
    .replace(/\[(?:official\s+)?(?:music\s+)?(?:video|audio|lyrics?|lyric video|visuali[sz]er|mv|hd|4k|hq|remaster(?:ed)?[^\]]*)\]/gi, '')
    .replace(/\bofficial\s+(?:music\s+)?video\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function stripDecorations(t) {
  return (t || '')
    .split('|')[0]
    .replace(/\((?:\s*live\b[^)]*)\)/gi, '')
    .replace(/\[(?:\s*live\b[^\]]*)\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function splitArtistTitle(t) {
  const m = (t || '').match(/^(.+?)\s+-\s+(.+)$/)
  if (!m) return null
  const artist = m[1].trim()
  const track = m[2].trim()
  if (!artist || !track) return null
  return { artist, track }
}

function parseLrc(s) {
  if (!s) return null
  const out = []
  for (const line of s.split('\n')) {
    const times = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    if (!times.length) continue
    const text = line.replace(/\[[^\]]*\]/g, '').trim()
    for (const m of times) {
      const frac = m[3] ? Number(`0.${m[3]}`) : 0
      out.push({ t: Number(m[1]) * 60 + Number(m[2]) + frac, text })
    }
  }
  if (!out.length) return null
  out.sort((a, b) => a.t - b.t)
  return out
}

function pickBest(list) {
  if (!Array.isArray(list) || !list.length) return null
  return list.find((r) => r && r.syncedLyrics) || list.find((r) => r && r.plainLyrics) || list[0]
}

export async function fetchLyrics({ title, artist, signal }) {
  const track = cleanTitle(title)
  const art = (artist || '').replace(/\s*-\s*topic$/i, '').trim()
  if (!track) return { synced: null, plain: null }

  const bare = stripDecorations(track) || track
  const split = splitArtistTitle(bare)

  const get = (artistName, trackName) =>
    `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artistName)}&track_name=${encodeURIComponent(trackName)}`
  const search = (q) => `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`

  const urls = []
  if (split) urls.push(get(split.artist, split.track))
  if (art) urls.push(get(art, bare))
  urls.push(search([split ? split.track : bare, split ? split.artist : art].filter(Boolean).join(' ')))
  urls.push(search(bare))

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal })
      if (!res.ok) continue
      const data = await res.json()
      const rec = Array.isArray(data) ? pickBest(data) : data
      if (!rec) continue
      const synced = parseLrc(rec.syncedLyrics)
      const plain = (rec.plainLyrics || '').trim() || null
      if (synced || plain) return { synced, plain }
    } catch (e) {
      if (e?.name === 'AbortError') throw e
    }
  }
  return { synced: null, plain: null }
}
