const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || ''

export const BUCKET = 'volunteer'

export const LIMITS = {
  title: 80,
  organization: 80,
  role: 60,
  location: 80,
  summary: 1200,
  url: 300,
  tags: 6,
  tag: 24,
  photos: 8,
  hours: 5000,
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const URL_RE = /^https?:\/\/[^\s<>"'`]+$/
export const PHOTO_RE = /^[0-9a-f-]{36}\/[a-z0-9-]{1,60}\.webp$/

export const VOLUNTEER_INTRO =
  'Where my time goes when the laptop is closed. The events I joined, the people I worked with and what we got done together.'

export const photoUrl = (path) =>
  SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` : ''

const DAY = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const DAY_NO_YEAR = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const asDate = (iso) => new Date(`${iso}T00:00:00Z`)

export const formatDay = (iso) => DAY.format(asDate(iso))

export function formatRange(start, end) {
  if (!start) return ''
  if (!end || end === start) return formatDay(start)
  if (start.slice(0, 4) === end.slice(0, 4)) {
    if (start.slice(0, 7) === end.slice(0, 7)) {
      return `${DAY_NO_YEAR.format(asDate(start))} to ${asDate(end).getUTCDate()}, ${start.slice(0, 4)}`
    }
    return `${DAY_NO_YEAR.format(asDate(start))} to ${formatDay(end)}`
  }
  return `${formatDay(start)} to ${formatDay(end)}`
}

export const daysIn = (start, end) =>
  !start ? 0 : !end ? 1 : Math.max(1, Math.round((asDate(end) - asDate(start)) / 86400000) + 1)

export const formatHours = (hours) => {
  if (hours == null || !Number.isFinite(hours)) return ''
  const n = Math.round(hours * 10) / 10
  return `${n % 1 === 0 ? n : n.toFixed(1)} h`
}

export const sortEvents = (events) =>
  [...events].sort((a, b) => b.startedOn.localeCompare(a.startedOn) || a.title.localeCompare(b.title))

export function eventsByYear(events) {
  const groups = []
  for (const event of sortEvents(events)) {
    const year = event.startedOn.slice(0, 4)
    if (groups.at(-1)?.year !== year) groups.push({ year, events: [] })
    groups.at(-1).events.push(event)
  }
  return groups
}

export function totalsOf(events) {
  const orgs = new Set(events.map((e) => e.organization.trim().toLowerCase()).filter(Boolean))
  const hours = events.reduce((sum, e) => sum + (e.hours || 0), 0)
  return {
    events: events.length,
    hours: Math.round(hours * 10) / 10,
    organizations: orgs.size,
    days: events.reduce((sum, e) => sum + daysIn(e.startedOn, e.endedOn), 0),
  }
}

export const parseTags = (text) =>
  [...new Set(String(text || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]

export function fromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    organization: row.organization || '',
    role: row.role || '',
    location: row.location || '',
    startedOn: row.started_on,
    endedOn: row.ended_on || null,
    hours: row.hours == null ? null : Number(row.hours),
    summary: row.summary || '',
    url: row.url || null,
    tags: row.tags || [],
    photos: row.photos || [],
    published: Boolean(row.published),
    updatedAt: row.updated_at || null,
  }
}

export function toRow(event) {
  return {
    id: event.id,
    title: event.title.trim(),
    organization: event.organization.trim(),
    role: event.role.trim(),
    location: event.location.trim(),
    started_on: event.startedOn,
    ended_on: event.endedOn || null,
    hours: event.hours == null || event.hours === '' ? null : Number(event.hours),
    summary: event.summary.trim(),
    url: event.url?.trim() || null,
    tags: event.tags,
    photos: event.photos,
    published: event.published,
  }
}

export const blankForm = (today) => ({
  title: '',
  organization: '',
  role: '',
  location: '',
  startedOn: today,
  endedOn: '',
  hours: '',
  summary: '',
  url: '',
  tags: '',
  published: true,
})

export const formFrom = (event) => ({
  title: event.title,
  organization: event.organization,
  role: event.role,
  location: event.location,
  startedOn: event.startedOn,
  endedOn: event.endedOn || '',
  hours: event.hours == null ? '' : String(event.hours),
  summary: event.summary,
  url: event.url || '',
  tags: event.tags.join(', '),
  published: event.published,
})

export function problemsOf(form) {
  const problems = {}
  const title = form.title.trim()
  if (!title) problems.title = 'Give the event a name.'
  else if (title.length > LIMITS.title) problems.title = `Keep it under ${LIMITS.title} characters.`
  for (const key of ['organization', 'role', 'location', 'summary']) {
    if (form[key].trim().length > LIMITS[key]) problems[key] = `Keep it under ${LIMITS[key]} characters.`
  }
  if (!DATE_RE.test(form.startedOn)) problems.startedOn = 'Pick the day it started.'
  if (form.endedOn) {
    if (!DATE_RE.test(form.endedOn)) problems.endedOn = 'That is not a date.'
    else if (form.endedOn < form.startedOn) problems.endedOn = 'It cannot end before it starts.'
  }
  if (String(form.hours).trim() !== '') {
    const hours = Number(form.hours)
    if (!Number.isFinite(hours) || hours <= 0) problems.hours = 'Hours have to be a positive number.'
    else if (hours > LIMITS.hours) problems.hours = `That is more than ${LIMITS.hours} hours.`
  }
  const url = form.url.trim()
  if (url && (!URL_RE.test(url) || url.length > LIMITS.url)) problems.url = 'Use a full http(s):// link.'
  const tags = parseTags(form.tags)
  if (tags.length > LIMITS.tags) problems.tags = `At most ${LIMITS.tags} tags.`
  else if (tags.some((t) => t.length > LIMITS.tag)) problems.tags = `Each tag fits in ${LIMITS.tag} characters.`
  return problems
}

export const eventFrom = (id, form, photos) => ({
  id,
  title: form.title,
  organization: form.organization,
  role: form.role,
  location: form.location,
  startedOn: form.startedOn,
  endedOn: form.endedOn || null,
  hours: String(form.hours).trim() === '' ? null : Number(form.hours),
  summary: form.summary,
  url: form.url,
  tags: parseTags(form.tags),
  photos,
  published: form.published,
})
