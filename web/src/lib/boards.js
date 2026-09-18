export const LIMITS = {
  boards: 60,
  lists: 12,
  cards: 400,
  labels: 12,
  name: 60,
  note: 240,
  listName: 32,
  listCap: 99,
  title: 140,
  notes: 2000,
  comment: 1000,
  step: 200,
  steps: 40,
  comments: 120,
  links: 12,
  linkLabel: 60,
  linkUrl: 400,
  labelName: 24,
  files: 10,
  bulk: 120,
  activity: 40,
}

export const SOON_HOURS = 48

export const BIN_HOURS = 24

export const COLOURS = [
  { id: 'violet', label: 'Violet' },
  { id: 'blue', label: 'Blue' },
  { id: 'teal', label: 'Teal' },
  { id: 'green', label: 'Green' },
  { id: 'amber', label: 'Amber' },
  { id: 'rose', label: 'Rose' },
  { id: 'ink', label: 'Mono' },
]

const SHADES = {
  violet: { swatch: '#8b5cf6', stripe: 'bg-violet-500', dot: 'bg-violet-500', wash: 'from-violet-500/20 via-violet-500/5 to-transparent' },
  blue:   { swatch: '#3b82f6', stripe: 'bg-blue-500',   dot: 'bg-blue-500',   wash: 'from-blue-500/20 via-blue-500/5 to-transparent' },
  teal:   { swatch: '#14b8a6', stripe: 'bg-teal-500',   dot: 'bg-teal-500',   wash: 'from-teal-500/20 via-teal-500/5 to-transparent' },
  green:  { swatch: '#22c55e', stripe: 'bg-green-500',  dot: 'bg-green-500',  wash: 'from-green-500/20 via-green-500/5 to-transparent' },
  amber:  { swatch: '#f59e0b', stripe: 'bg-amber-500',  dot: 'bg-amber-500',  wash: 'from-amber-500/20 via-amber-500/5 to-transparent' },
  rose:   { swatch: '#f43f5e', stripe: 'bg-rose-500',   dot: 'bg-rose-500',   wash: 'from-rose-500/20 via-rose-500/5 to-transparent' },
  ink:    { swatch: 'var(--color-ink-faint)', stripe: 'bg-ink-strong', dot: 'bg-ink-strong', wash: 'from-ink-strong/10 via-ink-strong/[0.03] to-transparent' },
}

export const shade = (colour) => SHADES[colour] || SHADES.violet

