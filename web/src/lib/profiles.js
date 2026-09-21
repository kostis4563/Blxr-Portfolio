import { supabase } from './supabase'
import { AuthError } from './auth'
import { profilePath } from './router'
import { SITE_URL } from './seo'

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/
export const RESERVED_HANDLES = new Set([
  'admin', 'administrator', 'api', 'blxr', 'dashboard', 'help', 'login', 'me', 'mod',
  'moderator', 'null', 'owner', 'profile', 'root', 'settings', 'staff', 'support', 'system',
  'undefined', 'www',
])

export const LIMITS = {
  name: 40,
  handle: 20,
  headline: 80,
  bio: 500,
  pronouns: 24,
  location: 64,
  website: 200,
  links: 6,
  linkLabel: 24,
  skills: 12,
  skill: 24,
  status: 60,
  now: 240,
  showcase: 4,
  showcaseTitle: 40,
  showcaseDescription: 120,
  tag: 4,
}

export const VISIBILITY = [
  { value: 'public', label: 'Public', description: 'Anyone can find and open it.' },
  { value: 'unlisted', label: 'Unlisted', description: 'Only people with the link.' },
  { value: 'private', label: 'Private', description: 'Only you. Nothing is shown.' },
]

export const ACCENTS = [
  { id: 'ink', label: 'Mono', from: 'var(--color-ink-subtle)', to: 'var(--color-ink-strong)', swatch: 'var(--color-ink-strong)' },
  { id: 'violet', label: 'Violet', from: '#a78bfa', to: '#6d28d9', swatch: '#8b5cf6' },
  { id: 'blue', label: 'Blue', from: '#60a5fa', to: '#1d4ed8', swatch: '#3b82f6' },
  { id: 'teal', label: 'Teal', from: '#2dd4bf', to: '#0f766e', swatch: '#14b8a6' },
  { id: 'green', label: 'Green', from: '#4ade80', to: '#15803d', swatch: '#22c55e' },
  { id: 'amber', label: 'Amber', from: '#fbbf24', to: '#b45309', swatch: '#f59e0b' },
  { id: 'rose', label: 'Rose', from: '#fb7185', to: '#be123c', swatch: '#f43f5e' },
]
export const HEX_RE = /^#[0-9a-f]{6}$/
const CUSTOM_ACCENT_HEX = '#5865f2'

export function accentOf(source) {
  const id = typeof source === 'string' ? source : source?.accent
  if (id === 'custom') {
    const hex = typeof source === 'object' && HEX_RE.test(source?.accentHex || '') ? source.accentHex : CUSTOM_ACCENT_HEX
    return { id: 'custom', label: 'Custom', from: shadeHex(hex, 0.22), to: shadeHex(hex, -0.28), swatch: hex }
  }
  return ACCENTS.find((a) => a.id === id) || ACCENTS[0]
}

export function shadeHex(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c) => Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount))
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export const DECORATIONS = [
  { id: 'none', label: 'None', description: 'Just the photo.' },
  { id: 'ring', label: 'Ring', description: 'A thin ring in the accent colour.' },
  { id: 'glow', label: 'Glow', description: 'A soft accent glow behind it.' },
  { id: 'halo', label: 'Halo', description: 'A slowly turning gradient.' },
  { id: 'image', label: 'Discord', description: 'The decoration on your Discord account.' },
]

export const NAMEPLATES = [
  { id: 'none', label: 'None' },
  { id: 'accent', label: 'Accent' },
  { id: 'image', label: 'Discord' },
]
export const NAMEPLATE_PALETTES = {
  crimson: '#d12a3a', berry: '#b83280', sky: '#38bdf8', teal: '#14b8a6', forest: '#16a34a', bubble_gum: '#f472b6',
  violet: '#8b5cf6', cobalt: '#3b82f6', clover: '#22c55e', lemon: '#eab308', white: '#e5e7eb', none: '#94a3b8',
}
export const paletteColor = (name) => NAMEPLATE_PALETTES[name] || NAMEPLATE_PALETTES.none
const DISCORD_CDN = 'https://cdn.discordapp.com'
export const nameplateImage = (asset) => (asset ? `${DISCORD_CDN}/assets/collectibles/${asset}static.png` : null)
export const nameplateVideo = (asset) => (asset ? `${DISCORD_CDN}/assets/collectibles/${asset}asset.webm` : null)
export const DISCORD_ID_RE = /^\d{17,20}$/
const DECORATION_URL_RE = /^https:\/\/cdn\.discordapp\.com\/avatar-decoration-presets\/[A-Za-z0-9_./-]+\.png(\?[A-Za-z0-9_=&]*)?$/
const TAG_BADGE_URL_RE = /^https:\/\/cdn\.discordapp\.com\/guild-tag-badges\/\d{17,20}\/[a-f0-9]{32}\.png(\?[A-Za-z0-9_=&]*)?$/
const NAMEPLATE_ASSET_RE = /^nameplates\/[A-Za-z0-9_./-]{1,120}$/

