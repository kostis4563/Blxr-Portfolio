export const reducedMotion = () =>
  document.documentElement.dataset.motion === 'reduced' ||
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export const onDesktop = () => Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches)

let dismiss = null
let cleared = Promise.resolve()

export function show(className, html, { hold, out }) {
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
  return el
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
  nuked: { id: 'nuked', gamerscore: 500, title: 'Survived the 1 in 5,000 nuke' },
  launchCodes: { id: 'launch-codes', gamerscore: 20, title: 'Found the launch codes' },
  cheater: { id: 'cheater', gamerscore: 0, title: 'Typed a San Andreas cheat' },
  barrelRoll: { id: 'barrel-roll', gamerscore: 10, title: 'Did a barrel roll' },
  oneUp: { id: 'one-up', gamerscore: 10, title: 'Hit the ? block ten times' },
  rmrf: { id: 'rm-rf', gamerscore: 15, title: 'Ran sudo rm -rf /' },
  indecisive: { id: 'indecisive', gamerscore: 5, title: 'Could not pick a theme' },
  dvdCorner: { id: 'dvd-corner', gamerscore: 50, title: 'Saw the DVD logo hit the corner' },
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
export const NUKE_ODDS = 5000
const LAUNCH_MS = 3200
const DROP_MS = 1600
const SHOCK_MS = 900
const FLASH_COVER_MS = 300
const NUKE_MS = 10400
const BOOMS = [
  [0, 1],
  [1.1, 0.62],
  [2.3, 0.4],
]
const CHEAT_MS = 3600
const MONEY = 250000
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

const TREFOIL = [-90, 30, 150]
  .map((mid) => {
    const at = (r, deg) => `${round(r * Math.cos((deg * Math.PI) / 180))} ${round(r * Math.sin((deg * Math.PI) / 180))}`
    const [from, to] = [mid - 30, mid + 30]
    return `M${at(2.4, from)}L${at(8, from)}A8 8 0 0 1 ${at(8, to)}L${at(2.4, to)}A2.4 2.4 0 0 0 ${at(2.4, from)}Z`
  })
  .join('')

const RADIATION = `<circle r="10" fill="#f5d90a"/><path d="${TREFOIL}" fill="#111"/><circle r="1.4" fill="#111"/>`
const radiationSign = `<svg class="nuke-sign" viewBox="-10 -10 20 20">${RADIATION}</svg>`

const BOMB =
  '<div class="nuke-bomb"><svg viewBox="0 0 60 124">' +
  '<defs><linearGradient id="nuke-shell" x1="0" x2="1">' +
  '<stop offset="0" stop-color="#23261f"/><stop offset=".34" stop-color="#8d927e"/>' +
  '<stop offset=".58" stop-color="#5b6150"/><stop offset="1" stop-color="#1c1e18"/></linearGradient>' +
  '<clipPath id="nuke-body"><ellipse cx="30" cy="82" rx="25" ry="38"/></clipPath></defs>' +
  '<path d="M16 6L30 46M44 6L30 46" stroke="#4a4f40" stroke-width="2.5"/>' +
  '<rect x="13" y="4" width="34" height="24" rx="2" fill="none" stroke="url(#nuke-shell)" stroke-width="4"/>' +
  '<rect x="27" y="4" width="6" height="42" fill="url(#nuke-shell)"/>' +
  '<ellipse cx="30" cy="82" rx="25" ry="38" fill="url(#nuke-shell)"/>' +
  '<g clip-path="url(#nuke-body)"><rect y="58" width="60" height="6" fill="#e8c21a"/>' +
  '<rect y="104" width="60" height="4" fill="#e8c21a" opacity=".8"/></g>' +
  `<g transform="translate(30 84) scale(.95)">${RADIATION}</g>` +
  '</svg></div>'

const cloud = () => import('./mushroom-cloud')

const WARNING =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>' +
  '<path d="M12 9v4.5M12 17h.01" stroke="#1c1c1e" stroke-width="2.2" stroke-linecap="round"/></svg>'

const launchAlert = (seconds) =>
  '<div class="nuke-alarm"></div>' +
  '<div class="nuke-alert">' +
  `<p class="nuke-alert-head">${WARNING}<span>Emergency alert</span><time>now</time></p>` +
  `<p class="nuke-alert-title">Ballistic missile threat inbound to ${location.hostname || 'this page'}.</p>` +
  '<p class="nuke-alert-copy">Seek immediate shelter. This is not a drill.</p>' +
  `<p class="nuke-alert-count">Impact in <b>${seconds}</b></p>` +
  '</div>'

export function startAudio() {
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

export function noiseBuffer() {
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

function whistle(out, t) {
  const fall = DROP_MS / 1000
  const tone = audio.createOscillator()
  const wobble = audio.createOscillator()
  const wobbleDepth = audio.createGain()
  const level = audio.createGain()
  tone.frequency.setValueAtTime(1500, t)
  tone.frequency.exponentialRampToValueAtTime(420, t + fall)
  wobble.frequency.value = 6
  wobbleDepth.gain.value = 18
  wobble.connect(wobbleDepth).connect(tone.frequency)
  level.gain.setValueAtTime(0.0001, t)
  level.gain.exponentialRampToValueAtTime(0.05, t + 0.25)
  level.gain.setValueAtTime(0.05, t + fall - 0.05)
  level.gain.exponentialRampToValueAtTime(0.0001, t + fall)
  tone.connect(level).connect(out)
  for (const node of [tone, wobble]) {
    node.start(t)
    node.stop(t + fall)
  }
}

function boom(out, t, size) {
  const crack = audio.createBufferSource()
  const bright = audio.createBiquadFilter()
  const crackGain = audio.createGain()
  crack.buffer = noiseBuffer()
  bright.type = 'highpass'
  bright.frequency.value = 1200
  crackGain.gain.setValueAtTime(0.6 * size ** 3, t)
  crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
  crack.connect(bright).connect(crackGain).connect(out)
  crack.start(t)
  crack.stop(t + 0.15)

  const thump = audio.createOscillator()
  const thumpGain = audio.createGain()
  thump.frequency.setValueAtTime(95, t)
  thump.frequency.exponentialRampToValueAtTime(24, t + 0.9)
  thumpGain.gain.setValueAtTime(0.75 * size, t)
  thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1 + size)
  thump.connect(thumpGain).connect(out)
  thump.start(t)
  thump.stop(t + 1.2 + size)

  const blast = audio.createBufferSource()
  const muffle = audio.createBiquadFilter()
  const blastGain = audio.createGain()
  blast.buffer = noiseBuffer()
  blast.loop = true
  muffle.type = 'lowpass'
  muffle.frequency.setValueAtTime(2400 * size, t)
  muffle.frequency.exponentialRampToValueAtTime(70, t + 1.4 + size)
  blastGain.gain.setValueAtTime(0.7 * size, t)
  blastGain.gain.exponentialRampToValueAtTime(0.001, t + 2 + size * 2)
  blast.connect(muffle).connect(blastGain).connect(out)
  blast.start(t)
  blast.stop(t + 2 + size * 2)
}

let crackles = null

function crackleBuffer() {
  if (!crackles) {
    crackles = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate)
    const samples = crackles.getChannelData(0)
    for (let i = 0; i < samples.length; i++) {
      if (Math.random() > 0.0012) continue
      const length = 30 + Math.floor(Math.random() * 90)
      const level = 0.3 + Math.random() * 0.7
      for (let j = 0; j < length && i + j < samples.length; j++) {
        samples[i + j] += (Math.random() * 2 - 1) * level * (1 - j / length)
      }
    }
  }
  return crackles
}

function roar(out, t, hit) {
  const end = hit + 7
  const source = audio.createBufferSource()
  const low = audio.createBiquadFilter()
  const rolling = audio.createGain()
  const level = audio.createGain()
  source.buffer = noiseBuffer()
  source.loop = true
  low.type = 'lowpass'
  low.frequency.value = 150
  rolling.gain.value = 0.6
  level.gain.setValueAtTime(0.0001, t)
  level.gain.exponentialRampToValueAtTime(0.12, hit - 0.05)
  level.gain.exponentialRampToValueAtTime(0.6, hit + 0.15)
  level.gain.setValueAtTime(0.6, hit + 2.5)
  level.gain.exponentialRampToValueAtTime(0.0001, end)
  source.connect(low).connect(rolling).connect(level).connect(out)
  source.start(t)
  source.stop(end)
  for (const [frequency, depth] of [
    [0.45, 0.25],
    [1.3, 0.18],
  ]) {
    const wobble = audio.createOscillator()
    const amount = audio.createGain()
    wobble.frequency.value = frequency
    amount.gain.value = depth
    wobble.connect(amount).connect(rolling.gain)
    wobble.start(t)
    wobble.stop(end)
  }
}

function gust(out, t) {
  const source = audio.createBufferSource()
  const band = audio.createBiquadFilter()
  const level = audio.createGain()
  source.buffer = noiseBuffer()
  source.loop = true
  band.type = 'bandpass'
  band.Q.value = 0.9
  band.frequency.setValueAtTime(1400, t)
  band.frequency.exponentialRampToValueAtTime(220, t + 1.4)
  level.gain.setValueAtTime(0.0001, t)
  level.gain.exponentialRampToValueAtTime(0.35, t + 0.08)
  level.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
  source.connect(band).connect(level).connect(out)
  source.start(t)
  source.stop(t + 1.6)
}

function crackle(out, t) {
  const source = audio.createBufferSource()
  const band = audio.createBiquadFilter()
  const level = audio.createGain()
  source.buffer = crackleBuffer()
  source.loop = true
  band.type = 'bandpass'
  band.frequency.value = 2200
  band.Q.value = 0.5
  level.gain.setValueAtTime(0.0001, t)
  level.gain.exponentialRampToValueAtTime(0.25, t + 0.3)
  level.gain.exponentialRampToValueAtTime(0.0001, t + 5)
  source.connect(band).connect(level).connect(out)
  source.start(t)
  source.stop(t + 5)
}

function detonation(out, t) {
  const hit = t + SHOCK_MS / 1000
  roar(out, t, hit)
  gust(out, hit)
  crackle(out, hit)
  for (const [at, size] of BOOMS) boom(out, hit + at, size)
}

function alarm(out, t) {
  const level = audio.createGain()
  level.gain.setValueAtTime(0, t)
  for (const [on, off] of [
    [0, 0.5],
    [0.62, 1.12],
    [1.24, 1.74],
  ]) {
    level.gain.setValueAtTime(0, t + on)
    level.gain.linearRampToValueAtTime(0.035, t + on + 0.01)
    level.gain.setValueAtTime(0.035, t + off - 0.01)
    level.gain.linearRampToValueAtTime(0, t + off)
  }
  level.connect(out)
  for (const frequency of [853, 960]) {
    const tone = audio.createOscillator()
    tone.frequency.value = frequency
    tone.connect(level)
    tone.start(t)
    tone.stop(t + 1.8)
  }
}

function siren(out, t, cut) {
  const end = cut + 2.4
  const soften = audio.createBiquadFilter()
  const level = audio.createGain()
  soften.type = 'lowpass'
  soften.frequency.value = 1800
  level.gain.setValueAtTime(0.0001, t)
  level.gain.exponentialRampToValueAtTime(0.05, t + 1.2)
  level.gain.setValueAtTime(0.05, cut)
  level.gain.exponentialRampToValueAtTime(0.0001, end)
  soften.connect(level).connect(out)
  for (const ratio of [1, 1.19]) {
    const rotor = audio.createOscillator()
    rotor.type = 'sawtooth'
    rotor.frequency.setValueAtTime(90 * ratio, t)
    rotor.frequency.exponentialRampToValueAtTime(470 * ratio, t + 1.6)
    rotor.frequency.setValueAtTime(470 * ratio, cut)
    rotor.frequency.exponentialRampToValueAtTime(110 * ratio, end)
    rotor.connect(soften)
    rotor.start(t)
    rotor.stop(end)
  }
}

function chime(out, t) {
  for (const [at, frequency] of [
    [0, 1318.5],
    [0.09, 1760],
  ]) {
    const tone = audio.createOscillator()
    const level = audio.createGain()
    tone.type = 'triangle'
    tone.frequency.value = frequency
    level.gain.setValueAtTime(0.0001, t + at)
    level.gain.exponentialRampToValueAtTime(0.09, t + at + 0.01)
    level.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.35)
    tone.connect(level).connect(out)
    tone.start(t + at)
    tone.stop(t + at + 0.36)
  }
}

