import { PRESENT_PATH } from './router'

export const LIMITS = {
  title: 120,
  slides: 100,
  decks: 200,
  heading: 120,
  subtitle: 240,
  point: 200,
  points: 8,
  head: 40,
  quote: 300,
  stat: 16,
  notes: 4000,
  alt: 200,
  items: 6,
}

export const DEFAULT_TITLE = 'Untitled presentation'

export const THEMES = [
  {
    id: 'blxr',
    label: 'blxr',
    font: 'blxr',
    frame: true,
    paint: '#090909',
    base: '#090909',
    ink: '#f5f5f5',
    accent: '#0d99ff',
    alt: { base: '#0d99ff', ink: '#ffffff', accent: '#090909' },
    inv: { base: '#f2f1ee', ink: '#17150f', accent: '#0a84e0' },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    font: 'sans',
    paint: 'radial-gradient(120% 95% at 88% 0%, #241a3d 0%, #0b0b10 58%)',
    base: '#0b0b10',
    ink: '#f6f6f8',
    accent: '#a78bfa',
    alt: { base: '#7c3aed', ink: '#ffffff', accent: '#ede9fe' },
    inv: { base: '#f6f6f8', ink: '#0b0b10', accent: '#6d28d9' },
  },
  {
    id: 'paper',
    label: 'Paper',
    font: 'serif',
    paint: '#f3efe6',
    base: '#f3efe6',
    ink: '#1c1914',
    accent: '#c2410c',
    alt: { base: '#c2410c', ink: '#fff7ed', accent: '#fed7aa' },
    inv: { base: '#1c1914', ink: '#f3efe6', accent: '#fb923c' },
  },
  {
    id: 'mono',
    label: 'Mono',
    font: 'sans',
    paint: '#ffffff',
    base: '#ffffff',
    ink: '#0a0a0a',
    accent: '#e5322d',
    alt: { base: '#e5322d', ink: '#ffffff', accent: '#ffffff' },
    inv: { base: '#0a0a0a', ink: '#ffffff', accent: '#ff5a52' },
  },
  {
    id: 'aurora',
    label: 'Aurora',
    font: 'sans',
    paint: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 55%, #831843 100%)',
    base: '#2e1765',
    ink: '#ffffff',
    accent: '#f0abfc',
    alt: { base: '#f0abfc', ink: '#2e1765', accent: '#6b21a8' },
    inv: { base: '#faf5ff', ink: '#2e1765', accent: '#a21caf' },
  },
  {
    id: 'forest',
    label: 'Forest',
    font: 'serif',
    paint: '#0f1d16',
    base: '#0f1d16',
    ink: '#eef4ef',
    accent: '#86efac',
    alt: { base: '#166534', ink: '#f0fdf4', accent: '#bbf7d0' },
    inv: { base: '#eef4ef', ink: '#0f1d16', accent: '#15803d' },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    font: 'sans',
    paint: 'linear-gradient(160deg, #04263b 0%, #0b3b52 100%)',
    base: '#062c42',
    ink: '#e8f6f6',
    accent: '#2dd4bf',
    alt: { base: '#0d9488', ink: '#f0fdfa', accent: '#ccfbf1' },
    inv: { base: '#f0fdfa', ink: '#062c42', accent: '#0f766e' },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    font: 'sans',
    paint: 'linear-gradient(135deg, #fb923c 0%, #f43f5e 60%, #be185d 100%)',
    base: '#f43f5e',
    ink: '#ffffff',
    accent: '#fff1d6',
    alt: { base: '#1f1020', ink: '#ffffff', accent: '#fb7185' },
    inv: { base: '#fff7ed', ink: '#4a0d1f', accent: '#e11d48' },
  },
]

export const THEME_IDS = THEMES.map((theme) => theme.id)
export const DEFAULT_THEME = THEMES[0].id
export const themeOf = (id) => THEMES.find((theme) => theme.id === id) || THEMES[0]