export const LAYOUTS = [
  { id: 'card', label: 'Card', description: 'Banner and details in one card.' },
  { id: 'cover', label: 'Cover', description: 'Edge-to-edge banner, details below.' },
  { id: 'minimal', label: 'Minimal', description: 'No banner. Centered and quiet.' },
]
export const PATTERNS = [
  { id: 'dots', label: 'Dots' },
  { id: 'grid', label: 'Grid' },
  { id: 'none', label: 'Plain' },
]
export const AVATAR_SHAPES = [
  { id: 'circle', label: 'Circle' },
  { id: 'rounded', label: 'Rounded' },
]
export const PAGE_THEMES = [
  { id: 'system', label: 'Visitor’s', icon: 'monitor' },
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
]

export const SECTIONS = [
  { id: 'about', label: 'About', description: 'Bio, location, website.' },
  { id: 'now', label: 'Now', description: 'What you are up to at the moment.' },
  { id: 'showcase', label: 'Showcase', description: 'Up to four things you made.' },
  { id: 'links', label: 'Links', description: 'Where to find you.' },
  { id: 'skills', label: 'Skills', description: 'Tags.' },
]
export const DEFAULT_SECTIONS = SECTIONS.map((s) => s.id)

export const EMPTY_PROFILE = {
  handle: '',
  name: '',
  headline: '',
  bio: '',
  pronouns: '',
  location: '',
  website: '',
  avatar: null,
  accent: 'ink',
  openToWork: false,
  links: [],
  skills: [],
  status: '',
  now: '',
  showcase: [],
  cover: null,
  layout: 'card',
  pattern: 'dots',
  avatarShape: 'circle',
  theme: 'system',
  sections: DEFAULT_SECTIONS,
  visibility: 'private',
  discordId: null,
  decoration: 'none',
  decorationUrl: null,
  nameplate: 'none',
  nameplateAsset: null,
  nameplatePalette: null,
  tagText: '',
  tagBadgeUrl: null,
  accentHex: null,
}

export const profileUrl = (handle) => `${SITE_URL}${profilePath(handle)}`

export function draftFromUser(user) {
  const meta = user?.user_metadata || {}
  const email = user?.email || ''
  const name = meta.name || meta.full_name || meta.user_name || meta.preferred_username || email.split('@')[0] || ''
  return {
    ...EMPTY_PROFILE,
    name: name.slice(0, LIMITS.name),
    handle: suggestHandle(meta.user_name || meta.preferred_username || name || email.split('@')[0]),
    bio: (meta.bio || '').slice(0, LIMITS.bio),
    website: meta.website || '',
    location: meta.location || '',
    avatar: meta.avatar_url || meta.picture || null,
  }
}

export function suggestHandle(source) {
  const base = String(source || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, LIMITS.handle)
  return base.length >= 3 && !RESERVED_HANDLES.has(base) ? base : ''
}

