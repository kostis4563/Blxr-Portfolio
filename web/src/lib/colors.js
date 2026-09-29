import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'blxr-colors'
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

const EMPTY = {}
let custom = typeof window === 'undefined' ? EMPTY : read()
const listeners = new Set()

export function applyCustomColors(scheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const c = custom[scheme ?? root.dataset.theme]
  if (c) {
    root.style.setProperty('--custom-bg', c.bg)
    root.style.setProperty('--custom-ink', c.ink)
    root.dataset.customColors = ''
  } else {
    root.style.removeProperty('--custom-bg')
    root.style.removeProperty('--custom-ink')
    delete root.dataset.customColors
  }
}

let fade = 0

export function setCustomColors(scheme, colors, { animate = false } = {}) {
  const def = DEFAULT_COLORS[scheme]
  const next = { ...custom }
  if (!colors || (colors.bg === def.bg && colors.ink === def.ink)) delete next[scheme]
  else next[scheme] = { bg: colors.bg, ink: colors.ink }
  custom = next
  try {
    if (Object.keys(custom).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
  }

  const root = document.documentElement
  if (root.dataset.theme === scheme) {
    if (animate) {
      clearTimeout(fade)
      root.dataset.themeTransition = ''
      fade = setTimeout(() => delete root.dataset.themeTransition, 300)
    }
    applyCustomColors(scheme)
  }
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
