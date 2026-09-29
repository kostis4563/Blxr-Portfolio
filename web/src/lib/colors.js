import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'blxr-colors'
const CSS_KEY = 'blxr-colors-css'
const STYLE_ID = 'custom-colors'
const HEX_RE = /^#[0-9a-f]{6}$/i
const SCHEMES = ['dark', 'light']

export const DEFAULT_COLORS = {
  dark: { bg: '#090909', ink: '#f5f5f5' },
  light: { bg: '#f2f1ee', ink: '#26231f' },
}

export const COLOR_PRESETS = {
  dark: [
    { id: 'default', label: 'Default', ...DEFAULT_COLORS.dark },
    { id: 'midnight', label: 'Midnight', bg: '#0b1020', ink: '#e4e9f5' },
    { id: 'forest', label: 'Forest', bg: '#09130e', ink: '#e1eee6' },
    { id: 'plum', label: 'Plum', bg: '#140c1a', ink: '#eee4f5' },
    { id: 'mocha', label: 'Mocha', bg: '#15100c', ink: '#f0e6da' },
    { id: 'terminal', label: 'Terminal', bg: '#040804', ink: '#7dfc9a' },
  ],
  light: [
    { id: 'default', label: 'Default', ...DEFAULT_COLORS.light },
    { id: 'paper', label: 'Paper', bg: '#f6f1e5', ink: '#2c2416' },
    { id: 'sky', label: 'Sky', bg: '#edf2f9', ink: '#1a2436' },
    { id: 'mint', label: 'Mint', bg: '#ecf5ef', ink: '#16261d' },
    { id: 'blush', label: 'Blush', bg: '#f9eeee', ink: '#2e1a1d' },
    { id: 'snow', label: 'Snow', bg: '#ffffff', ink: '#111111' },
  ],
}

export function normalizeHex(text) {
  const raw = String(text).trim().replace(/^#?/, '#').toLowerCase()
  if (HEX_RE.test(raw)) return raw
  if (/^#[0-9a-f]{3}$/.test(raw)) return `#${[...raw.slice(1)].map((c) => c + c).join('')}`
  return null
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

// :root:root outranks index.css's :root[data-theme] palettes wherever this lands in <head>
function stylesheet(all) {
  const rules = Object.entries(all).map(([scheme, colors]) => {
    const body = Object.entries(tokens(scheme, colors)).map(([name, value]) => `${name}:${value}`).join(';')
    return `:root:root[data-theme="${scheme}"]{${body}}`
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

function read() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    const out = {}
    for (const scheme of SCHEMES) {
      const c = stored?.[scheme]
      if (HEX_RE.test(c?.bg) && HEX_RE.test(c?.ink)) out[scheme] = { bg: c.bg.toLowerCase(), ink: c.ink.toLowerCase() }
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

export function setCustomColors(scheme, colors, { animate = false } = {}) {
  const def = DEFAULT_COLORS[scheme]
  const next = { ...custom }
  if (!colors || (colors.bg === def.bg && colors.ink === def.ink)) delete next[scheme]
  else next[scheme] = { bg: colors.bg, ink: colors.ink }
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

const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useCustomColors() {
  return useSyncExternalStore(subscribe, () => custom, () => EMPTY)
}

export const colorsFor = (all, scheme) => all[scheme] ?? DEFAULT_COLORS[scheme]

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
