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
const SMOKE_AT_MS = 1000
const SMOKE_COVER_MS = 1900
const SMOKE_MS = 5600
const HISS_S = 3.8
const SMOKE_PUFFS = 24
const SMOKE_TONES = ['74 78 82', '58 61 65', '43 46 49', '30 32 34']
let flashbangs = 0
let armed = null
let audio = null
let noise = null
let silence = null

const nade = (defs, body) =>
  '<div class="nade"><svg viewBox="0 0 60 140">' +
  '<defs><linearGradient id="nade-steel" x1="0" x2="1">' +
  '<stop offset="0" stop-color="#3b3e38"/><stop offset=".35" stop-color="#a3a69c"/>' +
  `<stop offset="1" stop-color="#34372f"/></linearGradient>${defs}</defs>` +
  '<rect x="21" y="8" width="18" height="16" rx="3" fill="url(#nade-steel)"/>' +
  '<rect x="15" y="22" width="30" height="9" rx="2" fill="url(#nade-steel)"/>' +
  body +
  '<rect x="11" y="124" width="38" height="10" rx="3" fill="url(#nade-steel)"/>' +
  '<path class="nade-spoon" d="M36 11C46 9 53 15 53 25V78" fill="none" stroke="#b8bab0" stroke-width="4.5" stroke-linecap="round"/>' +
  '</svg></div>'

const FLASHBANG_HOLES = [47, 61, 75, 89, 103]
  .flatMap((y, row) =>
    (row % 2 ? [[22, 5], [38, 5]] : [[15, 3], [30, 6], [45, 3]]).map(
      ([x, w]) => `<rect x="${x - w / 2}" y="${y}" width="${w}" height="9" rx="${w / 2}"/>`,
    ),
  )
  .join('')

const FLASHBANG_NADE = nade(
  '<linearGradient id="nade-drab" x1="0" x2="1">' +
    '<stop offset="0" stop-color="#2c3114"/><stop offset=".32" stop-color="#6d7a36"/>' +
    '<stop offset=".55" stop-color="#4f5a24"/><stop offset="1" stop-color="#232810"/></linearGradient>',
  '<rect x="9" y="29" width="42" height="98" rx="7" fill="url(#nade-drab)"/>' +
    '<rect x="9" y="36" width="42" height="3" fill="#d6c46a" opacity=".85"/>' +
    `<g fill="#161a08">${FLASHBANG_HOLES}</g>`,
)

const SMOKE_VENTS = [41, 113]
  .flatMap((y) => [17, 30, 43].map((x) => `<circle cx="${x}" cy="${y}" r="2.6"/>`))
  .join('')

// The label runs along the body so it reads left to right once the can lies on its side.
const SMOKE_NADE = nade(
  '<linearGradient id="nade-gunmetal" x1="0" x2="1">' +
    '<stop offset="0" stop-color="#1b1f22"/><stop offset=".32" stop-color="#6b737a"/>' +
    '<stop offset=".55" stop-color="#474f55"/><stop offset="1" stop-color="#15181a"/></linearGradient>',
  '<rect x="9" y="29" width="42" height="98" rx="7" fill="url(#nade-gunmetal)"/>' +
    '<rect x="9" y="32" width="42" height="4" fill="#d3d7da" opacity=".9"/>' +
    '<rect x="9" y="119" width="42" height="3" fill="#d3d7da" opacity=".9"/>' +
    `<g fill="#0d0f10">${SMOKE_VENTS}</g>` +
    '<text transform="translate(25.8 78) rotate(90)" text-anchor="middle" font-family="system-ui, sans-serif" ' +
    'font-size="12" font-weight="800" letter-spacing="1.5" fill="#dfe2e4">SMOKE</text>',
)

const round = (value) => Math.round(value * 10) / 10

