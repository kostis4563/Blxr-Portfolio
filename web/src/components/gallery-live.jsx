import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './icon'
import { imageProps, SIZES } from '../lib/images'

const stillMotion = () =>
  document.documentElement.dataset.motion === 'reduced' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const withAlpha = (color, alpha) => {
  const [r, g, b] = color.match(/[\d.]+/g)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}


function useCanvas(setup) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    const box = canvas.parentElement
    const paint = setup()
    const still = stillMotion()
    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0
    let seen = false

    const draw = (ms) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      paint(ctx, w, h, still ? 0 : ms, getComputedStyle(canvas).color)
    }
    const loop = (ms) => {
      draw(ms)
      raf = requestAnimationFrame(loop)
    }
    const sync = () => {
      cancelAnimationFrame(raf)
      raf = !still && seen && !document.hidden ? requestAnimationFrame(loop) : 0
    }
    const fit = () => {
      ;({ width: w, height: h } = box.getBoundingClientRect())
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      draw(performance.now())
    }

    const sizes = new ResizeObserver(fit)
    const view = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting
      sync()
    })
    const theme = new MutationObserver(() => draw(performance.now()))
    sizes.observe(box)
    view.observe(canvas)
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    document.addEventListener('visibilitychange', sync)
    return () => {
      cancelAnimationFrame(raf)
      sizes.disconnect()
      view.disconnect()
      theme.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])
  return ref
}

const COMET_TAIL = 0.14
const COMET_LOOP = 7600
const COMET_SAMPLES = 150
const COMET_STROKE = 2.4
const COMET_RADIUS = 16

function edgePoint(width, height, radius, inset) {
  const left = inset
  const top = inset
  const right = width - inset
  const bottom = height - inset
  const r = Math.max(1, Math.min(radius, (right - left) / 2, (bottom - top) / 2))
  const arc = (Math.PI / 2) * r
  const across = right - left - 2 * r
  const down = bottom - top - 2 * r
  const total = 2 * across + 2 * down + 4 * arc

  return (t) => {
    let d = (((t % 1) + 1) % 1) * total
    if (d < across) return [left + r + d, top]
    d -= across
    if (d < arc) return [right - r + r * Math.cos(-Math.PI / 2 + d / r), top + r + r * Math.sin(-Math.PI / 2 + d / r)]
    d -= arc
    if (d < down) return [right, top + r + d]
    d -= down
    if (d < arc) return [right - r + r * Math.cos(d / r), bottom - r + r * Math.sin(d / r)]
    d -= arc
    if (d < across) return [right - r - d, bottom]
    d -= across
    if (d < arc) return [left + r + r * Math.cos(Math.PI / 2 + d / r), bottom - r + r * Math.sin(Math.PI / 2 + d / r)]
    d -= arc
    if (d < down) return [left, bottom - r - d]
    d -= down
    return [left + r + r * Math.cos(Math.PI + d / r), top + r + r * Math.sin(Math.PI + d / r)]
  }
}

