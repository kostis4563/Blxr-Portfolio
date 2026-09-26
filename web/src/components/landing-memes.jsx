import { useEffect, useRef, useState } from 'react'
import { ACHIEVEMENTS, achievement, reducedMotion } from '../lib/memes'
import { imageUrl } from '../lib/images'

const CLIP = imageUrl('/parkour.mp4')
const POSTER = imageUrl('/parkour.webp')

const SKIM_SCREENS_PER_SECOND = 2.5

const HEART_EDGE =
  'M2 0h2v1H2zM5 0h2v1H5zM1 1h1v1H1zM4 1h1v1H4zM7 1h1v1H7zM0 2h1v2H0zM8 2h1v2H8zM1 4h1v1H1zM7 4h1v1H7zM2 5h1v1H2zM6 5h1v1H6zM3 6h1v1H3zM5 6h1v1H5zM4 7h1v1H4z'
const HEART_FILL = 'M2 1h2v1H2zM5 1h2v1H5zM1 2h7v2H1zM2 4h5v1H2zM3 5h3v1H3zM4 6h1v1H4z'
const HEART_SHINE = 'M2 2h1v1H2z'

const READ_SECONDS = { intro: 5, projects: 12, skills: 20, activity: 4 }

const readMs = { intro: 0, projects: 0, skills: 0, activity: 0 }
const slidesSeen = new Set()

function holdsScreen(el) {
  const box = el.getBoundingClientRect()
  const visible = Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0)
  return visible > 0 && visible >= Math.min(window.innerHeight * 0.4, box.height * 0.6)
}

const readEverything = () =>
  Object.entries(READ_SECONDS).every(([id, seconds]) => readMs[id] >= seconds * 1000) &&
  slidesSeen.size >= document.querySelectorAll('.project-slide').length

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

const SPLIT_MIN = 0.25
const SPLIT_MAX = 0.7
const SPLIT_KEYS = { ArrowUp: -0.05, ArrowDown: 0.05, Home: -1, End: 1 }
const clampSplit = (share) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, share))

let visitorActive = false
let splitShare = 0.5

const saveData = () => navigator.connection?.saveData || /2g/.test(navigator.connection?.effectiveType ?? '')