export const TONES = [
  { id: 'theme', label: 'Standard' },
  { id: 'accent', label: 'Accent' },
  { id: 'invert', label: 'Inverted' },
]

export function paletteOf(themeId, tone = 'theme') {
  const theme = themeOf(themeId)
  if (tone === 'accent') return { ...theme.alt, paint: theme.alt.base, font: theme.font }
  if (tone === 'invert') return { ...theme.inv, paint: theme.inv.base, font: theme.font }
  return { paint: theme.paint, base: theme.base, ink: theme.ink, accent: theme.accent, font: theme.font }
}

export const TRANSITIONS = [
  { id: 'fade', label: 'Fade' },
  { id: 'slide', label: 'Slide' },
  { id: 'none', label: 'None' },
]

export const LAYOUTS = [
  { id: 'title', label: 'Title', hint: 'A cover or a closing slide', aligns: true },
  { id: 'section', label: 'Section', hint: 'Opens a new part of the talk', aligns: true },
  { id: 'bullets', label: 'Bullets', hint: 'A heading and a few points' },
  { id: 'columns', label: 'Two columns', hint: 'Two sides, side by side' },
  { id: 'split', label: 'Text and image', hint: 'Points beside a picture', image: true },
  { id: 'image', label: 'Full image', hint: 'One picture, edge to edge', image: true },
  { id: 'quote', label: 'Quote', hint: 'A line worth repeating', aligns: true },
  { id: 'stat', label: 'Big number', hint: 'One figure that matters', aligns: true },
  { id: 'cards', label: 'Cards', hint: 'Up to six short ideas in a grid' },
  { id: 'flow', label: 'Flow', hint: 'Steps joined by arrows' },
  { id: 'timeline', label: 'Timeline', hint: 'Dates along a line' },
  { id: 'layers', label: 'Layers', hint: 'Levels stacked from top to bottom' },
  { id: 'stats', label: 'Numbers', hint: 'Two to four figures side by side' },
  { id: 'checks', label: 'Do and don\'t', hint: 'Ticks on one side, crosses on the other' },
  { id: 'code', label: 'Terminal', hint: 'Lines of code or text in a window' },
]

export const LAYOUT_IDS = LAYOUTS.map((layout) => layout.id)
export const layoutOf = (id) => LAYOUTS.find((layout) => layout.id === id) || LAYOUTS[0]

export function shortId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return Math.random().toString(36).slice(2, 14)
}

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '')
const list = (value, max) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(0, LIMITS.points).map((item) => item.slice(0, max)) : []

const itemList = (value) =>
  Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === 'object')
        .slice(0, LIMITS.items)
        .map((item) => ({ label: text(item.label, LIMITS.head), body: text(item.body, LIMITS.point) }))
    : []

function imageFrom(value) {
  if (!value || typeof value !== 'object' || typeof value.path !== 'string' || !value.path) return null
  return { path: value.path, alt: text(value.alt, LIMITS.alt), fit: value.fit === 'contain' ? 'contain' : 'cover' }
}

export function slideFrom(raw = {}) {
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 32) : shortId(),
    layout: LAYOUT_IDS.includes(raw.layout) ? raw.layout : 'title',
    tone: TONES.some((tone) => tone.id === raw.tone) ? raw.tone : 'theme',
    align: raw.align === 'center' ? 'center' : 'left',
    title: text(raw.title, LIMITS.heading),
    subtitle: text(raw.subtitle, LIMITS.subtitle),
    head: text(raw.head, LIMITS.head),
    head2: text(raw.head2, LIMITS.head),
    points: list(raw.points, LIMITS.point),
    points2: list(raw.points2, LIMITS.point),
    items: itemList(raw.items),
    quote: text(raw.quote, LIMITS.quote),
    stat: text(raw.stat, LIMITS.stat),
    image: imageFrom(raw.image),
    notes: text(raw.notes, LIMITS.notes),
  }
}

