const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || ''

export const BUCKET = 'gallery'

export const LIMITS = {
  title: 80,
  caption: 600,
  url: 300,
  tags: 6,
  tag: 24,
}

export const KINDS = [
  { value: 'photo', label: 'Photos', one: 'Photo', icon: 'image' },
  { value: 'ui', label: 'UI', one: 'UI', icon: 'monitor' },
]
export const KIND_VALUES = KINDS.map((k) => k.value)
export const kindLabel = (kind) => KINDS.find((k) => k.value === kind)?.one || 'Photo'

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const URL_RE = /^https?:\/\/[^\s<>"'`]+$/
export const IMAGE_RE = /^[0-9a-f-]{36}\/[a-z0-9-]{1,60}\.webp$/

export const GALLERY_INTRO =
  'Photos I took and interfaces I designed. Places, light, screens and the small details that made them worth keeping.'

export const imageUrl = (path) =>
  SUPABASE_URL && path ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` : ''

const DAY = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
export const formatDay = (iso) => (iso ? DAY.format(new Date(`${iso}T00:00:00Z`)) : '')

export const sortItems = (items) =>
  [...items].sort(
    (a, b) => b.takenOn.localeCompare(a.takenOn) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.title.localeCompare(b.title),
  )

export const filterItems = (items, kind) => (kind && kind !== 'all' ? items.filter((i) => i.kind === kind) : items)

export function countsOf(items) {
  const counts = { all: items.length }
  for (const kind of KIND_VALUES) counts[kind] = items.filter((i) => i.kind === kind).length
  return counts
}

export const parseTags = (text) =>
  [...new Set(String(text || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]

export const titleFromFile = (name) => {
  const base = String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const title = base ? base[0].toUpperCase() + base.slice(1) : 'Untitled'
  return title.slice(0, LIMITS.title)
}

export function fromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    kind: KIND_VALUES.includes(row.kind) ? row.kind : 'photo',
    title: row.title,
    caption: row.caption || '',
    image: row.image,
    width: Number(row.width) || 1,
    height: Number(row.height) || 1,
    takenOn: row.taken_on,
    url: row.url || null,
    tags: row.tags || [],
    published: Boolean(row.published),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export function toRow(item) {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title.trim(),
    caption: item.caption.trim(),
    image: item.image,
    width: Math.round(item.width),
    height: Math.round(item.height),
    taken_on: item.takenOn,
    url: item.url?.trim() || null,
    tags: item.tags,
    published: item.published,
  }
}

export const formFrom = (item) => ({
  kind: item.kind,
  title: item.title,
  caption: item.caption,
  takenOn: item.takenOn,
  url: item.url || '',
  tags: item.tags.join(', '),
  published: item.published,
})

export function problemsOf(form) {
  const problems = {}
  const title = form.title.trim()
  if (!title) problems.title = 'Give it a title. It doubles as the alt text.'
  else if (title.length > LIMITS.title) problems.title = `Keep it under ${LIMITS.title} characters.`
  if (form.caption.trim().length > LIMITS.caption) problems.caption = `Keep it under ${LIMITS.caption} characters.`
  if (!KIND_VALUES.includes(form.kind)) problems.kind = 'Pick photo or UI.'
  if (!DATE_RE.test(form.takenOn)) problems.takenOn = 'Pick a date.'
  const url = form.url.trim()
  if (url && (!URL_RE.test(url) || url.length > LIMITS.url)) problems.url = 'Use a full http(s):// link.'
  const tags = parseTags(form.tags)
  if (tags.length > LIMITS.tags) problems.tags = `At most ${LIMITS.tags} tags.`
  else if (tags.some((t) => t.length > LIMITS.tag)) problems.tags = `Each tag fits in ${LIMITS.tag} characters.`
  return problems
}

export const itemFrom = (base, form) => ({
  ...base,
  kind: form.kind,
  title: form.title,
  caption: form.caption,
  takenOn: form.takenOn,
  url: form.url,
  tags: parseTags(form.tags),
  published: form.published,
})
