import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'blxr-colors'
const CSS_KEY = 'blxr-colors-css'
const STYLE_ID = 'custom-colors'
const HEX_RE = /^#[0-9a-f]{6}$/
const SCHEMES = ['dark', 'light']
const TEXT_TAGS = 'h1,h2,h3,h4,h5,h6,p,dt,dd,label,blockquote,figcaption'

export const PALETTES = {
  dark: [
    { id: 'default', label: 'Default', bg: '#090909', ink: '#f5f5f5' },
    { id: 'black', label: 'Black', bg: '#000000', ink: '#f5f5f5' },
    { id: 'graphite', label: 'Graphite', bg: '#1a1a1c', ink: '#f4f4f5' },
    { id: 'slate', label: 'Slate', bg: '#0f141c', ink: '#eef1f6' },
    { id: 'stone', label: 'Stone', bg: '#171411', ink: '#f3efe9' },
    { id: 'dusk', label: 'Dusk', bg: '#14121f', ink: '#f0eef6' },
  ],
  light: [
    { id: 'default', label: 'Default', bg: '#f2f1ee', ink: '#26231f' },
    { id: 'white', label: 'White', bg: '#ffffff', ink: '#171717' },
    { id: 'paper', label: 'Paper', bg: '#f7f3ea', ink: '#2b261d' },
    { id: 'mist', label: 'Mist', bg: '#edf0f4', ink: '#1e2430' },
    { id: 'sand', label: 'Sand', bg: '#e9e4da', ink: '#29231b' },
    { id: 'fog', label: 'Fog', bg: '#e4e4e6', ink: '#1d1d20' },
  ],
}

export const TEXT_COLORS = {
  dark: [
    { id: 'ivory', label: 'Ivory', ink: '#efe6d4' },
    { id: 'ice', label: 'Ice', ink: '#d6e2f3' },
    { id: 'lilac', label: 'Lilac', ink: '#dcd4f6' },
    { id: 'rose', label: 'Rose', ink: '#f1d3d6' },
  ],
  light: [
    { id: 'navy', label: 'Navy', ink: '#1c2a4a' },
    { id: 'espresso', label: 'Espresso', ink: '#3b2a1f' },
    { id: 'plum', label: 'Plum', ink: '#3d2248' },
    { id: 'oxblood', label: 'Oxblood', ink: '#4a1d22' },
  ],
}