export function slideToJson(slide) {
  const out = { id: slide.id, layout: slide.layout }
  if (slide.tone !== 'theme') out.tone = slide.tone
  if (slide.align !== 'left') out.align = slide.align
  for (const key of ['title', 'subtitle', 'head', 'head2', 'quote', 'stat', 'notes']) {
    if (slide[key]) out[key] = slide[key]
  }
  for (const key of ['points', 'points2']) {
    const kept = slide[key].map((point) => point.trimEnd())
    while (kept.length && !kept.at(-1)) kept.pop()
    if (kept.length) out[key] = kept
  }
  const items = slide.items.map((item) => ({ label: item.label.trimEnd(), body: item.body.trimEnd() }))
  while (items.length && !items.at(-1).label && !items.at(-1).body) items.pop()
  if (items.length) out.items = items.map((item) => Object.fromEntries(Object.entries(item).filter(([, value]) => value)))
  if (slide.image) out.image = slide.image
  return out
}

export function newSlide(layout = 'bullets', fields = {}) {
  return slideFrom({ ...fields, id: shortId(), layout })
}

export const duplicateSlide = (slide) => ({ ...slide, id: shortId(), image: slide.image ? { ...slide.image } : null })

export function moveSlide(slides, from, to) {
  if (from === to || from < 0 || from >= slides.length) return slides
  const next = [...slides]
  const [taken] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, taken)
  return next
}

export function sectionNumber(slides, index) {
  let count = 0
  for (let at = 0; at <= index && at < slides.length; at += 1) if (slides[at].layout === 'section') count += 1
  return String(Math.max(1, count)).padStart(2, '0')
}

export function sectionTitle(slides, index) {
  for (let at = Math.min(index, slides.length - 1); at >= 0; at -= 1) if (slides[at].layout === 'section') return slides[at].title
  return ''
}

export function slideLabel(slide) {
  const words = slide.title || slide.quote || slide.stat || slide.subtitle || slide.points.find(Boolean) || slide.items.find((item) => item.label)?.label || ''
  return words.trim() || layoutOf(slide.layout).label
}

export const imagesOf = (slides) => slides.map((slide) => slide.image?.path).filter(Boolean)

export const TEMPLATES = [
  { id: 'blank', label: 'Blank', hint: 'One title slide to start from' },
  { id: 'outline', label: 'Talk outline', hint: 'Eight slides with the basic layouts, ready to rewrite' },
  { id: 'visual', label: 'Visual outline', hint: 'Cards, flows, timelines and numbers, ready to rewrite' },
]

export function templateSlides(id) {
  if (id === 'visual') {
    return [
      newSlide('title', { title: 'The big idea', subtitle: 'One line on why it matters, and who is telling it' }),
      newSlide('cards', { title: 'Three questions', items: [{ label: 'What is it?', body: 'The short answer' }, { label: 'How does it work?', body: 'The part people get wrong' }, { label: 'Does it matter?', body: 'Your judgement' }] }),
      newSlide('section', { title: 'How it works', subtitle: 'The mechanism, step by step' }),
      newSlide('flow', { title: 'From start to finish', items: [{ label: 'Input', body: 'Where it starts' }, { label: 'Process', body: 'What happens' }, { label: 'Output', body: 'What comes out' }] }),
      newSlide('layers', { title: 'Three levels', items: [{ label: 'Top', body: 'What everyone sees' }, { label: 'Middle', body: 'What most people use' }, { label: 'Bottom', body: 'What few people reach' }] }),
      newSlide('timeline', { title: 'How we got here', items: [{ label: '1990s', body: 'It begins' }, { label: '2000s', body: 'It spreads' }, { label: 'Today', body: 'Where it is now' }] }),
      newSlide('stats', { title: 'The numbers', items: [{ label: '57%', body: 'One figure, and its source' }, { label: '3×', body: 'Another figure to compare it with' }] }),
      newSlide('checks', { title: 'Do and don\'t', head: 'Do', head2: 'Don\'t', points: ['The safe habit', 'The good habit'], points2: ['The common mistake', 'The risky shortcut'] }),
      newSlide('code', { title: 'What it looks like', subtitle: 'Terminal', points: ['# A comment explains the next line', '$ the command or address'] }),
      newSlide('title', { title: 'Thank you', subtitle: 'Questions?', tone: 'accent', align: 'center' }),
    ]
  }
  if (id !== 'outline') return [newSlide('title')]
  return [
    newSlide('title', { title: 'The big idea', subtitle: 'One line on why it matters, and who is telling it' }),
    newSlide('bullets', { title: 'Today', points: ['Where we are', 'What we found', 'What happens next'] }),
    newSlide('section', { title: 'Where we are', subtitle: 'The short version' }),
    newSlide('split', { title: 'The problem', points: ['Say it plainly', 'Show who it hurts', 'Put a picture next to it'] }),
    newSlide('stat', { stat: '3×', title: 'the one number to remember', subtitle: 'Where it came from, in a few words' }),
    newSlide('columns', { title: 'Before and after', head: 'Before', head2: 'After', points: ['Slow', 'Manual'], points2: ['Fast', 'Automatic'] }),
    newSlide('quote', { quote: 'A line someone said that makes the point better than you could.', subtitle: 'Who said it' }),
    newSlide('title', { title: 'Thank you', subtitle: 'Questions?', tone: 'accent', align: 'center' }),
  ]
}

