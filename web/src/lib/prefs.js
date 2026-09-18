import { useSyncExternalStore } from 'react'

// Two kinds of settings. Device prefs live in localStorage and follow the
// browser (density, motion, analytics). Account prefs ride in Supabase
// `user_metadata.prefs` so they follow the user across devices.

// --- device -----------------------------------------------------------------

const DEVICE_KEY = 'blxr:prefs'

export const DEVICE_DEFAULTS = {
  density: 'comfortable', // comfortable | compact
  reduceMotion: false,
  analytics: true,
}

function readDevice() {
  try {
    const raw = localStorage.getItem(DEVICE_KEY)
    return raw ? { ...DEVICE_DEFAULTS, ...JSON.parse(raw) } : DEVICE_DEFAULTS
  } catch {
    return DEVICE_DEFAULTS
  }
}

let device = typeof window === 'undefined' ? DEVICE_DEFAULTS : readDevice()
const listeners = new Set()

export function setDevicePref(key, value) {
  device = { ...device, [key]: value }
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(device))
  } catch {
    // private mode
  }
  applyDevicePrefs()
  listeners.forEach((fn) => fn())
}

// Root attributes the stylesheet keys off (`[data-motion="reduced"]`).
export function applyDevicePrefs() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (device.reduceMotion) root.dataset.motion = 'reduced'
  else delete root.dataset.motion
  root.dataset.density = device.density
}

const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useDevicePrefs() {
  return useSyncExternalStore(subscribe, () => device, () => DEVICE_DEFAULTS)
}

// Synchronous check for the beacon senders.
export const analyticsAllowed = () => (typeof window === 'undefined' ? true : readDevice().analytics !== false)

// --- account ----------------------------------------------------------------

export const ACCOUNT_DEFAULTS = {
  locale: {
    timezone: 'auto',
    dateFormat: 'mdy', // mdy | dmy | ymd
    timeFormat: 'auto', // auto | 12 | 24
    weekStart: 'monday', // monday | sunday
  },
  notifications: {
    productUpdates: true,
    reviewActivity: true,
    mentions: true,
    digest: 'weekly', // daily | weekly | monthly | never
    desktop: false,
    sound: true,
    badge: true,
    quietHours: false,
    quietFrom: '22:00',
    quietTo: '08:00',
  },
  security: {
    loginAlerts: true,
  },
}

// Deep-merge one level so a new default key shows up for existing users.
export function mergeAccountPrefs(stored) {
  const out = {}
  for (const group of Object.keys(ACCOUNT_DEFAULTS)) {
    out[group] = { ...ACCOUNT_DEFAULTS[group], ...(stored && typeof stored[group] === 'object' ? stored[group] : null) }
  }
  return out
}

export const DATE_FORMATS = [
  { value: 'mdy', label: 'Sep 15, 2026' },
  { value: 'dmy', label: '15 Sep 2026' },
  { value: 'ymd', label: '2026-09-15' },
]

export function timeZones() {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['UTC']
  }
}

export function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// Formats a date the way the account prefs ask for.
export function formatDate(value, locale) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const tz = locale.timezone === 'auto' ? undefined : locale.timezone
  const hour12 = locale.timeFormat === 'auto' ? undefined : locale.timeFormat === '12'
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12, timeZone: tz }).format(date)
  const numeric = locale.dateFormat === 'ymd'
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric', month: numeric ? '2-digit' : 'short', day: numeric ? '2-digit' : 'numeric', timeZone: tz,
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value || ''
  const y = get('year')
  const m = get('month')
  const d = get('day')
  const day = numeric ? `${y}-${m}-${d}` : locale.dateFormat === 'dmy' ? `${d} ${m} ${y}` : `${m} ${d}, ${y}`
  return `${day} · ${time}`
}
