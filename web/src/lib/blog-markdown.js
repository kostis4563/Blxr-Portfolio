import { Marked } from 'marked'

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const FIELDS = ['title', 'date', 'updated', 'description', 'tags', 'cover', 'draft']
const WORDS_PER_MINUTE = 220
const EXCERPT_MAX = 180

const CALLOUTS = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' }
const LANG_LABELS = { js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX', sh: 'Shell', bash: 'Bash', zsh: 'Shell', py: 'Python', md: 'Markdown', yml: 'YAML' }

const unquote = (s) => (/^(["']).*\1$/.test(s) ? s.slice(1, -1) : s)

function parseValue(raw) {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (/^\[.*\]$/.test(raw)) return raw.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean)
  return unquote(raw)
}

export function parseFrontmatter(source, file = 'post') {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source)
  if (!match) throw new Error(`${file}: start the file with a --- block holding at least title and date`)

  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (!kv) throw new Error(`${file}: can't read the frontmatter line "${line}" — use key: value`)
    if (!FIELDS.includes(kv[1])) {
      throw new Error(`${file}: unknown frontmatter key "${kv[1]}" — use ${FIELDS.join(', ')}`)
    }
    data[kv[1]] = parseValue(kv[2].trim())
  }
  return { data, body: source.slice(match[0].length) }
}

const quoteIfNeeded = (value) => {
  const s = String(value).replace(/\s+/g, ' ').trim()
  return /^(true|false)$|^[[\]"']|["']$/.test(s) ? `"${s}"` : s
}

export function serializePost({ title, date, updated, description, tags, cover, draft }, body) {
  const lines = [`title: ${quoteIfNeeded(title)}`, `date: ${date}`]
  if (updated && updated !== date) lines.push(`updated: ${updated}`)
  if (description?.trim()) lines.push(`description: ${quoteIfNeeded(description)}`)
  const cleanTags = (tags || []).map((t) => t.trim().toLowerCase().replace(/[,[\]"']/g, '')).filter(Boolean)
  if (cleanTags.length) lines.push(`tags: [${[...new Set(cleanTags)].join(', ')}]`)
  if (cover?.trim()) lines.push(`cover: ${cover.trim()}`)
  if (draft) lines.push('draft: true')
  const text = body.replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\s+$/, '')
  return `---\n${lines.join('\n')}\n---\n\n${text}\n`
}

const stripTags = (html) => html.replace(/<[^>]+>/g, '')
const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
export const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const plain = (markdown) =>
  markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

function excerptOf(tokens) {
  const first = tokens.find((t) => t.type === 'paragraph' && plain(t.text))
  if (!first) return ''
  const text = plain(first.text)
  if (text.length <= EXCERPT_MAX) return text
  return `${text.slice(0, EXCERPT_MAX).replace(/\s+\S*$/, '')}…`
}

function wordCount(tokens) {
  let words = 0
  const walk = (list) => {
    for (const t of list) {
      if (t.type === 'code') words += t.text.split(/\s+/).filter(Boolean).length / 3
      else if (t.tokens) walk(t.tokens)
      else if (t.items) walk(t.items)
      else if (typeof t.text === 'string' && t.type === 'text') words += plain(t.text).split(' ').filter(Boolean).length
    }
  }
  walk(tokens)
  return Math.round(words)
}

export function readMeta(slug, source, file) {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`${file}: name the file in lowercase-with-dashes, e.g. my-first-post.md — it becomes /blog/<name>`)
  }
  const { data, body } = parseFrontmatter(source, file)
  if (typeof data.title !== 'string' || !data.title) throw new Error(`${file}: frontmatter needs a title`)
  for (const key of ['date', 'updated']) {
    if (data[key] !== undefined && !DATE_RE.test(data[key])) {
      throw new Error(`${file}: ${key} must look like 2026-10-06, got "${data[key]}"`)
    }
  }
  if (!data.date) throw new Error(`${file}: frontmatter needs a date (YYYY-MM-DD)`)
  if (data.cover !== undefined && !String(data.cover).startsWith('/')) {
    throw new Error(`${file}: cover is a path under web/public, starting with / (e.g. /blog/my-post.webp)`)
  }

  const tokens = new Marked().lexer(body)
  const words = wordCount(tokens)
  const tags = Array.isArray(data.tags) ? data.tags : data.tags ? String(data.tags).split(',').map((t) => t.trim()) : []

  return {
    meta: {
      slug,
      title: data.title,
      date: data.date,
      updated: data.updated && data.updated !== data.date ? data.updated : null,
      description: data.description || excerptOf(tokens),
      tags: tags.filter(Boolean).map((t) => t.toLowerCase()),
      cover: data.cover || null,
      draft: data.draft === true,
      words,
      minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    },
    body,
  }
}

export function parseInfo(info = '') {
  const [lang = '', ...rest] = info.trim().split(/\s+/)
  const [name, inlineTitle] = lang.split(':')
  const title = /title=(["']?)(.+?)\1$/.exec(rest.join(' '))?.[2] || inlineTitle || ''
  return { lang: name.toLowerCase(), title }
}

export const slugify = (text) =>
  decode(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'section'

const GREEK = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o' }

export const postSlugFor = (title) =>
  String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ου/g, 'ou')
    .replace(/[α-ω]/g, (c) => GREEK[c] ?? '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')

export function codeLangs(body) {
  const langs = new Set()
  const marked = new Marked()
  marked.walkTokens(marked.lexer(body), (t) => {
    if (t.type !== 'code') return
    const { lang } = parseInfo(t.lang)
    if (lang) langs.add(lang)
  })
  return [...langs]
}

const plainCode = (text) => `<pre class="shiki"><code>${escapeHtml(text)}</code></pre>`

export function renderMarkdown(body, { highlight = plainCode } = {}) {
  const marked = new Marked()
  const toc = []
  const used = new Map()
  const uniqueId = (base) => {
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    return n ? `${base}-${n}` : base
  }

  marked.use({
    renderer: {
      heading({ tokens: inline, depth }) {
        const level = Math.min(Math.max(depth, 2), 6)
        const html = this.parser.parseInline(inline)
        const text = decode(stripTags(html)).trim()
        const id = uniqueId(slugify(text))
        if (level <= 3) toc.push({ id, text, depth: level })
        return (
          `<h${level} id="${id}"><a class="heading-anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>` +
          `${html}</h${level}>\n`
        )
      },

      code({ text, lang: info }) {
        const { lang, title } = parseInfo(info)
        const pre = highlight(text.replace(/\n$/, ''), lang)
        const label = title || LANG_LABELS[lang] || lang || 'Text'
        return (
          `<figure class="code-block" data-lang="${escapeHtml(lang || 'text')}">` +
          `<figcaption><span class="code-title">${escapeHtml(label)}</span>` +
          `<button type="button" class="code-copy" data-copy>Copy</button></figcaption>` +
          `${pre}</figure>\n`
        )
      },

      paragraph({ tokens: inline }) {
        const only = inline.filter((t) => !(t.type === 'text' && !t.text.trim()))
        if (only.length === 1 && only[0].type === 'image') {
          const { href, title, text } = only[0]
          const caption = title || ''
          return (
            `<figure class="post-figure"><img src="${escapeHtml(href)}" alt="${escapeHtml(text)}" loading="lazy" decoding="async" />` +
            (caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '') +
            '</figure>\n'
          )
        }
        return `<p>${this.parser.parseInline(inline)}</p>\n`
      },

      image({ href, title, text }) {
        const t = title ? ` title="${escapeHtml(title)}"` : ''
        return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${t} loading="lazy" decoding="async" />`
      },

      link({ href, title, tokens: inline }) {
        const inner = this.parser.parseInline(inline)
        const t = title ? ` title="${escapeHtml(title)}"` : ''
        const external = /^https?:\/\//.test(href)
        return external
          ? `<a href="${escapeHtml(href)}"${t} target="_blank" rel="noreferrer" class="external">${inner}</a>`
          : `<a href="${escapeHtml(href)}"${t}>${inner}</a>`
      },

      blockquote({ tokens: inner }) {
        const html = this.parser.parse(inner)
        const callout = /^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/.exec(html)
        if (!callout) return `<blockquote>\n${html}</blockquote>\n`
        const kind = callout[1]
        const after = html.slice(callout[0].length)
        const rest = after.startsWith('</p>') ? after.replace(/^<\/p>\s*/, '') : `<p>${after}`
        return (
          `<aside class="callout" data-kind="${kind.toLowerCase()}">` +
          `<p class="callout-title">${CALLOUTS[kind]}</p>${rest}</aside>\n`
        )
      },

      hr() {
        return '<hr />\n'
      },
    },
  })

  const html = marked
    .parser(marked.lexer(body))
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>')

  return { html, toc }
}
