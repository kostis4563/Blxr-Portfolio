import { fold } from './text-match.js'

const MAX_LEN = 96

function editDistance(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

function similarity(a, b) {
  if (!a || !b) return 0
  const longest = Math.max(a.length, b.length)
  return 1 - editDistance(a, b) / longest
}

function words(s) {
  return fold(s)
    .replace(/\.(html?|php|aspx?|jsp)$/i, '')
    .split(/[\s/_\-.]+/)
    .filter(Boolean)
}

const lastWord = (ws) => ws[ws.length - 1] || ''

function score(askedWords, entry) {
  const asked = askedWords.join(' ')
  const askedLast = lastWord(askedWords)
  const pathWords = words(entry.path)
  const path = pathWords.join(' ')
  const pathLast = lastWord(pathWords)
  const label = words(entry.label).join(' ')

  let best = Math.max(
    similarity(asked, path),
    similarity(askedLast, pathLast),
    similarity(askedLast, label),
  )

  if (askedLast.length >= 3) {
    for (const target of [path, pathLast, label]) {

      if (target.length < 3) continue
      if (target.includes(askedLast) || askedLast.includes(target)) {
        best = Math.max(best, 0.72 + 0.2 * Math.min(askedLast.length, target.length) / Math.max(askedLast.length, target.length))
      }
    }
  }
  return best
}

export function suggestRoutes(route, catalogue, { limit = 3, threshold = 0.55 } = {}) {
  const askedWords = words(route.slice(0, MAX_LEN))
  if (!askedWords.length) return []

  return catalogue
    .map((entry) => ({ entry, score: score(askedWords, entry) }))
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry)
}

export function splitKnownPrefix(route, catalogue) {
  const segments = route.split('/').filter(Boolean)
  const known = new Set(catalogue.map((e) => e.path))
  let depth = 0
  for (let i = segments.length - 1; i >= 1; i--) {
    if (known.has('/' + segments.slice(0, i).join('/'))) {
      depth = i
      break
    }
  }
  return {
    known: '/' + segments.slice(0, depth).map((s) => s + '/').join(''),
    unknown: segments.slice(depth).join('/'),
  }
}
