import { useEffect, useId, useRef, useState } from 'react'
import '../focus-kit.css'
import { reveal } from '../lib/crossfade'

export const still = () =>
  document.documentElement.dataset.motion === 'reduced' ||
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' })
  return true
}

export const jump = (id) => ({
  href: `#${id}`,
  onClick: (event) => {
    if (scrollToId(id)) event.preventDefault()
  },
})

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
const SKY = [
  [2, 2, 3],
  [10, 10, 13],
  [24, 25, 30],
  [52, 54, 63],
  [126, 130, 142],
]
const SKY_LIGHT = [
  [250, 250, 251],
  [234, 236, 241],
  [212, 216, 225],
  [172, 179, 194],
  [118, 127, 147],
]
export const CELL = 5

const skyColors = (theme) =>
  new Uint32Array((theme === 'light' ? SKY_LIGHT : SKY).map(([r, g, b]) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0))

function makeNoise(seed) {
  const grid = new Float32Array(256 * 256)
  let s = seed >>> 0
  for (let i = 0; i < grid.length; i++) {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    grid[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return (x, y) => {
    const xf = Math.floor(x)
    const yf = Math.floor(y)
    const tx = x - xf
    const ty = y - yf
    const sx = tx * tx * (3 - 2 * tx)
    const sy = ty * ty * (3 - 2 * ty)
    const x0 = xf & 255
    const y0 = yf & 255
    const x1 = (x0 + 1) & 255
    const y1 = (y0 + 1) & 255
    const a = grid[y0 * 256 + x0]
    const b = grid[y0 * 256 + x1]
    const c = grid[y1 * 256 + x0]
    const d = grid[y1 * 256 + x1]
    return a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy
  }
}

const skyField = (t, gw, gh) => (gx, gy, n) => (0.94 - (gy / gh) * 0.8 + (gx / gw) * 0.14) * 0.6 + (n - 0.5) * 1.25 + 0.1

export function DitherSky({ hostRef, theme, seed = 20261019, field: shape = skyField }) {
  const ref = useRef(null)
  const palette = useRef(null)
  const shaper = useRef(shape)
  const repaint = useRef(null)

  useEffect(() => {
    palette.current = skyColors(theme)
    repaint.current?.()
  }, [theme])

  useEffect(() => {
    shaper.current = shape
    repaint.current?.()
  }, [shape])

  useEffect(() => {
    const canvas = ref.current
    const host = hostRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !host || !ctx) return

    const noise = makeNoise(seed)
    const pointer = { x: 0, y: 0, k: 0, target: 0 }
    let gw = 0
    let gh = 0
    let img = null
    let pixels = null
    let field = null
    let fw = 0
    let raf = 0
    let last = 0
    let visible = true
    const calm = still()
    const started = performance.now()

    const resize = () => {
      const box = canvas.parentElement.getBoundingClientRect()
      gw = Math.max(1, Math.ceil(box.width / CELL))
      gh = Math.max(1, Math.ceil(box.height / CELL))
      canvas.width = gw
      canvas.height = gh
      canvas.style.width = `${gw * CELL}px`
      canvas.style.height = `${gh * CELL}px`
      img = ctx.createImageData(gw, gh)
      pixels = new Uint32Array(img.data.buffer)
      fw = (gw >> 1) + 2
      field = new Float32Array(fw * ((gh >> 1) + 2))
    }

    const draw = (t) => {
      const colors = palette.current
      const fh = (gh >> 1) + 2
      for (let fy = 0; fy < fh; fy++) {
        const y = fy * 2
        for (let fx = 0; fx < fw; fx++) {
          const x = fx * 2
          field[fy * fw + fx] =
            noise(x * 0.021 + t * 0.05, y * 0.058) * 0.56 +
            noise(x * 0.052 - t * 0.08, y * 0.13 + t * 0.025 + 40) * 0.3 +
            noise(x * 0.13 + t * 0.14 + 90, y * 0.31) * 0.14
        }
      }

      pointer.k += (pointer.target - pointer.k) * 0.08
      const glow = pointer.k > 0.01
      const reach = 2 * 22 * 22
      const at = shaper.current(t, gw, gh)

      for (let gy = 0; gy < gh; gy++) {
        const fy = gy >> 1
        const ty = (gy & 1) * 0.5
        const row = gy * gw
        const bayerRow = (gy & 3) * 4
        for (let gx = 0; gx < gw; gx++) {
          const fx = gx >> 1
          const tx = (gx & 1) * 0.5
          const i = fy * fw + fx
          const top = field[i] + (field[i + 1] - field[i]) * tx
          const bottom = field[i + fw] + (field[i + fw + 1] - field[i + fw]) * tx
          const n = top + (bottom - top) * ty

          let v = at(gx, gy, n)
          if (glow) {
            const dx = gx - pointer.x
            const dy = gy - pointer.y
            v += 0.26 * pointer.k * Math.exp(-(dx * dx + dy * dy) / reach)
          }
          if (v < 0) v = 0
          else if (v > 0.999) v = 0.999

          const scaled = v * 4
          const level = scaled | 0
          pixels[row + gx] = colors[scaled - level > BAYER[bayerRow + (gx & 3)] ? level + 1 : level]
        }
      }
      ctx.putImageData(img, 0, 0)
    }

    const frame = (ts) => {
      raf = requestAnimationFrame(frame)
      if (!visible || document.hidden || ts - last < 33) return
      last = ts
      draw((ts - started) / 1000)
    }

    resize()
    draw(0)
    canvas.dataset.ready = ''
    repaint.current = () => draw((performance.now() - started) / 1000)

    const sizes = new ResizeObserver(() => {
      resize()
      draw((performance.now() - started) / 1000)
    })
    sizes.observe(canvas.parentElement)

    if (calm) return () => sizes.disconnect()

    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    seen.observe(host)

    const move = (event) => {
      const box = canvas.getBoundingClientRect()
      pointer.x = (event.clientX - box.left) / CELL
      pointer.y = (event.clientY - box.top) / CELL
      pointer.target = event.pointerType === 'mouse' ? 1 : 0
    }
    const leave = () => {
      pointer.target = 0
    }
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerleave', leave)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      sizes.disconnect()
      seen.disconnect()
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerleave', leave)
    }
  }, [hostRef, seed])

  return <canvas ref={ref} className="fl-sky-canvas" aria-hidden="true" />
}

