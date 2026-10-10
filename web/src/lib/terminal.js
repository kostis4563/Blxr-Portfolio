import { version as REACT_VERSION } from 'react'
import {
  HOME_PATH,
  PROJECTS_PATH,
  LIBRARY_PATH,
  BLOG_PATH,
  REVIEWS_PATH,
  USES_PATH,
  CV_PATH,
  SECURITY_PATH,
  IB_PATH,
  LISTENING_PATH,
  CONTACT_PATH,
  PAYMENT_PATH,
  LINKS_PATH,
  VOLUNTEER_PATH,
  GALLERY_PATH,
  TERMINAL_PATH,
  projectPath,
  libraryPath,
  blogPath,
} from './router'
import { projectsList } from './projects'
import { libraryList } from './library'
import { postsList } from './blog'
import { SKILL_CATEGORIES, SKILL_LEVELS } from './skills'
import { CV_NAME, CV_LOCATION, CV_ROLE, CV_SUMMARY, CV_EXPERIENCE, CV_EDUCATION, CV_LANGUAGES } from './cv'
import { DESK, TERMINAL, PIPELINE } from './uses'
import { CONTACT_EMAIL, GITHUB_URL, GITHUB_USERNAME, DISCORD_URL } from './profile'
import { LINKS } from './links'
import { artistLine, formatDuration, nowStatus, progressAt } from './listening'
import { editDistance } from './route-suggest'
import { fold } from './text-match'

export const USER = 'visitor'
export const HOST = 'blxr'
export const HOME_DIR = `/home/${USER}`
export const SHELL = 'blxrsh'
export const SHELL_VERSION = '1.0.0'

const STUDIO_URL = 'https://amitista.com'

const t = (text, tone) => ({ text, tone })
const dim = (text) => t(text, 'dim')
const muted = (text) => t(text, 'muted')
const strong = (text) => t(text, 'strong')
const ok = (text) => t(text, 'ok')
const warn = (text) => t(text, 'warn')
const err = (text) => t(text, 'err')
const run = (text, cmd = text) => ({ text, cmd, tone: 'link' })
const go = (text, to) => ({ text, to, tone: 'link' })
const ext = (text, href) => ({ text, href, tone: 'link' })
const art = (...parts) => ({ pre: true, parts })
const BLANK = []
const fail = (...parts) => [[err(parts[0]), ...parts.slice(1)]]

const pad = (text, width) => String(text).padEnd(width)
const widest = (items) => Math.max(0, ...items.map((item) => String(item).length))
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const periodOf = ({ from, to, present }) => `${from} – ${present ? 'present' : to}`

const joinParts = (items, separator = dim(' · ')) => items.flatMap((item, i) => (i ? [separator, item] : [item]))

export const PAGES = [
  { name: 'home', to: HOME_PATH, desc: 'the front page' },
  { name: 'projects', to: PROJECTS_PATH, desc: 'everything I have built' },
  { name: 'library', to: LIBRARY_PATH, desc: 'FiveM interfaces and scripts' },
  { name: 'blog', to: BLOG_PATH, desc: 'writing' },
  { name: 'gallery', to: GALLERY_PATH, desc: 'photos and UI design' },
  { name: 'cv', to: CV_PATH, desc: 'the printable version' },
  { name: 'uses', to: USES_PATH, desc: 'desk, machine and software' },
  { name: 'reviews', to: REVIEWS_PATH, desc: 'what clients say' },
  { name: 'listening', to: LISTENING_PATH, desc: 'live from Spotify' },
  { name: 'volunteer', to: VOLUNTEER_PATH, desc: 'events I gave time to' },
  { name: 'ib', to: IB_PATH, desc: 'IB grade calculator' },
  { name: 'contact', to: CONTACT_PATH, desc: 'how to reach me' },
  { name: 'links', to: LINKS_PATH, desc: 'every link on one page' },
  { name: 'payment', to: PAYMENT_PATH, desc: 'how to pay' },
  { name: 'security', to: SECURITY_PATH, desc: 'report a vulnerability' },
  { name: 'terminal', to: TERMINAL_PATH, desc: 'you are here' },
]

const PAGE_ALIASES = {
  '': 'home',
  '~': 'home',
  '..': 'home',
  index: 'home',
  resume: 'cv',
  volunteering: 'volunteer',
  music: 'listening',
  spotify: 'listening',
  photos: 'gallery',
  pay: 'payment',
}

const cleanPath = (name) =>
  String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/^~\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')

export function findPage(name) {
  const key = cleanPath(name)
  const resolved = PAGE_ALIASES[key] ?? key
  return PAGES.find((page) => page.name === resolved) ?? null
}

const EXTERNAL = {
  github: { label: 'GitHub', href: GITHUB_URL, value: GITHUB_URL },
  discord: { label: 'Discord', href: DISCORD_URL, value: DISCORD_URL },
  email: { label: 'email', href: `mailto:${CONTACT_EMAIL}`, value: CONTACT_EMAIL },
  studio: { label: 'Amitista Studio', href: STUDIO_URL, value: STUDIO_URL },
}

const findProject = (query) => {
  const key = fold(String(query ?? '').trim()).replace(/\.md$/, '')
  if (!key) return null
  return (
    projectsList.find((project) => project.id === key) ??
    projectsList.find((project) => fold(project.title) === key) ??
    projectsList.find((project) => fold(project.title).startsWith(key) || project.id.startsWith(key)) ??
    null
  )
}

const findLibrary = (query) => {
  const key = fold(String(query ?? '').trim()).replace(/\.md$/, '')
  return libraryList.find((entry) => entry.id === key || fold(entry.title) === key) ?? null
}

const findBlogPost = (query) => {
  const key = String(query ?? '').trim().replace(/\.md$/, '')
  return postsList.find((post) => post.slug === key) ?? null
}

const BANNER = [
  ' _     _',
  '| |__ | |_  ___ __',
  "| '_ \\| \\ \\/ / '__|",
  '| |_) | |>  <| |',
  '|_.__/|_/_/\\_\\_|',
]

const LOGO = [
  '  ███             ',
  '  ███             ',
  '  ███  ██████     ',
  '  █████    ███    ',
  '  ███       ███   ',
  '  ███       ███   ',
  '  █████    ███    ',
  '  ███ ██████      ',
]

const FORTUNES = [
  'There are only two hard things in Computer Science: cache invalidation and naming things. — Phil Karlton',
  'Simplicity is prerequisite for reliability. — Edsger W. Dijkstra',
  'First, solve the problem. Then, write the code. — John Johnson',
  'Weeks of coding can save you hours of planning.',
  'Deleted code is debugged code.',
  'It works on my machine. Ship the machine.',
  '99 little bugs in the code. Take one down, patch it around. 127 little bugs in the code.',
  'The best error message is the one that never shows up.',
  'A user interface is like a joke. If you have to explain it, it is not that good.',
  'Real programmers count from 0.',
  'The IB Diploma is a two year side quest with a word count.',
  'Every great site has a terminal nobody asked for. Hi.',
]

const ENV = (ctx) => ({
  USER,
  HOME: HOME_DIR,
  SHELL: `/bin/${SHELL}`,
  PWD: HOME_DIR,
  HOSTNAME: 'blxr.net',
  LANG: 'en_GB.UTF-8',
  THEME: ctx.theme ?? 'dark',
  TERM: 'xterm-256color',
  EDITOR: 'code',
})

