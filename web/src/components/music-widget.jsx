import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadYouTubeApi, parseYouTubeId, fetchYouTubeMeta, youTubeThumb } from '../lib/youtube-engine'
import { fetchLyrics } from '../lib/lyrics'
import { searchTracks, fetchTopChart } from '../lib/api'

const STORAGE_KEY = 'blxr-music-v2'

const VOLUME_KEY = 'blxr-music-vol'

const DEFAULT_VOLUME = 50
const DEFAULT_QUERY = 'lofi hip hop'

const VIRAL_VIEWS = 50_000_000

const MEDALS = [
  { color: '#f5c542', glow: 'rgba(245,197,66,0.55)' },
  { color: '#c9d1d9', glow: 'rgba(201,209,217,0.45)' },
  { color: '#e08a4b', glow: 'rgba(224,138,75,0.45)' },
]

function fmt(s) {
  if (!s || s < 0 || !isFinite(s)) return '0:00'
  const t = Math.floor(s)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

function fmtViews(n) {
  const v = Number(n)
  if (!v || v < 0 || !isFinite(v)) return ''
  if (v >= 1e9) return `${(v / 1e9).toFixed(1).replace(/\.0$/, '')}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, '')}K`
  return String(v)
}

function readStored() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const tracks = Array.isArray(raw.tracks) ? raw.tracks.filter((t) => t && /^[A-Za-z0-9_-]{11}$/.test(t.videoId)) : []
    const activeId = typeof raw.activeId === 'string' ? raw.activeId : null
    return { tracks, activeId }
  } catch {
    return { tracks: [], activeId: null }
  }
}

function writeStored(tracks, activeId) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tracks, activeId }))
  } catch {
  }
}

function readVolume() {
  try {
    const raw = JSON.parse(localStorage.getItem(VOLUME_KEY) || '{}')
    const level = Number(raw.volume)
    return {
      volume: isFinite(level) && raw.volume !== null && raw.volume !== undefined ? Math.min(100, Math.max(0, Math.round(level))) : null,
      muted: !!raw.muted,
    }
  } catch {
    return { volume: null, muted: false }
  }
}

function writeVolume(volume, muted) {
  try {
    localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume, muted }))
  } catch {
  }
}