const cometPaint = () => (ctx, w, h, ms, color) => {
  const progress = (ms % COMET_LOOP) / COMET_LOOP
  const at = edgePoint(w, h, COMET_RADIUS - 1, 1)
  const [headX, headY] = at(progress + COMET_TAIL / 120)
  const [tailX, tailY] = at(progress - COMET_TAIL)

  const trail = ctx.createLinearGradient(tailX, tailY, headX, headY)
  trail.addColorStop(0, withAlpha(color, 0))
  trail.addColorStop(0.38, withAlpha(color, 0.12))
  trail.addColorStop(0.72, withAlpha(color, 0.42))
  trail.addColorStop(1, withAlpha(color, 0.86))

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = COMET_STROKE * 1.16
  ctx.strokeStyle = trail
  ctx.beginPath()
  for (let i = 0; i <= COMET_SAMPLES; i++) {
    const [x, y] = at(progress - COMET_TAIL + (COMET_TAIL * i) / COMET_SAMPLES)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  const [neckX, neckY] = at(progress - COMET_TAIL / 34)
  ctx.lineWidth = COMET_STROKE + 0.5
  ctx.strokeStyle = withAlpha(color, 0.96)
  ctx.beginPath()
  ctx.moveTo(neckX, neckY)
  ctx.lineTo(headX, headY)
  ctx.stroke()
}

export function CometCard({ title, sub }) {
  const ref = useCanvas(cometPaint)
  return (
    <div className="relative grid h-[132px] w-full max-w-[260px] place-items-center rounded-2xl border border-line bg-surface-raised">
      <span className="text-center">
        <span className="block text-[22px] font-semibold tracking-tight text-ink-strong">{title}</span>
        {sub && <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">{sub}</span>}
      </span>
      <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-ink-strong" />
    </div>
  )
}

const CONTOUR_LEVELS = 11
const CONTOUR_CELL = 8
const CONTOUR_SCALE = 0.011

const heightAt = (x, y, t) =>
  Math.sin(x * 1.7 + t) * Math.cos(y * 1.3 - t * 0.7) +
  Math.sin((x + y) * 0.9 + t * 0.5) * 0.7 +
  Math.cos(x * 0.6 - y * 1.4 + t * 0.31) * 0.55 +
  Math.sin(y * 2.3 - t * 0.42) * 0.32

const contourPaint = () => {
  let values = new Float32Array(0)
  return (ctx, w, h, ms, color) => {
    const cols = Math.ceil(w / CONTOUR_CELL)
    const rows = Math.ceil(h / CONTOUR_CELL)
    const stride = cols + 1
    if (values.length !== stride * (rows + 1)) values = new Float32Array(stride * (rows + 1))

    const t = ms * 0.00012
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        values[r * stride + c] = heightAt(c * CONTOUR_CELL * CONTOUR_SCALE, r * CONTOUR_CELL * CONTOUR_SCALE, t)
      }
    }

    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    for (let l = 0; l < CONTOUR_LEVELS; l++) {
      const p = l / (CONTOUR_LEVELS - 1)
      const level = -1.05 + p * 2.1
      ctx.strokeStyle = withAlpha(color, 0.14 + Math.sin(Math.PI * p) * 0.42)
      ctx.beginPath()

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * stride + c
          const tl = values[i]
          const tr = values[i + 1]
          const bl = values[i + stride]
          const br = values[i + stride + 1]
          const code = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0)
          if (code === 0 || code === 15) continue

          const x0 = c * CONTOUR_CELL
          const y0 = r * CONTOUR_CELL
          const x1 = x0 + CONTOUR_CELL
          const y1 = y0 + CONTOUR_CELL
          const top = x0 + (CONTOUR_CELL * (level - tl)) / (tr - tl)
          const bottom = x0 + (CONTOUR_CELL * (level - bl)) / (br - bl)
          const left = y0 + (CONTOUR_CELL * (level - tl)) / (bl - tl)
          const right = y0 + (CONTOUR_CELL * (level - tr)) / (br - tr)

          switch (code) {
            case 1: case 14: ctx.moveTo(x0, left); ctx.lineTo(bottom, y1); break
            case 2: case 13: ctx.moveTo(bottom, y1); ctx.lineTo(x1, right); break
            case 3: case 12: ctx.moveTo(x0, left); ctx.lineTo(x1, right); break
            case 4: case 11: ctx.moveTo(top, y0); ctx.lineTo(x1, right); break
            case 6: case 9: ctx.moveTo(top, y0); ctx.lineTo(bottom, y1); break
            case 7: case 8: ctx.moveTo(top, y0); ctx.lineTo(x0, left); break
            case 5:
              ctx.moveTo(top, y0); ctx.lineTo(x0, left)
              ctx.moveTo(bottom, y1); ctx.lineTo(x1, right)
              break
            case 10:
              ctx.moveTo(top, y0); ctx.lineTo(x1, right)
              ctx.moveTo(x0, left); ctx.lineTo(bottom, y1)
              break
          }
        }
      }
      ctx.stroke()
    }
  }
}