export const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\/[^\s<>"'`]+$/i.test(value)

export function normalizeUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(withScheme)
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export function handleProblem(handle) {
  if (!handle) return 'Pick a handle.'
  if (handle.length < 3) return 'At least 3 characters.'
  if (!HANDLE_RE.test(handle)) return 'Lowercase letters, numbers and underscores only.'
  if (RESERVED_HANDLES.has(handle)) return 'That one is reserved.'
  return null
}

export function fromRow(row) {
  if (!row) return null
  return {
    ownerId: row.id,
    handle: row.handle,
    name: row.display_name,
    headline: row.headline || '',
    bio: row.bio || '',
    pronouns: row.pronouns || '',
    location: row.location || '',
    website: isHttpUrl(row.website) ? row.website : '',
    avatar: row.avatar_url || null,
    accent: row.accent === 'custom' && HEX_RE.test(row.accent_hex || '') ? 'custom' : ACCENTS.some((a) => a.id === row.accent) ? row.accent : 'ink',
    accentHex: HEX_RE.test(row.accent_hex || '') ? row.accent_hex : null,
    openToWork: Boolean(row.open_to_work),
    links: Array.isArray(row.links) ? row.links.filter((l) => l && isHttpUrl(l.url)) : [],
    skills: Array.isArray(row.skills) ? row.skills : [],
    status: row.status || '',
    now: row.now_text || '',
    showcase: Array.isArray(row.showcase)
      ? row.showcase.filter((s) => s && typeof s.title === 'string').map((s) => ({ ...s, url: isHttpUrl(s.url) ? s.url : '' }))
      : [],
    cover: row.cover_url || null,
    layout: LAYOUTS.some((l) => l.id === row.layout) ? row.layout : 'card',
    pattern: PATTERNS.some((p) => p.id === row.pattern) ? row.pattern : 'dots',
    avatarShape: row.avatar_shape === 'rounded' ? 'rounded' : 'circle',
    theme: PAGE_THEMES.some((t) => t.id === row.theme) ? row.theme : 'system',
    sections: Array.isArray(row.sections) ? row.sections.filter((id) => DEFAULT_SECTIONS.includes(id)) : DEFAULT_SECTIONS,
    visibility: row.visibility || 'private',
    discordId: DISCORD_ID_RE.test(row.discord_id || '') ? row.discord_id : null,
    decoration: DECORATIONS.some((d) => d.id === row.decoration) ? row.decoration : 'none',
    decorationUrl: DECORATION_URL_RE.test(row.decoration_url || '') ? row.decoration_url : null,
    nameplate: NAMEPLATES.some((n) => n.id === row.nameplate) ? row.nameplate : 'none',
    nameplateAsset: NAMEPLATE_ASSET_RE.test(row.nameplate_asset || '') ? row.nameplate_asset : null,
    nameplatePalette: /^[a-z_]{1,24}$/.test(row.nameplate_palette || '') ? row.nameplate_palette : null,
    tagText: typeof row.tag_text === 'string' ? row.tag_text.slice(0, LIMITS.tag) : '',
    tagBadgeUrl: TAG_BADGE_URL_RE.test(row.tag_badge_url || '') ? row.tag_badge_url : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toRow(id, p) {
  return {
    id,
    handle: p.handle,
    display_name: p.name,
    headline: p.headline,
    bio: p.bio,
    pronouns: p.pronouns,
    location: p.location,
    website: p.website,
    avatar_url: p.avatar,
    accent: p.accent,
    open_to_work: p.openToWork,
    links: p.links,
    skills: p.skills,
    status: p.status,
    now_text: p.now,
    showcase: p.showcase,
    cover_url: p.cover,
    layout: p.layout,
    pattern: p.pattern,
    avatar_shape: p.avatarShape,
    theme: p.theme,
    sections: p.sections,
    visibility: p.visibility,
    discord_id: p.discordId || null,
    decoration: p.decoration === 'image' && !p.decorationUrl ? 'none' : p.decoration,
    decoration_url: p.decorationUrl || null,
    nameplate: p.nameplate === 'image' && !p.nameplateAsset ? 'none' : p.nameplate,
    nameplate_asset: p.nameplateAsset || null,
    nameplate_palette: p.nameplatePalette || null,
    tag_text: p.tagText || '',
    tag_badge_url: p.tagBadgeUrl || null,
    accent_hex: p.accent === 'custom' ? p.accentHex : null,
  }
}

function wrap(error) {
  if (!error) return null
  const msg = String(error.message || '').toLowerCase()
  let code = 'failed'
  if (error.code === '23505') code = 'handle_taken'
  else if (error.code === '42P01' || error.code === 'PGRST205' || msg.includes('relation "public.profiles"')) code = 'profiles_not_set_up'
  else if (error.code === 'PGRST204' || error.code === '42703') code = 'profiles_outdated'
  else if (error.code === '42501' || error.code === 'PGRST301' || error.status === 401 || error.status === 403) code = 'forbidden'
  else if (error.code === '23514' || error.code === '22P02') code = 'invalid'
  else if (msg.includes('bucket not found') || (msg.includes('bucket') && msg.includes('not'))) code = 'uploads_disabled'
  else if (msg.includes('payload too large') || msg.includes('exceeded the maximum allowed size')) code = 'too_large'
  else if (msg.includes('mime type') || msg.includes('not supported')) code = 'bad_image'
  else if (msg.includes('failed to fetch') || msg.includes('network')) code = 'offline'
  return new AuthError(code, { status: error.status || 0 })
}

function client() {
  const sb = supabase()
  if (!sb) throw new AuthError('not_configured')
  return sb
}

async function run(fn) {
  const sb = client()
  let result
  try {
    result = await fn(sb)
  } catch (err) {
    throw wrap(err) || new AuthError('failed')
  }
  if (result?.error) throw wrap(result.error)
  return result?.data ?? null
}

export async function fetchMyProfile(userId) {
  const row = await run((sb) => sb.from('profiles').select('*').eq('id', userId).maybeSingle())
  return fromRow(row)
}

export async function fetchProfileByHandle(handle) {
  const clean = String(handle || '').toLowerCase()
  if (!HANDLE_RE.test(clean)) return null
  const row = await run((sb) => sb.from('profiles').select('*').eq('handle', clean).maybeSingle())
  return fromRow(row)
}

export async function checkHandle(handle) {
  try {
    const free = await run((sb) => sb.rpc('handle_available', { candidate: handle }))
    return typeof free === 'boolean' ? free : null
  } catch {
    return null
  }
}

export async function saveProfile(userId, profile) {
  const row = await run((sb) => sb.from('profiles').upsert(toRow(userId, profile), { onConflict: 'id' }).select('*').single())
  return fromRow(row)
}

export async function deleteProfile(userId) {
  await run((sb) => sb.from('profiles').delete().eq('id', userId))
  await removeFiles(userId, '').catch(() => {})
}

const BUCKET = 'avatars'
const SIZES = { avatar: [320, 320], cover: [1200, 480] }

async function resizeWebp(file, [w, h]) {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new AuthError('bad_image')
  const scale = Math.max(w / bitmap.width, h / bitmap.height)
  const sw = Math.min(bitmap.width, w / scale)
  const sh = Math.min(bitmap.height, h / scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84))
  if (!blob) throw new AuthError('bad_image')
  return blob
}

async function removeFiles(userId, prefix, keep) {
  const sb = client()
  const { data } = await sb.storage.from(BUCKET).list(userId)
  const stale = (data || [])
    .map((f) => `${userId}/${f.name}`)
    .filter((p) => p !== keep && (!prefix || p.startsWith(`${userId}/${prefix}`)))
  if (stale.length) await sb.storage.from(BUCKET).remove(stale)
}

async function uploadImage(userId, file, kind) {
  if (!file.type.startsWith('image/')) throw new AuthError('bad_image')
  if (file.size > 12 * 1024 * 1024) throw new AuthError('too_large')
  const blob = await resizeWebp(file, SIZES[kind])
  const path = `${userId}/${kind}-${Date.now()}.webp`
  await run((sb) => sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false }))
  const { data } = client().storage.from(BUCKET).getPublicUrl(path)
  removeFiles(userId, `${kind}-`, path).catch(() => {})
  return data.publicUrl
}

export const uploadAvatar = (userId, file) => uploadImage(userId, file, 'avatar')
export const uploadCover = (userId, file) => uploadImage(userId, file, 'cover')
export const removeAvatar = (userId) => removeFiles(userId, 'avatar-').catch(() => {})
export const removeCover = (userId) => removeFiles(userId, 'cover-').catch(() => {})

const LINK_KINDS = [
  { id: 'github', label: 'GitHub', hosts: ['github.com'] },
  { id: 'discord', label: 'Discord', hosts: ['discord.com', 'discord.gg', 'discordapp.com'] },
  { id: 'x', label: 'X', hosts: ['x.com', 'twitter.com'] },
  { id: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  { id: 'twitch', label: 'Twitch', hosts: ['twitch.tv'] },
  { id: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com'] },
  { id: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
  { id: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
]

export function linkKind(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return LINK_KINDS.find((k) => k.hosts.some((h) => host === h || host.endsWith(`.${h}`))) || null
  } catch {
    return null
  }
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