export default function MusicWidget() {
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [apiFailed, setApiFailed] = useState(false)

  const [tracks, setTracks] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [copied, setCopied] = useState(false)
  const [scrub, setScrub] = useState(null)
  const copiedTimerRef = useRef(null)

  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const [muted, setMuted] = useState(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const [tab, setTab] = useState('top')
  const [topList, setTopList] = useState(null)
  const [topState, setTopState] = useState('idle')
  const topFetchedRef = useRef(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off')
  const [lyrics, setLyrics] = useState(null)
  const [lyricsState, setLyricsState] = useState('idle')
  const [lyricsOffset, setLyricsOffset] = useState(0)
  const shuffleRef = useRef(shuffle)
  shuffleRef.current = shuffle
  const repeatRef = useRef(repeat)
  repeatRef.current = repeat
  const lyricsCacheRef = useRef(new Map())
  const lyricsScrollRef = useRef(null)
  const activeLineRef = useRef(null)

  const playerRef = useRef(null)
  const playerElRef = useRef(null)
  const cuedRef = useRef(null)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks
  const durationRef = useRef(0)
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  const lastLevelRef = useRef(DEFAULT_VOLUME)
  const draggingVolRef = useRef(false)

  const rootRef = useRef(null)
  const panelRef = useRef(null)
  const launcherRef = useRef(null)
  const playBtnRef = useRef(null)
  const restoreFocusRef = useRef(false)

  const active = tracks.find((t) => t.videoId === activeId) || tracks[0] || null

  const persist = useCallback((next, id) => {
    writeStored(next, id ?? activeIdRef.current)
  }, [])

  const applyVolume = useCallback((level, isMuted) => {
    const p = playerRef.current
    if (!p?.setVolume) return
    try {

      if (isMuted || level <= 0) p.mute?.()
      else p.unMute?.()

      p.setVolume(level)
    } catch {
    }
  }, [])

  const unmountedRef = useRef(false)
  const playerInitRef = useRef(false)

  const pendingPlayRef = useRef(null)

  const withPlayer = useCallback((fn, tries = 60) => {
    if (unmountedRef.current) return
    const p = playerRef.current
    if (p?.loadVideoById) {
      fn(p)
      return
    }
    if (tries <= 0) return
    setTimeout(() => withPlayer(fn, tries - 1), 50)
  }, [])

  const ensurePlayer = useCallback(() => {
    if (playerInitRef.current) return
    playerInitRef.current = true
    loadYouTubeApi()
      .then((YT) => {
        if (unmountedRef.current || !playerElRef.current || playerRef.current) return
        playerRef.current = new YT.Player(playerElRef.current, {
          width: '200',
          height: '80',
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1, rel: 0, iv_load_policy: 3 },
          events: {
            onReady: () => {
              if (unmountedRef.current) return
              setReady(true)
              withPlayer((p) => {

                applyVolume(volumeRef.current, mutedRef.current)

                const wanted = pendingPlayRef.current
                pendingPlayRef.current = null
                if (wanted) {
                  cuedRef.current = wanted
                  p.loadVideoById(wanted)
                  setPlaying(true)
                  return
                }
                const id = activeIdRef.current
                if (id) {
                  cuedRef.current = id
                  p.cueVideoById(id)
                }
              })
            },
            onStateChange: (e) => {
              if (unmountedRef.current) return

              if (e.data === 1) {
                setPlaying(true)
                durationRef.current = playerRef.current.getDuration() || 0
                setDuration(durationRef.current)

                applyVolume(volumeRef.current, mutedRef.current)
              } else if (e.data === 2) {
                setPlaying(false)
              } else if (e.data === 0) {
                onEndedRef.current()
              }
            },
            onError: () => {
              if (unmountedRef.current) return

              const list = tracksRef.current
              if (list.length > 1) stepRef.current(1)
            },
          },
        })
      })
      .catch(() => {
        if (!unmountedRef.current) setApiFailed(true)
      })
  }, [applyVolume, withPlayer])

  useEffect(() => {
    if (open) ensurePlayer()
  }, [open, ensurePlayer])

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      try {
        playerRef.current?.destroy?.()
      } catch {
      }
      playerRef.current = null

      playerInitRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const p = playerRef.current
      if (!p?.getCurrentTime) return
      setPosition(p.getCurrentTime() || 0)
      const d = p.getDuration() || 0
      if (d && d !== durationRef.current) {
        durationRef.current = d
        setDuration(d)
      }
    }, 500)
    return () => clearInterval(id)
  }, [playing])

  const play = useCallback(
    (videoId) => {
      const p = playerRef.current
      setActiveId(videoId)
      setPosition(0)
      setDuration(0)
      durationRef.current = 0
      persist(tracksRef.current, videoId)
      if (!p) {

        pendingPlayRef.current = videoId
        ensurePlayer()
        return
      }

      withPlayer((ready) => {
        cuedRef.current = videoId
        ready.loadVideoById(videoId)
        setPlaying(true)
      })
    },
    [persist, ensurePlayer, withPlayer],
  )

  const onRowClick = useCallback(
    (videoId) => {
      const p = playerRef.current
      if (videoId === activeIdRef.current && p?.playVideo) {
        if (playing) p.pauseVideo()
        else p.playVideo()
      } else {
        play(videoId)
      }
    },
    [play, playing],
  )

  const step = useCallback(
    (dir) => {
      const list = tracksRef.current
      if (!list.length) return
      const i = list.findIndex((t) => t.videoId === activeIdRef.current)
      let j

      if (dir === 1 && shuffleRef.current && list.length > 1) {
        do {
          j = Math.floor(Math.random() * list.length)
        } while (j === i)
      } else {
        j = ((i < 0 ? 0 : i) + dir + list.length) % list.length
      }
      play(list[j].videoId)
    },
    [play],
  )

  const onEnded = useCallback(() => {
    const p = playerRef.current
    if (repeatRef.current === 'one' && p) {
      p.seekTo(0, true)
      p.playVideo()
      return
    }
    const list = tracksRef.current
    const i = list.findIndex((t) => t.videoId === activeIdRef.current)
    if (repeatRef.current === 'off' && !shuffleRef.current && i === list.length - 1) {
      setPlaying(false)
      p?.pauseVideo?.()
      return
    }
    step(1)
  }, [step])

  const stepRef = useRef(step)
  stepRef.current = step
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  const toggleRef = useRef(() => {})
  toggleRef.current = () => {
    if (active) onRowClick(active.videoId)
  }

  const seek = useCallback((e) => {
    const p = playerRef.current
    if (!p?.seekTo || !durationRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const target = frac * durationRef.current
    p.seekTo(target, true)
    setPosition(target)
  }, [])

  const nudgeSeek = useCallback((delta) => {
    const p = playerRef.current
    if (!p?.seekTo || !durationRef.current) return
    const target = Math.min(durationRef.current, Math.max(0, (p.getCurrentTime() || 0) + delta))
    p.seekTo(target, true)
    setPosition(target)
  }, [])

  const onSeekKey = useCallback(
    (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault(); nudgeSeek(5); break
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault(); nudgeSeek(-5); break
        case 'Home':
          e.preventDefault(); nudgeSeek(-Infinity); break
        case 'End':
          e.preventDefault(); nudgeSeek(Infinity); break
        default:
          break
      }
    },
    [nudgeSeek],
  )

  const commitVolume = useCallback(
    (level, isMuted) => {
      const v = Math.min(100, Math.max(0, Math.round(level)))
      if (v > 0) lastLevelRef.current = v
      setVolume(v)
      setMuted(isMuted)
      applyVolume(v, isMuted)
      writeVolume(v, isMuted)
    },
    [applyVolume],
  )

  const changeVolume = useCallback(
    (level) => {
      commitVolume(level, level <= 0 ? mutedRef.current : false)
    },
    [commitVolume],
  )

  const nudgeVolume = useCallback((delta) => changeVolume(volumeRef.current + delta), [changeVolume])

  const toggleMute = useCallback(() => {
    if (!mutedRef.current && volumeRef.current > 0) {
      commitVolume(volumeRef.current, true)
      return
    }

    commitVolume(volumeRef.current || lastLevelRef.current || DEFAULT_VOLUME, false)
  }, [commitVolume])
  const toggleMuteRef = useRef(toggleMute)
  toggleMuteRef.current = toggleMute

  const volumeFromEvent = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * 100
  }

  const onVolumePointerDown = useCallback(
    (e) => {
      e.currentTarget.setPointerCapture?.(e.pointerId)
      draggingVolRef.current = true
      changeVolume(volumeFromEvent(e))
    },
    [changeVolume],
  )

  const onVolumePointerMove = useCallback(
    (e) => {
      if (!draggingVolRef.current) return
      changeVolume(volumeFromEvent(e))
    },
    [changeVolume],
  )

  const endVolumeDrag = useCallback((e) => {
    draggingVolRef.current = false
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
    }
  }, [])

  const onVolumeKey = useCallback(
    (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault(); nudgeVolume(5); break
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault(); nudgeVolume(-5); break
        case 'PageUp':
          e.preventDefault(); nudgeVolume(10); break
        case 'PageDown':
          e.preventDefault(); nudgeVolume(-10); break
        case 'Home':
          e.preventDefault(); changeVolume(0); break
        case 'End':
          e.preventDefault(); changeVolume(100); break
        default:
          break
      }
    },
    [nudgeVolume, changeVolume],
  )

  const close = useCallback((restoreFocus) => {
    restoreFocusRef.current = !!restoreFocus
    setOpen(false)
    setQuery('')
    setResults([])
  }, [])

  const shareTrack = useCallback(() => {
    const id = activeIdRef.current
    if (!id) return
    const url = `${window.location.origin}/?play=${id}`
    const flash = () => {
      setCopied(true)
      clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1600)
    }
    const fallback = () => {
      try {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
              }
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(flash, () => { fallback(); flash() })
    } else {
      fallback()
      flash()
    }
  }, [])

  useEffect(() => {
    const stored = readStored()
    if (!stored.tracks.length) return
    setTracks(stored.tracks)
    setActiveId((cur) => cur || stored.activeId || stored.tracks[0]?.videoId || null)
  }, [])

  useEffect(() => {
    const stored = readVolume()
    if (stored.volume === null && !stored.muted) return
    const level = stored.volume === null ? DEFAULT_VOLUME : stored.volume
    if (level > 0) lastLevelRef.current = level
    setVolume(level)
    setMuted(stored.muted)
    applyVolume(level, stored.muted)
  }, [applyVolume])

  useEffect(() => {

    if (!open) return
    if (tracksRef.current.length) return
    let cancelled = false
    const seed = async () => {

      if (tracksRef.current.length) return
      let items = []
      try {
        items = await fetchTopChart({ limit: 10 })
      } catch {
      }
      if (!items.length) {
        try {
          items = await searchTracks(DEFAULT_QUERY, { limit: 8 })
        } catch {
        }
      }
      if (cancelled || !items.length) return

      const shuffled = items.slice()
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      setTracks(shuffled)
      setActiveId((cur) => cur || shuffled[0].videoId)
      persist(shuffled, shuffled[0].videoId)
    }

    const handle = setTimeout(seed, 60)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [open, persist])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = parseYouTubeId(params.get('play') || '')
    if (!id) return
    params.delete('play')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
    let cancelled = false
    ;(async () => {
      const meta = await fetchYouTubeMeta(id).catch(() => ({}))
      if (cancelled) return
      const track = { videoId: id, title: meta.title || 'YouTube video', subtitle: meta.subtitle || 'YouTube', art: meta.art || youTubeThumb(id) }
      setTracks((prev) => {
        const next = prev.some((t) => t.videoId === id) ? prev : [...prev, track]
        persist(next, id)
        return next
      })
      setActiveId(id)
      setOpen(true)
    })()
    return () => { cancelled = true }
  }, [persist])

  useEffect(() => {
    const p = playerRef.current
    if (!ready || !p?.cueVideoById || !activeId || playing) return
    if (cuedRef.current !== activeId) {
      cuedRef.current = activeId
      p.cueVideoById(activeId)
    }
  }, [ready, activeId, playing])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        close(true)
        return
      }

      if ((e.key === ' ' || e.code === 'Space') && e.target?.tagName !== 'INPUT') {
        e.preventDefault()
        toggleRef.current()
        return
      }

      if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey && e.target?.tagName !== 'INPUT') {
        e.preventDefault()
        toggleMuteRef.current()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  useEffect(() => {
    const panel = panelRef.current
    if (panel) panel.inert = !open
    if (open) {
      const target = playBtnRef.current && !playBtnRef.current.disabled ? playBtnRef.current : panel
      target?.focus({ preventScroll: true })
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false
      launcherRef.current?.focus({ preventScroll: true })
    }
  }, [open])

  const addResult = useCallback(
    (item) => {
      setQuery('')
      setResults([])
      setHighlight(0)
      setTracks((prev) => {
        const next = prev.some((t) => t.videoId === item.videoId) ? prev : [...prev, item]
        persist(next, item.videoId)
        return next
      })
      play(item.videoId)
    },
    [play, persist],
  )

  const addLink = useCallback(
    async (videoId) => {
      setQuery('')
      setResults([])
      if (tracksRef.current.some((t) => t.videoId === videoId)) {
        play(videoId)
        return
      }
      const stub = { videoId, title: 'Loading…', subtitle: 'YouTube', art: youTubeThumb(videoId) }
      setTracks((prev) => {
        const next = [...prev, stub]
        persist(next, videoId)
        return next
      })
      play(videoId)
      const meta = await fetchYouTubeMeta(videoId)
      setTracks((prev) => {
        const next = prev.map((t) =>
          t.videoId === videoId ? { ...t, title: meta.title || 'YouTube video', subtitle: meta.subtitle || 'YouTube', art: meta.art } : t,
        )
        persist(next, activeIdRef.current)
        return next
      })
    },
    [play, persist],
  )

  const removeTrack = useCallback(
    (videoId) => {
      setTracks((prev) => {
        const next = prev.filter((t) => t.videoId !== videoId)
        persist(next, activeIdRef.current)
        return next
      })
    },
    [persist],
  )

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
    setSearchError(false)
    setHighlight(0)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q || parseYouTubeId(q) || q.length < 2) {
      setResults([])
      setSearching(false)
      setSearchError(false)
      return
    }
    setSearching(true)
    setSearchError(false)
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        setResults(await searchTracks(q, { limit: 12, signal: ctrl.signal }))
        setHighlight(0)
      } catch {
        if (!ctrl.signal.aborted) {
          setSearchError(true)
          setResults([])
        }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query])

  useEffect(() => {
    if (!open || tab !== 'top' || topFetchedRef.current) return
    topFetchedRef.current = true
    setTopState('loading')
    ;(async () => {
      try {
        const items = await fetchTopChart({ limit: 10 })
        setTopList(items)
        setTopState(items.length ? 'done' : 'none')
      } catch {
        setTopState('none')
      }
    })()
  }, [open, tab])

  const activeVideoId = active?.videoId || null

  useEffect(() => {
    setLyricsOffset(0)
  }, [activeVideoId])

  useEffect(() => {
    if (!activeVideoId || (tab !== 'lyrics' && !playing)) return
    const cache = lyricsCacheRef.current
    if (cache.has(activeVideoId)) {
      const cached = cache.get(activeVideoId)
      setLyrics(cached)
      setLyricsState(cached.synced || cached.plain ? 'done' : 'none')
      return
    }
    const ctrl = new AbortController()
    setLyricsState('loading')
    setLyrics(null)
    fetchLyrics({ title: active.title, artist: active.subtitle, signal: ctrl.signal })
      .then((r) => {
        cache.set(activeVideoId, r)
        setLyrics(r)
        setLyricsState(r.synced || r.plain ? 'done' : 'none')
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLyricsState('none')
      })
    return () => ctrl.abort()
  }, [tab, activeVideoId, playing])

  const activeLine = useMemo(() => {
    if (!lyrics?.synced) return -1
    const p = position + lyricsOffset
    let idx = -1
    for (let i = 0; i < lyrics.synced.length; i++) {
      if (lyrics.synced[i].t <= p) idx = i
      else break
    }
    return idx
  }, [lyrics, position, lyricsOffset])

  useEffect(() => {
    if (tab !== 'lyrics' || activeLine < 0) return
    const c = lyricsScrollRef.current
    const el = activeLineRef.current
    if (!c || !el) return
    const cr = c.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    c.scrollTo({ top: c.scrollTop + (er.top - cr.top) - c.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' })
  }, [activeLine, tab])

  const seekToTime = useCallback((t) => {
    const p = playerRef.current
    if (!p?.seekTo) return
    const target = Math.max(0, t - lyricsOffset)
    p.seekTo(target, true)
    setPosition(target)
    if (!playing) p.playVideo?.()
  }, [lyricsOffset, playing])

  const progress = duration ? Math.min(1, position / duration) : 0
  const disabled = !ready && !apiFailed

  const silent = muted || volume === 0
  const volumeShown = silent ? 0 : volume

  const tickerLive = playing && lyrics?.synced && activeLine >= 0
  const tickerPrev = tickerLive ? lyrics.synced[activeLine - 1]?.text || '' : ''
  const tickerCur = tickerLive ? lyrics.synced[activeLine]?.text || '♪' : ''
  const tickerNext = tickerLive ? lyrics.synced[activeLine + 1]?.text || '' : ''
  const parsedLink = parseYouTubeId(query.trim())
  const isLinkInput = !!parsedLink
  const showResults = query.trim().length > 0 && !isLinkInput

  const onSubmit = (e) => {
    e.preventDefault()
    if (parsedLink) {
      addLink(parsedLink)
      return
    }
    const pick = results[highlight] || results[0]
    if (pick) addResult(pick)
  }

  const onSearchKey = (e) => {
    if (e.key === 'Escape') {
      if (query) {
        e.preventDefault()
        e.stopPropagation()
        clearSearch()
      }
      return
    }
    if (!showResults || !results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + results.length) % results.length)
    }
  }

  return (
    <div ref={rootRef} className="music-widget fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 print:hidden">
      {}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(true)}

        onPointerEnter={ensurePlayer}
        onFocus={ensurePlayer}
        aria-label={playing && active ? `Now playing ${active.title} by ${active.subtitle}. Open music player` : 'Open music player'}
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        className={`music-launch group absolute bottom-0 left-0 w-14 h-14 rounded-full shadow-lg shadow-[color:var(--shadow-cast)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer ${
          open ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100 hover:scale-[1.07]'
        }`}
      >
        {}
        {playing && (
          <span aria-hidden="true" className="music-art-glow absolute -inset-1 rounded-full bg-gradient-to-br from-brand-indigo to-brand-purple blur-md" />
        )}
        {}
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(var(--color-brand-purple) ${progress * 360}deg, var(--color-line) 0deg)` }}
        />
        {}
        <span
          className="music-spin absolute inset-[2.5px] rounded-full overflow-hidden bg-surface-raised"
          style={{ animationPlayState: playing ? 'running' : 'paused' }}
        >
          <Artwork src={active?.art} alt="" rounded="rounded-full" className="w-full h-full" />
          <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
        </span>
        {}
        <span aria-hidden="true" className="absolute inset-[2.5px] rounded-full ring-1 ring-inset ring-[color:var(--hairline)] pointer-events-none" />
        <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-ink-strong flex items-center justify-center ring-[3px] ring-[color:var(--color-bg)] transition-transform duration-200 group-hover:scale-110">
          {playing ? (
            <EqualizerBars playing className="h-3" barClassName="bg-ink-inverse" />
          ) : (
            <PlayIcon className="w-3 h-3 text-ink-inverse translate-x-[0.5px]" />
          )}
        </span>
        {}
        <span
          aria-hidden="true"
          style={{ textShadow: '0 1px 6px var(--color-bg), 0 1px 2px var(--color-bg)' }}
          className={`absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 flex max-w-[240px] flex-col text-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            playing ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0'
          }`}
        >
          {tickerLive ? (
            <span key={activeLine} className="lyric-roll flex flex-col">
              <span className="block text-[10px] leading-tight text-ink-faint truncate">{tickerPrev || ' '}</span>
              <span className="block text-[13px] leading-snug font-semibold text-ink-strong truncate my-0.5">{tickerCur}</span>
              <span className="block text-[10px] leading-tight text-ink-subtle truncate">{tickerNext || ' '}</span>
            </span>
          ) : (
            <>
              <span className="block text-[12.5px] font-bold text-ink-strong tracking-tight truncate">{active?.title || 'Music'}</span>
              <span className="block text-[10px] font-mono text-ink-subtle truncate mt-0.5">
                {playing ? active?.subtitle || 'YouTube' : `Paused · ${active?.subtitle || 'search a song'}`}
              </span>
            </>
          )}
        </span>
      </button>

      {}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label="Music player"
        aria-hidden={!open}
        tabIndex={-1}

        className={`absolute bottom-0 left-0 w-[320px] max-w-[calc(100vw-2rem)] origin-bottom-left focus:outline-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-90 translate-y-3 pointer-events-none [content-visibility:hidden]'
        }`}
      >
        <div className="flex flex-col rounded-[22px] border border-line bg-surface/95 backdrop-blur-xl shadow-2xl shadow-[color:var(--shadow-cast)] overflow-hidden">
          {}
          <div className="flex items-center gap-2 px-4 pt-3.5 pb-1">
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              {apiFailed ? 'Unavailable' : playing ? 'Now playing' : 'Music'}
            </span>
            {playing && <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />}
            {active && (
              <button
                type="button"
                onClick={shareTrack}
                aria-label={copied ? 'Link copied' : 'Copy share link'}
                title={copied ? 'Link copied!' : 'Copy share link'}
                className={`ml-auto w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-200 cursor-pointer ${copied ? 'text-emerald-500' : 'text-ink-subtle hover:text-ink-strong hover:bg-surface-hover'}`}
              >
                {copied ? <CheckIcon className="w-4 h-4" /> : <ShareIcon className="w-[15px] h-[15px]" />}
              </button>
            )}
            {active && (
              <a
                href={`https://www.youtube.com/watch?v=${active.videoId}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Open on YouTube"
                title="Open on YouTube"
                className="w-7 h-7 rounded-full text-ink-subtle hover:text-ink-strong hover:bg-surface-hover flex items-center justify-center transition-colors duration-200"
              >
                <YouTubeGlyph className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => close(true)}
              aria-label="Minimise music player"
              title="Minimise"
              className={`${active ? '' : 'ml-auto'} w-7 h-7 -mr-1 rounded-full text-ink-subtle hover:text-ink-strong hover:bg-surface-hover flex items-center justify-center transition-colors duration-200 cursor-pointer`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
              </svg>
            </button>
          </div>

          {}
          <div className="px-4 pt-1 pb-3.5">
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0 w-14 h-14">
                {playing && (
                  <span aria-hidden="true" className="music-art-glow absolute -inset-1 z-0 rounded-[14px] bg-gradient-to-br from-brand-indigo to-brand-purple blur-md" />
                )}
                <div key={active?.videoId || 'none'} className="music-art-in relative z-[1] w-14 h-14 rounded-[11px] overflow-hidden shadow-md shadow-[color:var(--shadow-cast)]">
                  <Artwork src={active?.art} alt="" className="w-full h-full" />
                </div>
              </div>
              <div key={active?.videoId || 'meta'} className="music-hero-in min-w-0 flex-1">
                <p className="text-[15px] font-bold text-ink-strong tracking-tight truncate">{active?.title || 'Search a song'}</p>
                <p className="text-[11px] font-mono text-ink-subtle truncate mt-0.5">{active?.subtitle || 'type below to start'}</p>
              </div>
            </div>

            {}
            <div className="mt-3.5">
              <div
                role="slider"
                aria-label="Seek"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${fmt(position)} of ${duration ? fmt(duration) : 'unknown'}`}
                tabIndex={0}
                onClick={seek}
                onKeyDown={onSeekKey}
                onMouseMove={(e) => {
                  if (!durationRef.current) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
                  setScrub({ frac, t: frac * durationRef.current })
                }}
                onMouseLeave={() => setScrub(null)}
                className="group/bar relative h-3 flex items-center cursor-pointer"
              >
                <div className="h-[3px] w-full rounded-full bg-line overflow-hidden">
                  <div className="h-full rounded-full bg-ink-strong transition-[width] duration-500 ease-linear" style={{ width: `${progress * 100}%` }} />
                </div>
                <span
                  className="absolute top-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 scale-50 rounded-full bg-ink-strong shadow opacity-0 group-hover/bar:opacity-100 group-hover/bar:scale-100 transition-[left,opacity,transform] duration-500 ease-linear"
                  style={{ left: `${progress * 100}%` }}
                />
                {}
                {scrub && duration > 0 && (
                  <>
                    <span
                      className="pointer-events-none absolute top-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-strong shadow ring-2 ring-[color:var(--color-surface)]"
                      style={{ left: `${scrub.frac * 100}%` }}
                    />
                    <span
                      className="pointer-events-none absolute -top-7 z-10 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-ink-strong text-ink-inverse text-[9px] font-mono tabular-nums shadow-md whitespace-nowrap"
                      style={{ left: `${scrub.frac * 100}%` }}
                    >
                      {fmt(scrub.t)}
                    </span>
                  </>
                )}
              </div>
              <div className="flex justify-between text-[9px] font-mono text-ink-faint mt-1 tabular-nums">
                <span>{fmt(position)}</span>
                <span>{duration ? fmt(duration) : '—:—'}</span>
              </div>
            </div>

            {}
            <div className="mt-1.5 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setShuffle((s) => !s)}
                disabled={disabled}
                aria-label="Shuffle"
                aria-pressed={shuffle}
                title={shuffle ? 'Shuffle: on' : 'Shuffle: off'}
                className={`p-1 transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-default ${shuffle ? 'text-ink-strong' : 'text-ink-faint hover:text-ink-muted'}`}
              >
                <ShuffleIcon className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-6">
                <button type="button" onClick={() => step(-1)} disabled={disabled || !tracks.length} aria-label="Previous" className="text-ink-muted hover:text-ink-strong disabled:opacity-40 transition-colors duration-200 cursor-pointer disabled:cursor-default">
                  <SkipIcon className="w-5 h-5" dir="prev" />
                </button>
                <button
                  ref={playBtnRef}
                  type="button"
                  onClick={() => active && onRowClick(active.videoId)}
                  disabled={disabled || !active}
                  aria-label={playing ? 'Pause' : 'Play'}
                  className="w-12 h-12 rounded-full bg-ink-strong text-ink-inverse flex items-center justify-center shadow-md shadow-[color:var(--shadow-cast)] hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-transform duration-150 cursor-pointer disabled:cursor-default"
                >
                  <span key={playing ? 'pause' : 'play'} className="music-icon-pop flex">
                    {playing ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 translate-x-[1px]" />}
                  </span>
                </button>
                <button type="button" onClick={() => step(1)} disabled={disabled || !tracks.length} aria-label="Next" className="text-ink-muted hover:text-ink-strong disabled:opacity-40 transition-colors duration-200 cursor-pointer disabled:cursor-default">
                  <SkipIcon className="w-5 h-5" dir="next" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))}
                disabled={disabled}
                aria-label={`Repeat: ${repeat}`}
                title={`Repeat: ${repeat}`}
                className={`p-1 transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-default ${repeat === 'off' ? 'text-ink-faint hover:text-ink-muted' : 'text-ink-strong'}`}
              >
                {repeat === 'one' ? <RepeatOneIcon className="w-4 h-4" /> : <RepeatIcon className="w-4 h-4" />}
              </button>
            </div>

            {}
            <div className="mt-3 flex items-center gap-2.5 px-1">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={silent ? 'Unmute' : 'Mute'}
                aria-pressed={silent}
                title={silent ? 'Unmute (M)' : 'Mute (M)'}
                className={`shrink-0 -ml-1 p-1 transition-colors duration-200 cursor-pointer ${silent ? 'text-ink-strong' : 'text-ink-faint hover:text-ink-muted'}`}
              >
                <VolumeIcon className="w-4 h-4" level={silent ? 0 : volume < 50 ? 1 : 2} />
              </button>
              <div
                role="slider"
                aria-label="Volume"
                aria-valuenow={volumeShown}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={silent ? 'Muted' : `${volume}%`}
                tabIndex={0}
                onPointerDown={onVolumePointerDown}
                onPointerMove={onVolumePointerMove}
                onPointerUp={endVolumeDrag}
                onPointerCancel={endVolumeDrag}
                onKeyDown={onVolumeKey}
                className="group/vol relative h-3 flex-1 flex items-center cursor-pointer touch-none focus:outline-none"
              >
                <div className="h-[3px] w-full rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full rounded-full bg-ink-muted group-hover/vol:bg-ink-strong group-focus/vol:bg-ink-strong transition-colors duration-200"
                    style={{ width: `${volumeShown}%` }}
                  />
                </div>
                <span
                  className="absolute top-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 scale-50 rounded-full bg-ink-strong shadow opacity-0 group-hover/vol:opacity-100 group-hover/vol:scale-100 group-focus/vol:opacity-100 group-focus/vol:scale-100 transition-[opacity,transform] duration-200"
                  style={{ left: `${volumeShown}%` }}
                />
              </div>
              <span className="w-5 shrink-0 text-right text-[9px] font-mono text-ink-faint tabular-nums">{silent ? '—' : volume}</span>
            </div>
          </div>

          {}
          <div className="border-t border-dashed border-line">
            <div className="flex items-center gap-1 px-3 pt-2.5 pb-1">
              {showResults ? (
                <span className="px-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Results</span>
              ) : (
                <>
                  <TabButton active={tab === 'top'} onClick={() => setTab('top')}>Top 10</TabButton>
                  <TabButton active={tab === 'queue'} onClick={() => setTab('queue')}>Up Next</TabButton>
                  <TabButton active={tab === 'lyrics'} onClick={() => setTab('lyrics')}>Lyrics</TabButton>
                </>
              )}
              {!showResults && tab === 'top' && (
                <span className="ml-auto pr-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-ink-faint">this week</span>
              )}
              {showResults && searching && <Spinner className="w-3 h-3 text-ink-subtle ml-1" />}
              {!showResults && tab === 'lyrics' && lyrics?.synced && (
                <div className="ml-auto flex items-center gap-0.5 text-ink-faint">
                  <button type="button" onClick={() => setLyricsOffset((o) => Math.round((o - 0.5) * 10) / 10)} aria-label="Nudge lyrics earlier" title="Lyrics earlier" className="w-5 h-5 rounded hover:text-ink-strong hover:bg-surface-hover flex items-center justify-center cursor-pointer">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path strokeLinecap="round" d="M5 12h14" /></svg>
                  </button>
                  <span className="text-[8px] font-mono w-9 text-center tabular-nums">{lyricsOffset > 0 ? '+' : ''}{lyricsOffset.toFixed(1)}s</span>
                  <button type="button" onClick={() => setLyricsOffset((o) => Math.round((o + 0.5) * 10) / 10)} aria-label="Nudge lyrics later" title="Lyrics later" className="w-5 h-5 rounded hover:text-ink-strong hover:bg-surface-hover flex items-center justify-center cursor-pointer">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>
              )}
            </div>
            <ul ref={lyricsScrollRef} className="music-scroll flex flex-col gap-0.5 px-2 pb-1 max-h-[30vh] overflow-y-auto overscroll-contain">
              {showResults ? (
                searching && results.length === 0 ? (
                  [0, 1, 2].map((i) => <SkeletonRow key={`sk-${i}`} i={i} />)
                ) : searchError ? (
                  <li className="px-3 py-6 text-center text-[11px] text-ink-subtle leading-relaxed">Search unavailable right now. Try again, or paste a YouTube link.</li>
                ) : results.length === 0 ? (
                  <li className="px-3 py-6 text-center text-[11px] text-ink-subtle">No results for “{query.trim()}”.</li>
                ) : (
                  results.map((item, i) => (
                    <ResultRow key={item.videoId} item={item} index={i} active={i === highlight} onPick={() => addResult(item)} onHover={() => setHighlight(i)} />
                  ))
                )
              ) : tab === 'top' ? (
                topState === 'loading' ? (
                  [0, 1, 2, 3].map((i) => <SkeletonRow key={`tk-${i}`} i={i} />)
                ) : !topList || !topList.length ? (
                  <li className="px-3 py-6 text-center text-[11px] text-ink-subtle leading-relaxed">Chart unavailable right now. Try again shortly.</li>
                ) : (
                  topList.map((item, i) => {
                    const isActive = item.videoId === activeId
                    const medal = MEDALS[i]
                    const views = fmtViews(item.views)
                    return (
                      <li key={item.videoId}>
                        <button
                          type="button"
                          onClick={() => addResult(item)}
                          disabled={disabled}
                          aria-pressed={isActive}
                          className={`group/row w-full flex items-center gap-2.5 p-1.5 rounded-[12px] text-left transition-colors duration-200 cursor-pointer disabled:cursor-default ${isActive ? 'bg-surface-hover' : 'hover:bg-surface-hover/60'}`}
                        >
                          <span
                            className={`w-5 shrink-0 text-center text-[13px] font-black italic tabular-nums leading-none ${medal ? '' : 'text-ink-faint'}`}
                            style={medal ? { color: medal.color, textShadow: `0 0 10px ${medal.glow}` } : undefined}
                          >
                            {i + 1}
                          </span>
                          <span className="relative shrink-0 w-9 h-9 rounded-[7px] overflow-hidden bg-surface-raised">
                            <Artwork src={item.art} alt="" className="w-full h-full" />
                            <span className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'}`}>
                              {isActive && playing ? <EqualizerBars playing className="h-3" barClassName="bg-ink-inverse" /> : <PlayIcon className="w-3.5 h-3.5 text-white translate-x-[1px]" />}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[12.5px] font-semibold tracking-tight truncate ${isActive ? 'text-ink-strong' : 'text-ink-secondary'}`}>{item.title}</span>
                            <span className="flex items-center gap-1.5 text-[10px] text-ink-subtle min-w-0">
                              <span className="font-mono truncate">{item.subtitle}</span>
                              {views && (
                                <>
                                  <span className="text-ink-faint/60">·</span>
                                  <span className="flex items-center gap-0.5 shrink-0 tabular-nums">
                                    <PlayIcon className="w-2 h-2 translate-x-0" />
                                    {views}
                                  </span>
                                </>
                              )}
                              {item.views >= VIRAL_VIEWS && <FlameIcon className="w-2.5 h-2.5 shrink-0 flame-flicker" />}
                            </span>
                          </span>
                          <span className="shrink-0 w-8 flex items-center justify-end pr-0.5">
                            <MoveIndicator move={item.move} />
                          </span>
                        </button>
                      </li>
                    )
                  })
                )
              ) : tab === 'lyrics' ? (
                <li>
                  <LyricsPane state={lyricsState} lyrics={lyrics} activeLine={activeLine} activeLineRef={activeLineRef} onSeek={seekToTime} />
                </li>
              ) : tracks.length === 0 ? (
                <li className="px-3 py-6 text-center text-[11px] text-ink-subtle leading-relaxed">Nothing queued yet. Search a song below to start.</li>
              ) : (
                tracks.map((track) => {
                  const isActive = track.videoId === activeId
                  return (
                    <li key={track.videoId} className="group/row relative">
                      <button
                        type="button"
                        onClick={() => onRowClick(track.videoId)}
                        disabled={disabled}
                        aria-pressed={isActive}
                        className={`w-full flex items-center gap-3 p-1.5 rounded-[12px] text-left transition-colors duration-200 cursor-pointer disabled:cursor-default ${isActive ? 'bg-surface-hover' : 'hover:bg-surface-hover/60'}`}
                      >
                        <span className="relative shrink-0 w-9 h-9 rounded-[7px] overflow-hidden bg-surface-raised">
                          <Artwork src={track.art} alt="" className="w-full h-full" />
                          <span className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'}`}>
                            {isActive && playing ? <EqualizerBars playing className="h-3" barClassName="bg-ink-inverse" /> : <PlayIcon className="w-3.5 h-3.5 text-white translate-x-[1px]" />}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 pr-6">
                          <span className={`block text-[12.5px] font-semibold tracking-tight truncate ${isActive ? 'text-ink-strong' : 'text-ink-secondary'}`}>{track.title}</span>
                          <span className="block text-[10px] font-mono text-ink-subtle truncate">{track.subtitle}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTrack(track.videoId)}
                        aria-label={`Remove ${track.title}`}
                        title="Remove"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-ink-subtle bg-surface-hover opacity-0 group-hover/row:opacity-100 hover:text-ink-strong flex items-center justify-center transition-opacity duration-200 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>

            {}
            <form onSubmit={onSubmit} className="px-3 pt-1 pb-3">
              <div className="flex items-center gap-1 rounded-full border border-line focus-within:border-line-strong bg-surface-raised/60 pl-3 pr-1 py-1 transition-colors duration-200">
                <span className="shrink-0 text-ink-subtle">{isLinkInput ? <LinkIcon className="w-3.5 h-3.5" /> : <SearchIcon className="w-3.5 h-3.5" />}</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder="search songs or paste a link…"
                  aria-label="Search for a song or paste a YouTube link"
                  autoComplete="off"
                  spellCheck="false"
                  className="min-w-0 flex-1 bg-transparent text-[11.5px] font-mono text-ink-secondary placeholder:text-ink-faint outline-none"
                />
                {query && (
                  <button type="button" onClick={clearSearch} aria-label="Clear search" title="Clear" className="shrink-0 w-6 h-6 rounded-full text-ink-subtle hover:text-ink-strong hover:bg-surface-hover flex items-center justify-center transition-colors duration-150 cursor-pointer">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={showResults && !results.length}
                  aria-label={isLinkInput ? 'Add link' : 'Add top result'}
                  title={isLinkInput ? 'Add link' : 'Add top result'}
                  className="shrink-0 w-6.5 h-6.5 rounded-full bg-ink-strong text-ink-inverse flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-transform duration-150 cursor-pointer disabled:cursor-default"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            </form>
          </div>

          {apiFailed && (
            <p className="border-t border-dashed border-line px-4 py-3 text-[11px] text-ink-subtle leading-relaxed">
              Couldn't reach YouTube — it may be blocked by the network or an ad blocker.
            </p>
          )}
        </div>
      </div>

      {}
      <div className="absolute bottom-0 left-0 w-[200px] h-[80px] -z-10 opacity-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div ref={playerElRef} />
      </div>
    </div>
  )
}