export function ContourField() {
  const ref = useCanvas(contourPaint)
  return (
    <span aria-hidden="true" className="absolute inset-0 bg-bg">
      <canvas ref={ref} className="absolute inset-0 h-full w-full text-[#8b5cf6]" />
    </span>
  )
}

const PATHS_W = 696
const PATHS_H = 316
const DASH = 0.45
const GAP = 0.08

const pathData = (i) =>
  `M-${380 + i * 5} -${189 + i * 6}C-${380 + i * 5} -${189 + i * 6} -${312 + i * 5} ${216 - i * 6} ${152 + i * 5} ${343 - i * 6}` +
  `C${616 + i * 5} ${470 - i * 6} ${684 + i * 5} ${875 - i * 6} ${684 + i * 5} ${875 - i * 6}`

function curveLengths(data) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
  const paths = data.map((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', d)
    return svg.appendChild(path)
  })
  document.body.appendChild(svg)
  const lengths = paths.map((p) => p.getTotalLength())
  svg.remove()
  return lengths
}

const pathsPaint = () => {
  const steps = Array.from({ length: 18 }, (_, k) => k * 2)
  const data = steps.map(pathData)
  const lengths = curveLengths(data)
  const curves = steps.map((i, k) => ({
    path: new Path2D(data[k]),
    length: lengths[k],
    width: 0.5 + i * 0.03,
    alpha: 0.1 + i * 0.03,
    travel: (35 + Math.random() * 20) * 1000,
    travelPhase: Math.random(),
    pulse: (8 + Math.random() * 6) * 1000,
    pulsePhase: Math.random() * Math.PI * 2,
  }))

  return (ctx, w, h, ms, color) => {
    const s = Math.min(w / PATHS_W, h / PATHS_H)
    ctx.transform(s, 0, 0, s, (w - PATHS_W * s) / 2, (h - PATHS_H * s) / 2)
    ctx.strokeStyle = color
    ctx.lineCap = 'round'
    for (const p of curves) {
      const pattern = (DASH + GAP) * p.length
      ctx.lineWidth = p.width
      ctx.setLineDash([DASH * p.length, GAP * p.length])
      ctx.lineDashOffset = -((ms / p.travel + p.travelPhase) % 1) * pattern
      ctx.globalAlpha = p.alpha * (0.3 + 0.09 * Math.sin((ms / p.pulse) * Math.PI * 2 + p.pulsePhase))
      ctx.stroke(p.path)
    }
    ctx.globalAlpha = 1
  }
}

const SWAP_MS = 800

function TextLoop({ lead, words, every = 3000 }) {
  const [index, setIndex] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [width, setWidth] = useState(null)
  const wordRef = useRef(null)

  useLayoutEffect(() => {
    const fit = () => wordRef.current && setWidth(Math.ceil(wordRef.current.getBoundingClientRect().width))
    fit()
    document.fonts?.ready.then(fit)
  }, [index])

  useEffect(() => {
    if (stillMotion()) {
      const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), every)
      return () => window.clearInterval(id)
    }
    let swap = 0
    const id = window.setInterval(() => {
      setCollapsed(true)
      swap = window.setTimeout(() => {
        setIndex((i) => (i + 1) % words.length)
        setCollapsed(false)
      }, SWAP_MS)
    }, every)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(swap)
    }
  }, [words, every])

  return (
    <p className="relative flex items-center text-[24px] font-medium tracking-tight text-ink-strong" aria-label={`${lead} ${words.join(', ')}`}>
      <span aria-hidden="true" className="mr-2.5 whitespace-nowrap">{lead}</span>
      <span aria-hidden="true" className="flex items-center">
        <span
          className="relative overflow-hidden whitespace-nowrap transition-[width,opacity] duration-[800ms] ease-in-out"
          style={{ width: collapsed ? 0 : width ?? undefined, opacity: collapsed ? 0 : 1 }}
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/15 to-violet-500/30" />
          <span ref={wordRef} className="relative inline-block bg-gradient-to-r from-violet-400 to-violet-600 bg-clip-text pr-1 text-transparent">
            {words[index]}
          </span>
        </span>
        <span className="h-[1.1em] w-[3px] bg-violet-500 animate-caret" />
      </span>
    </p>
  )
}

