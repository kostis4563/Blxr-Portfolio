import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './icon'

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

// Comet border, from the async landing hero. A bright head with a fading tail
// travels the rounded edge of the card.

const COMET_TAIL = 0.14
const COMET_LOOP = 7600
const COMET_SAMPLES = 150
const COMET_STROKE = 2.4
const COMET_RADIUS = 16

// Maps 0..1 around the loop to a point on the rounded rectangle's edge.
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

// Contour field, from the Amitista Studio backdrop. Marching squares trace
// eleven height levels of a slowly moving sum of sines.

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

// Floating paths and the word loop, together the Fresh Finds hero.

const PATHS_W = 696
const PATHS_H = 316
const DASH = 0.45
const GAP = 0.08

// The hero's mirrored set (position -1 in the original), sweeping in from the top left.
const pathData = (i) =>
  `M-${380 + i * 5} -${189 + i * 6}C-${380 + i * 5} -${189 + i * 6} -${312 + i * 5} ${216 - i * 6} ${152 + i * 5} ${343 - i * 6}` +
  `C${616 + i * 5} ${470 - i * 6} ${684 + i * 5} ${875 - i * 6} ${684 + i * 5} ${875 - i * 6}`

// Canvas dashes are in path units, so each curve's length is needed up front,
// and only SVG can measure that.
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