function smokeCloud() {
  let puffs = ''
  for (let i = 0; i < SMOKE_PUFFS; i++) {
    const p = i / (SMOKE_PUFFS - 1)
    // Early puffs jet upward out of the can, later ones roll outward in every direction.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * (1.4 + p * 4.4)
    const reach = 3 + p * 40 + Math.random() * 10
    const style = [
      `--x:${round(Math.cos(angle) * reach)}vmax`,
      `--y:${round(Math.sin(angle) * reach * 0.75)}vmax`,
      `--size:${round(12 + p * 48 + Math.random() * 16)}vmax`,
      `--tone:${SMOKE_TONES[Math.floor(Math.random() * SMOKE_TONES.length)]}`,
      `--at:${Math.round(SMOKE_AT_MS + p * 550 + Math.random() * 120)}ms`,
      `--grow:${Math.round(700 + Math.random() * 400)}ms`,
      `--thin:${Math.round(SMOKE_COVER_MS + 300 + Math.random() * 1500)}ms`,
      `--fade:${Math.round(1300 + Math.random() * 400)}ms`,
      `--dx:${round((Math.random() - 0.5) * 12)}vw`,
      `--dy:${round(-6 - Math.random() * 14)}vh`,
    ].join(';')
    puffs += `<i class="smoke-puff" style="${style}"></i>`
  }
  return `<div class="smoke-haze"></div><div class="smoke-fog"></div>${puffs}`
}

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

function noiseBuffer() {
  if (!noise) {
    noise = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate)
    const samples = noise.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
  }
  return noise
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

  const crack = audio.createBufferSource()
  const muffle = audio.createBiquadFilter()
  const crackGain = audio.createGain()
  crack.buffer = noiseBuffer()
  muffle.type = 'lowpass'
  muffle.frequency.setValueAtTime(6000, t)
  muffle.frequency.exponentialRampToValueAtTime(180, t + 0.45)
  crackGain.gain.setValueAtTime(0.4, t)
  crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
  crack.connect(muffle).connect(crackGain).connect(out)
  crack.start(t)
  crack.stop(t + 0.5)

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

function hiss(out, t) {
  const pop = audio.createOscillator()
  const popGain = audio.createGain()
  pop.frequency.setValueAtTime(320, t)
  pop.frequency.exponentialRampToValueAtTime(70, t + 0.12)
  popGain.gain.setValueAtTime(0.3, t)
  popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
  pop.connect(popGain).connect(out)
  pop.start(t)
  pop.stop(t + 0.16)

  const jet = audio.createBufferSource()
  const band = audio.createBiquadFilter()
  const flutter = audio.createGain()
  const level = audio.createGain()
  jet.buffer = noiseBuffer()
  jet.loop = true
  band.type = 'bandpass'
  band.Q.value = 0.8
  band.frequency.setValueAtTime(4200, t)
  band.frequency.exponentialRampToValueAtTime(1500, t + HISS_S)
  level.gain.setValueAtTime(0.0001, t)
  level.gain.exponentialRampToValueAtTime(0.14, t + 0.06)
  level.gain.setValueAtTime(0.14, t + 1.1)
  level.gain.exponentialRampToValueAtTime(0.0001, t + HISS_S)
  jet.connect(band).connect(flutter).connect(level).connect(out)
  jet.start(t)
  jet.stop(t + HISS_S)

  const sputter = audio.createOscillator()
  const depth = audio.createGain()
  sputter.frequency.value = 11
  depth.gain.value = 0.25
  sputter.connect(depth).connect(flutter.gain)
  sputter.start(t)
  sputter.stop(t + HISS_S)
}

// One grenade in the air at a time: throwing again mid-flight only swaps what happens when it goes off.
function pullPin(then) {
  const throwing = !armed
  armed = then
  return throwing
}

function goesOff() {
  const then = armed
  armed = null
  then()
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
  if (!pullPin(onBlast)) return

  const out = startAudio()
  if (out) {
    const t = audio.currentTime
    for (const [at, level] of BOUNCES) clink(out, t + at, level)
    bang(out, t + FUSE_MS / 1000)
  }
  show('flashbang-throw', FLASHBANG_NADE, { hold: FUSE_MS + 200, out: 0 })

  setTimeout(() => {
    show(
      'flashbang',
      '<div class="flashbang-haze"></div><div class="flashbang-burn"></div><div class="flashbang-flash"></div>',
      { hold: FLASHBANG_MS, out: 0 },
    )
    goesOff()
    survived()
  }, FUSE_MS)
}

export function smokeGrenade(onCover = () => {}) {
  if (reducedMotion()) {
    onCover()
    return
  }
  if (!pullPin(onCover)) return

  const out = startAudio()
  if (out) {
    const t = audio.currentTime
    for (const [at, level] of BOUNCES) clink(out, t + at, level)
    hiss(out, t + SMOKE_AT_MS / 1000)
  }
  show('smoke', SMOKE_NADE + smokeCloud(), { hold: SMOKE_MS, out: 0 })
  setTimeout(goesOff, SMOKE_COVER_MS)
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