export function FreshFindsHero({ lead, words }) {
  const ref = useCanvas(pathsPaint)
  const list = useMemo(() => {
    const split = String(words || '').split(',').map((w) => w.trim()).filter(Boolean)
    return split.length ? split : ['fast']
  }, [words])
  return (
    <>
      <span aria-hidden="true" className="absolute inset-0 mask-[linear-gradient(to_bottom,black_45%,transparent)]">
        <canvas ref={ref} className="absolute inset-0 h-full w-full text-ink-strong" />
      </span>
      <TextLoop key={list.join(',')} lead={lead} words={list} />
    </>
  )
}


export function GlowButton({ text }) {
  const [on, setOn] = useState(false)
  const show = () => setOn(true)
  const hide = () => setOn(false)
  return (
    <button
      type="button"
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="relative flex cursor-pointer overflow-hidden rounded-full p-px outline-none transition-shadow duration-300"
      style={{ boxShadow: on ? '0 0 20px 2px #3b82f640' : 'none' }}
    >
      <span aria-hidden="true" className="absolute inset-0">
        {on ? (
          <span
            className="absolute left-1/2 top-1/2 block aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2 animate-spin [animation-duration:2s]"
            style={{ background: 'conic-gradient(from 0deg, transparent 0%, #3b82f6 25%, #93c5fd 50%, transparent 75%)' }}
          />
        ) : (
          <span className="absolute inset-0 bg-line-strong" />
        )}
      </span>
      <span aria-hidden="true" className="absolute inset-px rounded-[inherit] bg-bg" />
      <span className="relative z-10 inline-flex items-center gap-2 rounded-[inherit] px-5 py-2.5 text-[13.5px] font-medium text-ink-strong">
        <Icon name="search" className="h-3.5 w-3.5" /> {text}
      </span>
    </button>
  )
}

const TRACK = '/audio/sunset-drive.mp3'
const EQ_DELAYS = [0, 0.22, 0.44, 0.12]