const OCEAN_VERT = `
  attribute vec3 position;
  uniform mat4 projectionMatrix;
  uniform mat4 viewMatrix;
  uniform vec3 cameraPosition;
  uniform float uTime;
  varying vec3 vPos;
  varying vec3 vNrm;
  varying float vRise;

  const float G = 9.81;
  const float PI2 = 6.28318531;
  const float NW = 6.0;

  void gerstner(vec2 dir, float len, float amp, float steep, vec2 p, float t, inout vec3 disp, inout vec3 nrm) {
    float k = PI2 / len;
    float w = sqrt(G * k);
    float q = steep / (k * max(amp, 1e-4) * NW);
    float ph = k * dot(dir, p) - w * t;
    float c = cos(ph);
    float sn = sin(ph);
    float wa = k * amp;
    disp.xz += q * amp * dir * c;
    disp.y += amp * sn;
    nrm.x -= dir.x * wa * c;
    nrm.z -= dir.y * wa * c;
    nrm.y -= q * wa * sn;
  }

  void main() {
    vec2 p = position.xz;
    float t = uTime * 0.62;
    float near = 1.0 - smoothstep(30.0, 120.0, distance(p, cameraPosition.xz));
    vec3 disp = vec3(0.0);
    vec3 nrm = vec3(0.0, 1.0, 0.0);
    gerstner(vec2( 0.98,  0.20), 145.0, 0.700,        0.30,        p, t, disp, nrm);
    gerstner(vec2(-0.34,  0.94),  79.0, 0.400,        0.30,        p, t, disp, nrm);
    gerstner(vec2( 0.72, -0.69),  43.0, 0.220,        0.35,        p, t, disp, nrm);
    gerstner(vec2( 0.20,  0.98),  24.0, 0.115,        0.40,        p, t, disp, nrm);
    gerstner(vec2(-0.86,  0.51),  13.5, 0.055 * near, 0.45 * near, p, t, disp, nrm);
    gerstner(vec2( 0.55,  0.83),  11.5, 0.028 * near, 0.45 * near, p, t, disp, nrm);
    vNrm = normalize(nrm);
    vRise = disp.y;
    vec4 world = vec4(position + disp, 1.0);
    vPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const OCEAN_FRAG = `
  precision highp float;
  uniform vec3 cameraPosition;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform vec3 uZenith;
  uniform vec3 uGlint;
  uniform vec3 uScatter;
  uniform vec3 uLight;
  varying vec3 vPos;
  varying vec3 vNrm;
  varying float vRise;

  float ggx(float ndh, float rough) {
    float a2 = rough * rough;
    float d = ndh * ndh * (a2 - 1.0) + 1.0;
    return a2 / (3.14159265 * d * d);
  }

  void main() {
    float d = distance(cameraPosition, vPos);
    vec3 V = normalize(cameraPosition - vPos);
    vec2 q = vPos.xz;
    float t = uTime;
    float fine = 1.0 - smoothstep(18.0, 95.0, d);
    float gust = 0.72 + 0.28 * sin(dot(q, vec2(0.31, 0.95)) * 0.090 + t * 0.15) * sin(dot(q, vec2(-0.87, 0.49)) * 0.130 - t * 0.11);
    float amp = fine * gust * 0.090;
    float warp = sin(dot(q, vec2(0.62, 0.78)) * 0.105 + t * 0.21) + sin(dot(q, vec2(-0.79, 0.61)) * 0.077 - t * 0.17);

    vec2 chop = vec2(0.0);
    chop += vec2( 0.90,  0.44) * cos(dot(q, vec2( 0.90,  0.44)) *  3.70 + warp * 1.1 + t * 1.55) * 0.70;
    chop += vec2(-0.48,  0.88) * cos(dot(q, vec2(-0.48,  0.88)) *  5.90 - warp * 0.8 - t * 2.05);
    chop += vec2( 0.74, -0.67) * cos(dot(q, vec2( 0.74, -0.67)) *  8.30 + warp * 1.5 + t * 2.60) * 0.80;
    chop += vec2(-0.96, -0.28) * cos(dot(q, vec2(-0.96, -0.28)) * 13.10 - warp * 1.9 - t * 3.30) * 0.50;
    chop += vec2( 0.31,  0.95) * cos(dot(q, vec2( 0.31,  0.95)) * 19.70 + warp * 2.4 + t * 4.10) * 0.28;

    vec3 N = normalize(normalize(vNrm) + vec3(chop.x, 0.0, chop.y) * amp);
    float ndv = max(dot(N, V), 0.0);
    float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
    vec3 R = reflect(-V, N);
    vec3 sky = mix(uSky, uZenith, clamp(R.y * 2.4, 0.0, 1.0));
    vec3 col = mix(uDeep, sky, fres);
    float rough = mix(0.062, 0.20, 1.0 - fine);
    vec3 H = normalize(uLight + V);
    col += uGlint * ggx(max(dot(N, H), 0.0), rough) * fres * 0.13;
    float through = pow(max(dot(V, -uLight), 0.0), 3.0);
    col += uScatter * through * max(vRise, 0.0) * 0.10;
    float fog = 1.0 - exp(-pow(d * 0.0075, 2.4));
    col = col / (1.0 + col);
    gl_FragColor = vec4(col * (1.0 - fog), 1.0 - fog);
  }