export function tokenize(input) {
  const tokens = []
  let current = ''
  let quote = null
  let started = false
  for (const ch of String(input ?? '')) {
    if (quote) {
      if (ch === quote) quote = null
      else current += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      started = true
      continue
    }
    if (/\s/.test(ch)) {
      if (started) tokens.push(current)
      current = ''
      started = false
      continue
    }
    current += ch
    started = true
  }
  if (started) tokens.push(current)
  return tokens
}

export function splitChain(input) {
  const parts = []
  let current = ''
  let quote = null
  const src = String(input ?? '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === quote) quote = null
      current += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    if (ch === ';' || (ch === '&' && src[i + 1] === '&')) {
      parts.push(current)
      current = ''
      if (ch === '&') i += 1
      continue
    }
    current += ch
  }
  parts.push(current)
  return parts.map((part) => part.trim()).filter(Boolean)
}

export function expandHistory(input, history = []) {
  const raw = String(input ?? '')
  if (!/!(!|-?\d+)/.test(raw)) return raw
  let missing = false
  const expanded = raw.replace(/!(!|-?\d+)/g, (match, ref) => {
    let entry
    if (ref === '!') entry = history[history.length - 1]
    else {
      const n = Number(ref)
      entry = n < 0 ? history[history.length + n] : history[n - 1]
    }
    if (entry === undefined) missing = true
    return entry ?? match
  })
  return missing ? null : expanded
}

const expandVars = (token, ctx) =>
  token.replace(/\$(\w+)|\$\{(\w+)\}/g, (match, a, b) => {
    const value = ENV(ctx)[a ?? b]
    return value === undefined ? '' : value
  })

export function calculate(expression) {
  const src = String(expression ?? '')
    .replace(/\s+/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\*\*/g, '^')
    .toLowerCase()
  if (!src) throw new Error('empty')
  let i = 0

  const number = () => {
    if (src.startsWith('pi', i)) {
      i += 2
      return Math.PI
    }
    const match = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(src.slice(i))
    if (!match) throw new Error('syntax')
    i += match[0].length
    return parseFloat(match[0])
  }

  const atom = () => {
    if (src[i] === '(') {
      i += 1
      const value = sum()
      if (src[i] !== ')') throw new Error('syntax')
      i += 1
      return value
    }
    return number()
  }

  const power = () => {
    const base = atom()
    if (src[i] !== '^') return base
    i += 1
    return base ** unary()
  }

  const unary = () => {
    if (src[i] === '-') {
      i += 1
      return -unary()
    }
    if (src[i] === '+') {
      i += 1
      return unary()
    }
    return power()
  }

  const product = () => {
    let value = unary()
    while (src[i] === '*' || src[i] === '/' || src[i] === '%') {
      const op = src[i]
      i += 1
      const right = unary()
      if (op === '*') value *= right
      else if (op === '/') value /= right
      else value %= right
    }
    return value
  }

  function sum() {
    let value = product()
    while (src[i] === '+' || src[i] === '-') {
      const op = src[i]
      i += 1
      const right = product()
      value = op === '+' ? value + right : value - right
    }
    return value
  }

  const result = sum()
  if (i !== src.length) throw new Error('syntax')
  if (!Number.isFinite(result)) throw new Error('infinite')
  return Number(result.toPrecision(12))
}

const looksLikeMath = (input) => /^[\d\s+\-*/%^().×÷]+$/.test(input) && /\d/.test(input) && /[+\-*/%^×÷]/.test(input)

const shortHash = (text) => {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 7)
}

function wrap(text, width) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    if (current && (current + ' ' + word).length > width) {
      lines.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function cowsay(text) {
  const lines = wrap(text, 36)
  const width = widest(lines)
  const border = (ch) => ` ${ch.repeat(width + 2)}`
  const body =
    lines.length === 1
      ? [`< ${lines[0]} >`]
      : lines.map((line, i) => {
          const [l, r] = i === 0 ? ['/', '\\'] : i === lines.length - 1 ? ['\\', '/'] : ['|', '|']
          return `${l} ${pad(line, width)} ${r}`
        })
  return [
    border('_'),
    ...body,
    border('-'),
    '        \\   ^__^',
    '         \\  (oo)\\_______',
    '            (__)\\       )\\/\\',
    '                ||----w |',
    '                ||     ||',
  ].map((line) => art(line))
}

const athensParts = (now, opts) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', ...opts }).format(now)

function athensOffsetMinutes(now) {
  const label = athensParts(now, { timeZoneName: 'longOffset' })
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(label)
  if (!match) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0)
  return match[1] === '-' ? -minutes : minutes
}

function formatUptime(ms) {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return `${Math.max(1, Math.floor(ms / 1000))} sec`
  if (minutes < 60) return plural(minutes, 'min', 'min')
  const hours = Math.floor(minutes / 60)
  return `${plural(hours, 'hour')}, ${plural(minutes % 60, 'min', 'min')}`
}

function calendar(now) {
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const days = new Date(year, month + 1, 0).getDate()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const title = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(now)
  const lines = [art(strong(title.padStart(Math.floor((20 + title.length) / 2)))), art(dim('Mo Tu We Th Fr Sa Su'))]
  let week = []
  const flush = () => {
    lines.push(art(...week))
    week = []
  }
  for (let i = 0; i < offset; i++) week.push('   ')
  for (let day = 1; day <= days; day++) {
    const cell = String(day).padStart(2)
    week.push(day === today ? t(cell, 'invert') : cell)
    if ((offset + day) % 7 === 0) flush()
    else if (day < days) week.push(' ')
  }
  if (week.length) flush()
  return lines
}

const HOME_FILES = ['README.md', 'about.txt', 'contact.txt', 'skills.txt', 'experience.txt', 'uses.txt']
const HIDDEN_FILES = ['.secrets', '.zsh_history', '.plan']
const DIRS = {
  projects: () => projectsList.map((project) => `${project.id}.md`),
  library: () => libraryList.map((entry) => `${entry.id}.md`),
  blog: () => postsList.map((post) => `${post.slug}.md`),
}

const fileCommand = {
  'README.md': 'readme',
  'about.txt': 'about',
  'contact.txt': 'contact',
  'skills.txt': 'skills',
  'experience.txt': 'experience',
  'uses.txt': 'uses',
  '.secrets': 'secrets',
  '.zsh_history': 'history',
}