function Speaker({ muted }) {
  const lines = muted
    ? ['M11 5 6 9H2v6h4l5 4z', 'm22 9-6 6', 'm16 9 6 6']
    : ['M11 5 6 9H2v6h4l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14']
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5">
      {lines.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

export function MusicPill({ label }) {
  const audio = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(60)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    const el = audio.current
    if (!el) return
    el.volume = volume / 100
    el.muted = muted
  }, [volume, muted])

  const toggle = () => {
    const el = audio.current
    if (el.paused) el.play().catch(() => setPlaying(false))
    else el.pause()
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-full border py-[9px] pl-[18px] pr-2.5 backdrop-blur-[18px] transition-[background-color,border-color,box-shadow] duration-500 ${
        playing
          ? 'border-line-strong bg-ink-strong/[0.07] shadow-[0_8px_34px_var(--shadow-cast-soft),0_0_22px_var(--glow-soft)]'
          : 'border-line bg-ink-strong/5 shadow-[0_8px_30px_var(--shadow-cast-soft)]'
      }`}
    >
      <span className="whitespace-nowrap text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</span>
      <span
        aria-hidden="true"
        className={`flex h-3.5 items-end gap-[2.5px] overflow-hidden transition-[width,opacity] duration-[450ms] ${playing ? 'w-[18px] opacity-100' : 'w-0 opacity-0'}`}
      >
        {EQ_DELAYS.map((d) => (
          <i key={d} className="h-1 w-[2.5px] shrink-0 animate-eq rounded-sm bg-ink-strong" style={{ animationDelay: `${d}s` }} />
        ))}
      </span>
      <span
        inert={!playing}
        className={`flex items-center overflow-hidden transition-[max-width,opacity,translate,scale] duration-500 ${
          playing ? 'max-w-[130px] opacity-100' : 'max-w-0 translate-x-2.5 scale-[0.92] opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full text-ink-muted outline-none transition-colors hover:bg-ink-strong/[0.08] hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/30"
        >
          <Speaker muted={muted || volume === 0} />
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
          className="mr-1 ml-0.5 h-[3px] w-[68px] cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-[11px] [&::-moz-range-thumb]:w-[11px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink-strong [&::-webkit-slider-thumb]:h-[11px] [&::-webkit-slider-thumb]:w-[11px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink-strong [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125"
          style={{ background: `linear-gradient(to right, var(--color-ink-strong) ${volume}%, var(--color-line-strong) ${volume}%)` }}
        />
      </span>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        className="grid h-[30px] w-[30px] shrink-0 cursor-pointer place-items-center rounded-full bg-ink-strong text-bg outline-none transition-transform hover:scale-[1.06] focus-visible:ring-2 focus-visible:ring-ink-strong/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <Icon name={playing ? 'pause' : 'play'} className="h-3 w-3" strokeWidth={2.4} />
      </button>
      <audio ref={audio} src={TRACK} loop preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
    </div>
  )
}

const MARQUEE_REPEAT = 3

function MarqueeRow({ items, back }) {
  const run = Array.from({ length: MARQUEE_REPEAT }, () => items).flat()
  const group = (
    <span className="flex shrink-0 items-center gap-3 pr-3">
      {run.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className="whitespace-nowrap rounded-full border border-line bg-surface-raised px-3.5 py-1.5 text-[13px] font-semibold text-ink-muted transition-colors hover:border-line-strong hover:text-ink-strong"
        >
          {item}
        </span>
      ))}
    </span>
  )
  return (
    <div aria-hidden="true" className="flex w-max animate-marquee group-hover:[animation-play-state:paused]" style={back ? { animationDirection: 'reverse' } : undefined}>
      {group}
      {group}
    </div>
  )
}

export function Marquee({ items }) {
  const list = useMemo(() => {
    const split = String(items || '').split(',').map((s) => s.trim()).filter(Boolean)
    return split.length ? split : ['React']
  }, [items])
  const half = Math.ceil(list.length / 2)
  const top = list.length > 3 ? list.slice(0, half) : list
  const bottom = list.length > 3 ? list.slice(half) : list
  return (
    <div className="group w-full space-y-3 overflow-hidden mask-[linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
      <MarqueeRow items={top} />
      <MarqueeRow items={bottom} back />
      <p className="sr-only">{list.join(', ')}</p>
    </div>
  )
}

const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 4 + i).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2))
const MONTH_NAME = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const DAY_NAME = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const keyDate = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const shiftKey = (key, by) => {
  const d = keyDate(key)
  d.setDate(d.getDate() + by)
  return dayKey(d)
}

function weeksOf(year, month) {
  const lead = new Date(year, month, 1).getDay()
  const rows = Math.ceil((lead + new Date(year, month + 1, 0).getDate()) / 7)
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => {
      const at = new Date(year, month, 1 - lead + r * 7 + c)
      return { key: dayKey(at), day: at.getDate(), inside: at.getMonth() === month, at }
    }),
  )
}

const RANGE_DAYS = 13

