import { ACHIEVEMENTS, achievement, noiseBuffer, reducedMotion, show, startAudio } from './memes'

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

function tones(notes, { type = 'square', level = 0.05 } = {}) {
  const out = startAudio()
  if (!out) return
  const audio = out.context
  const t = audio.currentTime
  for (const [at, frequency, length] of notes) {
    const tone = audio.createOscillator()
    const gain = audio.createGain()
    tone.type = type
    tone.frequency.value = frequency
    gain.gain.setValueAtTime(level, t + at)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + at + length)
    tone.connect(gain).connect(out)
    tone.start(t + at)
    tone.stop(t + at + length)
  }
}

function whoosh(seconds, from, to, level = 0.14) {
  const out = startAudio()
  if (!out) return
  const audio = out.context
  const t = audio.currentTime
  const source = audio.createBufferSource()
  const band = audio.createBiquadFilter()
  const gain = audio.createGain()
  source.buffer = noiseBuffer()
  source.loop = true
  band.type = 'bandpass'
  band.Q.value = 1.1
  band.frequency.setValueAtTime(from, t)
  band.frequency.exponentialRampToValueAtTime(to, t + seconds)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(level, t + seconds * 0.35)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  source.connect(band).connect(gain).connect(out)
  source.start(t)
  source.stop(t + seconds)
}

function oof() {
  const out = startAudio()
  if (!out) return
  const audio = out.context
  const t = audio.currentTime
  const voice = audio.createOscillator()
  const level = audio.createGain()
  voice.type = 'sawtooth'
  voice.frequency.setValueAtTime(190, t)
  voice.frequency.exponentialRampToValueAtTime(115, t + 0.2)
  level.gain.setValueAtTime(0.0001, t)
  level.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
  level.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
  for (const [frequency, q] of [
    [650, 5],
    [1080, 6],
  ]) {
    const formant = audio.createBiquadFilter()
    formant.type = 'bandpass'
    formant.frequency.value = frequency
    formant.Q.value = q
    voice.connect(formant).connect(level)
  }
  level.connect(out)
  voice.start(t)
  voice.stop(t + 0.25)
}

const COIN_SOUND = [
  [0, 988, 0.08],
  [0.08, 1319, 0.5],
]
const ONE_UP_SOUND = [
  [0, 659, 0.1],
  [0.1, 784, 0.1],
  [0.2, 1319, 0.1],
  [0.3, 1047, 0.1],
  [0.4, 1175, 0.1],
  [0.5, 1568, 0.3],
]
const POWER_UP_SOUND = [
  [0, 523, 0.07],
  [0.07, 659, 0.07],
  [0.14, 784, 0.07],
  [0.21, 1047, 0.25],
]

const CREW = [
  ['#c51111', '#7a0838'],
  ['#132ed1', '#09158e'],
  ['#117f2d', '#0a4d2e'],
  ['#ed54ba', '#ab2bad'],
  ['#ef7d0d', '#b33e15'],
  ['#f5f557', '#c38823'],
  ['#d6e0f0', '#8394bf'],
  ['#6b2fbb', '#3b177c'],
  ['#38fedc', '#24a8be'],
  ['#50ef39', '#15a742'],
]

const EJECTIONS = [
  ['You were not The Impostor.', '1 Impostor remains.'],
  ['Light mode was The Impostor.', '0 Impostors remain.'],
  ['The Minecraft parkour was The Impostor.', '0 Impostors remain.'],
  ['blxr was not The Impostor.', '1 Impostor remains.'],
  ['Internet Explorer was The Impostor.', '0 Impostors remain.'],
  ['The 404 page was not The Impostor.', '1 Impostor remains.'],
]

const crewmate = ([body, shade]) =>
  `<svg class="sus-crew" viewBox="0 0 124 150" style="--body:${body};--shade:${shade}">` +
  '<rect x="6" y="50" width="28" height="58" rx="11" fill="var(--shade)" stroke="#000" stroke-width="6"/>' +
  '<path d="M28 66C28 30 46 12 66 12s38 18 38 52v64c0 7-6 12-12 12H80c-6 0-10-4-10-10v-10H60v10c0 6-4 10-10 10H40c-7 0-12-5-12-12Z" ' +
  'fill="var(--body)" stroke="#000" stroke-width="6"/>' +
  '<path d="M32 104c10 8 30 10 48 4v10H60v12c0 6-4 10-10 10H40c-7 0-12-5-12-12Z" fill="var(--shade)"/>' +
  '<path d="M70 38h30c9 0 16 7 16 16s-7 16-16 16H70c-9 0-16-7-16-16s7-16 16-16Z" fill="#95cadc" stroke="#000" stroke-width="6"/>' +
  '<path d="M74 47h20" stroke="#fff" stroke-width="5" stroke-linecap="round"/>' +
  '</svg>'

