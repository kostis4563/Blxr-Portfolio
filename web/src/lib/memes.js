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
const FUSE_MS = 1100
const FLASHBANG_MS = 3400
const RING_S = 3.2
const BOUNCES = [
  [0.44, 1],
  [0.77, 0.55],
  [0.935, 0.25],
]
let flashbangs = 0
let armed = null
let audio = null
let noise = null
let silence = null

const GRENADE_HOLES = [47, 61, 75, 89, 103]
  .flatMap((y, row) =>
    (row % 2 ? [[22, 5], [38, 5]] : [[15, 3], [30, 6], [45, 3]]).map(
      ([x, w]) => `<rect x="${x - w / 2}" y="${y}" width="${w}" height="9" rx="${w / 2}"/>`,
    ),
  )
  .join('')

const GRENADE =
  '<div class="nade"><svg viewBox="0 0 60 140">' +
  '<defs><linearGradient id="nade-drab" x1="0" x2="1">' +
  '<stop offset="0" stop-color="#2c3114"/><stop offset=".32" stop-color="#6d7a36"/>' +
  '<stop offset=".55" stop-color="#4f5a24"/><stop offset="1" stop-color="#232810"/></linearGradient>' +
  '<linearGradient id="nade-steel" x1="0" x2="1">' +
  '<stop offset="0" stop-color="#3b3e38"/><stop offset=".35" stop-color="#a3a69c"/>' +
  '<stop offset="1" stop-color="#34372f"/></linearGradient></defs>' +
  '<rect x="21" y="8" width="18" height="16" rx="3" fill="url(#nade-steel)"/>' +
  '<rect x="15" y="22" width="30" height="9" rx="2" fill="url(#nade-steel)"/>' +
  '<rect x="9" y="29" width="42" height="98" rx="7" fill="url(#nade-drab)"/>' +
  '<rect x="9" y="36" width="42" height="3" fill="#d6c46a" opacity=".85"/>' +
  `<g fill="#161a08">${GRENADE_HOLES}</g>` +
  '<rect x="11" y="124" width="38" height="10" rx="3" fill="url(#nade-steel)"/>' +
  '<path class="nade-spoon" d="M36 11C46 9 53 15 53 25V78" fill="none" stroke="#b8bab0" stroke-width="4.5" stroke-linecap="round"/>' +
  '</svg></div>'

function startAudio() {
  const Context = window.AudioContext ?? window.webkitAudioContext
  if (!Context) return null
  try {
    audio ??= new Context()
    audio.resume().catch(() => {})
  } catch {
    return null
  }
  silence?.()
  const out = audio.createGain()
  out.connect(audio.destination)
  silence = () => out.disconnect()
  return out
}

function clink(out, t, level) {
  for (const [frequency, peak, decay] of [
    [1850, 0.09, 0.22],
    [3120, 0.06, 0.14],
    [4730, 0.04, 0.09],
  ]) {
    const tone = audio.createOscillator()
    const envelope = audio.createGain()
    tone.frequency.value = frequency
    envelope.gain.setValueAtTime(peak * level, t)
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    tone.connect(envelope).connect(out)
    tone.start(t)
    tone.stop(t + decay)
  }
}

function bang(out, t) {
  const thump = audio.createOscillator()
  const thumpGain = audio.createGain()
  thump.frequency.setValueAtTime(140, t)
  thump.frequency.exponentialRampToValueAtTime(38, t + 0.3)
  thumpGain.gain.setValueAtTime(0.55, t)
  thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
  thump.connect(thumpGain).connect(out)
  thump.start(t)
  thump.stop(t + 0.4)

  if (!noise) {
    noise = audio.createBuffer(1, audio.sampleRate * 0.5, audio.sampleRate)
    const samples = noise.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
  }
  const crack = audio.createBufferSource()
  const muffle = audio.createBiquadFilter()
  const crackGain = audio.createGain()
  crack.buffer = noise
  muffle.type = 'lowpass'
  muffle.frequency.setValueAtTime(6000, t)
  muffle.frequency.exponentialRampToValueAtTime(180, t + 0.45)
  crackGain.gain.setValueAtTime(0.4, t)
  crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
  crack.connect(muffle).connect(crackGain).connect(out)
  crack.start(t)

  const ring = audio.createGain()
  ring.gain.setValueAtTime(0.0001, t)
  ring.gain.exponentialRampToValueAtTime(0.022, t + 0.12)
  ring.gain.setValueAtTime(0.022, t + 1)
  ring.gain.exponentialRampToValueAtTime(0.0001, t + RING_S)
  ring.connect(out)
  for (const frequency of [3520, 3527]) {
    const tone = audio.createOscillator()
    tone.frequency.value = frequency
    tone.connect(ring)
    tone.start(t)
    tone.stop(t + RING_S)
  }
}

function survived() {
  flashbangs += 1
  if (flashbangs === FLASHBANGS_FOR_ACHIEVEMENT) achievement(ACHIEVEMENTS.flashbangs)
}

export function flashbang(onBlast = () => {}) {
  if (reducedMotion()) {
    onBlast()
    survived()
    return
  }
  if (armed) {
    armed = onBlast
    return
  }
  armed = onBlast

  const out = startAudio()
  if (out) {
    const t = audio.currentTime
    for (const [at, level] of BOUNCES) clink(out, t + at, level)
    bang(out, t + FUSE_MS / 1000)
  }
  show('flashbang-throw', GRENADE, { hold: FUSE_MS + 200, out: 0 })

  setTimeout(() => {
    const blast = armed
    armed = null
    show(
      'flashbang',
      '<div class="flashbang-haze"></div><div class="flashbang-burn"></div><div class="flashbang-flash"></div>',
      { hold: FLASHBANG_MS, out: 0 },
    )
    blast()
    survived()
  }, FUSE_MS)
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
