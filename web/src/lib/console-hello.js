import { reducedMotion } from './memes'

const LOGO = [
  '██████╗ ██╗     ██╗  ██╗██████╗ ',
  '██╔══██╗██║     ╚██╗██╔╝██╔══██╗',
  '██████╔╝██║      ╚███╔╝ ██████╔╝',
  '██╔══██╗██║      ██╔██╗ ██╔══██╗',
  '██████╔╝███████╗██╔╝ ██╗██║  ██║',
  '╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝',
]

const TAG_STYLE = 'color:#888;font-family:monospace'
const LABEL_STYLE = 'color:#6366f1;font-family:monospace;font-weight:700'
const VALUE_STYLE = 'color:inherit;font-family:monospace'
const HINT_STYLE = 'color:#888;font-family:monospace'
const COMMAND_STYLE = 'background:#f5d90a;color:#111;font-family:monospace;font-weight:800;padding:1px 4px;border-radius:3px'

const LABEL_WIDTH = 10
const IP_TIMEOUT_MS = 3000

const CELL_W = 8
const CELL_H = 15
const PAD_X = 14
const PAD_Y = 14
const RAIL = 2
const COLS = Math.max(...LOGO.map((row) => row.length))
const WIDTH = COLS * CELL_W + PAD_X * 2
const HEIGHT = LOGO.length * CELL_H + PAD_Y * 2
const LEFT_COLOR = [167, 139, 250]
const RIGHT_COLOR = [99, 102, 241]
const CREST = '#e879f9'
const SHADOW = '#7c3aed'
const SWEEP_S = 3.2
const COLUMN_LAG_S = 0.035

const CORNERS = { '╗': [-1, 1], '╔': [1, 1], '╝': [-1, -1], '╚': [1, -1] }

const SPARKLES = [
  [0.035, 0.1, 4.5, CREST, 0],
  [0.965, 0.13, 5, '#a78bfa', 1.1],
  [0.46, 0.06, 3.5, '#a78bfa', 2.2],
  [0.975, 0.9, 3.5, CREST, 0.6],
  [0.025, 0.8, 3, '#a78bfa', 1.7],
  [0.72, 0.95, 4, CREST, 2.6],
  [0.26, 0.95, 3, '#a78bfa', 0.3],
  [0.6, 0.07, 3, CREST, 1.4],
]
const SPARKLE = 'M0-1L.22-.22 1 0 .22.22 0 1-.22.22-1 0-.22-.22Z'

const EMBERS = [
  [0.1, 1.2, '#a78bfa', 4.2, 0],
  [0.24, 1, CREST, 3.6, 1.8],
  [0.37, 1.4, '#a78bfa', 4.8, 0.9],
  [0.51, 1, CREST, 3.9, 2.9],
  [0.625, 1.2, '#a78bfa', 4.4, 0.4],
  [0.76, 1, CREST, 3.7, 2.2],
  [0.88, 1.3, '#a78bfa', 4.6, 1.3],
  [0.95, 1, CREST, 4, 3.3],
]

const BANNER_CSS =
  '.c{animation:sweep ' + SWEEP_S + 's ease-in-out infinite}' +
  '@keyframes sweep{0%,24%,100%{transform:translateY(0);fill:var(--c)}12%{transform:translateY(-3px);fill:' + CREST + '}}' +
  '.s{transform:scale(0);animation:twinkle 3s ease-in-out infinite}' +
  '@keyframes twinkle{0%,100%{transform:scale(0) rotate(0);opacity:0}50%{transform:scale(1) rotate(90deg);opacity:1}}' +
  '.e{opacity:0;animation:rise 4s linear infinite}' +
  `@keyframes rise{0%{transform:translateY(0);opacity:0}15%{opacity:.9}100%{transform:translateY(-${Math.round(HEIGHT * 0.55)}px);opacity:0}}` +
  '@media (prefers-reduced-motion:reduce){.c,.s,.e{animation:none}}'

const mix = (from, to, t) => `rgb(${from.map((channel, i) => Math.round(channel + (to[i] - channel) * t)).join(',')})`

function rails(char, x, y) {
  const cx = x + CELL_W / 2
  const cy = y + CELL_H / 2
  if (char === '═') return `M${x} ${cy - RAIL}h${CELL_W}M${x} ${cy + RAIL}h${CELL_W}`
  if (char === '║') return `M${cx - RAIL} ${y}v${CELL_H}M${cx + RAIL} ${y}v${CELL_H}`
  const corner = CORNERS[char]
  if (!corner) return ''
  const [h, v] = corner
  const edgeX = h < 0 ? x : x + CELL_W
  const edgeY = v < 0 ? y : y + CELL_H
  return (
    `M${edgeX} ${cy - v * RAIL}H${cx - h * RAIL}V${edgeY}` +
    `M${edgeX} ${cy + v * RAIL}H${cx + h * RAIL}V${edgeY}`
  )
}

