export const CHANGELOG_INTRO =
  'What changed in my public projects, read live from GitHub. Every line is a commit, newest first, sorted into what it added, fixed or removed.'

export const PAGE_DAYS = 14

export const KINDS = [
  { id: 'added', label: 'Added' },
  { id: 'fixed', label: 'Fixed' },
  { id: 'changed', label: 'Changed' },
  { id: 'removed', label: 'Removed' },
  { id: 'security', label: 'Security' },
]

const NAME_RE = /^[\w.-]{1,100}$/
const SHA_RE = /^[0-9a-f]{40}$/
const COLOR_RE = /^#[0-9a-f]{3,8}$/i
const REPO_URL_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/

export class ChangelogError extends Error {
  constructor(code, status = 0) {
    super(code)
    this.code = code
    this.status = status
  }
}

const isTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value))
const count = (value) => (Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0)

function cleanRepo(raw) {
  if (!raw || !NAME_RE.test(raw.name) || !REPO_URL_RE.test(raw.url)) return null
  return {
    name: raw.name,
    url: raw.url,
    description: typeof raw.description === 'string' ? raw.description.slice(0, 200) : '',
    language: typeof raw.language?.name === 'string'
      ? { name: raw.language.name.slice(0, 40), color: COLOR_RE.test(raw.language.color) ? raw.language.color : null }
      : null,
    commits: count(raw.commits),
  }
}

function cleanCommit(raw, repos) {
  if (!raw || !repos.has(raw.repo) || !SHA_RE.test(raw.sha) || !isTime(raw.date) || typeof raw.message !== 'string') return null
  return {
    repo: raw.repo,
    sha: raw.sha,
    message: raw.message.slice(0, 200),
    date: raw.date,
    additions: count(raw.additions),
    deletions: count(raw.deletions),
  }
}

export function cleanChangelog(data) {
  const repos = (Array.isArray(data?.repos) ? data.repos : []).map(cleanRepo).filter(Boolean)
  const names = new Set(repos.map((r) => r.name))
  const commits = (Array.isArray(data?.commits) ? data.commits : []).map((c) => cleanCommit(c, names)).filter(Boolean)
  commits.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  return {
    since: isTime(data?.since) ? data.since : null,
    fetchedAt: isTime(data?.fetchedAt) ? data.fetchedAt : null,
    repos,
    commits,
  }
}

export async function fetchChangelog({ signal } = {}) {
  let res
  try {
    res = await fetch('/api/github/changelog', { signal, headers: { accept: 'application/json' } })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ChangelogError('offline')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ChangelogError(typeof data?.error === 'string' ? data.error : `http_${res.status}`, res.status)
  return cleanChangelog(data)
}

export function describeError(err) {
  if (err?.code === 'rate_limited') return 'GitHub is rate limiting the server right now. Try again in a minute.'
  if (err?.code === 'offline') return 'Could not reach the server. Check your connection and try again.'
  if (err?.code === 'changelog_disabled') return 'The connection to GitHub is switched off at the moment.'
  return 'GitHub did not answer in time. Try again in a minute.'
}

export const commitUrl = (repo, sha) => `${repo.url}/commit/${sha}`

const CONVENTIONAL_RE = /^(feat|fix|revert|security|chore|docs|style|refactor|perf|test|build|ci)(?:\([^)]*\))?!?:\s*/i
const CONVENTIONAL_KIND = { feat: 'added', fix: 'fixed', revert: 'removed', security: 'security' }

const SECURITY_RE = /\b(security|vulnerab\w*|cve-\d{4}-\d+|xss|csrf|prototype pollution|codeql)\b/i
const KIND_RULES = [
  ['fixed', /^(fix(es|ed|ing)?|hotfix|repair(ed|s)?|resolve[sd]?|correct(ed|s)?)\b/i],
  ['removed', /^(remove[sd]?|delete[sd]?|drop(ped|s)?|deprecate[sd]?|revert(ed|s)?)\b/i],
  ['added', /^(add(ed|s)?|create[sd]?|introduce[sd]?|implement(ed|s)?|install(ed|s)?|initial|launch(ed|es)?|new)\b/i],
]