export const SAMPLES = {
  title: { title: 'Big idea', subtitle: 'Why it matters' },
  section: { title: 'Part one', subtitle: 'Where we start' },
  bullets: { title: 'Three things', points: ['First point', 'Second point', 'Third point'] },
  columns: { title: 'Side by side', head: 'Before', head2: 'After', points: ['Slow', 'Manual'], points2: ['Fast', 'Automatic'] },
  split: { title: 'With a picture', points: ['One point', 'Another'] },
  image: { title: 'Edge to edge', subtitle: 'A caption' },
  quote: { quote: 'Make it simple, but significant.', subtitle: 'Someone wise' },
  stat: { stat: '42%', title: 'the one number', subtitle: 'and what it means' },
  cards: { title: 'In a grid', items: [{ label: 'First', body: 'A short line' }, { label: 'Second', body: 'A short line' }, { label: 'Third', body: 'A short line' }] },
  flow: { title: 'Step by step', items: [{ label: 'Start', body: 'First' }, { label: 'Then', body: 'Next' }, { label: 'End', body: 'Last' }] },
  timeline: { title: 'Over time', items: [{ label: '2002', body: 'It began' }, { label: '2013', body: 'It grew' }, { label: 'Today', body: 'Where it is' }] },
  layers: { title: 'Top to bottom', items: [{ label: 'Surface', body: 'What everyone sees' }, { label: 'Deep', body: 'Behind a login' }, { label: 'Dark', body: 'Hidden on purpose' }] },
  stats: { title: 'By the numbers', items: [{ label: '57%', body: 'of one thing' }, { label: '6.7%', body: 'of another' }] },
  checks: { title: 'Do and don\'t', head: 'Do', head2: 'Don\'t', points: ['Keep it updated', 'Stay careful'], points2: ['Share your login', 'Click strange links'] },
  code: { title: 'In a window', subtitle: 'Terminal', points: ['# A comment', '$ a command', 'what it prints'] },
}

export const sampleSlide = (layout) => slideFrom({ id: `sample-${layout}`, layout, ...SAMPLES[layout] })

export function blankDeck({ template = 'blank', theme = DEFAULT_THEME } = {}) {
  return {
    title: DEFAULT_TITLE,
    theme: THEME_IDS.includes(theme) ? theme : DEFAULT_THEME,
    transition: 'fade',
    numbers: true,
    slides: templateSlides(template),
  }
}