function swoosh(out, t, seconds) {
  const source = audio.createBufferSource()
  const band = audio.createBiquadFilter()
  const level = audio.createGain()
  source.buffer = noiseBuffer()
  source.loop = true
  band.type = 'bandpass'
  band.Q.value = 1.2
  band.frequency.setValueAtTime(300, t)
  band.frequency.exponentialRampToValueAtTime(2200, t + seconds * 0.5)
  band.frequency.exponentialRampToValueAtTime(400, t + seconds)
  level.gain.setValueAtTime(0.0001, t)
  level.gain.exponentialRampToValueAtTime(0.16, t + seconds * 0.5)
  level.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  source.connect(band).connect(level).connect(out)
  source.start(t)
  source.stop(t + seconds)
}

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

function countDown(digit, until) {
  const left = until - performance.now()
  if (left <= 0 || !digit?.isConnected) return
  digit.textContent = Math.ceil(left / 1000)
  setTimeout(() => countDown(digit, until), left % 1000 || 1000)
}

export function nuke(onBlast = () => {}, { launched = false } = {}) {
  const prize = launched ? ACHIEVEMENTS.launchCodes : ACHIEVEMENTS.nuked
  if (reducedMotion()) {
    onBlast()
    achievement(prize)
    return true
  }
  if (!pullPin(onBlast)) return false

  const lead = launched ? LAUNCH_MS : 0
  const drop = lead + DROP_MS
  const out = startAudio()
  if (out) {
    const t = audio.currentTime
    const bus = audio.createDynamicsCompressor()
    bus.threshold.value = -16
    bus.ratio.value = 5
    bus.connect(out)
    if (launched) {
      alarm(bus, t)
      siren(bus, t + 1.1, t + drop / 1000)
    }
    whistle(bus, t + lead / 1000)
    detonation(bus, t + drop / 1000)
  }

  const odds = NUKE_ODDS.toLocaleString('en-US')
  const [kicker, footnote] = launched
    ? ['Launch codes accepted', `Launched from the console. The real one is a 1 in ${odds} chance`]
    : ['Congratulations', `This bomb was a 1 in ${odds} chance`]
  const detonateAt = performance.now() + drop
  const el = show(
    launched ? 'nuke nuke-launched' : 'nuke',
    (launched ? launchAlert(Math.round(drop / 1000)) : '') +
      '<div class="nuke-haze"></div>' +
      `<div class="nuke-scene"><canvas class="nuke-sky"></canvas>${BOMB}</div>` +
      '<div class="nuke-flash"></div>' +
      '<div class="nuke-band">' +
      `<span class="nuke-kicker">${radiationSign}${kicker}${radiationSign}</span>` +
      '<span class="nuke-title">You got nuked</span>' +
      `<span class="nuke-odds">${footnote}</span>` +
      '</div>',
    { hold: lead + NUKE_MS, out: 900 },
  )
  cloud()
    .then(({ mushroomCloud }) => mushroomCloud(el.querySelector('.nuke-sky'), { detonateAt, shock: SHOCK_MS / 1000 }))
    .catch(() => {})
  if (launched) countDown(el.querySelector('.nuke-alert-count b'), detonateAt)
  setTimeout(() => {
    goesOff()
    achievement(prize)
  }, drop + FLASH_COVER_MS)
  return true
}

