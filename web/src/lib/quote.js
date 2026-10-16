export const LIMITS = {
  text: 300,
  author: 60,
  explanation: 4000,
  slug: 60,
}

export const DEFAULT_AUTHOR = 'Kostis'

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

const SLUG_WORDS = 8

export function slugify(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, SLUG_WORDS)
    .join('-')
    .slice(0, LIMITS.slug)
    .replace(/-+$/, '')
}

export function uniqueSlug(base, taken = []) {
  const root = base || 'quote'
  const used = new Set(taken)
  if (!used.has(root)) return root
  let n = 2
  while (used.has(`${root}-${n}`)) n += 1
  return `${root}-${n}`
}

export function todayIso(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const paragraphsOf = (text) =>
  String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

export function fromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug,
    text: row.body,
    author: row.author || DEFAULT_AUTHOR,
    explanation: row.explanation || '',
    featured: Boolean(row.featured),
    published: Boolean(row.published),
    addedOn: row.added_on,
    editedOn: row.edited_on || null,
    createdAt: row.created_at || null,
  }
}

export function toRow(quote) {
  return {
    id: quote.id,
    slug: quote.slug.trim(),
    body: quote.text.trim(),
    author: quote.author.trim() || DEFAULT_AUTHOR,
    explanation: quote.explanation.trim(),
    featured: quote.featured,
    published: quote.published,
    added_on: quote.addedOn,
    edited_on: quote.editedOn || null,
  }
}

export const blankForm = (today) => ({
  text: '',
  author: DEFAULT_AUTHOR,
  slug: '',
  addedOn: today,
  editedOn: '',
  explanation: '',
  featured: false,
  published: true,
})

export const formFrom = (quote) => ({
  text: quote.text,
  author: quote.author,
  slug: quote.slug,
  addedOn: quote.addedOn,
  editedOn: quote.editedOn || '',
  explanation: quote.explanation,
  featured: quote.featured,
  published: quote.published,
})

export const quoteFrom = (id, form) => ({
  id,
  slug: form.slug,
  text: form.text,
  author: form.author,
  explanation: form.explanation,
  featured: form.featured,
  published: form.published,
  addedOn: form.addedOn,
  editedOn: form.editedOn || null,
})

export const wordsOf = (form) => [form.text.trim(), form.author.trim(), form.explanation.trim()].join('\n\u0000\n')

export function problemsOf(form, takenSlugs = []) {
  const problems = {}
  const text = form.text.trim()
  if (!text) problems.text = 'Write the quote.'
  else if (text.length > LIMITS.text) problems.text = `Keep it under ${LIMITS.text} characters.`
  if (form.author.trim().length > LIMITS.author) problems.author = `Keep it under ${LIMITS.author} characters.`
  if (form.explanation.trim().length > LIMITS.explanation) problems.explanation = `Keep it under ${LIMITS.explanation} characters.`
  const slug = form.slug.trim()
  if (!slug) problems.slug = 'Give it a link, like true-heroes-never-run.'
  else if (slug.length > LIMITS.slug || !SLUG_RE.test(slug)) problems.slug = 'Use lowercase letters, numbers and single dashes.'
  else if (takenSlugs.includes(slug)) problems.slug = 'Another quote already uses this link.'
  if (!DATE_RE.test(form.addedOn)) problems.addedOn = 'Pick the day you added it.'
  if (form.editedOn) {
    if (!DATE_RE.test(form.editedOn)) problems.editedOn = 'That is not a date.'
    else if (DATE_RE.test(form.addedOn) && form.editedOn < form.addedOn) problems.editedOn = 'It cannot be edited before it was added.'
  }
  return problems
}

const oldestFirst = (a, b) => a.addedOn.localeCompare(b.addedOn) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))

export const sortQuotes = (quotes) => [...quotes].sort(oldestFirst).reverse()

export function arrangeQuotes(quotes) {
  const all = [...quotes]
    .sort(oldestFirst)
    .map((quote, i) => ({ ...quote, number: i + 1 }))
    .reverse()
  const featured = all.find((quote) => quote.featured) ?? all[0] ?? null
  return { all, featured, more: all.filter((quote) => quote !== featured) }
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export const formatQuoteDate = (iso) => DATE.format(new Date(`${iso}T00:00:00Z`))

export const quoteNumber = (n) => String(n).padStart(2, '0')