function banner(animate) {
  let logo = ''
  for (let c = 0; c < COLS; c++) {
    const x = PAD_X + c * CELL_W
    let blocks = ''
    let lines = ''
    for (let r = 0; r < LOGO.length; r++) {
      const y = PAD_Y + r * CELL_H
      if (LOGO[r][c] !== '█') {
        lines += rails(LOGO[r][c], x, y)
        continue
      }
      let run = 1
      while (LOGO[r + run]?.[c] === '█') run++
      blocks += `<rect x="${x}" y="${y}" width="${CELL_W}" height="${run * CELL_H}" stroke="none"/>`
      r += run - 1
    }
    if (!blocks && !lines) continue
    const color = mix(LEFT_COLOR, RIGHT_COLOR, c / (COLS - 1))
    const delay = (c * COLUMN_LAG_S - SWEEP_S).toFixed(3)
    logo +=
      `<g class="c" fill="${color}" style="--c:${color};animation-delay:${delay}s">` +
      `${blocks}${lines && `<path d="${lines}" fill="none"/>`}</g>`
  }

  let extras = ''
  if (animate) {
    for (const [x, y, size, color, delay] of SPARKLES) {
      extras +=
        `<g transform="translate(${Math.round(x * WIDTH)} ${Math.round(y * HEIGHT)}) scale(${size})">` +
        `<path class="s" d="${SPARKLE}" fill="${color}" style="animation-delay:-${delay}s"/></g>`
    }
    for (const [x, r, color, seconds, delay] of EMBERS) {
      extras +=
        `<circle class="e" cx="${Math.round(x * WIDTH)}" cy="${HEIGHT - 8}" r="${r}" fill="${color}" ` +
        `style="animation-duration:${seconds}s;animation-delay:-${delay}s"/>`
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    (animate ? `<style>${BANNER_CSS}</style>` : '') +
    '<defs><filter id="glow" x="-10%" y="-20%" width="120%" height="140%">' +
    '<feGaussianBlur stdDeviation="2.5" result="blur"/>' +
    '<feColorMatrix in="blur" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .55 0" result="halo"/>' +
    '<feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
    `${extras}<g filter="url(#glow)" stroke="${SHADOW}" stroke-width="1.3">${logo}</g></svg>`
  )
}

function bannerStyle(svg) {
  return (
    `font-size:${HEIGHT}px;line-height:${HEIGHT}px;padding:0 ${WIDTH / 2}px;color:transparent;` +
    `background:url("data:image/svg+xml;base64,${btoa(svg)}") center / ${WIDTH}px ${HEIGHT}px no-repeat`
  )
}

function windowsName(version) {
  const major = Number.parseInt(version, 10)
  return major >= 13 ? 'Windows 11' : 'Windows 10'
}

function osFromUa(ua) {
  let m
  if ((m = /iPhone OS ([\d_]+)/.exec(ua))) return `iOS ${m[1].replace(/_/g, '.')}`
  if ((m = /CPU OS ([\d_]+)/.exec(ua))) return `iPadOS ${m[1].replace(/_/g, '.')}`
  if (/Macintosh/.test(ua)) return navigator.maxTouchPoints > 1 ? 'iPadOS' : 'macOS'
  if ((m = /Android ([\d.]+)/.exec(ua))) return `Android ${m[1]}`
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11'
  if (/Windows/.test(ua)) return 'Windows'
  if (/CrOS/.test(ua)) return 'ChromeOS'
  if (/Linux/.test(ua)) return 'Linux'
  return null
}

function browserFromUa(ua) {
  const rules = [
    ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
    ['Opera', /OPR\/(\d+)/],
    ['Samsung Internet', /SamsungBrowser\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ]
  for (const [name, re] of rules) {
    const m = re.exec(ua)
    if (m) return `${name} ${m[1]}`
  }
  return null
}

async function system() {
  const ua = navigator.userAgent
  const fallback = { os: osFromUa(ua), browser: browserFromUa(ua), arch: null, model: null }
  const uad = navigator.userAgentData
  if (!uad?.getHighEntropyValues) return fallback
  try {
    const v = await uad.getHighEntropyValues(['platformVersion', 'fullVersionList', 'architecture', 'bitness', 'model'])
    const brand = (v.fullVersionList || uad.brands || []).find((b) => !/not.?a.?brand|chromium/i.test(b.brand)) ||
      (v.fullVersionList || uad.brands || []).find((b) => /chromium/i.test(b.brand))
    const os = v.platform === 'Windows'
      ? windowsName(v.platformVersion)
      : [v.platform === 'macOS' ? 'macOS' : v.platform, v.platformVersion?.replace(/(\.0)+$/, '')].filter(Boolean).join(' ')
    return {
      os: os || fallback.os,
      browser: brand ? `${brand.brand} ${brand.version.split('.')[0]}` : fallback.browser,
      arch: v.architecture ? `${v.architecture}${v.bitness ? ` ${v.bitness}-bit` : ''}` : null,
      model: v.model || null,
    }
  } catch {
    return fallback
  }
}

async function ipAddress() {
  try {
    const res = await fetch('/api/ip', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      priority: 'low',
      signal: AbortSignal.timeout?.(IP_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const { ip, country } = await res.json()
    if (typeof ip !== 'string' || !ip) return null
    return country ? `${ip} (${country})` : ip
  } catch {
    return null
  }
}

function cleanGpu(name) {
  return String(name)
    .replace(/^ANGLE \((?:[^,]+), (.+?)(?:, [^,]+)?\)$/, '$1')
    .replace(/ANGLE Metal Renderer: /, '')
    .replace(/\s*\(0x[0-9a-f]+\)/i, '')
    .replace(/\s+(Direct3D|OpenGL|vs_\d).*$/i, '')
    .trim()
}

function gpu() {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    if (!gl) return null
    let name = gl.getParameter(gl.RENDERER)
    if (!name || /^WebKit WebGL$/i.test(name)) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) name = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return name ? cleanGpu(name) : null
  } catch {
    return null
  }
}

async function battery() {
  try {
    const b = await navigator.getBattery?.()
    if (!b) return null
    return `${Math.round(b.level * 100)}%${b.charging ? ', charging' : ''}`
  } catch {
    return null
  }
}

function network() {
  const c = navigator.connection
  if (!c) return navigator.onLine === false ? 'offline' : null
  const parts = []
  if (c.effectiveType) parts.push(c.effectiveType)
  if (c.downlink) parts.push(`~${c.downlink} Mbps`)
  if (Number.isFinite(c.rtt)) parts.push(`${c.rtt} ms rtt`)
  if (c.saveData) parts.push('data saver')
  return parts.join(' · ') || null
}

function hardware() {
  const parts = []
  if (navigator.hardwareConcurrency) parts.push(`${navigator.hardwareConcurrency} cores`)
  if (navigator.deviceMemory) parts.push(`${navigator.deviceMemory >= 8 ? '8+' : navigator.deviceMemory} GB RAM`)
  return parts.join(' · ') || null
}

function screenInfo() {
  const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100
  const touch = navigator.maxTouchPoints > 0 ? ' · touch' : ''
  return `${screen.width}×${screen.height} @${dpr}x · viewport ${window.innerWidth}×${window.innerHeight}${touch}`
}

function locale() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return [navigator.language, zone, time].filter(Boolean).join(' · ')
}

function prefs() {
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return `${dark ? 'dark' : 'light'} scheme${reduced ? ' · reduced motion' : ''}`
}

async function collect() {
  const [sys, ip, power] = await Promise.all([system(), ipAddress(), battery()])
  return [
    ['ip', ip ?? 'unavailable'],
    ['os', [sys.os, sys.arch].filter(Boolean).join(' · ') || null],
    ['device', sys.model],
    ['browser', sys.browser],
    ['screen', screenInfo()],
    ['cpu', hardware()],
    ['gpu', gpu()],
    ['network', network()],
    ['battery', power],
    ['locale', locale()],
    ['prefs', prefs()],
  ].filter(([, value]) => value)
}

function print(rows) {
  if (import.meta.env.PROD) console.clear()
  console.log("%c​%c\n  blxr.net here's what your browser told me", bannerStyle(banner(!reducedMotion())), TAG_STYLE)
  let format = ''
  const args = []
  for (const [label, value] of rows) {
    format += `%c  ${label.padEnd(LABEL_WIDTH)}%c%s\n`
    args.push(LABEL_STYLE, VALUE_STYLE, value)
  }
  console.log(format.trimEnd(), ...args)
  console.log('%c  psst, type %c secrets %c for everything hidden on this site and how to set it off', HINT_STYLE, COMMAND_STYLE, HINT_STYLE)
}

export function consoleHello() {
  if (typeof window === 'undefined') return
  const run = () => collect().then(print).catch(() => {})
  const idle = () => (window.requestIdleCallback ? window.requestIdleCallback(run, { timeout: 3000 }) : setTimeout(run, 200))
  if (document.readyState === 'complete') idle()
  else window.addEventListener('load', idle, { once: true })
}