`

const OCEAN_FOV = 45
const OCEAN_HORIZON = 0.36
const OCEAN_CAMERA = [0, 12, 60]
const OCEAN_STEPS = [140, 115]

const OCEAN_COLORS = {
  uDeep: [0.006, 0.016, 0.028],
  uSky: [0.048, 0.092, 0.136],
  uZenith: [0.01, 0.021, 0.038],
  uGlint: [0.62, 0.76, 0.9],
  uScatter: [0.04, 0.13, 0.15],
}

function oceanMesh() {
  const [across, deep] = OCEAN_STEPS
  const cols = across + 1
  const points = new Float32Array(cols * (deep + 1) * 3)
  for (let r = 0; r <= deep; r++) {
    for (let c = 0; c <= across; c++) {
      const i = (r * cols + c) * 3
      points[i] = (c / across - 0.5) * 560
      points[i + 2] = (r / deep - 0.5) * 460 - 120
    }
  }
  const order = new Uint16Array(across * deep * 6)
  for (let r = 0, k = 0; r < deep; r++) {
    for (let c = 0; c < across; c++, k += 6) {
      const a = r * cols + c
      order.set([a, a + cols, a + 1, a + 1, a + cols, a + cols + 1], k)
    }
  }
  return { points, order }
}

function oceanView() {
  const pitch = -Math.atan((0.5 - OCEAN_HORIZON) * 2 * Math.tan((OCEAN_FOV * Math.PI) / 360))
  const c = Math.cos(pitch)
  const s = -Math.sin(pitch)
  const [x, y, z] = OCEAN_CAMERA
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, -x, -(c * y - s * z), -(s * y + c * z), 1])
}

function oceanProjection(aspect, near = 0.5, far = 900) {
  const f = 1 / Math.tan((OCEAN_FOV * Math.PI) / 360)
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0])
}

function shader(gl, type, source) {
  const s = gl.createShader(type)
  gl.shaderSource(s, source)
  gl.compileShader(s)
  return s
}

function startOcean(canvas) {
  const box = canvas.parentElement
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true })
  if (!gl) return () => {}

  const vert = shader(gl, gl.VERTEX_SHADER, OCEAN_VERT)
  const frag = shader(gl, gl.FRAGMENT_SHADER, OCEAN_FRAG)
  const program = gl.createProgram()
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  const { points, order } = oceanMesh()
  const pointBuffer = gl.createBuffer()
  const orderBuffer = gl.createBuffer()
  const release = () => {
    gl.deleteBuffer(pointBuffer)
    gl.deleteBuffer(orderBuffer)
    gl.deleteProgram(program)
    gl.deleteShader(vert)
    gl.deleteShader(frag)
  }
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    release()
    return () => {}
  }
  gl.useProgram(program)

  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, orderBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, order, gl.STATIC_DRAW)

  const uniform = (name) => gl.getUniformLocation(program, name)
  gl.uniformMatrix4fv(uniform('viewMatrix'), false, oceanView())
  gl.uniform3fv(uniform('cameraPosition'), OCEAN_CAMERA)
  for (const [name, rgb] of Object.entries(OCEAN_COLORS)) gl.uniform3fv(uniform(name), rgb)
  const uTime = uniform('uTime')
  const uLight = uniform('uLight')
  const uProjection = uniform('projectionMatrix')

  gl.enable(gl.BLEND)
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.clearColor(0, 0, 0, 0)

  const still = stillMotion()
  let sun = 0
  let sunAt = 0
  let raf = 0
  let seen = false

  const draw = (ms) => {
    sunAt += (sun - sunAt) * 0.06
    const length = Math.hypot(sunAt, 0.3, 1)
    gl.uniform3f(uLight, sunAt / length, 0.3 / length, -1 / length)
    gl.uniform1f(uTime, still ? 0 : ms / 1000)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawElements(gl.TRIANGLES, order.length, gl.UNSIGNED_SHORT, 0)
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
    const { width, height } = box.getBoundingClientRect()
    if (!width || !height) return
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniformMatrix4fv(uProjection, false, oceanProjection(width / height))
    draw(performance.now())
  }
  const aim = (e) => {
    const rect = box.getBoundingClientRect()
    sun = ((e.clientX - rect.left) / rect.width - 0.5) * 1.6
    if (still) {
      sunAt = sun
      draw(0)
    }
  }
  const drop = () => {
    sun = 0
    if (still) {
      sunAt = 0
      draw(0)
    }
  }

  const sizes = new ResizeObserver(fit)
  const view = new IntersectionObserver(([entry]) => {
    seen = entry.isIntersecting
    sync()
  })
  sizes.observe(box)
  view.observe(canvas)
  box.addEventListener('pointermove', aim)
  box.addEventListener('pointerleave', drop)
  document.addEventListener('visibilitychange', sync)

  return () => {
    cancelAnimationFrame(raf)
    sizes.disconnect()
    view.disconnect()
    box.removeEventListener('pointermove', aim)
    box.removeEventListener('pointerleave', drop)
    document.removeEventListener('visibilitychange', sync)
    release()
  }
}

export function Ocean() {
  const ref = useRef(null)
  useEffect(() => startOcean(ref.current), [])
  return (
    <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,#0b1724,#02060b_70%)]">
      <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />
    </span>
  )
}