const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function mix(a, b, t) {
  const [x, y] = [toRgb(a), toRgb(b)]
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

const linear = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

function paletteFor(scheme, bg) {
  const list = PALETTES[scheme]
  if (!bg) return list[0]
  const light = scheme === 'light'
  return list.find((p) => p.bg === bg) ?? { id: 'custom', label: 'Custom', bg, ink: mix(bg, light ? '#000000' : '#ffffff', light ? 0.84 : 0.96) }
}

export function resolveColors(all, scheme) {
  const palette = paletteFor(scheme, all[scheme]?.bg)
  const ink = all[scheme]?.ink
  const text = !ink
    ? { id: 'default', label: 'Default', ink: palette.ink }
    : TEXT_COLORS[scheme].find((t) => t.ink === ink) ?? { id: 'custom', label: 'Custom', ink }
  return { palette, text }
}

function tokens(scheme, { bg, ink }) {
  const tint = (a, b, pct) => `color-mix(in oklab, ${a}, ${b} ${pct}%)`
  const fade = (pct) => `color-mix(in srgb, ${ink} ${pct}%, transparent)`
  const shared = { '--color-bg': bg, '--color-ink': ink, '--color-ink-inverse': bg }
  if (scheme === 'light') {
    return {
      ...shared,
      '--color-surface': tint(bg, '#fff', 85),
      '--color-surface-raised': tint(bg, '#fff', 45),
      '--color-surface-hover': tint(bg, ink, 6),
      '--color-surface-hover-strong': tint(bg, ink, 12),
      '--color-surface-inverted': tint(ink, '#000', 20),
      '--color-ink-on-inverted': bg,
      '--color-line': tint(bg, ink, 13),
      '--color-line-strong': tint(bg, ink, 24),
      '--color-ink-strong': tint(ink, '#000', 25),
      '--color-ink-secondary': tint(ink, bg, 10),
      '--color-ink-muted': tint(ink, bg, 20),
      '--color-ink-subtle': tint(ink, bg, 32),
      '--color-ink-faint': tint(ink, bg, 50),
      '--color-selection': tint(bg, ink, 15),
      '--hairline': fade(10),
      '--hairline-strong': fade(16),
      '--glow-strong': fade(14),
      '--glow-soft': fade(4),
      '--glow-sweep': fade(4),
      '--gh-0': 'var(--color-surface-hover)',
    }
  }
  return {
    ...shared,
    '--color-surface': tint(bg, ink, 2),
    '--color-surface-raised': tint(bg, ink, 4),
    '--color-surface-hover': tint(bg, ink, 7),
    '--color-surface-hover-strong': tint(bg, ink, 11),
    '--color-surface-inverted': 'var(--color-surface)',
    '--color-ink-on-inverted': ink,
    '--color-line': tint(bg, ink, 8),
    '--color-line-strong': tint(bg, ink, 13),
    '--color-ink-strong': tint(ink, '#fff', 25),
    '--color-ink-secondary': tint(ink, bg, 16),
    '--color-ink-muted': tint(ink, bg, 45),
    '--color-ink-subtle': tint(ink, bg, 56),
    '--color-ink-faint': tint(ink, bg, 68),
    '--color-selection': 'var(--color-surface-hover-strong)',
    '--hairline': fade(5),
    '--hairline-strong': fade(10),
    '--glow-strong': fade(40),
    '--glow-soft': fade(8),
    '--glow-sweep': fade(9),
  }
}

function textTokens(scheme, bg, ink) {
  const toward = (pct) => `color-mix(in oklab, ${ink}, ${bg} ${pct}%)`
  const light = scheme === 'light'
  return {
    '--color-ink-strong': ink,
    '--color-ink': ink,
    '--color-ink-secondary': toward(light ? 10 : 16),
    '--color-ink-muted': toward(light ? 20 : 45),
  }
}

const block = (selector, vars) => `${selector}{${Object.entries(vars).map(([name, value]) => `${name}:${value}`).join(';')}}`

// :root:root outranks index.css's :root[data-theme] palettes wherever this lands in <head>
function stylesheet(all) {
  const rules = Object.entries(all).flatMap(([scheme, { bg, ink }]) => {
    const root = `:root:root[data-theme="${scheme}"]`
    const palette = paletteFor(scheme, bg)
    return [
      bg && block(root, tokens(scheme, palette)),
      ink && block(`${root} :is(${TEXT_TAGS})`, textTokens(scheme, palette.bg, ink)),
    ].filter(Boolean)
  })
  return rules.length ? `@media screen{${rules.join('')}}` : ''
}

function applyStylesheet(css) {
  let el = document.getElementById(STYLE_ID)
  if (!css) return el?.remove()
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.append(el)
  }
  el.textContent = css
}

const hex = (value) => (typeof value === 'string' && HEX_RE.test(value.toLowerCase()) ? value.toLowerCase() : undefined)

function read() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    const out = {}
    for (const scheme of SCHEMES) {
      const bg = hex(stored?.[scheme]?.bg)
      const ink = hex(stored?.[scheme]?.ink)
      const entry = {}
      if (bg && bg !== PALETTES[scheme][0].bg) entry.bg = bg
      if (ink) entry.ink = ink
      if (entry.bg || entry.ink) out[scheme] = entry
    }
    return out
  } catch {
    return {}
  }
}

function save() {
  const css = stylesheet(custom)
  try {
    if (css) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
      localStorage.setItem(CSS_KEY, css)
    } else {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(CSS_KEY)
    }
  } catch {
  }
  applyStylesheet(css)
}

const EMPTY = {}
let custom = typeof window === 'undefined' ? EMPTY : read()
const listeners = new Set()

if (typeof window !== 'undefined' && custom !== EMPTY) save()

let fadeTimer = 0

function commit(scheme, entry, animate) {
  const next = { ...custom }
  if (entry.bg || entry.ink) next[scheme] = entry
  else delete next[scheme]
  custom = next

  const root = document.documentElement
  if (animate && root.dataset.theme === scheme) {
    clearTimeout(fadeTimer)
    root.dataset.themeTransition = ''
    fadeTimer = setTimeout(() => delete root.dataset.themeTransition, 300)
  }
  save()
  listeners.forEach((fn) => fn())
}

export function setColor(scheme, key, value, { animate = false } = {}) {
  const entry = { ...custom[scheme] }
  if (value && !(key === 'bg' && value === PALETTES[scheme][0].bg)) entry[key] = value
  else delete entry[key]
  commit(scheme, entry, animate)
}

export const resetColors = (scheme) => commit(scheme, {}, true)

const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useCustomColors() {
  return useSyncExternalStore(subscribe, () => custom, () => EMPTY)
}