const NOTCH_PATH = {
  top: 'M0 0H40V46C18 46 22 0 0 0Z',
  bottom: 'M0 46H40V0C18 0 22 46 0 46Z',
}

export function Notch({ side = 'top', curves = 'both', className = '', children }) {
  const curve = (end) => (
    <svg className={`fl-notch-curve${end ? ' fl-notch-end' : ''}`} viewBox="0 0 40 46" preserveAspectRatio="none" aria-hidden="true">
      <path d={NOTCH_PATH[side]} />
    </svg>
  )
  return (
    <div className={`fl-notch ${className}`} data-side={side}>
      {curves !== 'end' && curve(false)}
      <div className="fl-notch-body">{children}</div>
      {curves !== 'start' && curve(true)}
    </div>
  )
}

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

export function ThemeButton({ theme, onToggle }) {
  const mask = `fl-theme-${useId()}`
  const [flipped, setFlipped] = useState(false)
  const light = theme === 'light'
  const label = light ? 'Switch to dark mode' : 'Switch to light mode'

  const toggle = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    setFlipped(true)
    onToggle?.((apply) => reveal(apply, box.left + box.width / 2, box.top + box.height / 2))
  }

  return (
    <button
      type="button"
      className="fl-theme"
      data-mode={light ? 'light' : 'dark'}
      data-flipped={flipped || undefined}
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <mask id={mask}>
          <rect width="24" height="24" fill="#fff" />
          <circle className="fl-theme-bite" cx="15" cy="9" r="7.5" fill="#000" />
        </mask>
        <g className="fl-theme-tilt">
          <g mask={`url(#${mask})`}>
            <circle className="fl-theme-core" cx="12" cy="12" r="8" fill="currentColor" />
          </g>
          <g className="fl-theme-rays" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {RAY_ANGLES.map((angle, i) => (
              <g key={angle} style={{ rotate: `${angle}deg` }}>
                <path d="M12 4.5V2" style={{ '--i': i }} />
              </g>
            ))}
          </g>
        </g>
      </svg>
    </button>
  )
}

const TRACE_LAP = 18000
const TRACE_BEAMS = 2
const TRACE_BASE = 0.07
const TRACE_PEAK = 0.95
const TRACE_STEP = 2
const TRACE_FRONT = 10

const traceTail = (total) => Math.min(340, Math.max(160, total * 0.075))

function traceOutline(card) {
  const box = card.getBoundingClientRect()
  const w = box.width
  const h = box.height
  const r = Math.min(parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0, w / 2, h / 2)
  const notches = [...card.querySelectorAll(':scope > .fl-notch')].map((el) => {
    const rect = el.getBoundingClientRect()
    return { top: el.dataset.side !== 'bottom', s: rect.left - box.left, e: rect.right - box.left, d: rect.height }
  })

  const pts = [0, r]
  const to = (x, y) => pts.push(x, y)
  const arc = (cx, cy, from) => {
    for (let i = 1; i <= 12; i++) {
      const a = from + (i / 12) * (Math.PI / 2)
      to(cx + r * Math.cos(a), cy + r * Math.sin(a))
    }
  }
  const curve = (x1, y1, x2, y2, x3, y3) => {
    const x0 = pts[pts.length - 2]
    const y0 = pts[pts.length - 1]
    for (let i = 1; i <= 24; i++) {
      const t = i / 24
      const u = 1 - t
      const a = u * u * u
      const b = 3 * u * u * t
      const c = 3 * u * t * t
      const k = t * t * t
      to(a * x0 + b * x1 + c * x2 + k * x3, a * y0 + b * y1 + c * y2 + k * y3)
    }
  }

  arc(r, r, Math.PI)
  for (const { s, e, d } of notches.filter((n) => n.top).sort((a, b) => a.s - b.s)) {
    to(s, 0)
    curve(s + 22, 0, s + 18, d, s + 40, d)
    to(e - 40, d)
    curve(e - 18, d, e - 22, 0, e, 0)
  }
  to(w - r, 0)
  arc(w - r, r, Math.PI * 1.5)
  to(w, h - r)
  arc(w - r, h - r, 0)
  for (const { s, e, d } of notches.filter((n) => !n.top).sort((a, b) => b.s - a.s)) {
    to(e, h)
    curve(e - 22, h, e - 18, h - d, e - 40, h - d)
    to(s + 40, h - d)
    curve(s + 18, h - d, s + 22, h, s, h)
  }
  to(r, h)
  arc(r, h - r, Math.PI / 2)
  to(0, r)
  return pts
}