export function describeCommit(message) {
  const conventional = CONVENTIONAL_RE.exec(message)
  const rest = conventional ? message.slice(conventional[0].length) : message
  const text = rest.charAt(0).toUpperCase() + rest.slice(1)
  if (SECURITY_RE.test(text)) return { kind: 'security', text }
  const tagged = conventional && CONVENTIONAL_KIND[conventional[1].toLowerCase()]
  if (tagged) return { kind: tagged, text }
  const rule = KIND_RULES.find(([, re]) => re.test(text))
  return { kind: rule ? rule[0] : 'changed', text }
}

export const isNoise = (message) => message.split(/\s+/).filter((word) => /\p{L}{2,}/u.test(word)).length < 2

export function dayKeyOf(iso, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

export function groupChangelog(commits, { timeZone } = {}) {
  const days = []
  for (const commit of commits) {
    const day = dayKeyOf(commit.date, timeZone)
    let current = days.at(-1)
    if (current?.day !== day) {
      current = { day, groups: [], changes: 0 }
      days.push(current)
    }
    let group = current.groups.find((g) => g.repo === commit.repo)
    if (!group) {
      group = { repo: commit.repo, entries: [], quiet: [] }
      current.groups.push(group)
    }
    if (isNoise(commit.message)) {
      group.quiet.push(commit)
    } else {
      group.entries.push({ ...commit, ...describeCommit(commit.message) })
      current.changes += 1
    }
  }
  return days
}

export function timelineOf(days) {
  const items = []
  for (const day of days) {
    if (day.changes) {
      items.push({ type: 'day', ...day })
      continue
    }
    const commits = day.groups.flatMap((g) => g.quiet)
    const last = items.at(-1)
    if (last?.type === 'quiet' && last.from.slice(0, 7) === day.day.slice(0, 7)) {
      last.from = day.day
      last.commits.push(...commits)
    } else {
      items.push({ type: 'quiet', from: day.day, to: day.day, commits })
    }
  }
  return items
}

export const monthOf = (item) => (item.type === 'day' ? item.day : item.to).slice(0, 7)

export const sizeOf = (item) => (item.type === 'day' ? item.groups.reduce((n, g) => n + g.entries.length + g.quiet.length, 0) : item.commits.length)

export function kindCounts(commits) {
  const counts = Object.fromEntries(KINDS.map((k) => [k.id, 0]))
  for (const commit of commits) {
    if (!isNoise(commit.message)) counts[describeCommit(commit.message).kind] += 1
  }
  return counts
}

export function dayHeading(day, now = Date.now(), timeZone) {
  const today = dayKeyOf(new Date(now).toISOString(), timeZone)
  const yesterday = dayKeyOf(new Date(now - 86_400_000).toISOString(), timeZone)
  if (day === today) return 'Today'
  if (day === yesterday) return 'Yesterday'
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
      timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00Z`))
  } catch {
    return day
  }
}

const utcDay = (day, options) => new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))

export function rangeHeading(from, to, now = Date.now(), timeZone) {
  const end = dayHeading(to, now, timeZone)
  if (from === to) return end
  try {
    return `${utcDay(from, { month: 'short', day: 'numeric' })} – ${end === 'Today' || end === 'Yesterday' ? end : utcDay(to, { day: 'numeric' })}`
  } catch {
    return `${from} – ${to}`
  }
}

export function monthHeading(month) {
  try {
    return utcDay(`${month}-01`, { month: 'long', year: 'numeric' })
  } catch {
    return month
  }
}

export function shortDateOf(iso, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

export function dateOf(iso, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

export function timeOf(iso, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso))
  } catch {
    return ''
  }
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
export const formatLines = (n) => (n >= 1000 ? compact.format(n) : String(n))

export function spanDays(since, now = Date.now()) {
  const ms = now - Date.parse(since)
  return Number.isFinite(ms) ? Math.max(1, Math.round(ms / 86_400_000)) : null
}
