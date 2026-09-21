import { currentSession } from './supabase'
import { DISCORD_ID_RE, HEX_RE, LIMITS, suggestHandle } from './profiles'

export class DiscordError extends Error {
  constructor(code, { status = 0 } = {}) {
    super(code)
    this.code = code
    this.status = status
  }
}

async function request(path, { method = 'GET', signal } = {}) {
  const token = currentSession()?.access_token
  if (!token) throw new DiscordError('unauthorized', { status: 401 })
  let res
  try {
    res = await fetch(path, { method, signal, cache: 'no-store', credentials: 'same-origin', headers: { authorization: `Bearer ${token}` } })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new DiscordError('offline')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new DiscordError(data?.error || 'failed', { status: res.status })
  return data
}

// Public profile by user ID. No OAuth: the server asks Discord's API (or a
// public mirror) and hands back the normalised user object.
export async function lookupDiscord(id, { signal } = {}) {
  const clean = String(id || '').replace(/\D/g, '')
  if (!DISCORD_ID_RE.test(clean)) throw new DiscordError('bad_id', { status: 400 })
  const data = await request(`/api/discord/user?id=${clean}`, { signal })
  if (!data?.user || !DISCORD_ID_RE.test(String(data.user.id || ''))) throw new DiscordError('failed')
  return data.user
}

export const IMPORT_FIELDS = [
  {
    id: 'name', label: 'Display name', group: 'identity',
    has: (u) => Boolean(u.displayName), preview: (u) => u.displayName,
    apply: (p, u) => ({ ...p, name: u.displayName.slice(0, LIMITS.name) }),
  },
  {
    id: 'handle', label: 'Handle', group: 'identity',
    has: (u) => Boolean(suggestHandle(u.username)), preview: (u) => `@${suggestHandle(u.username)}`,
    apply: (p, u) => ({ ...p, handle: suggestHandle(u.username) }),
  },
  {
    id: 'avatar', label: 'Photo', group: 'identity',
    has: (u) => Boolean(u.avatar), preview: () => 'Profile picture',
    apply: (p, u) => ({ ...p, avatar: u.avatar }),
  },
  {
    id: 'banner', label: 'Banner as cover photo', group: 'design',
    has: (u) => Boolean(u.banner), preview: () => 'Profile banner',
    apply: (p, u) => ({ ...p, cover: u.banner }),
  },
  {
    id: 'accent', label: 'Accent colour', group: 'design',
    has: (u) => HEX_RE.test(u.accent || ''), preview: (u) => u.accent,
    apply: (p, u) => ({ ...p, accent: 'custom', accentHex: u.accent }),
  },
  {
    id: 'decoration', label: 'Avatar decoration', group: 'flair',
    has: (u) => Boolean(u.decoration?.url), preview: () => 'Animated frame',
    apply: (p, u) => ({ ...p, decoration: 'image', decorationUrl: u.decoration.url }),
  },
  {
    id: 'nameplate', label: 'Nameplate', group: 'flair',
    has: (u) => Boolean(u.nameplate?.asset), preview: (u) => u.nameplate?.label || 'Nameplate',
    apply: (p, u) => ({ ...p, nameplate: 'image', nameplateAsset: u.nameplate.asset, nameplatePalette: u.nameplate.palette || null }),
  },
  {
    id: 'tag', label: 'Server tag', group: 'flair',
    has: (u) => Boolean(u.tag?.text), preview: (u) => u.tag?.text,
    apply: (p, u) => ({ ...p, tagText: u.tag.text.slice(0, LIMITS.tag), tagBadgeUrl: u.tag.badge || null }),
  },
  {
    id: 'link', label: 'Discord link', group: 'content',
    has: (u) => Boolean(u.username), preview: (u) => `discord.com/users/${u.id}`,
    apply: (p, u) => {
      const url = `https://discord.com/users/${u.id}`
      if (p.links.some((l) => l.url === url) || p.links.length >= LIMITS.links) return p
      return { ...p, links: [...p.links, { label: u.username.slice(0, LIMITS.linkLabel), url }] }
    },
  },
]

export const IMPORT_GROUPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'design', label: 'Design' },
  { id: 'flair', label: 'Flair' },
  { id: 'content', label: 'Content' },
]

export const availableImports = (user) => IMPORT_FIELDS.filter((f) => f.has(user))

export function applyImports(profile, user, chosen) {
  let next = { ...profile, discordId: user.id }
  for (const field of IMPORT_FIELDS) if (chosen.has(field.id) && field.has(user)) next = field.apply(next, user)
  return next
}
