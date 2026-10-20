export { FOCUS_VERSION, FOCUS_MIN_MACOS, FOCUS_DOWNLOAD } from './focus-release'

export const ALLOWED_APPS = [
  { id: 'chrome', name: 'Google Chrome', short: 'Chrome', role: 'Browser', icon: '/focus/chrome.webp' },
  { id: 'terminal', name: 'Terminal', short: 'Terminal', role: 'Shell', icon: '/focus/terminal.webp' },
  { id: 'spotify', name: 'Spotify', short: 'Spotify', role: 'Music', icon: '/focus/spotify.webp' },
  { id: 'notion', name: 'Notion', short: 'Notion', role: 'Notes', icon: '/focus/notion.webp' },
  { id: 'teams', name: 'Microsoft Teams', short: 'Teams', role: 'Class', icon: '/focus/teams.webp' },
  { id: 'claude', name: 'Claude', short: 'Claude', role: 'Questions', icon: '/focus/claude.webp' },
]

export const BLOCKED_SITES = ['instagram.com', 'discord.com']

export const APP_ICON = '/focus/focus-lock.webp'
export const DISCORD_ICON = '/focus/discord.webp'

export const DEMO_APPS = [
  ...ALLOWED_APPS,
  { id: 'iterm', name: 'iTerm', short: 'iTerm' },
  { id: 'notion-calendar', name: 'Notion Calendar', short: 'Notion Calendar' },
  { id: 'discord', name: 'Discord', short: 'Discord', icon: DISCORD_ICON },
  { id: 'messages', name: 'Messages', short: 'Messages' },
  { id: 'mail', name: 'Mail', short: 'Mail' },
  { id: 'xcode', name: 'Xcode', short: 'Xcode' },
]

export const appById = (id) => DEMO_APPS.find((app) => app.id === id) ?? { id, name: id, short: id }

export const OPEN_NOW = ['chrome', 'terminal', 'spotify', 'notion', 'discord', 'messages', 'mail', 'xcode']

export const PRESETS = [25, 45, 60, 90, 120]
export const MIN_MINUTES = 1
export const MAX_MINUTES = 600
export const DIAL_MAX = 180
export const DIAL_STEP = 5
export const SAVE_GRACE = 15
export const GRACE_CHOICES = [0, 5, 15, 30, 60]

export const DEFAULT_SETTINGS = {
  rule: 'allow',
  allowed: [...ALLOWED_APPS.map((app) => app.id), 'iterm', 'notion-calendar'],
  blocked: [],
  sites: BLOCKED_SITES,
  grace: SAVE_GRACE,
  chime: true,
  popUp: true,
}

const stringList = (list) => (Array.isArray(list) ? [...new Set(list.filter((item) => typeof item === 'string'))] : null)

export function normalizeSettings(saved) {
  if (!saved || typeof saved !== 'object') return null
  return {
    rule: saved.rule === 'block' ? 'block' : 'allow',
    allowed: stringList(saved.allowed) ?? DEFAULT_SETTINGS.allowed,
    blocked: stringList(saved.blocked) ?? DEFAULT_SETTINGS.blocked,
    sites: stringList(saved.sites) ?? DEFAULT_SETTINGS.sites,
    grace: GRACE_CHOICES.includes(saved.grace) ? saved.grace : DEFAULT_SETTINGS.grace,
    chime: typeof saved.chime === 'boolean' ? saved.chime : DEFAULT_SETTINGS.chime,
    popUp: typeof saved.popUp === 'boolean' ? saved.popUp : DEFAULT_SETTINGS.popUp,
  }
}

export const ruleList = (settings) => (settings.rule === 'allow' ? settings.allowed : settings.blocked)

export const closesApp = (settings, id) =>
  settings.rule === 'allow' ? !settings.allowed.includes(id) : settings.blocked.includes(id)

export const wouldClose = (settings) =>
  OPEN_NOW.filter((id) => closesApp(settings, id))
    .map((id) => appById(id).name)
    .sort()

const ATTEMPTS = [
  ['app', 'discord'],
  ['site', 0],
  ['app', 'messages'],
  ['site', 1],
  ['app', 'xcode'],
  ['site', 2],
  ['app', 'discord'],
]
const ATTEMPT_TIMES = [4, 11, 19, 32, 47, 63, 80]

export function planBlocks(settings) {
  const blocks = []
  for (const [kind, ref] of ATTEMPTS) {
    if (kind === 'site') {
      if (settings.sites[ref]) blocks.push({ name: settings.sites[ref], kind })
    } else if (closesApp(settings, ref)) {
      blocks.push({ name: appById(ref).name, kind })
    }
  }
  return blocks.map((block, i) => ({ ...block, at: ATTEMPT_TIMES[i] }))
}

export function siteHost(input) {
  let text = input.trim().toLowerCase()
  if (!text) return null
  if (!text.includes('://')) text = `https://${text}`
  let host
  try {
    host = new URL(text).hostname
  } catch {
    return null
  }
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.') || !/^[a-z0-9.-]+$/.test(host)) return null
  return host.startsWith('www.') ? host.slice(4) : host
}

export const clampMinutes = (value) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)))

export function clock(seconds) {
  const total = Math.max(0, Math.ceil(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor(total / 60) % 60
  const s = total % 60
  const two = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}

export function listSentence(names) {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function dialMinutes(degrees, current) {
  let value = Math.round((degrees / 360) * (DIAL_MAX / DIAL_STEP)) * DIAL_STEP
  if (current >= DIAL_MAX - 30 && value < 30) value = DIAL_MAX
  if (current <= 30 && value > DIAL_MAX - 30) value = DIAL_STEP
  return Math.min(Math.max(value, DIAL_STEP), DIAL_MAX)
}