export const PURPOSES = [
  {
    id: 'personal',
    label: 'Personal',
    icon: 'user',
    blurb: 'Your own work. Nothing else to fill in.',
    fields: [],
  },
  {
    id: 'server',
    label: 'Server',
    icon: 'terminal',
    blurb: 'A game or community server: who owns it, where it runs.',
    fields: [
      { id: 'game', label: 'Game or platform', kind: 'line', hint: 'FiveM, Minecraft, Rust, Discord…', key: true },
      { id: 'owner', label: 'Server owner', kind: 'line', key: true },
      { id: 'host', label: 'IP or hostname', kind: 'host', key: true },
      { id: 'port', label: 'Port', kind: 'port', key: true },
      { id: 'contact', label: 'How to reach them', kind: 'line', hint: 'Discord tag, email, phone' },
      { id: 'connect', label: 'Connect link', kind: 'link' },
      { id: 'panel', label: 'Host panel', kind: 'link' },
      { id: 'region', label: 'Where it is hosted', kind: 'line' },
      { id: 'slots', label: 'Player slots', kind: 'line' },
      { id: 'renews', label: 'Renews on', kind: 'day' },
    ],
  },
  {
    id: 'client',
    label: 'Client work',
    icon: 'inbox',
    blurb: 'Paid work for somebody else.',
    fields: [
      { id: 'client', label: 'Client', kind: 'line', key: true },
      { id: 'contact', label: 'How to reach them', kind: 'line', hint: 'Discord tag, email, phone', key: true },
      { id: 'deal', label: 'What you are building', kind: 'line', key: true },
      { id: 'stage', label: 'Where it stands', kind: 'pick', options: ['Talking', 'Agreed', 'Building', 'Handed over', 'Paid'], key: true },
      { id: 'price', label: 'Agreed price', kind: 'line' },
      { id: 'due', label: 'Promised for', kind: 'day' },
      { id: 'where', label: 'Where the work lives', kind: 'link' },
    ],
  },
  {
    id: 'bot',
    label: 'Discord bot',
    icon: 'zap',
    blurb: 'A bot: which guild it serves and where it runs.',
    fields: [
      { id: 'bot', label: 'Bot name', kind: 'line', key: true },
      { id: 'guild', label: 'Guild id', kind: 'line', hint: 'Right-click the server, Copy Server ID', key: true },
      { id: 'owner', label: 'Whose bot it is', kind: 'line', key: true },
      { id: 'host', label: 'Runs on', kind: 'host', hint: 'The box or service it lives on' },
      { id: 'invite', label: 'Invite link', kind: 'link' },
      { id: 'repo', label: 'Repo', kind: 'link' },
    ],
  },
  {
    id: 'site',
    label: 'Website',
    icon: 'globe',
    blurb: 'A domain: where it is hosted and when it renews.',
    fields: [
      { id: 'domain', label: 'Domain', kind: 'host', key: true },
      { id: 'owner', label: 'Whose site it is', kind: 'line', key: true },
      { id: 'hosted', label: 'Hosted on', kind: 'line', key: true },
      { id: 'live', label: 'Live address', kind: 'link' },
      { id: 'repo', label: 'Repo', kind: 'link' },
      { id: 'renews', label: 'Domain renews', kind: 'day' },
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    icon: 'rocket',
    blurb: 'In-house work: the build, the release, the brand.',
    fields: [
      { id: 'lead', label: 'Who is leading it', kind: 'line', key: true },
      { id: 'target', label: 'Aiming for', kind: 'day', key: true },
      { id: 'where', label: 'Where the work lives', kind: 'link' },
    ],
  },
]

const FALLBACK_PURPOSE = PURPOSES[0]

export const purposeOf = (id) => PURPOSES.find((entry) => entry.id === id) || FALLBACK_PURPOSE
export const purposeLabel = (id) => purposeOf(id).label
export const purposeIcon = (id) => purposeOf(id).icon

export const FACT_FIELDS = Object.fromEntries(
  PURPOSES.flatMap((purpose) => purpose.fields.map((field) => [field.id, field])),
)

export const keyFields = (purpose) => purpose.fields.filter((field) => field.key)
export const restFields = (purpose) => purpose.fields.filter((field) => !field.key)

export function filledFacts(purpose, facts) {
  return purpose.fields.filter((field) => (facts?.[field.id] ?? '').trim()).length
}

export function strayFacts(purpose, facts) {
  const known = new Set(purpose.fields.map((field) => field.id))
  return Object.keys(facts || {}).filter((key) => !known.has(key) && (facts[key] ?? '').trim())
}

export function prettyDay(value) {
  const at = Date.parse(value)
  if (!Number.isFinite(at)) return value
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function prettyLink(value) {
  const cleaned = String(value || '').trim()
  if (!cleaned) return ''
  try {
    const url = new URL(cleaned.includes('://') ? cleaned : `https://${cleaned}`)
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return cleaned
  }
}

export function factText(field, value, facts) {
  if (!value) return ''
  if (field.kind === 'day') return prettyDay(value)
  if (field.kind === 'link') return prettyLink(value)
  if (field.kind === 'host' && facts?.port) return `${value}:${facts.port}`
  return value
}

export function factChips(purpose, facts) {
  return keyFields(purpose)
    .filter((field) => !(field.id === 'port' && facts?.host))
    .map((field) => ({ field, value: facts?.[field.id] ?? '', text: factText(field, facts?.[field.id], facts) }))
    .filter((chip) => chip.text)
}

export function factLead(purpose, facts) {
  return factChips(purpose, facts)[0] || null
}

export function factHaystack(board) {
  const purpose = purposeOf(board?.purpose)
  return [purpose.label, ...Object.values(board?.facts || {})].filter(Boolean).join(' ')
}

export const REMIND_UNITS = [
  { id: 'm', label: 'minutes', seconds: 60 },
  { id: 'h', label: 'hours', seconds: 3600 },
  { id: 'd', label: 'days', seconds: 86400 },
  { id: 'w', label: 'weeks', seconds: 604800 },
]

export const REMIND_STEPS_MAX = 6
export const REMIND_LEAD_DEFAULT = ['1d', '1h']
export const REMIND_LATE_DEFAULT = ['1d']
const STEP_RE = /^(\d{1,4})([mhdw])$/

export function stepSeconds(step) {
  const hit = STEP_RE.exec(String(step || ''))
  if (!hit) return 0
  const unit = REMIND_UNITS.find((entry) => entry.id === hit[2])
  return unit ? Number(hit[1]) * unit.seconds : 0
}

export function stepWords(step) {
  const hit = STEP_RE.exec(String(step || ''))
  if (!hit) return String(step || '')
  const count = Number(hit[1])
  const unit = REMIND_UNITS.find((entry) => entry.id === hit[2])
  if (!unit) return String(step)
  const name = count === 1 ? unit.label.slice(0, -1) : unit.label
  return `${count} ${name}`
}

export const sortSteps = (steps) =>
  [...new Set((steps || []).filter((step) => stepSeconds(step) > 0))].sort((a, b) => stepSeconds(a) - stepSeconds(b))

export function joinWords(parts) {
  const kept = (parts || []).filter(Boolean)
  if (kept.length <= 1) return kept.join('')
  return `${kept.slice(0, -1).join(', ')} and ${kept[kept.length - 1]}`
}

export const DEFAULT_REMIND = {
  on: false,
  lead: REMIND_LEAD_DEFAULT,
  late: REMIND_LATE_DEFAULT,
  quiet: false,
}

export function remindOf(board) {
  const held = board?.remind
  if (!held || typeof held !== 'object') return { ...DEFAULT_REMIND }
  return {
    on: Boolean(held.on),
    lead: sortSteps(held.lead ?? REMIND_LEAD_DEFAULT),
    late: sortSteps(held.late ?? REMIND_LATE_DEFAULT),
    quiet: Boolean(held.quiet),
  }
}

export const LIST_SORTS = [
  { id: 'due', label: 'Due date' },
  { id: 'title', label: 'Title' },
  { id: 'made', label: 'Newest first' },
  { id: 'done', label: 'Unfinished first' },
]

export const BULK_ACTIONS = ['done', 'undone', 'archive', 'restore', 'delete', 'label', 'unlabel', 'due', 'move']

export const STARTING_LISTS = ['To do', 'Doing', 'Done']

export function plural(count, one) {
  return `${count} ${count === 1 ? one : `${one}s`}`
}

export function ago(stamp, now = Date.now()) {
  const then = typeof stamp === 'number' ? stamp : Date.parse(stamp ?? '')
  if (!Number.isFinite(then)) return ''
  const minutes = Math.max(0, Math.floor((now - then) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function whenShort(stamp) {
  const at = Date.parse(stamp ?? '')
  if (!Number.isFinite(at)) return ''
  const date = new Date(at)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  const day = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
  if (date.getHours() === 0 && date.getMinutes() === 0) return day
  return `${day}, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export function dueState(card, now = Date.now()) {
  const at = Date.parse(card?.due ?? '')
  if (!Number.isFinite(at)) return null
  const label = whenShort(card.due)
  if (card.done) return { tone: 'done', label, at }
  if (at < now) return { tone: 'late', label, at }
  if (at - now < SOON_HOURS * 3600000) return { tone: 'soon', label, at }
  return { tone: 'calm', label, at }
}

export const DUE_TONE = {
  late: 'text-red-500',
  soon: 'text-amber-500',
  calm: 'text-ink-subtle',
  done: 'text-ink-faint line-through',
}

export function tally(cards, now = Date.now()) {
  const held = cards || []
  const live = held.filter((card) => !card.archived)
  return {
    cards: live.length,
    done: live.filter((card) => card.done).length,
    archived: held.length - live.length,
    overdue: live.filter((card) => {
      const at = Date.parse(card.due ?? '')
      return !card.done && Number.isFinite(at) && at < now
    }).length,
    soon: live.filter((card) => {
      const at = Date.parse(card.due ?? '')
      return !card.done && Number.isFinite(at) && at >= now && at - now < SOON_HOURS * 3600000
    }).length,
  }
}

export function cardMatches(card, filters, labels) {
  if (!filters) return !card.archived
  if (Boolean(card.archived) !== Boolean(filters.archived)) return false
  if (filters.hideDone && card.done) return false
  if (filters.label && !(card.labels || []).includes(filters.label)) return false
  if (filters.due === 'overdue' && dueState(card)?.tone !== 'late') return false
  if (filters.due === 'soon' && !['soon', 'late'].includes(dueState(card)?.tone)) return false
  if (filters.due === 'none' && card.due) return false
  const wanted = (filters.text || '').trim().toLowerCase()
  if (!wanted) return true
  const named = (card.labels || [])
    .map((id) => (labels || []).find((label) => label.id === id)?.name || '')
    .join(' ')
  return `#${card.seq} ${card.title} ${card.notes || ''} ${named}`.toLowerCase().includes(wanted)
}

export const filtersActive = (filters) =>
  Boolean(filters.text || filters.hideDone || filters.label || filters.archived || filters.due)

export const EMPTY_FILTERS = { text: '', hideDone: false, label: '', archived: false, due: '' }

export const POSITION_STEP = 1024
export const POSITION_MIN_GAP = 0.0005

export function positionFor(ordered, index) {
  const before = index > 0 ? ordered[index - 1]?.position : undefined
  const after = ordered[index]?.position
  if (before === undefined && after === undefined) return POSITION_STEP
  if (before === undefined) return after - POSITION_STEP
  if (after === undefined) return before + POSITION_STEP
  return (before + after) / 2
}

export const needsRenumber = (ordered, index) => {
  const before = index > 0 ? ordered[index - 1]?.position : undefined
  const after = ordered[index]?.position
  return before !== undefined && after !== undefined && Math.abs(after - before) < POSITION_MIN_GAP
}

export function sortCards(cards, by) {
  const rows = [...(cards || [])]
  if (by === 'due') {
    rows.sort((a, b) => (Date.parse(a.due ?? '') || Infinity) - (Date.parse(b.due ?? '') || Infinity))
  } else if (by === 'title') {
    rows.sort((a, b) => a.title.localeCompare(b.title))
  } else if (by === 'made') {
    rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  } else if (by === 'done') {
    rows.sort((a, b) => Number(a.done) - Number(b.done) || a.position - b.position)
  }
  return rows
}

export function initials(name) {
  const cleaned = String(name ?? '').trim()
  if (!cleaned) return '?'
  const parts = cleaned.split(/[\s._-]+/).filter(Boolean)
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase()
}

export function sizeWords(bytes) {
  const held = Number(bytes) || 0
  if (held < 1024) return `${held} B`
  if (held < 1024 * 1024) return `${Math.round(held / 1024)} KB`
  return `${(held / (1024 * 1024)).toFixed(1)} MB`
}

export function shortId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 12)
  return Math.random().toString(36).slice(2, 14)
}

export const SORTS = [
  { id: 'touched', label: 'Recently touched' },
  { id: 'name', label: 'Name' },
  { id: 'open', label: 'Most left to do' },
  { id: 'made', label: 'Newest' },
]

export const BOARDS_TAB = [
  { id: 'boards', label: 'Boards' },
  { id: 'archive', label: 'Archived' },
]
