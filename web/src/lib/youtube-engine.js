let apiPromise = null

export function loadYouTubeApi() {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT)
      return
    }
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      try {
        if (typeof previous === 'function') previous()
      } catch {
      }
      resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = reject
    document.body.appendChild(script)
  })
  return apiPromise
}

export function parseYouTubeId(input) {
  if (!input) return null
  const s = input.trim()
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (m) return m[1]
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  return null
}

const thumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

export async function fetchYouTubeMeta(videoId) {
  const fallback = { title: null, subtitle: null, art: thumb(videoId) }
  try {
    const target = `https://www.youtube.com/watch?v=${videoId}`
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(target)}&format=json`)
    if (!res.ok) return fallback
    const d = await res.json()
    return {
      title: d.title || null,
      subtitle: (d.author_name || '').replace(/ - Topic$/, '') || null,
      art: thumb(videoId),
    }
  } catch {
    return fallback
  }
}

export { thumb as youTubeThumb }