function Artwork({ src, alt = '', className = '', rounded = '' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (!src || failed) {
    return (
      <span className={`${className} ${rounded} flex items-center justify-center bg-gradient-to-br from-brand-indigo/25 via-surface-raised to-brand-purple/20`}>
        <svg className="w-2/5 h-2/5 text-ink-muted/70" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
        </svg>
      </span>
    )
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`${className} ${rounded} object-cover`} />
}

const EQ_BARS = [
  { dur: '0.9s', delay: '-0.9s' },
  { dur: '1.15s', delay: '-0.35s' },
  { dur: '0.75s', delay: '-0.55s' },
  { dur: '1.0s', delay: '-0.15s' },
]
function EqualizerBars({ playing, className = '', barClassName = '' }) {
  return (
    <span className={`flex items-end gap-[2px] ${className}`} aria-hidden="true">
      {EQ_BARS.map((bar, i) => (
        <span
          key={i}
          className={`w-[2.5px] h-full rounded-full origin-bottom ${barClassName || 'bg-gradient-to-t from-brand-indigo to-brand-purple'}`}
          style={{ animation: `eq-bounce ${bar.dur} ease-in-out infinite`, animationDelay: bar.delay, animationPlayState: playing ? 'running' : 'paused', transform: playing ? undefined : 'scaleY(0.5)' }}
        />
      ))}
    </span>
  )
}

function PlayIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.79-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
    </svg>
  )
}

function PauseIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.3" />
      <rect x="14" y="5" width="4" height="14" rx="1.3" />
    </svg>
  )
}

function SkipIcon({ className = '', dir = 'next' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={dir === 'prev' ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M6 5.5v13a1 1 0 0 0 1.53.85L16 14.1V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v3.9L7.53 4.65A1 1 0 0 0 6 5.5z" />
    </svg>
  )
}

function YouTubeGlyph({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
    </svg>
  )
}

function SearchIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
    </svg>
  )
}

function LinkIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l6-6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 6.5l1-1a4 4 0 0 1 5.66 5.66l-1 1M13 17.5l-1 1a4 4 0 0 1-5.66-5.66l1-1" />
    </svg>
  )
}

function FlameIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2c.5 3-1.8 4.4-3.2 6C7.2 9.8 6 11.7 6 14a6 6 0 0 0 12 0c0-2.2-1-4-2.3-5.6-.6.9-1.4 1.5-2.4 1.6.9-2.4.4-5.3-1.3-8z"
        fill="url(#flame-grad)"
      />
      <path d="M12 21a3.2 3.2 0 0 0 3.2-3.2c0-1.6-1.3-2.8-2-3.8-.6.8-1.2 1.1-2 1.2.3 1.2-.4 2-.9 2.6-.5.6-1.5 1.2-1.5 2.4A2.9 2.9 0 0 0 12 21z" fill="#ffd47e" fillOpacity="0.9" />
      <defs>
        <linearGradient id="flame-grad" x1="12" y1="2" x2="12" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd166" />
          <stop offset="0.55" stopColor="#f5822b" />
          <stop offset="1" stopColor="#e03b2f" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function MoveIndicator({ move }) {
  if (!move || move.dir === 'same') {
    return <span className="text-[11px] leading-none text-ink-faint/50" title="No change" aria-hidden="true">–</span>
  }
  if (move.dir === 'new') {
    return <span className="px-1 py-px rounded-[4px] text-[7px] font-bold uppercase tracking-[0.08em] bg-amber-400/15 text-amber-500" title="New this week">New</span>
  }
  const up = move.dir === 'up'
  return (
    <span
      className={`flex items-center gap-px text-[10px] font-bold tabular-nums leading-none ${up ? 'text-emerald-500' : 'text-rose-500'}`}
      title={`${up ? 'Up' : 'Down'} ${move.delta} from last week`}
    >
      <svg className="w-2 h-2" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        {up ? <path d="M6 2l4.5 6h-9z" /> : <path d="M6 10L1.5 4h9z" />}
      </svg>
      {move.delta}
    </span>
  )
}

function ShareIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  )
}

function CheckIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

function Spinner({ className = '' }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function ResultRow({ item, index, active, onPick, onHover }) {
  return (
    <li style={{ animation: 'result-in 0.34s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${Math.min(index, 7) * 0.035}s` }}>
      <button
        type="button"
        onClick={onPick}
        onMouseMove={onHover}
        className={`w-full flex items-center gap-3 p-1.5 rounded-[12px] text-left transition-colors duration-150 cursor-pointer ${active ? 'bg-surface-hover' : 'hover:bg-surface-hover/60'}`}
      >
        <span className="relative shrink-0 w-9 h-9 rounded-[7px] overflow-hidden bg-surface-raised">
          <Artwork src={item.art} alt="" className="w-full h-full" />
          <span className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity duration-150 ${active ? 'opacity-100' : 'opacity-0'}`}>
            <PlayIcon className="w-3.5 h-3.5 text-white translate-x-[1px]" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold tracking-tight truncate text-ink-secondary">{item.title}</span>
          <span className="flex items-center gap-1.5 text-[10px] text-ink-subtle min-w-0">
            <span className="font-mono truncate">{item.subtitle}</span>
            {fmtViews(item.views) && (
              <>
                <span className="text-ink-faint/60">·</span>
                <span className="flex items-center gap-0.5 shrink-0 tabular-nums">
                  <PlayIcon className="w-2 h-2 translate-x-0" />
                  {fmtViews(item.views)}
                </span>
              </>
            )}
            {item.views >= VIRAL_VIEWS && <FlameIcon className="w-2.5 h-2.5 shrink-0 flame-flicker" />}
          </span>
        </span>
        {item.duration ? <span className="shrink-0 mr-1 text-[9px] font-mono text-ink-faint tabular-nums">{fmt(item.duration)}</span> : null}
      </button>
    </li>
  )
}

function SkeletonRow({ i }) {
  return (
    <li className="flex items-center gap-3 p-1.5" aria-hidden="true">
      <span className="shrink-0 w-9 h-9 rounded-[7px] skeleton" />
      <span className="flex-1 flex flex-col gap-1.5">
        <span className="h-2.5 rounded skeleton" style={{ width: `${68 - i * 12}%` }} />
        <span className="h-2 rounded skeleton" style={{ width: `${40 - i * 6}%` }} />
      </span>
    </li>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors duration-200 cursor-pointer ${active ? 'text-ink-strong bg-surface-hover' : 'text-ink-subtle hover:text-ink-secondary'}`}
    >
      {children}
    </button>
  )
}

function LyricsPane({ state, lyrics, activeLine, activeLineRef, onSeek }) {
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-[11px] text-ink-subtle">
        <Spinner className="w-3.5 h-3.5" /> Finding lyrics…
      </div>
    )
  }
  if (state === 'none' || (!lyrics?.synced && !lyrics?.plain)) {
    return <p className="px-3 py-10 text-center text-[11px] text-ink-subtle leading-relaxed">No lyrics found for this track.</p>
  }
  if (lyrics.synced) {
    return (
      <div className="flex flex-col gap-2 py-3 px-1.5">
        {lyrics.synced.map((ln, i) => (
          <button
            key={i}
            type="button"
            ref={i === activeLine ? activeLineRef : null}
            onClick={() => onSeek(ln.t)}
            className={`text-left text-[13px] leading-snug transition-all duration-300 cursor-pointer ${
              i === activeLine ? 'text-ink-strong font-semibold' : i < activeLine ? 'text-ink-faint hover:text-ink-secondary' : 'text-ink-subtle/70 hover:text-ink-secondary'
            }`}
          >
            {ln.text || '♪'}
          </button>
        ))}
      </div>
    )
  }
  return <p className="whitespace-pre-wrap px-2 py-3 text-[12.5px] text-ink-secondary leading-relaxed">{lyrics.plain}</p>
}

function VolumeIcon({ className = '', level = 2 }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M11.5 4.6a.9.9 0 0 0-1.5-.66L6.2 7.5H3.6a.9.9 0 0 0-.9.9v7.2a.9.9 0 0 0 .9.9h2.6l3.8 3.56a.9.9 0 0 0 1.5-.66V4.6z" fill="currentColor" stroke="none" />
      {level === 0 ? (
        <path strokeLinecap="round" d="M15.6 9.6l5 4.8m0-4.8l-5 4.8" />
      ) : (
        <>
          <path strokeLinecap="round" d="M15.4 9.4a3.7 3.7 0 0 1 0 5.2" />
          {level === 2 && <path strokeLinecap="round" d="M18.6 6.6a8 8 0 0 1 0 10.8" />}
        </>
      )}
    </svg>
  )
}

function ShuffleIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 4h4v4M20 4l-6 6M4 20l6-6M16 20h4v-4M4 4l16 16" />
    </svg>
  )
}

function RepeatIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 2l4 4-4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function RepeatOneIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 2l4 4-4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13v2a4 4 0 0 1-4 4H3" />
      <text x="12" y="14.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">1</text>
    </svg>
  )
}