export function RangeCalendar() {
  const [range, setRange] = useState(() => {
    const from = dayKey(new Date())
    return { from, to: shiftKey(from, RANGE_DAYS) }
  })
  const [face, setFace] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }))
  const [hover, setHover] = useState(null)
  const [cursor, setCursor] = useState(null)
  const gridRef = useRef(null)
  const wanted = useRef(null)
  const weeks = useMemo(() => weeksOf(face.year, face.month), [face])
  const today = dayKey(new Date())

  const open = range.from && !range.to
  const end = open ? hover : range.to
  const [lo, hi] = end && end < range.from ? [end, range.from] : [range.from, end]
  const cells = weeks.flat()
  const roving = cells.find((c) => c.key === (cursor || range.from) && c.inside)?.key || cells.find((c) => c.inside).key

  useLayoutEffect(() => {
    if (!wanted.current) return
    gridRef.current?.querySelector(`[data-day="${wanted.current}"]`)?.focus({ preventScroll: true })
    wanted.current = null
  })

  const show = (key) => {
    const d = keyDate(key)
    setFace({ year: d.getFullYear(), month: d.getMonth() })
  }
  const step = (by) => setFace(({ year, month }) => ({ year: new Date(year, month + by, 1).getFullYear(), month: new Date(year, month + by, 1).getMonth() }))

  const pick = (key, inside) => {
    setRange((r) => (!r.from || r.to ? { from: key, to: null } : key < r.from ? { from: key, to: r.from } : { from: r.from, to: key }))
    setCursor(key)
    if (!inside) show(key)
  }

  const walk = (event) => {
    const by = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]
    if (!by) return
    event.preventDefault()
    const next = shiftKey(roving, by)
    wanted.current = next
    setCursor(next)
    if (!cells.some((c) => c.key === next && c.inside)) show(next)
  }

  const arrow = 'grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-muted outline-none transition-colors hover:bg-ink-strong/[0.07] hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/30'

  return (
    <div className="w-full max-w-[252px] rounded-xl border border-line bg-surface p-3 shadow-[0_10px_34px_var(--shadow-cast-soft)]">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => step(-1)} className={arrow}>
          <Icon name="chevronLeft" className="h-4 w-4" />
        </button>
        <span aria-live="polite" className="text-[13.5px] font-semibold tracking-tight text-ink-strong">
          {MONTH_NAME.format(new Date(face.year, face.month, 1))}
        </span>
        <button type="button" aria-label="Next month" onClick={() => step(1)} className={arrow}>
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map((name) => (
          <span key={name} className="text-center text-[11.5px] font-medium text-ink-subtle">
            {name}
          </span>
        ))}
      </div>
      <div ref={gridRef} role="grid" aria-label="Pick a date range" onKeyDown={walk} onPointerLeave={() => setHover(null)} className="space-y-1">
        {weeks.map((week) => (
          <div key={week[0].key} role="row" className="grid grid-cols-7">
            {week.map((cell, c) => {
              const band = lo && hi && cell.key >= lo && cell.key <= hi
              const edge = cell.key === lo || cell.key === hi
              return (
                <span key={cell.key} role="gridcell" className="relative grid h-8 place-items-center">
                  {band && (
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 right-0 bg-blue-500/20 ${c === 0 || cell.key === lo ? 'rounded-l-full' : ''} ${
                        c === 6 || cell.key === hi ? 'rounded-r-full' : ''
                      }`}
                    />
                  )}
                  <button
                    type="button"
                    data-day={cell.key}
                    tabIndex={cell.key === roving ? 0 : -1}
                    aria-label={DAY_NAME.format(cell.at)}
                    aria-pressed={edge}
                    onClick={() => pick(cell.key, cell.inside)}
                    onPointerEnter={() => setHover(cell.key)}
                    onFocus={() => setHover(cell.key)}
                    className={`relative grid h-7 w-7 cursor-pointer place-items-center rounded-full text-[12.5px] tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
                      edge
                        ? 'bg-blue-500 font-semibold text-white shadow-[0_0_0_3px_rgba(59,130,246,0.18)]'
                        : `hover:bg-ink-strong/10 ${cell.inside ? 'font-medium text-ink-strong' : 'text-ink-faint'} ${cell.key === today ? 'underline decoration-blue-500 decoration-2 underline-offset-4' : ''}`
                    }`}
                  >
                    {cell.day}
                  </button>
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

const BRANDS = {
  nvidia: {
    name: 'NVIDIA',
    style: 'font-black uppercase tracking-[0.04em]',
    d: 'M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z',
  },
  supabase: {
    name: 'supabase',
    style: 'font-semibold tracking-tight',
    d: 'M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z',
  },
  github: { name: 'GitHub', style: 'text-[19px] font-extrabold tracking-[-0.03em]' },
  openai: {
    name: 'OpenAI',
    style: 'font-medium tracking-tight',
    d: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z',
  },
  turso: {
    name: 'TURSO',
    style: 'font-black tracking-[-0.01em]',
    d: 'm23.31.803-.563-.42-1.11 1.189-.891-1.286-.512.235.704 1.798-.326.35L18.082 0l-.574.284 2.25 4.836-2.108.741h-.05l-1.143-1.359-1.144 1.36H8.687l-1.144-1.36-1.146 1.363H6.36l-2.12-.745L6.491.284 5.919 0l-2.53 2.668-.327-.349.705-1.798-.512-.236-.89 1.287L1.253.382.69.804 2.42 3.69l-.89.939.311 2.375 2.061.787L3.9 8.817H1.947v.444l.755 1.078 1.197.433v6.971l3.057 4.55L7.657 24l1.101-1.606L9.9 24l.999-1.606L12 24l1.102-1.606L14.1 24l1.141-1.606L16.343 24l.701-1.706 3.058-4.55v-6.972l1.196-.433.756-1.078v-.444h-1.952l.003-1.03 2.054-.784.311-2.375-.89-.939zm-8.93 18.718H8.033l.793-1.615.794 1.615.793-1.083.793 1.083.794-1.083.793 1.083.794-1.083.793 1.083.793-1.615.794 1.615zm3.886-7.39-3.3 1.084-.143 3.061-2.827.627-2.826-.627-.142-3.06-3.3-1.085v-1.635l4.266 1.21-.052 4.126h4.109l-.052-4.127 4.266-1.209z',
  },
  clerk: {
    name: 'clerk',
    style: 'text-[18px] font-semibold tracking-[-0.03em]',
    d: 'm21.47 20.829-2.881-2.881a.572.572 0 0 0-.7-.084 6.854 6.854 0 0 1-7.081 0 .576.576 0 0 0-.7.084l-2.881 2.881a.576.576 0 0 0-.103.69.57.57 0 0 0 .166.186 12 12 0 0 0 14.113 0 .58.58 0 0 0 .239-.423.576.576 0 0 0-.172-.453Zm.002-17.668-2.88 2.88a.569.569 0 0 1-.701.084A6.857 6.857 0 0 0 8.724 8.08a6.862 6.862 0 0 0-1.222 3.692 6.86 6.86 0 0 0 .978 3.764.573.573 0 0 1-.083.699l-2.881 2.88a.567.567 0 0 1-.864-.063A11.993 11.993 0 0 1 6.771 2.7a11.99 11.99 0 0 1 14.637-.405.566.566 0 0 1 .232.418.57.57 0 0 1-.168.448Zm-7.118 12.261a3.427 3.427 0 1 0 0-6.854 3.427 3.427 0 0 0 0 6.854Z',
  },
  claude: {
    name: 'Claude',
    style: 'font-serif text-[18px] tracking-[-0.01em]',
    d: 'm4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z',
  },
  vercel: { name: 'Vercel', style: 'text-[19px] font-semibold tracking-[-0.04em]', d: 'm12 1.608 12 20.784H0Z' },
}

const brandOf = (name) => BRANDS[name.toLowerCase().replace(/[^a-z0-9]/g, '')]

function Brand({ name }) {
  const brand = brandOf(name)
  return (
    <span className={`flex items-center gap-1.5 whitespace-nowrap text-[17px] leading-none ${brand?.style || 'font-semibold tracking-tight'}`}>
      {brand?.d && (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[1.15em] w-[1.15em] shrink-0 fill-current">
          <path d={brand.d} />
        </svg>
      )}
      {brand?.name || name}
    </span>
  )
}

const innerCorner = (i, count, cols) => (i + 1) % cols !== 0 && i < count - (count % cols || cols)

export function LogoWall({ lead, bold, tail, names }) {
  const list = useMemo(() => {
    const split = String(names || '').split(',').map((s) => s.trim()).filter(Boolean)
    return split.length ? split : ['Vercel']
  }, [names])
  return (
    <div className="@container w-full">
      <p className="mb-6 text-center text-[19px] font-semibold tracking-tight text-ink-subtle">
        {lead && `${lead} `}
        <span className="text-ink-strong">{bold}</span>
        {tail && ` ${tail}`}
      </p>
      <ul className="grid grid-cols-2 border-l border-t border-line @xl:grid-cols-4">
        {list.map((name, i) => (
          <li
            key={`${name}-${i}`}
            className="relative grid h-[76px] place-items-center border-b border-r border-line px-2 text-ink-muted transition-colors duration-300 hover:bg-surface-hover hover:text-ink-strong"
          >
            <Brand name={name} />
            <svg
              viewBox="0 0 9 9"
              aria-hidden="true"
              className={`pointer-events-none absolute -bottom-[5px] -right-[5px] z-10 h-[9px] w-[9px] stroke-ink-faint ${innerCorner(i, list.length, 2) ? 'block' : 'hidden'} ${
                innerCorner(i, list.length, 4) ? '@xl:block' : '@xl:hidden'
              }`}
            >
              <path d="M4.5 0v9M0 4.5h9" strokeWidth="1" />
            </svg>
          </li>
        ))}
      </ul>
    </div>
  )
}

const FACES = [
  { name: 'Kostis', src: '/pfp.webp' },
  { name: 'async', src: '/async-logo.webp', mark: true },
  { name: 'Delivo', src: '/delivo-logo.webp', mark: true },
  { name: 'Amitista', src: '/amitista-logo.webp', mark: true },
  { name: '7x0', src: '/7x0-logo.webp', mark: true },
]

export function AvatarStack({ more }) {
  const extra = Math.max(0, Math.min(999, Number(more) || 0))
  return (
    <div role="group" aria-label={`${FACES.length}${extra ? ` people and ${extra} more` : ' people'}`} className="group flex items-center">
      {FACES.map((face, i) => (
        <span
          key={face.name}
          tabIndex={0}
          className={`group/face relative rounded-full outline-none transition-[margin,translate] duration-300 ease-out hover:z-10 hover:-translate-y-1 focus-visible:z-10 focus-visible:-translate-y-1 ${
            i ? '-ml-3.5 group-focus-within:-ml-1 group-hover:-ml-1' : ''
          }`}
        >
          <img
            {...imageProps(face.src, SIZES.avatar)}
            alt={face.name}
            width="44"
            height="44"
            draggable="false"
            className={`block h-11 w-11 rounded-full ring-[3px] ring-bg select-none ${face.mark ? 'bg-[#1c1c1c] object-contain p-2' : 'object-cover'}`}
          />
          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-surface-inverted px-2 py-1 text-[11px] font-medium text-ink-on-inverted opacity-0 shadow-lg transition-[opacity,translate] duration-200 group-hover/face:translate-y-0 group-hover/face:opacity-100 group-focus-visible/face:translate-y-0 group-focus-visible/face:opacity-100">
            {face.name}
          </span>
        </span>
      ))}
      {extra > 0 && (
        <span className="relative -ml-3.5 grid h-11 min-w-11 place-items-center rounded-full bg-ink-strong px-2 text-[13px] font-semibold tabular-nums text-bg ring-[3px] ring-bg transition-[margin] duration-300 ease-out group-focus-within:-ml-1 group-hover:-ml-1">
          +{extra}
        </span>
      )}
    </div>
  )
}
