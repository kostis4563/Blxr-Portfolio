function cleanTitle(t) {
  return (t || '')
    .replace(/\((?:official\s+)?(?:music\s+)?(?:video|audio|lyrics?|lyric video|visuali[sz]er|mv|hd|4k|hq|remaster(?:ed)?[^)]*)\)/gi, '')
    .replace(/\[(?:official\s+)?(?:music\s+)?(?:video|audio|lyrics?|lyric video|visuali[sz]er|mv|hd|4k|hq|remaster(?:ed)?[^\]]*)\]/gi, '')
    .replace(/\bofficial\s+(?:music\s+)?video\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
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

  const urls = []
  if (art) urls.push(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(art)}&track_name=${encodeURIComponent(track)}`)
  urls.push(`https://lrclib.net/api/search?q=${encodeURIComponent([track, art].filter(Boolean).join(' '))}`)
  urls.push(`https://lrclib.net/api/search?q=${encodeURIComponent(track)}`)

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
