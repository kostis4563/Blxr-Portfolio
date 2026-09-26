export const reducedMotion = () =>
  document.documentElement.dataset.motion === 'reduced' ||
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

let dismiss = null
let cleared = Promise.resolve()

function show(className, html, { hold, out }) {
  dismiss?.()
  const el = document.createElement('div')
  el.className = className
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML = html
  document.body.append(el)

  let settle
  cleared = new Promise((resolve) => {
    settle = resolve
  })

  const leave = setTimeout(() => el.classList.add('is-leaving'), hold)
  const gone = setTimeout(done, hold + out)
  function done() {
    clearTimeout(leave)
    clearTimeout(gone)
    el.remove()
    if (dismiss === done) dismiss = null
    settle()
  }
  dismiss = done
}

async function whenClear() {
  let current
  do {
    current = cleared
    await current
  } while (current !== cleared)
}

const word = ({ viewBox, d }, className) =>
  `<svg class="${className}" viewBox="${viewBox}"><path d="${d}"/></svg>`

const lettering = () => import('./gta-lettering')

export function missionPassed() {
  lettering()
    .then(({ MISSION_PASSED, RESPECT }) =>
      show(
        'gta gta-passed',
        `<div class="gta-band">${word(MISSION_PASSED, 'gta-title')}${word(RESPECT, 'gta-sub')}</div>`,
        { hold: 3400, out: 600 },
      ),
    )
    .catch(() => {})
}

export function wasted() {
  lettering()
    .then(({ WASTED }) =>
      show('gta gta-wasted', `<div class="gta-band">${word(WASTED, 'gta-title')}</div>`, { hold: 2800, out: 700 }),
    )
    .catch(() => {})
}

export const ACHIEVEMENTS = {
  readItAll: { id: 'read-it-all', gamerscore: 100, title: 'Read the whole portfolio' },
  neededParkour: { id: 'needed-parkour', gamerscore: 5, title: 'Needed Minecraft parkour' },
  stayedForParkour: { id: 'stayed-for-parkour', gamerscore: 10, title: 'Stayed for the parkour' },
  konami: { id: 'konami', gamerscore: 25, title: 'Knew the Konami code' },
  flashbangs: { id: 'flashbangs', gamerscore: 15, title: 'Survived 5 flashbangs' },
  explorer: { id: 'explorer', gamerscore: 50, title: 'Opened every page' },
  completionist: { id: 'completionist', gamerscore: 200, title: 'Completionist' },
}

const FOR_COMPLETIONIST = ['readItAll', 'stayedForParkour', 'konami', 'flashbangs', 'explorer'].map(
  (key) => ACHIEVEMENTS[key].id,
)

const FLASHBANGS_FOR_ACHIEVEMENT = 5
let flashbangs = 0

export function flashbang() {
  flashbangs += 1
  if (!reducedMotion()) show('flashbang', '', { hold: 1900, out: 0 })
  if (flashbangs === FLASHBANGS_FOR_ACHIEVEMENT) achievement(ACHIEVEMENTS.flashbangs)
}

const ACHIEVEMENTS_KEY = 'blxr:achievements'
const VISITED_KEY = 'blxr:visited'
const inMemory = new Map()

function sessionList(key) {
  let stored = []
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key))
    if (Array.isArray(parsed)) stored = parsed
  } catch {
  }
  return [...new Set([...stored, ...(inMemory.get(key) ?? [])])]
}

function addToSessionList(key, id) {
  const list = sessionList(key)
  if (list.includes(id)) return null
  const next = [...list, id]
  inMemory.set(key, next)
  try {
    sessionStorage.setItem(key, JSON.stringify(next))
  } catch {
  }
  return next
}

const EXPLORER_PAGES = ['home', 'projects', 'library', 'reviews', 'uses', 'cv', 'contact']
const PAGE_OPEN_MS = 4000

export function trackPageVisit(page) {
  if (!EXPLORER_PAGES.includes(page)) return undefined
  const timer = setTimeout(() => {
    const visited = addToSessionList(VISITED_KEY, page)
    if (visited && EXPLORER_PAGES.every((name) => visited.includes(name))) achievement(ACHIEVEMENTS.explorer)
  }, PAGE_OPEN_MS)
  return () => clearTimeout(timer)
}

const TROPHY =
  '<svg viewBox="0 0 24 24" fill="currentColor">' +
  '<path d="M7 3.5h10V9a5 5 0 0 1-10 0V3.5Z"/>' +
  '<path d="M7 5.5H4.8a2.3 2.3 0 0 0 0 4.6h2.5M17 5.5h2.2a2.3 2.3 0 0 1 0 4.6h-2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
  '<path d="M10.8 13.8h2.4v3.7h-2.4z"/><path d="M8 19.2c0-1 .8-1.7 1.7-1.7h4.6c1 0 1.7.8 1.7 1.7v1.3H8z"/></svg>'

const GAMERSCORE =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
  '<circle cx="8" cy="8" r="6.6"/><path d="M10.2 5.8A3.1 3.1 0 1 0 11.1 8H8.4"/></svg>'

let achievementTurn = Promise.resolve()

export function achievement({ id, gamerscore, title }) {
  const unlocked = addToSessionList(ACHIEVEMENTS_KEY, id)
  if (!unlocked) return false
  const html =
    `<div class="achievement-bar">` +
    `<span class="achievement-badge">${TROPHY}</span>` +
    `<span class="achievement-copy"><span class="achievement-kicker">Achievement unlocked</span>` +
    `<span class="achievement-title">${title}</span></span>` +
    `<span class="achievement-score">${GAMERSCORE}${gamerscore}</span>` +
    `<span class="achievement-shine"></span>` +
    `</div>`
  achievementTurn = achievementTurn.then(async () => {
    await whenClear()
    show('achievement', html, { hold: 5200, out: 600 })
    await cleared
  })
  if (FOR_COMPLETIONIST.every((needed) => unlocked.includes(needed))) achievement(ACHIEVEMENTS.completionist)
  return true
}