export function ejected() {
  const [line, remains] = pick(EJECTIONS)
  const el = show(
    'sus',
    '<div class="sus-stars"></div><div class="sus-stars sus-stars-far"></div>' +
      crewmate(pick(CREW)) +
      '<p class="sus-line"></p>' +
      `<p class="sus-left">${remains}</p>`,
    { hold: 6400, out: 600 },
  )
  whoosh(2.4, 300, 90, 0.1)
  const text = el.querySelector('.sus-line')
  let shown = 0
  setTimeout(function type() {
    if (!text.isConnected || shown >= line.length) return
    text.textContent = line.slice(0, ++shown)
    setTimeout(type, 55)
  }, 1400)
}

export function doom(code) {
  const god = code === 'iddqd'
  show(
    god ? 'doom doom-god' : 'doom doom-ammo',
    `<div class="doom-tint"></div><p class="doom-msg">${god ? 'Degreelessness mode on' : 'Very happy ammo added'}</p>`,
    { hold: god ? 3000 : 2200, out: 300 },
  )
  tones(POWER_UP_SOUND)
}

const DEATHS = [
  'You fell out of the world',
  'You tried to swim in lava',
  'You were blown up by Creeper',
  'You were slain by the Minecraft parkour',
  'You experienced kinetic energy',
  'You starved to death reading the CV',
  'You went up in flames after a flashbang',
]

export function youDied() {
  const score = Math.round(performance.now() / 1000)
  show(
    'mc-death',
    '<p class="mc-title">You died!</p>' +
      `<p class="mc-cause">${pick(DEATHS)}</p>` +
      `<p class="mc-score">Score: <b>${score}</b></p>` +
      '<span class="mc-button">Respawn</span><span class="mc-button">Title Screen</span>',
    { hold: 4800, out: 500 },
  )
  oof()
}

const COIN =
  '<svg viewBox="0 0 12 16"><ellipse cx="6" cy="8" rx="5.4" ry="7.4" fill="#f8b800" stroke="#000" stroke-width=".9"/>' +
  '<ellipse cx="6" cy="8" rx="3.5" ry="5.5" fill="none" stroke="#c06c00" stroke-width=".9"/>' +
  '<rect x="5.2" y="4.2" width="1.6" height="7.6" rx=".8" fill="#fff4b8"/></svg>'
let coins = 0

export function coin(block) {
  coins += 1
  const oneUp = coins % 10 === 0
  const box = block.getBoundingClientRect()
  const pop = document.createElement('div')
  pop.className = oneUp ? 'coin-pop coin-one-up' : 'coin-pop'
  pop.setAttribute('aria-hidden', 'true')
  pop.innerHTML = oneUp ? '1UP' : COIN
  pop.style.left = `${box.left + box.width / 2}px`
  pop.style.top = `${box.top - 6}px`
  document.body.append(pop)
  const gone = () => pop.remove()
  pop.addEventListener('animationend', (event) => event.target === pop && gone())
  setTimeout(gone, 1500)
  if (!reducedMotion()) {
    block.animate?.([{ translate: '0 0' }, { translate: '0 -8px' }, { translate: '0 0' }], {
      duration: 180,
      easing: 'ease-out',
    })
  }
  tones(oneUp ? ONE_UP_SOUND : COIN_SOUND)
  if (oneUp) achievement(ACHIEVEMENTS.oneUp)
}

const SOLID = 'img, svg, video, canvas, button, input, textarea, select, hr'
const MAX_FALLING = 240
const GRID_CELLS = 5
let collapsing = false

function looseBlocks() {
  const picked = []
  let last = null
  for (const el of document.querySelectorAll('body *')) {
    if (picked.length >= MAX_FALLING) break
    if (last?.contains(el) || el.closest('script, style, noscript, .rmrf')) continue
    if (el instanceof SVGElement && el.ownerSVGElement) continue
    const solid = el.matches(SOLID)
    const texty = !solid && [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())
    const grid =
      !solid && !texty && el.children.length >= GRID_CELLS && [...el.children].every((child) => !child.firstElementChild)
    if (!solid && !texty && !grid) continue
    const box = el.getBoundingClientRect()
    if (!box.width || !box.height || box.bottom < 0 || box.top > innerHeight) continue
    picked.push(el)
    last = el
  }
  return picked
}