export function deckFrom(row) {
  if (!row) return null
  const slides = Array.isArray(row.slides) ? row.slides.slice(0, LIMITS.slides).map(slideFrom) : []
  return {
    id: row.id,
    title: text(row.title, LIMITS.title) || DEFAULT_TITLE,
    theme: THEME_IDS.includes(row.theme) ? row.theme : DEFAULT_THEME,
    transition: TRANSITIONS.some((t) => t.id === row.transition) ? row.transition : 'fade',
    numbers: row.numbers !== false,
    slides: slides.length ? slides : [newSlide('title')],
    shareToken: row.share_token || null,
    sharedAt: row.shared_at || null,
    author: row.author || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

const COLUMNS = { title: 'title', theme: 'theme', transition: 'transition', numbers: 'numbers', shareToken: 'share_token' }

export function deckToRow(patch) {
  const row = {}
  for (const [key, column] of Object.entries(COLUMNS)) if (key in patch) row[column] = patch[key]
  if ('title' in row) row.title = row.title.trim().slice(0, LIMITS.title) || DEFAULT_TITLE
  if ('slides' in patch) row.slides = patch.slides.map(slideToJson)
  return row
}

export function newToken() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/

export const shareUrl = (token, origin = typeof window === 'undefined' ? 'https://kostis.wtf' : window.location.origin) =>
  `${origin}${PRESENT_PATH}#${token}`

export function tokenFromHash(hash) {
  const token = String(hash || '').replace(/^#/, '').split(/[/?&]/)[0]
  return TOKEN_RE.test(token) ? token : null
}

const KEYS = {
  ArrowRight: 'next',
  ArrowDown: 'next',
  PageDown: 'next',
  ' ': 'next',
  Enter: 'next',
  n: 'next',
  ArrowLeft: 'prev',
  ArrowUp: 'prev',
  PageUp: 'prev',
  Backspace: 'prev',
  p: 'prev',
  Home: 'first',
  End: 'last',
  b: 'black',
  '.': 'black',
  w: 'white',
  ',': 'white',
  g: 'grid',
  s: 'speaker',
  f: 'fullscreen',
  Escape: 'close',
  '?': 'help',
}

export function keyAction(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return null
  if (/^[0-9]$/.test(event.key)) return 'digit'
  if (event.key === ' ' && event.shiftKey) return 'prev'
  return KEYS[event.key] || KEYS[String(event.key).toLowerCase()] || null
}

export const SHORTCUTS = [
  ['→  Space  N', 'Next slide'],
  ['←  Shift Space  P', 'Previous slide'],
  ['Home  End', 'First or last slide'],
  ['Number then Enter', 'Jump to that slide'],
  ['G', 'All slides'],
  ['S', 'Speaker view: notes, next slide, timer'],
  ['B  W', 'Black or white screen'],
  ['F', 'Full screen on or off'],
  ['Esc', 'Leave the show'],
]

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${String(m).padStart(2, '0')}:${s}`
}

export function revealIn(list, item, behavior = 'auto') {
  if (!list || !item) return
  const outer = list.getBoundingClientRect()
  const inner = item.getBoundingClientRect()
  const top = inner.top < outer.top ? inner.top - outer.top - 4 : inner.bottom > outer.bottom ? inner.bottom - outer.bottom + 4 : 0
  const left = inner.left < outer.left ? inner.left - outer.left - 4 : inner.right > outer.right ? inner.right - outer.right + 4 : 0
  if (top || left) list.scrollBy({ top, left, behavior })
}

export function sortDecks(decks) {
  return [...decks].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

const DAY = 86400000
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const LONG_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function editedLabel(iso, now = Date.now()) {
  if (!iso) return ''
  const at = new Date(iso).getTime()
  const gap = now - at
  if (gap < 60000) return 'Edited just now'
  if (gap < 3600000) return `Edited ${Math.floor(gap / 60000)} min ago`
  if (gap < DAY) return `Edited ${Math.floor(gap / 3600000)} h ago`
  const date = new Date(at)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return `Edited ${(sameYear ? SHORT_DATE : LONG_DATE).format(date)}`
}
