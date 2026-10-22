import { isDate, shiftDay, weekdayOf, daysBetween } from './day'

export const HOMEWORK_LIMITS = {
  title: 160,
  subject: 40,
}

const ALIASES = {
  Maths: ['maths', 'math', 'maa', 'mai'],
  Physics: ['physics', 'phys', 'phy'],
  Chemistry: ['chemistry', 'chem'],
  Biology: ['biology', 'bio'],
  CS: ['cs', 'compsci', 'computing'],
  Business: ['business', 'bm', 'bman'],
  Economics: ['economics', 'econ'],
  English: ['english', 'eng'],
  Greek: ['greek'],
  Spanish: ['spanish'],
  French: ['french'],
  German: ['german'],
  History: ['history', 'hist'],
  Geography: ['geography', 'geo'],
  Psychology: ['psychology', 'psych'],
  TOK: ['tok'],
  EE: ['ee'],
  CAS: ['cas'],
}

const ALIAS = new Map(Object.entries(ALIASES).flatMap(([name, words]) => words.map((word) => [word, name])))

const WEEKDAY_RE = [/^mon(day)?$/, /^tue(s(day)?)?$/, /^wed(s|nesday)?$/, /^thu(r(s(day)?)?)?$/, /^fri(day)?$/, /^sat(urday)?$/, /^sun(day)?$/]
const DATE_WORD_RE = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2}|\d{4}))?$/
const LEAD_WORDS = new Set(['due', 'by', 'for', 'on'])
const ARTICLES = new Set(['the', 'a'])

export const fold = (text) => String(text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

const capitalise = (text) => text.charAt(0).toLocaleUpperCase() + text.slice(1)

function dueFromWord(word, today) {
  if (word === 'today' || word === 'tonight') return today
  if (word === 'tomorrow' || word === 'tmr' || word === 'tmrw') return shiftDay(today, 1)
  const weekday = WEEKDAY_RE.findIndex((re) => re.test(word))
  if (weekday >= 0) return shiftDay(today, (weekday - weekdayOf(today) + 7) % 7 || 7)
  const match = DATE_WORD_RE.exec(word)
  if (!match) return null
  const [, d, m, y] = match
  const pad = (n) => String(n).padStart(2, '0')
  const year = y ? (y.length === 2 ? `20${y}` : y) : today.slice(0, 4)
  let iso = `${year}-${pad(m)}-${pad(d)}`
  if (!isDate(iso)) return null
  if (!y && daysBetween(today, iso) < -180) iso = `${Number(year) + 1}-${pad(m)}-${pad(d)}`
  return isDate(iso) ? iso : null
}

function subjectAt(words, known) {
  const folded = words.map((word) => fold(word).replace(/[:,.\-–—]+$/, ''))
  const named = [...known]
    .map((name) => ({ name, parts: fold(name).split(/\s+/) }))
    .filter(({ parts }) => parts.length <= folded.length && parts.every((part, i) => part === folded[i]))
    .sort((a, b) => b.parts.length - a.parts.length)[0]
  if (named) return { subject: named.name, used: named.parts.length }
  const alias = ALIAS.get(folded[0])
  if (!alias) return null
  const mine = [...known].find((name) => fold(name).split(/\s+/)[0] === fold(alias))
  return { subject: mine || alias, used: 1 }
}

export function parseHomework(text, today, known = []) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return null
  let due = null
  if (words.length > 1) {
    const last = fold(words.at(-1))
    const before = fold(words.at(-2))
    due = ARTICLES.has(before) ? null : dueFromWord(last, today)
    if (due) {
      words.pop()
      if (words.length > 1 && LEAD_WORDS.has(fold(words.at(-1)))) words.pop()
    }
  }
  const found = words.length > 1 || due ? subjectAt(words, known) : null
  const rest = found ? words.slice(found.used) : words
  const title = rest.join(' ').replace(/^[:\-–—,]\s*/, '').slice(0, HOMEWORK_LIMITS.title)
  return {
    subject: found?.subject ?? '',
    title: title ? capitalise(title) : 'Homework',
    due,
  }
}

const SHORT_WEEKDAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' })
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const atNoon = (iso) => new Date(`${iso}T12:00:00Z`)

export function dueLabel(due, today) {
  if (!due) return null
  const diff = daysBetween(today, due)
  const date = diff < -6 || diff > 6 ? SHORT_DATE.format(atNoon(due)) : SHORT_WEEKDAY.format(atNoon(due))
  if (diff < 0) return { text: `Late · ${date}`, tone: 'late' }
  if (diff === 0) return { text: 'Today', tone: 'soon' }
  if (diff === 1) return { text: 'Tomorrow', tone: 'soon' }
  return { text: date, tone: 'later' }
}

function byDue(a, b) {
  if (Boolean(a.doneOn) !== Boolean(b.doneOn)) return a.doneOn ? 1 : -1
  if (a.due !== b.due) return !a.due ? 1 : !b.due ? -1 : a.due.localeCompare(b.due)
  return String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.title.localeCompare(b.title)
}

export const sortHomework = (list) => [...list].sort(byDue)

export const visibleHomework = (list, today) => sortHomework(list.filter((item) => !item.doneOn || item.doneOn >= today))

export function subjectsOf(list) {
  const seen = new Map()
  for (const item of list) if (item.subject && !seen.has(fold(item.subject))) seen.set(fold(item.subject), item.subject)
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

export const homeworkForm = (item) => ({ subject: item.subject, title: item.title, due: item.due || '' })

export function homeworkProblems(form) {
  const problems = {}
  const title = form.title.trim()
  if (!title) problems.title = 'Say what the homework is.'
  else if (title.length > HOMEWORK_LIMITS.title) problems.title = `Keep it under ${HOMEWORK_LIMITS.title} characters.`
  if (form.subject.trim().length > HOMEWORK_LIMITS.subject) problems.subject = `Keep it under ${HOMEWORK_LIMITS.subject} characters.`
  if (form.due && !isDate(form.due)) problems.due = 'Pick a date.'
  return problems
}

export const homeworkFrom = (base, form) => ({
  ...base,
  subject: form.subject.trim(),
  title: form.title.trim(),
  due: form.due || null,
})

export function homeworkFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    subject: row.subject || '',
    title: row.title,
    due: row.due || null,
    doneOn: row.done_on || null,
    createdAt: row.created_at || null,
  }
}

export const homeworkToRow = (item) => ({
  id: item.id,
  subject: item.subject.trim(),
  title: item.title.trim(),
  due: item.due,
  done_on: item.doneOn,
})