export default function LandingMemes() {
  const [clip, setClip] = useState(null)
  const [called, setCalled] = useState(false)
  const [split, setSplit] = useState(false)
  const [leaving, setLeaving] = useState(null)
  const [share, setShare] = useState(splitShare)
  const placement = useRef('in')
  const video = useRef(null)
  const ambient = useRef(null)
  const progress = useRef(null)
  const broken = useRef(false)
  const clipSeen = useRef(false)
  const settleClipSeen = useRef(null)
  const watched = useRef(0)
  const lastFrame = useRef(null)

  useEffect(() => {
    if (!document.getElementById('skills') || reducedMotion() || saveData()) return
    const uses = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']
    let loaded = false
    let cancelled = false
    const warm = () => {
      if (!cancelled && loaded && visitorActive) setClip((current) => current ?? 'hidden')
    }
    const onUse = () => {
      visitorActive = true
      uses.forEach((type) => window.removeEventListener(type, onUse))
      warm()
    }
    const onLoad = () => {
      const whenIdle = window.requestIdleCallback ?? setTimeout
      whenIdle(() => {
        loaded = true
        warm()
      })
    }
    if (!visitorActive) uses.forEach((type) => window.addEventListener(type, onUse, { passive: true }))
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
    return () => {
      cancelled = true
      uses.forEach((type) => window.removeEventListener(type, onUse))
      window.removeEventListener('load', onLoad)
    }
  }, [])

  useEffect(() => {
    const zone = document.getElementById('skills')
    if (!zone || reducedMotion()) return

    let samples = []

    const onScroll = () => {
      const now = performance.now()
      const y = window.scrollY
      samples = samples.filter((sample) => now - sample.t <= 400)
      samples.push({ t: now, y })
      const box = zone.getBoundingClientRect()
      if (broken.current || box.top >= window.innerHeight || box.bottom <= 0) return
      const dt = now - samples[0].t
      if (dt < 80) return
      const speed = (Math.abs(y - samples[0].y) / dt) * 1000
      if (speed < SKIM_SCREENS_PER_SECOND * window.innerHeight) return
      if (!clipSeen.current) {
        clipSeen.current = new Promise((resolve) => {
          settleClipSeen.current = resolve
        })
      }
      setCalled(true)
      setClip(placement.current)
    }

    const observer = new IntersectionObserver(([entry]) => {
      placement.current = entry.isIntersecting || entry.boundingClientRect.top < 0 ? 'in' : 'away'
      setClip((current) => (current === 'in' || current === 'away' ? placement.current : current))
    })
    observer.observe(zone)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const playing = called && (split || clip === 'in')
  useEffect(() => {
    const el = video.current
    if (!el) return
    if (playing) el.play().catch(() => {})
    else el.pause()
  }, [playing])

  useEffect(() => {
    const el = video.current
    const glow = ambient.current?.getContext('2d')
    if (!split || !el || !glow) return
    let frame
    const paint = () => {
      glow.drawImage(el, 0, 0, glow.canvas.width, glow.canvas.height)
      if (el.duration) progress.current.style.transform = `scaleX(${el.currentTime / el.duration})`
      frame = el.requestVideoFrameCallback ? el.requestVideoFrameCallback(paint) : requestAnimationFrame(paint)
    }
    paint()
    return () => (el.cancelVideoFrameCallback ? el.cancelVideoFrameCallback(frame) : cancelAnimationFrame(frame))
  }, [split])

  useEffect(() => {
    if (!split) return
    const onKey = (event) => {
      if (event.key === 'Escape') setLeaving((current) => current ?? 'exit')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [split])

  useEffect(() => {
    if (!leaving) return
    const done = setTimeout(() => {
      setSplit(false)
      setLeaving(null)
      if (leaving !== 'close') return
      setCalled(false)
      setClip('hidden')
    }, 300)
    return () => clearTimeout(done)
  }, [leaving])

  useEffect(() => {
    if (!called) return
    const seen = setTimeout(() => settleClipSeen.current?.(true), 1500)
    return () => {
      clearTimeout(seen)
      settleClipSeen.current?.(!broken.current)
    }
  }, [called])

  useEffect(() => {
    const end = document.getElementById('site-footer')
    const sections = Object.keys(READ_SECONDS).map((id) => [id, document.getElementById(id)])
    if (!end || sections.some(([, el]) => !el)) return

    let scrolled = false
    let atEnd = false
    let resting = false
    let done = false
    let cancelled = false
    let settle = null

    const unlock = () => {
      if (!resting || !scrolled || done) return
      Promise.resolve(clipSeen.current).then((saw) => {
        if (cancelled || done) return
        if (!saw && !readEverything()) return
        done = true
        stop()
        achievement(saw ? ACHIEVEMENTS.neededParkour : ACHIEVEMENTS.readItAll)
      })
    }
    const arm = () => {
      resting = false
      clearTimeout(settle)
      settle = setTimeout(() => {
        resting = true
        unlock()
      }, 700)
    }
    const onScroll = () => {
      scrolled = true
      if (atEnd) arm()
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        atEnd = entry.isIntersecting
        if (atEnd) arm()
        else {
          resting = false
          clearTimeout(settle)
        }
      },
      { threshold: 0.5 },
    )

    let last = performance.now()
    const read = setInterval(() => {
      const now = performance.now()
      const step = Math.min(now - last, 500)
      last = now
      if (document.visibilityState !== 'visible') return
      for (const [id, el] of sections) {
        if (!holdsScreen(el)) continue
        readMs[id] += step
        if (id !== 'projects') continue
        const slides = [...el.querySelectorAll('.project-slide')]
        const active = slides.findIndex((slide) => slide.hasAttribute('data-active'))
        if (active !== -1) slidesSeen.add(active)
      }
      unlock()
    }, 250)

    function stop() {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      clearTimeout(settle)
      clearInterval(read)
    }
    observer.observe(end)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  useEffect(() => {
    let progress = 0
    const onKey = (event) => {
      if (event.repeat || event.target.isContentEditable || event.target.closest?.('input, textarea, select')) return
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      if (key.length > 1 && !key.startsWith('Arrow')) return
      if (key === KONAMI[progress]) progress += 1
      else progress = key !== 'ArrowUp' ? 0 : progress === 2 ? 2 : 1
      if (progress < KONAMI.length) return
      progress = 0
      achievement(ACHIEVEMENTS.konami)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const splitShown = split && clip !== null
  const splitMode = splitShown && (leaving ? 'leaving' : 'split')
  useEffect(() => {
    if (!splitMode) return
    const root = document.documentElement
    root.dataset.parkour = splitMode
    return () => delete root.dataset.parkour
  }, [splitMode])

  useEffect(() => {
    if (!splitShown) return
    splitShare = share
    const root = document.documentElement
    root.style.setProperty('--parkour-h', `${share * 100}dvh`)
    return () => root.style.removeProperty('--parkour-h')
  }, [splitShown, share])

  if (!clip) return null

  const close = () => {
    if (split) {
      setLeaving('close')
      return
    }
    setCalled(false)
    setClip('hidden')
  }

  const fail = () => {
    broken.current = true
    setCalled(false)
    setSplit(false)
    setLeaving(null)
    setClip(null)
  }

  const onTimeUpdate = (event) => {
    const el = event.currentTarget
    const previous = lastFrame.current
    lastFrame.current = el.currentTime
    const step = el.currentTime - previous
    if (!split || previous === null || step <= 0 || step > 1) return
    const needed = el.duration - 1
    watched.current += step
    if (watched.current >= needed && watched.current - step < needed) achievement(ACHIEVEMENTS.stayedForParkour)
  }

  const startResize = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    const root = document.documentElement
    const grab = event.clientY - share * window.innerHeight
    const move = (e) => setShare(clampSplit((e.clientY - grab) / window.innerHeight))
    const end = () => {
      delete root.dataset.parkourDrag
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('lostpointercapture', end)
    }
    handle.setPointerCapture(event.pointerId)
    root.dataset.parkourDrag = ''
    handle.addEventListener('pointermove', move)
    handle.addEventListener('lostpointercapture', end)
  }

  const nudgeResize = (event) => {
    const step = SPLIT_KEYS[event.key]
    if (!step) return
    event.preventDefault()
    setShare((current) => clampSplit(current + step))
  }

  const state = split ? 'in' : clip

  return (
    <aside
      className="parkour"
      data-state={state}
      data-split={split ? (leaving ? 'leaving' : 'on') : undefined}
      inert={state !== 'in'}
      aria-label="Minecraft parkour, for your attention span"
    >
      <p className="parkour-note" aria-hidden="true">
        hold on, restoring your attention span
        <span className="parkour-hearts">
          {Array.from({ length: 10 }, (_, i) => (
            <svg key={i} viewBox="0 0 9 8" style={{ '--i': i }}>
              <path className="parkour-heart-edge" d={HEART_EDGE} />
              <g className="parkour-heart-hp">
                <path d={HEART_FILL} />
                <path className="parkour-heart-shine" d={HEART_SHINE} />
              </g>
            </svg>
          ))}
        </span>
      </p>
      <canvas ref={ambient} className="parkour-ambient" width="16" height="16" aria-hidden="true" />
      <div className="parkour-screen" inert>
        <video
          ref={video}
          src={CLIP}
          poster={POSTER}
          preload="auto"
          muted
          loop
          playsInline
          disablePictureInPicture
          onTimeUpdate={onTimeUpdate}
          onError={fail}
        />
        <div className="parkour-progress">
          <div ref={progress} />
        </div>
      </div>
      {split && (
        <div
          className="parkour-resize"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize Minecraft parkour"
          aria-valuemin={SPLIT_MIN * 100}
          aria-valuemax={SPLIT_MAX * 100}
          aria-valuenow={Math.round(share * 100)}
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={nudgeResize}
          onDoubleClick={() => setShare(0.5)}
        />
      )}
      <button type="button" className="parkour-split" onClick={() => (split ? setLeaving('exit') : setSplit(true))}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="1.75" width="8" height="12.5" rx="2" />
          <path d="M4 8h8V3.75a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z" fill="currentColor" />
        </svg>
        {split ? 'Exit focus mode' : 'Focus mode'}
      </button>
      <button type="button" className="parkour-close" onClick={close} aria-label="Close Minecraft parkour">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
        </svg>
      </button>
    </aside>
  )
}