function readFile(path, ctx) {
  const clean = cleanPath(path)
  const [dir, file, ...rest] = clean.split('/')
  if (rest.length) return null
  if (!file) {
    if (DIRS[dir]) return { dir: true }
    const command = fileCommand[path.replace(/^~\//, '')] ?? fileCommand[clean]
    if (command) return { lines: execCommand(command, [], ctx) }
    if (clean === '.plan') return { lines: [['ship more, explain less.'], [dim('updated whenever I remember this file exists')]] }
    return null
  }
  if (dir === 'projects') {
    const project = projectsList.find((p) => `${p.id}.md` === file || p.id === file)
    return project ? { lines: projectDetails(project) } : null
  }
  if (dir === 'library') {
    const entry = libraryList.find((e) => `${e.id}.md` === file || e.id === file)
    return entry ? { lines: libraryDetails(entry) } : null
  }
  if (dir === 'blog') {
    const post = findBlogPost(file)
    return post ? { lines: postDetails(post) } : null
  }
  return null
}

function projectDetails(project) {
  const lines = [
    [strong(project.title), dim(`  ${[project.badge, project.date].filter(Boolean).join(' · ')}`)],
    [muted(project.category ?? '')],
    BLANK,
    [project.shortDescription ?? ''],
  ]
  if (project.features?.length) {
    lines.push(BLANK)
    for (const feature of project.features) lines.push([dim('  • '), feature])
  }
  lines.push(BLANK)
  if (project.tags?.length) lines.push([dim('stack  '), project.tags.join(' · ')])
  if (project.url) lines.push([dim('site   '), ext(project.url.replace(/^https?:\/\//, ''), project.url)])
  if (project.github) lines.push([dim('code   '), ext(project.github.replace(/^https?:\/\//, ''), project.github)])
  lines.push(BLANK, [dim('case study → '), go(projectPath(project.id), projectPath(project.id))])
  return lines
}

function libraryDetails(entry) {
  const lines = [
    [strong(entry.title), dim(`  ${[entry.category, entry.date].filter(Boolean).join(' · ')}`)],
    BLANK,
    [entry.shortDescription ?? ''],
  ]
  if (entry.tags?.length) lines.push(BLANK, [dim('stack  '), entry.tags.join(' · ')])
  lines.push(BLANK, [dim('open → '), go(libraryPath(entry.id), libraryPath(entry.id))])
  return lines
}

function postDetails(post) {
  const lines = [[strong(post.title), dim(`  ${post.date}`)]]
  if (post.description) lines.push(BLANK, [post.description])
  lines.push(BLANK, [dim('read it → '), go(blogPath(post.slug), blogPath(post.slug))])
  return lines
}

function lsLines(target, flags) {
  const all = flags.includes('a')
  const long = flags.includes('l')
  const clean = cleanPath(target)

  if (target === '/' || clean === 'pages') {
    return PAGES.map((page) => [{ ...run(pad(`${page.name}/`, 12), `cd ${page.name}`), tone: 'dir' }, dim(page.desc)])
  }

  if (clean === '' || clean === '~' || target === HOME_DIR) {
    const dirs = Object.keys(DIRS)
    const files = [...HOME_FILES, ...(all ? HIDDEN_FILES : [])]
    if (long) {
      return [
        [dim(`total ${dirs.length + files.length}`)],
        ...dirs.map((name) => [dim(`drwxr-xr-x  ${USER}  ${pad(DIRS[name]().length, 3)}  `), { ...run(`${name}/`, `ls ${name}`), tone: 'dir' }]),
        ...files.map((name) => [dim(`-rw-r--r--  ${USER}  1    `), run(name, `cat ${name}`)]),
      ]
    }
    return [
      [
        ...(all ? [dim('.  ..  ')] : []),
        ...joinParts(
          [...dirs.map((name) => ({ ...run(`${name}/`, `ls ${name}`), tone: 'dir' })), ...files.map((name) => run(name, `cat ${name}`))],
          '  ',
        ),
      ],
    ]
  }

  const [dir, file] = clean.split('/')
  if (DIRS[dir] && !file) {
    const files = DIRS[dir]()
    if (!files.length) return [[dim(`${dir}/ is empty for now`)]]
    if (long) return files.map((name) => [dim(`-rw-r--r--  ${USER}  `), run(name, `cat ${dir}/${name}`)])
    return files.map((name) => [run(name, `cat ${dir}/${name}`)])
  }
  if (DIRS[dir] && file && DIRS[dir]().includes(file)) return [[`${dir}/${file}`]]
  if ([...HOME_FILES, ...HIDDEN_FILES].includes(clean)) return [[clean]]
  return fail(`ls: ${target}: No such file or directory`)
}

function treeLines() {
  const lines = [art(strong('~'))]
  const entries = [...HOME_FILES.map((name) => ({ name })), ...Object.keys(DIRS).map((name) => ({ name, children: DIRS[name]() }))]
  entries.forEach((entry, i) => {
    const last = i === entries.length - 1
    const branch = last ? '└── ' : '├── '
    if (!entry.children) {
      lines.push(art(dim(branch), run(entry.name, `cat ${entry.name}`)))
      return
    }
    lines.push(art(dim(branch), { ...run(`${entry.name}/`, `ls ${entry.name}`), tone: 'dir' }))
    entry.children.forEach((child, j) => {
      const childBranch = j === entry.children.length - 1 ? '└── ' : '├── '
      lines.push(art(dim(`${last ? '    ' : '│   '}${childBranch}`), run(child, `cat ${entry.name}/${child}`)))
    })
  })
  const files = HOME_FILES.length + Object.values(DIRS).reduce((n, list) => n + list().length, 0)
  lines.push(BLANK, [dim(`${plural(Object.keys(DIRS).length, 'directory', 'directories')}, ${plural(files, 'file')}`)])
  return lines
}

function suggestCommand(name) {
  const asked = name.toLowerCase()
  let best = null
  let bestScore = Infinity
  for (const candidate of [...Object.keys(COMMANDS), ...Object.keys(ALIASES)]) {
    if (COMMANDS[ALIASES[candidate] ?? candidate]?.hidden) continue
    const score = editDistance(asked, candidate)
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
  }
  const limit = asked.length <= 3 ? 1 : 2
  return bestScore <= limit ? ALIASES[best] ?? best : null
}

function navigateTo(page, ctx) {
  if (page.name === 'terminal') return [[dim('already here. this is the terminal.')]]
  ctx.navigate?.(page.to)
  return [[dim('→ '), go(page.to, page.to), dim(`  ${page.desc}`)]]
}

const fx = (name, reply) => (args, ctx) => {
  ctx.fx?.(name)
  return reply
}

const GROUPS = ['About me', 'Work', 'Get around', 'Live', 'Shell', 'Fun']

export const COMMANDS = {
  help: {
    group: 'Shell',
    summary: 'list commands, or explain one',
    usage: 'help [command]',
    args: () => visibleCommands(),
    run(args) {
      if (args[0]) return helpFor(args[0])
      const visible = Object.entries(COMMANDS).filter(([, command]) => !command.hidden)
      const width = widest(visible.map(([name]) => name)) + 3
      const lines = [[strong(`${SHELL} ${SHELL_VERSION}`), dim(' — Tab completes, ↑ ↓ walks history, Ctrl+L clears')]]
      for (const group of GROUPS) {
        const inGroup = visible.filter(([, command]) => command.group === group)
        if (!inGroup.length) continue
        lines.push(BLANK, [muted(group.toLowerCase())])
        for (const [name, command] of inGroup) lines.push(['  ', run(pad(name, width), name), dim(command.summary)])
      }
      lines.push(BLANK, [dim('help <command> for details · '), run('secrets'), dim(' for the hidden ones')])
      return lines
    },
  },
  about: {
    group: 'About me',
    summary: 'who is behind this',
    run: () => [
      [strong(CV_NAME), dim(' — blxr')],
      [CV_ROLE],
      [muted(CV_LOCATION)],
      BLANK,
      [CV_SUMMARY],
      BLANK,
      [dim('more: '), ...joinParts([run('skills'), run('experience'), run('projects'), run('contact')])],
    ],
  },
  whoami: {
    group: 'About me',
    summary: 'who you are, as far as this shell knows',
    run: () => [[USER], [dim('the site belongs to Kostis. '), run('about'), dim(' to meet him')]],
  },
  skills: {
    group: 'About me',
    summary: 'languages, frameworks and tools',
    run() {
      const lines = []
      for (const category of SKILL_CATEGORIES) {
        if (lines.length) lines.push(BLANK)
        lines.push([muted(category.name.toLowerCase())])
        if (category.minor) {
          lines.push(['  ', category.items.map((item) => item.name).join(', ')])
          continue
        }
        const width = widest(category.items.map((item) => item.name)) + 3
        for (const item of category.items) {
          const level = SKILL_LEVELS[item.level]?.label
          lines.push(['  ', strong(pad(item.name, width)), dim(level ? level.toLowerCase() : '')])
        }
      }
      return lines
    },
  },
  experience: {
    group: 'About me',
    summary: 'where I have worked',
    run: () =>
      CV_EXPERIENCE.flatMap((job, i) => [
        ...(i ? [BLANK] : []),
        [strong(job.role), dim(' · '), job.url ? ext(job.org, job.url) : job.org, dim(`  ${periodOf(job.period)}`)],
        [muted(job.summary)],
      ]),
  },
  education: {
    group: 'About me',
    summary: 'school, and what I study',
    run: () => [
      ...CV_EDUCATION.flatMap((entry) => [
        [strong(entry.degree), dim(` · ${entry.org}  ${periodOf(entry.period)}`)],
        [muted(entry.note)],
      ]),
      BLANK,
      [muted('languages')],
      ...CV_LANGUAGES.map((language) => ['  ', pad(language.name, 10), dim(language.level)]),
    ],
  },
  cv: {
    group: 'About me',
    summary: 'the short CV, and a link to the full one',
    run: (args, ctx) => [
      [strong(CV_NAME), dim(` · ${CV_LOCATION}`)],
      [CV_ROLE],
      BLANK,
      ...execCommand('experience', [], ctx),
      BLANK,
      [dim('full, printable CV → '), go(CV_PATH, CV_PATH)],
    ],
  },
  projects: {
    group: 'Work',
    summary: 'everything I have built',
    run() {
      const width = widest(projectsList.map((project) => project.id)) + 3
      return [
        [dim(`${plural(projectsList.length, 'project')} · project <id> for the details`)],
        BLANK,
        ...projectsList.map((project) => [
          run(pad(project.id, width), `project ${project.id}`),
          strong(project.title),
          dim(`  ${[project.badge, project.date].filter(Boolean).join(' · ')}`),
        ]),
      ]
    },
  },
  project: {
    group: 'Work',
    summary: 'one project in detail',
    usage: 'project <id>',
    args: () => projectsList.map((project) => project.id),
    run(args, ctx) {
      if (!args.length) return [[err('usage: project <id>')], ...execCommand('projects', [], ctx).slice(2)]
      const project = findProject(args.join(' '))
      if (!project) return fail(`project: no project called ${args.join(' ')}. try `, run('projects'))
      return projectDetails(project)
    },
  },
  library: {
    group: 'Work',
    summary: 'FiveM interfaces and scripts',
    run() {
      const width = widest(libraryList.map((entry) => entry.id)) + 3
      return [
        [dim(`${plural(libraryList.length, 'entry', 'entries')} · cat library/<id>.md for one`)],
        BLANK,
        ...libraryList.map((entry) => [
          run(pad(entry.id, width), `cat library/${entry.id}.md`),
          strong(entry.title),
          dim(`  ${[entry.category, entry.date].filter(Boolean).join(' · ')}`),
        ]),
      ]
    },
  },
  blog: {
    group: 'Work',
    summary: 'posts, newest first',
    run() {
      if (!postsList.length) return [[dim('no posts yet. the blog is warming up → '), go(BLOG_PATH, BLOG_PATH)]]
      return postsList.map((post) => [dim(`${post.date}  `), go(post.title, blogPath(post.slug))])
    },
  },
  uses: {
    group: 'Work',
    summary: 'the desk, the machine and the pipeline',
    run() {
      const width = widest(DESK.map((item) => item.kind)) + 3
      return [
        ...DESK.map((item) => [dim(pad(item.kind.toLowerCase(), width)), strong(item.name), dim(`  ${item.specs.join(' · ')}`)]),
        BLANK,
        [muted(`${TERMINAL.app} · ${TERMINAL.font}`)],
        ...TERMINAL.lines.map((line) => [dim('$ '), pad(line.cmd, 26), strong(line.out)]),
        BLANK,
        [muted('shipping')],
        [...joinParts(PIPELINE.map((step) => step.name), dim(' → '))],
      ]
    },
  },
  contact: {
    group: 'Work',
    summary: 'how to reach me',
    run: () => [
      [dim('email     '), ext(CONTACT_EMAIL, `mailto:${CONTACT_EMAIL}`)],
      [dim('discord   '), ext('blxr__', DISCORD_URL)],
      [dim('github    '), ext(GITHUB_USERNAME, GITHUB_URL)],
      [dim('studio    '), ext('amitista.com', STUDIO_URL)],
      BLANK,
      [dim('or start a private thread → '), go(CONTACT_PATH, CONTACT_PATH)],
      [run('copy email', 'copy email'), dim(' puts the address on your clipboard')],
    ],
  },
  socials: {
    group: 'Work',
    summary: 'every link, like /links',
    run() {
      const width = widest(LINKS.map((item) => item.label)) + 3
      return LINKS.map((item) => [dim(pad(item.label.toLowerCase(), width)), ext(item.detail, item.href)])
    },
  },
  hire: {
    group: 'Work',
    summary: 'the useful one',
    run: () => [
      [ok('✓ '), 'open for client work through Amitista Studio'],
      [dim('  sites, dashboards, backends and the servers they run on')],
      BLANK,
      [dim('start here → '), go(CONTACT_PATH, CONTACT_PATH), dim('  or  '), ext(CONTACT_EMAIL, `mailto:${CONTACT_EMAIL}`)],
    ],
  },
  ls: {
    group: 'Get around',
    summary: 'list files. ls / lists the site pages',
    usage: 'ls [-la] [dir]',
    args: () => ['/', ...Object.keys(DIRS).map((dir) => `${dir}/`)],
    run(args) {
      const flags = args.filter((arg) => arg.startsWith('-')).join('').replace(/-/g, '')
      const target = args.find((arg) => !arg.startsWith('-')) ?? '~'
      return lsLines(target, flags)
    },
  },
  cd: {
    group: 'Get around',
    summary: 'go to a page on the site',
    usage: 'cd <page>',
    args: () => PAGES.map((page) => page.name),
    run(args, ctx) {
      const target = args[0]
      if (target === undefined || target === '~' || target === HOME_DIR) return null
      const page = findPage(target)
      if (!page) {
        const guess = suggestPage(target)
        return fail(`cd: no such page: ${target}`, ...(guess ? [dim('. did you mean '), run(guess, `cd ${guess}`), dim('?')] : []))
      }
      return navigateTo(page, ctx)
    },
  },
  open: {
    group: 'Get around',
    summary: 'open a page, a project, or github / discord / email / studio',
    usage: 'open <page | project | github | discord | email | studio>',
    args: () => [...PAGES.map((page) => page.name), ...projectsList.map((project) => project.id), ...Object.keys(EXTERNAL)],
    run(args, ctx) {
      const target = args.join(' ')
      if (!target) return fail('usage: open <page | project | github | discord | email | studio>')
      const key = target.toLowerCase()
      if (EXTERNAL[key]) {
        ctx.openUrl?.(EXTERNAL[key].href)
        return [[dim('opening '), ext(EXTERNAL[key].label, EXTERNAL[key].href), dim('…')]]
      }
      const page = findPage(target)
      if (page) return navigateTo(page, ctx)
      const [dir, file] = cleanPath(target).split('/')
      if (dir === 'library' && file) {
        const entry = findLibrary(file)
        if (entry) {
          ctx.navigate?.(libraryPath(entry.id))
          return [[dim('→ '), go(libraryPath(entry.id), libraryPath(entry.id))]]
        }
      }
      if (dir === 'blog' && file) {
        const post = findBlogPost(file)
        if (post) {
          ctx.navigate?.(blogPath(post.slug))
          return [[dim('→ '), go(blogPath(post.slug), blogPath(post.slug))]]
        }
      }
      const project = findProject(dir === 'projects' && file ? file : target)
      if (project) {
        ctx.navigate?.(projectPath(project.id))
        return [[dim('→ '), go(projectPath(project.id), projectPath(project.id)), dim(`  ${project.title}`)]]
      }
      return fail(`open: nothing called ${target}`)
    },
  },
  cat: {
    group: 'Get around',
    summary: 'print a file',
    usage: 'cat <file>',
    args: (ctx, prior, word = '') => {
      const nested = word.includes('/')
      if (!nested) return [...HOME_FILES, ...(word.startsWith('.') ? HIDDEN_FILES : []), ...Object.keys(DIRS).map((dir) => `${dir}/`)]
      const dir = cleanPath(word).split('/')[0]
      return DIRS[dir] ? DIRS[dir]().map((file) => `${dir}/${file}`) : []
    },
    run(args, ctx) {
      if (!args.length) return fail('usage: cat <file>  ·  try ', run('ls'))
      return args.flatMap((arg, i) => {
        const file = readFile(arg, ctx)
        const gap = i ? [BLANK] : []
        if (!file) return [...gap, ...fail(`cat: ${arg}: No such file or directory`)]
        if (file.dir) return [...gap, ...fail(`cat: ${arg}: Is a directory`)]
        return [...gap, ...(file.lines ?? [])]
      })
    },
  },
  tree: {
    group: 'Get around',
    summary: 'everything in the home folder',
    run: () => treeLines(),
  },
  pwd: {
    group: 'Get around',
    summary: 'where you are',
    run: () => [[HOME_DIR]],
  },
  now: {
    group: 'Live',
    summary: 'what I am listening to on Spotify',
    async run(args, ctx) {
      if (!ctx.spotifyNow) return fail('now: Spotify is not reachable from here')
      try {
        const now = await ctx.spotifyNow()
        const status = nowStatus(now)
        if (status === 'idle') return [[dim('nothing playing right now. the last 50 are on '), go(LISTENING_PATH, LISTENING_PATH)]]
        if (status === 'podcast') return [[ok('▶ '), 'a podcast', dim(' · more on '), go(LISTENING_PATH, LISTENING_PATH)]]
        const track = now.track
        const at = progressAt(now)
        const time = Number.isFinite(at) && track.durationMs ? `  ${formatDuration(at)} / ${formatDuration(track.durationMs)}` : ''
        return [
          [status === 'playing' ? ok('▶ ') : warn('❚❚ '), track.url ? ext(track.title, track.url) : strong(track.title), dim(` — ${artistLine(track)}`)],
          [dim(`${status === 'playing' ? 'listening on Spotify' : 'paused on Spotify'}${time}`)],
          [dim('more → '), go(LISTENING_PATH, LISTENING_PATH)],
        ]
      } catch (error) {
        if (error?.code === 'spotify_disabled') return [[dim('the Spotify link is off for the moment')]]
        return fail('now: could not reach Spotify. try again in a bit')
      }
    },
  },
  weather: {
    group: 'Live',
    summary: 'the temperature in Athens',
    async run(args, ctx) {
      const temp = ctx.athensTemp ? await ctx.athensTemp() : null
      if (!Number.isFinite(temp)) return fail('weather: the forecast did not answer')
      const rounded = Math.round(temp)
      const note = rounded >= 32 ? 'too hot to code outside' : rounded <= 8 ? 'cold. good coding weather' : rounded >= 24 ? 'nice out' : 'mild'
      return [[strong(`${rounded}°C`), ' in Athens', dim(`  ${note}`)]]
    },
  },
  date: {
    group: 'Live',
    summary: 'the date and time in Athens',
    run: (args, ctx) => {
      const now = ctx.now?.() ?? new Date()
      return [
        [
          athensParts(now, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZoneName: 'short',
          }),
          dim('  Athens'),
        ],
      ]
    },
  },
  time: {
    group: 'Live',
    summary: 'my clock against yours',
    run: (args, ctx) => {
      const now = ctx.now?.() ?? new Date()
      const athens = athensParts(now, { hour: '2-digit', minute: '2-digit', hour12: false })
      const local = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
      const diff = athensOffsetMinutes(now) + now.getTimezoneOffset()
      const hours = Math.abs(diff) / 60
      const span = Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
      const relation = diff === 0 ? 'same time zone as you' : diff > 0 ? `${span} ahead of you` : `${span} behind you`
      return [[dim('athens  '), strong(athens)], [dim('you     '), strong(local)], [dim(relation)]]
    },
  },
  cal: {
    group: 'Live',
    summary: 'this month',
    run: (args, ctx) => calendar(ctx.now?.() ?? new Date()),
  },
  uptime: {
    group: 'Live',
    summary: 'how long you have been here',
    run: (args, ctx) => {
      const since = ctx.startedAt ?? Date.now()
      const elapsed = (ctx.now?.() ?? new Date()).getTime() - since
      return [[`up ${formatUptime(elapsed)}, 1 user, load average: 0.42, 0.37, 0.31`]]
    },
  },
  ping: {
    group: 'Live',
    summary: 'measure the round trip to blxr.net',
    usage: 'ping [blxr.net]',
    async run(args, ctx) {
      const host = (args.find((arg) => !arg.startsWith('-')) ?? 'blxr.net').toLowerCase()
      if (!['blxr.net', 'www.blxr.net', 'localhost', '127.0.0.1'].includes(host)) {
        return fail(`ping: ${host}: this shell can only reach blxr.net`)
      }
      if (!ctx.ping) return fail('ping: no network in here')
      const times = []
      const lines = [[dim(`PING ${host}: 56 data bytes`)]]
      for (let seq = 1; seq <= 4; seq++) {
        try {
          const ms = await ctx.ping()
          times.push(ms)
          lines.push([`64 bytes from ${host}: icmp_seq=${seq} time=`, strong(`${ms.toFixed(1)} ms`)])
        } catch {
          lines.push([err(`request timeout for icmp_seq ${seq}`)])
        }
      }
      const loss = Math.round(((4 - times.length) / 4) * 100)
      const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0
      lines.push(BLANK, [dim(`4 packets transmitted, ${times.length} received, ${loss}% packet loss`)])
      if (times.length) lines.push([dim('round-trip avg '), strong(`${avg.toFixed(1)} ms`)])
      return lines
    },
  },
  neofetch: {
    group: 'Shell',
    summary: 'system info, with a logo',
    run(args, ctx) {
      const now = ctx.now?.() ?? new Date()
      const featured = SKILL_CATEGORIES.flatMap((category) => category.items).filter((item) => item.featured)
      const title = `${USER}@${HOST}`
      const info = [
        [strong(title)],
        [dim('-'.repeat(title.length))],
        [strong('OS'), dim(': '), 'blxr.net'],
        [strong('Host'), dim(': '), 'one Linux box behind Cloudflare'],
        [strong('Kernel'), dim(': '), `React ${REACT_VERSION} · Vite`],
        [strong('Uptime'), dim(': '), formatUptime(now.getTime() - (ctx.startedAt ?? now.getTime()))],
        [strong('Shell'), dim(': '), `${SHELL} ${SHELL_VERSION}`],
        [strong('Theme'), dim(': '), ctx.theme ?? 'dark'],
        [strong('Terminal'), dim(': '), ctx.screen ? `your browser, ${ctx.screen}` : 'your browser'],
        [strong('Location'), dim(': '), CV_LOCATION],
        [strong('Projects'), dim(': '), String(projectsList.length)],
        [strong('Stack'), dim(': '), featured.map((item) => item.name).join(', ')],
        BLANK,
        ['red', 'amber', 'emerald', 'sky', 'violet', 'rose', 'ink'].map((tone) => t('███', `swatch-${tone}`)),
      ]
      const stacked = (ctx.columns ?? 80) < 64
      if (stacked) return [...LOGO.map((row) => art(t(row, 'logo'))), BLANK, ...info]
      const rows = Math.max(LOGO.length, info.length)
      return Array.from({ length: rows }, (_, i) => art(t(LOGO[i] ?? ' '.repeat(LOGO[0].length), 'logo'), '  ', ...(info[i] ?? [])))
    },
  },
  banner: {
    group: 'Shell',
    summary: 'the big letters',
    run: () => [...BANNER.map((row) => art(strong(row))), BLANK, [dim('type '), run('help'), dim(' to see the commands')]],
  },
  theme: {
    group: 'Shell',
    summary: 'switch between light and dark',
    usage: 'theme [light | dark | toggle]',
    args: () => ['light', 'dark', 'toggle'],
    run(args, ctx) {
      const current = ctx.theme ?? 'dark'
      const wanted = (args[0] ?? '').toLowerCase()
      if (!wanted) return [[dim('theme: '), strong(current)], [dim('usage: theme light | dark | toggle')]]
      if (!['light', 'dark', 'toggle'].includes(wanted)) return fail(`theme: unknown theme ${wanted}. light or dark`)
      const next = wanted === 'toggle' ? (current === 'dark' ? 'light' : 'dark') : wanted
      if (next === current) return [[dim(`already ${current}`)]]
      ctx.toggleTheme?.()
      return [[ok('✓ '), `switched to ${next}`]]
    },
  },
  history: {
    group: 'Shell',
    summary: 'what you have typed. -c forgets it',
    usage: 'history [-c]',
    run(args, ctx) {
      if (args[0] === '-c') {
        ctx.clearHistory?.()
        return [[dim('history cleared')]]
      }
      const history = ctx.history ?? []
      if (!history.length) return [[dim('nothing yet')]]
      const width = String(history.length).length + 2
      return history.map((entry, i) => [dim(String(i + 1).padStart(width)), '  ', run(entry, entry)])
    },
  },
  echo: {
    group: 'Shell',
    summary: 'print text. $USER and friends expand',
    usage: 'echo <text>',
    run: (args) => [[args.join(' ')]],
  },
  env: {
    group: 'Shell',
    summary: 'environment variables',
    run: (args, ctx) => Object.entries(ENV(ctx)).map(([key, value]) => [strong(key), dim('='), value]),
  },
  calc: {
    group: 'Shell',
    summary: 'arithmetic. or just type 2+2',
    usage: 'calc <expression>',
    run(args) {
      const expression = args.join(' ')
      if (!expression) return fail('usage: calc <expression>  ·  e.g. calc (2+3)^2 / 5')
      try {
        return [[dim(`${expression} = `), strong(String(calculate(expression)))]]
      } catch (error) {
        return fail(error?.message === 'infinite' ? 'calc: that is not a number. division by zero?' : `calc: could not read ${expression}`)
      }
    },
  },
  copy: {
    group: 'Shell',
    summary: 'copy email, github, discord, studio or this url',
    usage: 'copy <email | github | discord | studio | url>',
    args: () => [...Object.keys(EXTERNAL), 'url'],
    async run(args, ctx) {
      const key = (args[0] ?? '').toLowerCase()
      const value = key === 'url' ? ctx.url : EXTERNAL[key]?.value
      if (!value) return fail('usage: copy <email | github | discord | studio | url>')
      const copied = ctx.copy ? await ctx.copy(value) : false
      return copied ? [[ok('✓ '), 'copied ', strong(value)]] : fail(`copy: the clipboard said no. here it is: ${value}`)
    },
  },
  palette: {
    group: 'Shell',
    summary: 'open the command palette (⌘K)',
    run(args, ctx) {
      ctx.openPalette?.()
      return [[dim('opened the command palette')]]
    },
  },
  clear: {
    group: 'Shell',
    summary: 'clear the screen',
    run(args, ctx) {
      ctx.clear?.()
      return null
    },
  },
  exit: {
    group: 'Shell',
    summary: 'leave the terminal',
    run(args, ctx) {
      ctx.navigate?.(HOME_PATH)
      return [[dim('logout')], [dim('[Process completed]')]]
    },
  },
  fortune: {
    group: 'Fun',
    summary: 'a line to think about',
    run: (args, ctx) => [[pickFrom(FORTUNES, ctx)]],
  },
  cowsay: {
    group: 'Fun',
    summary: 'a cow says it for you',
    usage: 'cowsay [text]',
    run: (args, ctx) => cowsay(args.join(' ') || pickFrom(FORTUNES, ctx)),
  },
  roll: {
    group: 'Fun',
    summary: 'roll a die. roll 20 for a d20',
    usage: 'roll [sides]',
    run(args, ctx) {
      const sides = Math.floor(Number(args[0] ?? 6))
      if (!Number.isFinite(sides) || sides < 2 || sides > 1_000_000) return fail('roll: give it a number of sides, 2 or more')
      const value = 1 + Math.floor((ctx.random ?? Math.random)() * sides)
      return [[dim(`d${sides} → `), strong(String(value)), ...(sides === 20 && value === 20 ? [ok('  natural 20')] : [])]]
    },
  },
  flip: {
    group: 'Fun',
    summary: 'flip a coin',
    run: (args, ctx) => [[strong((ctx.random ?? Math.random)() < 0.5 ? 'heads' : 'tails')]],
  },
  secrets: {
    group: 'Fun',
    summary: 'the hidden commands',
    run() {
      const hidden = Object.entries(COMMANDS).filter(([, command]) => command.hidden && command.summary)
      const width = widest(hidden.map(([name]) => name)) + 3
      return [
        [dim('commands that are not in help. some of them shake the page')],
        BLANK,
        ...hidden.map(([name, command]) => ['  ', run(pad(name, width), name), dim(command.summary)]),
        BLANK,
        [dim('also: '), run('sudo rm -rf /'), dim(' · '), run('do a barrel roll'), dim(' · '), run('sudo make me a sandwich')],
      ]
    },
  },
  achievements: {
    group: 'Fun',
    summary: 'what you have unlocked this session',
    run(args, ctx) {
      const list = ctx.achievements?.() ?? []
      if (!list.length) return [[dim('no achievements in here')]]
      const done = list.filter((item) => item.got).length
      const width = widest(list.map((item) => item.title)) + 2
      const lines = [[strong(`${done} of ${list.length}`), dim(' this session · desktop only')]]
      if (!ctx.fun?.()) lines.push([dim('they are off. '), run('enable'), dim(' to start earning them')])
      lines.push(BLANK)
      for (const item of list) {
        lines.push([item.got ? ok('✓ ') : dim('· '), item.got ? ok(pad(item.title, width)) : pad(item.title, width), dim(`${item.gamerscore}G`.padStart(5))])
      }
      return lines
    },
  },
  readme: { hidden: true, run: () => readmeLines() },
  pages: { hidden: true, summary: 'every page on the site', run: () => lsLines('/', '') },
  hello: { hidden: true, summary: 'say hi', run: () => [['hey 👋 '], [dim('try '), run('about'), dim(' or '), run('projects')]] },
  sudo: {
    hidden: true,
    summary: 'you know how this ends',
    run(args, ctx) {
      const rest = args.join(' ')
      if (/^rm\s+-(rf|fr|r\s+-f)\s+\/\*?$/.test(rest) || /^rm\s+-rf\s+--no-preserve-root\s+\/$/.test(rest)) {
        ctx.fx?.('rmrf')
        return [[warn('removing everything…')]]
      }
      if (/^make me a sandwich$/i.test(rest)) return [['okay.']]
      if (!rest) return fail('usage: sudo <command>')
      return [[`[sudo] password for ${USER}: `, dim('********')], [err(`${USER} is not in the sudoers file. This incident will be reported.`)]]
    },
  },
  rm: {
    hidden: true,
    summary: 'try it on /',
    run(args, ctx) {
      const rest = args.join(' ')
      if (/--no-preserve-root/.test(rest) && args.includes('/')) {
        ctx.fx?.('rmrf')
        return [[warn('you asked for it…')]]
      }
      if (args.includes('/') || args.includes('/*')) {
        return [
          [err("rm: it is dangerous to operate recursively on '/'")],
          [err('rm: use --no-preserve-root to override this failsafe')],
        ]
      }
      if (!args.length) return fail('usage: rm <file>')
      return fail(`rm: ${args.filter((arg) => !arg.startsWith('-')).join(' ') || 'that'}: Read-only file system`)
    },
  },
  make: {
    hidden: true,
    run: (args) =>
      args.join(' ') === 'me a sandwich' ? [['What? Make it yourself.']] : fail(`make: *** No rule to make target '${args[0] ?? ''}'.  Stop.`),
  },
  do: {
    hidden: true,
    run(args, ctx) {
      if (fold(args.join(' ')) === 'a barrel roll') {
        ctx.fx?.('barrelroll')
        return [[dim('press Z or R twice!')]]
      }
      return fail(`blxrsh: command not found: do`)
    },
  },
  barrelroll: { hidden: true, summary: 'what Peppy keeps telling you', run: fx('barrelroll', [[dim('press Z or R twice!')]]) },
  hesoyam: { hidden: true, summary: 'full health, armour and $250k', run: fx('hesoyam', [[ok('cheat activated')]]) },
  aezakmi: { hidden: true, summary: 'the cops forget you', run: fx('aezakmi', [[ok('cheat activated')]]) },
  iddqd: { hidden: true, summary: 'god mode, 1993 edition', run: fx('iddqd', [[ok('degreelessness mode on')]]) },
  idkfa: { hidden: true, summary: 'and the ammo to go with it', run: fx('idkfa', [[ok('very happy ammo added')]]) },
  sus: { hidden: true, summary: 'emergency meeting', run: fx('sus', [[warn('emergency meeting')]]) },
  dvd: { hidden: true, summary: 'the screensaver. wait for the corner', run: fx('dvd', [[dim('screensaver on. move to wake it')]]) },
  kill: { hidden: true, summary: 'the death screen', run: fx('kill', [[err('you died')]]) },
  wasted: { hidden: true, summary: 'wasted', run: fx('wasted', [[err('wasted')]]) },
  respect: { hidden: true, summary: 'mission passed', run: fx('respect', [[ok('mission passed. respect +')]]) },
  mpoum: {
    hidden: true,
    summary: 'launch codes',
    run(args, ctx) {
      const launched = ctx.fx?.('nuke')
      return launched === false ? [[dim('something is already in the air, give it a second')]] : [[warn('☢ launch codes accepted. impact in 5 seconds')]]
    },
  },
  enable: {
    hidden: true,
    summary: 'turn on flashbangs, parkour and achievements',
    run(args, ctx) {
      if (ctx.fun?.()) return [[dim('already on. '), run('disable'), dim(' turns it off')]]
      ctx.setFun?.(true)
      return [[ok('enabled '), 'flashbangs, Minecraft parkour and achievements are live. try ', run('theme toggle')]]
    },
  },
  disable: {
    hidden: true,
    summary: 'back to the plain site',
    run(args, ctx) {
      if (!ctx.fun?.()) return [[dim('already off. '), run('enable'), dim(' turns it on')]]
      ctx.setFun?.(false)
      return [[dim('disabled. back to the plain site')]]
    },
  },
  coffee: { hidden: true, summary: 'HTTP has a status code for it', run: () => [[warn('418 '), "I'm a teapot"]] },
  vim: { hidden: true, summary: 'good luck leaving', run: () => [[dim('you are now in vim. just kidding. you would never get out')], [dim('hint: '), ':q!']] },
  ':q': { hidden: true, run: () => [[dim('not in vim, but the reflex is noted')]] },
  ':q!': { hidden: true, run: () => [[dim('not in vim, but the reflex is noted')]] },
  nano: { hidden: true, run: () => [[dim('nano is fine. it is fine. everything is fine')]] },
  emacs: { hidden: true, run: () => [[dim('a great operating system, lacking only a decent editor')]] },
  git: {
    hidden: true,
    summary: 'status, log, blame, push',
    run(args) {
      const sub = args[0]
      if (sub === 'status') return [['On branch main'], ["Your branch is up to date with 'origin/main'."], BLANK, [dim('nothing to commit, working tree clean')]]
      if (sub === 'log') {
        return projectsList.map((project, i) => [
          warn(shortHash(project.id)),
          ...(i === 0 ? [' (', ok('HEAD -> main'), ')'] : []),
          ` ship ${project.title}`,
          dim(`  ${project.date}`),
        ])
      }
      if (sub === 'blame') return [['every line: Kostis']]
      if (sub === 'push') return [[dim('Everything up-to-date')]]
      if (sub === 'pull') return [[dim('Already up to date.')]]
      if (sub === 'commit') return [[dim('nothing added to commit. the site is already done. mostly')]]
      return [[dim('usage: git status | log | blame | push | pull')]]
    },
  },
  npm: {
    hidden: true,
    run: (args) =>
      args[0] === 'install' || args[0] === 'i'
        ? [[`added 1 developer in 0.4s`], [ok('found 0 vulnerabilities')], [dim('next: '), run('hire')]]
        : [[dim('usage: npm install')]],
  },
  ssh: { hidden: true, run: () => fail(`${USER}@blxr.net: Permission denied (publickey). nice try`) },
  curl: { hidden: true, run: () => [[dim('you are already on blxr.net')]] },
  sl: {
    hidden: true,
    summary: 'you meant ls',
    run: () => [
      art('      ____________   _________'),
      art('     |  BLXR EXP  |=| [] [] [] |__'),
      art('     |____________|=|__________|__\\'),
      art('      (o)      (o)    (o)    (o)'),
      BLANK,
      [dim('you meant '), run('ls'), dim('. the train left anyway')],
    ],
  },
  xyzzy: { hidden: true, run: () => [['Nothing happens.']] },
  hostname: { hidden: true, run: () => [['blxr.net']] },
  uname: {
    hidden: true,
    run: (args) => [[args.includes('-a') ? `blxrOS blxr.net ${SHELL_VERSION} react-${REACT_VERSION} browser` : 'blxrOS']],
  },
  which: {
    hidden: true,
    run: (args) =>
      args.length
        ? args.map((name) => (resolveCommand(name) ? [`/usr/local/bin/${name}`] : [err(`${name} not found`)]))
        : fail('usage: which <command>'),
  },
}

const ALIASES = {
  man: 'help',
  '?': 'help',
  commands: 'help',
  whois: 'about',
  finger: 'about',
  bio: 'about',
  me: 'about',
  stack: 'skills',
  tech: 'skills',
  work: 'experience',
  exp: 'experience',
  edu: 'education',
  languages: 'education',
  resume: 'cv',
  portfolio: 'projects',
  works: 'projects',
  posts: 'blog',
  setup: 'uses',
  email: 'contact',
  mail: 'contact',
  links: 'socials',
  goto: 'cd',
  dir: 'ls',
  ll: 'ls',
  la: 'ls',
  listening: 'now',
  spotify: 'now',
  np: 'now',
  music: 'now',
  temp: 'weather',
  clock: 'time',
  calendar: 'cal',
  fastfetch: 'neofetch',
  screenfetch: 'neofetch',
  info: 'neofetch',
  logo: 'banner',
  dark: 'theme',
  light: 'theme',
  cls: 'clear',
  reset: 'clear',
  quit: 'exit',
  logout: 'exit',
  bye: 'exit',
  math: 'calc',
  dice: 'roll',
  coin: 'flip',
  quote: 'fortune',
  hi: 'hello',
  hey: 'hello',
  amogus: 'sus',
  nuke: 'mpoum',
  printenv: 'env',
  vi: 'vim',
  nvim: 'vim',
  type: 'which',
}

const ALIAS_ARGS = {
  ll: ['-l'],
  la: ['-la'],
  dark: ['dark'],
  light: ['light'],
}

function resolveCommand(name) {
  const key = String(name ?? '').toLowerCase()
  const target = COMMANDS[key] ? key : ALIASES[key]
  return target ? { name: target, command: COMMANDS[target], preset: ALIAS_ARGS[key] ?? [] } : null
}

const visibleCommands = () => Object.keys(COMMANDS).filter((name) => !COMMANDS[name].hidden)

function suggestPage(name) {
  const asked = cleanPath(name)
  let best = null
  let bestScore = Infinity
  for (const page of PAGES) {
    const score = editDistance(asked, page.name)
    if (score < bestScore) {
      best = page.name
      bestScore = score
    }
  }
  return bestScore <= 2 ? best : null
}

function helpFor(name) {
  const resolved = resolveCommand(name)
  if (!resolved) return fail(`help: no command called ${name}`)
  const { name: real, command } = resolved
  const aliases = Object.entries(ALIASES)
    .filter(([, target]) => target === real)
    .map(([alias]) => alias)
  const lines = [[strong(real), dim(' — '), command.summary ?? 'no description, on purpose']]
  lines.push([dim('usage: '), command.usage ?? real])
  if (aliases.length) lines.push([dim('also: '), aliases.join(', ')])
  return lines
}

function readmeLines() {
  return [
    [strong('# blxr.net terminal')],
    BLANK,
    ['A small shell for the site. Everything in here is also one click away'],
    ['on the normal pages, so nothing depends on it.'],
    BLANK,
    [dim('start with '), run('help'), dim(', '), run('about'), dim(' or '), run('projects')],
    [dim('the pages live under '), run('ls /'), dim(' and '), run('cd <page>'), dim(' takes you there')],
  ]
}

function pickFrom(list, ctx) {
  return list[Math.floor((ctx.random ?? Math.random)() * list.length) % list.length]
}

function execCommand(name, args, ctx) {
  const resolved = resolveCommand(name)
  if (!resolved) return []
  const result = resolved.command.run([...resolved.preset, ...args], ctx)
  return Array.isArray(result) ? result : []
}

function runSegment(segment, ctx) {
  const tokens = tokenize(segment).map((token) => expandVars(token, ctx))
  if (!tokens.length) return null
  const [name, ...args] = tokens
  const resolved = resolveCommand(name)
  if (resolved) return resolved.command.run([...resolved.preset, ...args], ctx)
  if (looksLikeMath(segment)) return COMMANDS.calc.run([segment], ctx)
  if (findPage(name) && !args.length) return [[dim(`${name} is a page. `), run(`cd ${findPage(name).name}`), dim(' to go there')]]
  const guess = suggestCommand(name)
  return [
    [err(`${SHELL}: command not found: ${name}`)],
    guess ? [dim('did you mean '), run(guess), dim('?')] : [dim('type '), run('help'), dim(' to see what is in here')],
  ]
}

export async function execute(input, ctx = {}) {
  const lines = []
  for (const segment of splitChain(input)) {
    const result = await runSegment(segment, ctx)
    if (Array.isArray(result)) lines.push(...result)
  }
  return lines
}

const commonPrefix = (items) => {
  if (!items.length) return ''
  let prefix = items[0]
  for (const item of items.slice(1)) {
    while (!item.toLowerCase().startsWith(prefix.toLowerCase())) prefix = prefix.slice(0, -1)
  }
  return prefix
}

export function complete(input, ctx = {}) {
  const value = String(input ?? '')
  const trailing = /\s$/.test(value)
  const tokens = tokenize(value)
  if (!tokens.length) return { value, options: [] }

  let candidates
  let word
  if (tokens.length === 1 && !trailing) {
    word = tokens[0]
    candidates = visibleCommands().filter((name) => name.startsWith(word.toLowerCase()))
  } else {
    const resolved = resolveCommand(tokens[0])
    if (!resolved?.command.args) return { value, options: [] }
    word = trailing ? '' : tokens[tokens.length - 1]
    const prior = tokens.slice(1, trailing ? undefined : -1)
    candidates = resolved.command.args(ctx, prior, word).filter((option) => option.toLowerCase().startsWith(word.toLowerCase()))
  }

  candidates = [...new Set(candidates)]
  if (!candidates.length) return { value, options: [] }
  const head = value.slice(0, value.length - word.length)
  if (candidates.length === 1) {
    const [only] = candidates
    return { value: `${head}${only}${only.endsWith('/') ? '' : ' '}`, options: [] }
  }
  const prefix = commonPrefix(candidates)
  return { value: `${head}${prefix.length > word.length ? prefix : word}`, options: candidates }
}

export function welcomeLines(lastLogin) {
  return [
    ...BANNER.map((row) => art(strong(row))),
    BLANK,
    [`Welcome to ${SHELL} ${SHELL_VERSION}, the terminal for blxr.net.`],
    [dim('type '), run('help'), dim(' for the commands, or try '), ...joinParts([run('about'), run('projects'), run('contact'), run('neofetch')])],
    lastLogin ? [dim(`Last login: ${lastLogin} on ttys000`)] : [dim('first time in here. welcome')],
  ]
}

export const SUGGESTIONS = ['help', 'about', 'projects', 'skills', 'contact', 'neofetch']