const pad = (value, length = 2) => String(value).padStart(length, '0')

const STAR = '<svg viewBox="0 0 24 24"><path d="m12 2 2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8l-6.3 3.7 1.7-7.3L2 9.5l7.1-.6Z"/></svg>'

const CHEAT_HUD = {
  hesoyam:
    '<span class="gta-bar gta-armor"><i></i></span><span class="gta-bar gta-health"><i></i></span>' +
    `<span class="gta-money">$${pad(0, 8)}</span>`,
  aezakmi: `<span class="gta-stars">${STAR.repeat(6)}</span>`,
}

function countMoney(money) {
  const start = performance.now() + 300
  const step = (now) => {
    if (!money?.isConnected) return
    const progress = Math.min(1, Math.max(0, (now - start) / 1200))
    money.textContent = `$${pad(Math.round(MONEY * (1 - (1 - progress) ** 3)), 8)}`
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export function cheat(code) {
  const hud = CHEAT_HUD[code]
  if (!hud) return
  const now = new Date()
  const el = show(
    'gta-cheat',
    '<p class="gta-help">Cheat activated</p>' +
      `<div class="gta-hud"><span class="gta-clock">${pad(now.getHours())}:${pad(now.getMinutes())}</span>${hud}</div>`,
    { hold: CHEAT_MS, out: 500 },
  )
  const out = startAudio()
  if (out) chime(out, audio.currentTime)
  if (code === 'hesoyam') countMoney(el.querySelector('.gta-money'))
  achievement(ACHIEVEMENTS.cheater)
}

let rolling = false

export function barrelRoll() {
  if (reducedMotion() || !document.startViewTransition) {
    achievement(ACHIEVEMENTS.barrelRoll)
    return
  }
  if (rolling) return
  rolling = true
  const out = startAudio()
  if (out) swoosh(out, audio.currentTime, 1.2)
  const root = document.documentElement
  root.dataset.roll = ''
  document.startViewTransition(() => {}).finished.finally(() => {
    delete root.dataset.roll
    rolling = false
    achievement(ACHIEVEMENTS.barrelRoll)
  })
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

export const unlockedAchievements = () => sessionList(ACHIEVEMENTS_KEY)

const EXPLORER_PAGES = ['home', 'projects', 'library', 'reviews', 'uses', 'cv', 'contact']
const PAGE_OPEN_MS = 4000

export function trackPageVisit(page) {
  if (!EXPLORER_PAGES.includes(page) || !onDesktop()) return undefined
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
  if (!onDesktop()) return false
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