const TRACE_INK = {
  dark: { color: '#fff', blend: 'lighter' },
  light: { color: '#18181b', blend: 'source-over' },
}

export function HeroTrace({ hostRef, theme }) {
  const ref = useRef(null)
  const ink = useRef(TRACE_INK.dark)
  const repaint = useRef(null)

  useEffect(() => {
    ink.current = TRACE_INK[theme] ?? TRACE_INK.dark
    repaint.current?.()
  }, [theme])

  useEffect(() => {
    const canvas = ref.current
    const card = hostRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !card || !ctx || typeof ResizeObserver === 'undefined') return

    const calm = still()
    const started = performance.now()
    let pts = []
    let cum = new Float64Array(1)
    let total = 0
    let dpr = 1
    let w = 0
    let h = 0
    let raf = 0
    let visible = true

    const at = (s) => {
      const pos = ((s % total) + total) % total
      let lo = 0
      let hi = cum.length - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (cum[mid] <= pos) lo = mid
        else hi = mid
      }
      const k = (pos - cum[lo]) / (cum[hi] - cum[lo] || 1)
      return [pts[lo * 2] + (pts[hi * 2] - pts[lo * 2]) * k, pts[lo * 2 + 1] + (pts[hi * 2 + 1] - pts[lo * 2 + 1]) * k]
    }

    const measure = () => {
      const box = card.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = box.width
      h = box.height
      const cw = Math.round(w * dpr)
      const ch = Math.round(h * dpr)
      if (canvas.width !== cw) canvas.width = cw
      if (canvas.height !== ch) canvas.height = ch
      pts = traceOutline(card)
      cum = new Float64Array(pts.length / 2)
      for (let i = 1; i < cum.length; i++) {
        cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1])
      }
      total = cum[cum.length - 1]
    }

    const paint = (now) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      if (!total) return
      ctx.globalCompositeOperation = ink.current.blend
      ctx.strokeStyle = ink.current.color
      ctx.lineWidth = 2

      ctx.globalAlpha = TRACE_BASE
      ctx.beginPath()
      ctx.moveTo(pts[0], pts[1])
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
      ctx.stroke()
      if (calm) return

      const tail = traceTail(total)
      const steps = Math.ceil(tail / TRACE_STEP)
      const lead = ((now - started) / TRACE_LAP) * total
      for (let beam = 0; beam < TRACE_BEAMS; beam++) {
        const head = lead + (beam * total) / TRACE_BEAMS
        let [px, py] = at(head - tail)
        for (let i = 1; i <= steps; i++) {
          const [x, y] = at(head - tail + (i * tail) / steps)
          const gap = tail - ((i - 0.5) * tail) / steps
          const front = Math.min(1, gap / TRACE_FRONT)
          ctx.globalAlpha = TRACE_PEAK * (1 - gap / tail) ** 2.2 * front * front * (3 - 2 * front)
          ctx.beginPath()
          ctx.moveTo(px, py)
          ctx.lineTo(x, y)
          ctx.stroke()
          px = x
          py = y
        }
      }
    }

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      if (!visible || document.hidden) return
      paint(now)
    }

    measure()
    paint(performance.now())
    repaint.current = () => paint(performance.now())

    const sizes = new ResizeObserver(() => {
      measure()
      paint(performance.now())
    })
    sizes.observe(card)
    for (const notch of card.querySelectorAll(':scope > .fl-notch')) sizes.observe(notch)

    if (calm) return () => sizes.disconnect()

    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    seen.observe(card)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      sizes.disconnect()
      seen.disconnect()
    }
  }, [hostRef])

  return <canvas ref={ref} className="fl-trace" aria-hidden="true" />
}

export function Stop() {
  return <span className="fl-stop">.</span>
}

export function FrameLabel({ children }) {
  return (
    <span className="fl-frame-label">
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M4 1v10M8 1v10M1 4h10M1 8h10" />
      </svg>
      {children}
    </span>
  )
}

export function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || still() || typeof IntersectionObserver === 'undefined') return
    const items = [...root.querySelectorAll('[data-reveal]')]
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.dataset.shown = ''
          io.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    for (const item of items) {
      if (item.getBoundingClientRect().top < window.innerHeight * 0.92) item.dataset.shown = ''
      else io.observe(item)
    }
    root.dataset.reveal = 'on'
    return () => io.disconnect()
  }, [rootRef])
}