export function rmrf() {
  if (collapsing) return
  collapsing = true
  const blocks = reducedMotion() ? [] : looseBlocks()
  const el = show(
    'rmrf',
    '<div class="rmrf-window"><p class="rmrf-bar"><i></i><i></i><i></i><span>visitor@blxr: ~</span></p>' +
      '<pre class="rmrf-log"></pre></div>',
    { hold: 6600, out: 400 },
  )
  const log = el.querySelector('.rmrf-log')
  const say = (line) => {
    if (log.isConnected) log.textContent += `${line}\n`
  }
  const at = (ms, run) => setTimeout(run, ms)

  say('$ sudo rm -rf /')
  at(600, () => say('[sudo] password for visitor: ********'))
  at(1100, () => {
    say(`removing ${location.hostname || 'this page'}…`)
    whoosh(1.4, 900, 120)
    for (const block of blocks) {
      if (getComputedStyle(block).display === 'inline') block.dataset.fallInline = ''
      block.style.setProperty('--fall-delay', `${Math.round(Math.random() * 500)}ms`)
      block.style.setProperty('--fall-x', `${Math.round((Math.random() - 0.5) * 90)}px`)
      block.style.setProperty('--fall-spin', `${Math.round((Math.random() - 0.5) * 80)}deg`)
      block.dataset.fall = 'down'
    }
  })
  at(2700, () => say(`removed ${blocks.length.toLocaleString('en-US')} things. goodbye.`))
  at(3700, () => say("just kidding. it's a static site."))
  at(4300, () => {
    say('restoring from backup…')
    for (const block of blocks) block.dataset.fall = 'up'
  })
  at(5600, () => {
    say('✓ restored')
    for (const block of blocks) {
      delete block.dataset.fall
      delete block.dataset.fallInline
      for (const name of ['--fall-delay', '--fall-x', '--fall-spin']) block.style.removeProperty(name)
    }
    collapsing = false
    achievement(ACHIEVEMENTS.rmrf)
  })
}

export function notResponding() {
  const host = location.hostname || 'This page'
  show(
    'hang',
    `<div class="hang-window"><p class="hang-title">${host}</p>` +
      `<div class="hang-body"><p class="hang-head">${host} isn't responding</p>` +
      '<p>It has switched themes more times in the last few seconds than most sites do all year. Give it a moment.</p></div>' +
      '<p class="hang-actions"><span>Close the program</span><span class="hang-wait">Wait for the program to respond</span></p></div>',
    { hold: 3400, out: 300 },
  )
  tones(
    [
      [0, 880, 0.4],
      [0, 1319, 0.4],
    ],
    { type: 'sine', level: 0.04 },
  )
  achievement(ACHIEVEMENTS.indecisive)
}

const DVD_COLORS = ['#f5d90a', '#ff4d6d', '#4dabf7', '#51cf66', '#cc5de8', '#ff922b', '#f8f9fa']
const DVD_SPEED = 150
const CORNER_MS = 80
const WAKE_PX = 12
let screensaver = null

export function dvd() {
  if (screensaver) return
  const el = document.createElement('div')
  el.className = 'dvd'
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML =
    '<div class="dvd-logo"><span>blxr</span>' +
    '<svg viewBox="0 0 100 26"><ellipse cx="50" cy="13" rx="50" ry="13"/><text x="50" y="17.6">VIDEO</text></svg></div>'
  document.body.append(el)
  const logo = el.firstChild
  let color = Math.floor(Math.random() * DVD_COLORS.length)
  logo.style.color = DVD_COLORS[color]

  let x = Math.random() * Math.max(0, innerWidth - logo.offsetWidth)
  let y = Math.random() * Math.max(0, innerHeight - logo.offsetHeight)
  let vx = DVD_SPEED * (Math.random() < 0.5 ? -1 : 1)
  let vy = DVD_SPEED * 0.72 * (Math.random() < 0.5 ? -1 : 1)
  let wallX = -Infinity
  let wallY = -Infinity
  let last = performance.now()

  const step = (now) => {
    if (!el.isConnected) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const maxX = Math.max(0, innerWidth - logo.offsetWidth)
    const maxY = Math.max(0, innerHeight - logo.offsetHeight)
    x += vx * dt
    y += vy * dt
    let bounced = false
    if (x <= 0 || x >= maxX) {
      vx = x <= 0 ? Math.abs(vx) : -Math.abs(vx)
      x = clamp(x, 0, maxX)
      wallX = now
      bounced = true
    }
    if (y <= 0 || y >= maxY) {
      vy = y <= 0 ? Math.abs(vy) : -Math.abs(vy)
      y = clamp(y, 0, maxY)
      wallY = now
      bounced = true
    }
    if (bounced) {
      color = (color + 1 + Math.floor(Math.random() * (DVD_COLORS.length - 1))) % DVD_COLORS.length
      logo.style.color = DVD_COLORS[color]
      if (Math.abs(wallX - wallY) < CORNER_MS) {
        el.classList.remove('dvd-corner')
        void el.offsetWidth
        el.classList.add('dvd-corner')
        tones(ONE_UP_SOUND)
        achievement(ACHIEVEMENTS.dvdCorner)
      }
    }
    logo.style.translate = `${x}px ${y}px`
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)

  let origin = null
  const wake = (event) => {
    if (event.type === 'pointermove') {
      origin ??= [event.clientX, event.clientY]
      if (Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) < WAKE_PX) return
    }
    stop()
  }
  const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']
  const stop = () => {
    events.forEach((type) => window.removeEventListener(type, wake, true))
    el.classList.add('is-leaving')
    setTimeout(() => el.remove(), 300)
    screensaver = null
  }
  setTimeout(() => events.forEach((type) => window.addEventListener(type, wake, { capture: true, passive: true })), 400)
  screensaver = stop
}
