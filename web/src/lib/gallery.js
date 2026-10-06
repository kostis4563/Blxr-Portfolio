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

export const LIVE_TYPES = [
  {
    value: 'select',
    label: 'Selection',
    hint: 'The Figma selection box and cursor from the hero, drawn over a phrase.',
    fields: [
      { key: 'lead', label: 'Text before', max: 80 },
      { key: 'text', label: 'Selected text', max: 40, required: true },
      { key: 'tail', label: 'Text after', max: 80 },
      { key: 'name', label: 'Cursor name', max: 24, required: true },
    ],
    defaults: { lead: 'I build', text: 'the whole thing', tail: '.', name: 'Kostis' },
  },
  {
    value: 'inspect',
    label: 'Inspect',
    hint: 'Hover to see a Figma size readout. Leave the text empty to measure your avatar.',
    fields: [{ key: 'text', label: 'Button text', max: 40, placeholder: 'Empty shows your avatar' }],
    defaults: { text: '' },
  },
  {
    value: 'comment',
    label: 'Comment pin',
    hint: 'A Figma comment pin that opens on hover or tap.',
    fields: [
      { key: 'name', label: 'Commenter', max: 24, required: true },
      { key: 'text', label: 'Comment', max: 240, required: true, multiline: true },
      { key: 'time', label: 'Time', max: 12, placeholder: '2m' },
    ],
    defaults: { name: 'Client', text: 'Can you build ours on this?', time: '2m' },
  },
  {
    value: 'scramble',
    label: 'Scramble text',
    hint: 'Text that scrambles into another word on hover, like the hero name.',
    fields: [
      { key: 'text', label: 'Text', max: 40, required: true },
      { key: 'alt', label: 'Scrambles to', max: 40, required: true },
    ],
    defaults: { text: 'Blxr', alt: 'Kostis' },
  },
  {
    value: 'html',
    label: 'HTML + CSS',
    hint: 'Your own markup and styles, in a sandboxed frame. Scripts do not run.',
    fields: [
      { key: 'html', label: 'HTML', max: 20000, required: true, multiline: true, code: true },
      { key: 'css', label: 'CSS', max: 20000, multiline: true, code: true },
      { key: 'height', label: 'Height (px)', max: 3, number: { min: 80, max: 800 } },
    ],
    defaults: {
      html: '<button>Hover me</button>',
      css: 'button {\n  padding: 10px 18px;\n  border: 0;\n  border-radius: 999px;\n  background: #0d99ff;\n  color: #fff;\n  font: 600 14px system-ui;\n  transition: transform .2s;\n}\nbutton:hover { transform: scale(1.08); }',
      height: '220',
    },
  },
  {
    value: 'ocean',
    label: 'Ocean',
    hint: 'The Noizy ocean: Gerstner waves in a three.js shader. Moving across it drags the sun.',
    fields: [],
    defaults: {},
  },
  {
    value: 'comet',
    label: 'Comet border',
    hint: 'The async hero frame, with a lit trail riding its edge.',
    fields: [
      { key: 'title', label: 'Title', max: 24, required: true },
      { key: 'sub', label: 'Subtitle', max: 32 },
    ],
    defaults: { title: 'async', sub: 'hero.mp4 · 00:42' },
  },
  {
    value: 'contour',
    label: 'Contour field',
    hint: 'The Amitista Studio backdrop: marching squares over a drifting height map.',
    fields: [],
    defaults: {},
  },
  {
    value: 'loop',
    label: 'Word loop',
    hint: 'The Fresh Finds hero: floating paths behind a word that folds and swaps.',
    fields: [
      { key: 'lead', label: 'Text before', max: 24, required: true },
      { key: 'words', label: 'Words, comma separated', max: 200, required: true },
    ],
    defaults: { lead: 'Make it', words: 'fast, reliable, secure, automated, instant' },
  },
  {
    value: 'glow',
    label: 'Hover border',
    hint: 'The 7x0.site button: a conic gradient spins behind its border on hover or focus.',
    fields: [{ key: 'text', label: 'Button text', max: 32, required: true }],
    defaults: { text: 'Scan a file' },
  },
]
export const LIVE_VALUES = LIVE_TYPES.map((t) => t.value)
export const liveType = (type) => LIVE_TYPES.find((t) => t.value === type) || null

export function cleanLive(live) {
  const def = liveType(live?.type)
  if (!def) return null
  const props = {}
  for (const field of def.fields) {
    const v = live.props?.[field.key]
    props[field.key] = typeof v === 'string' || typeof v === 'number' ? String(v) : def.defaults[field.key]
  }
  return { type: def.value, props }
}

export const newLive = (type) => {
  const def = liveType(type) || LIVE_TYPES[0]
  return { type: def.value, props: { ...def.defaults } }
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const URL_RE = /^https?:\/\/[^\s<>"'`]+$/
export const IMAGE_RE = /^[0-9a-f-]{36}\/[a-z0-9-]{1,60}\.(webp|mp4|webm|mov)$/
export const isVideo = (path) => /\.(mp4|webm|mov)$/.test(String(path || ''))

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
    image: row.image || null,
    poster: row.poster || null,
    width: Number(row.width) || 1,
    height: Number(row.height) || 1,
    live: row.live ? cleanLive(row.live) : null,
    takenOn: row.taken_on,
    url: row.url || null,
    tags: row.tags || [],
    published: Boolean(row.published),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export function toRow(item) {
  const live = item.live ? cleanLive(item.live) : null
  return {
    ...(item.id ? { id: item.id } : {}),
    kind: live ? 'ui' : item.kind,
    title: item.title.trim(),
    caption: item.caption.trim(),
    image: live ? null : item.image,
    poster: live || !isVideo(item.image) ? null : item.poster || null,
    width: live ? null : Math.round(item.width),
    height: live ? null : Math.round(item.height),
    live,
    taken_on: item.takenOn,
    url: item.url?.trim() || null,
    tags: item.tags,
    published: item.published,
  }
}

export const formFrom = (item) => ({
  kind: item.kind,
  live: item.live ? { type: item.live.type, props: { ...item.live.props } } : null,
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
  if (form.live) {
    const def = liveType(form.live.type)
    if (!def) problems.live = 'Pick a component.'
    for (const field of def?.fields || []) {
      const v = String(form.live.props?.[field.key] ?? '')
      const key = `live.${field.key}`
      if (field.required && !v.trim()) problems[key] = 'This one is needed.'
      else if (field.number && v.trim()) {
        const n = Number(v)
        if (!Number.isInteger(n) || n < field.number.min || n > field.number.max) problems[key] = `A whole number from ${field.number.min} to ${field.number.max}.`
      } else if (v.length > field.max) problems[key] = `Keep it under ${field.max} characters.`
    }
  }
  return problems
}

export const draftLive = (today) => ({
  id: null,
  kind: 'ui',
  title: LIVE_TYPES[0].label,
  caption: '',
  image: null,
  width: null,
  height: null,
  live: newLive(LIVE_TYPES[0].value),
  takenOn: today,
  url: null,
  tags: [],
  published: true,
})

export const itemFrom = (base, form) => ({
  ...base,
  kind: form.live ? 'ui' : form.kind,
  live: form.live ? cleanLive(form.live) : null,
  title: form.title,
  caption: form.caption,
  takenOn: form.takenOn,
  url: form.url,
  tags: parseTags(form.tags),
  published: form.published,
})
