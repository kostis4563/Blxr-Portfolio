import {
  ACHIEVEMENTS,
  barrelRoll,
  cheat,
  funEnabled,
  missionPassed,
  NUKE_ODDS,
  nuke,
  onDesktop,
  reducedMotion,
  setFun,
  unlockedAchievements,
  wasted,
} from './memes'
import { forceTheme } from './use-theme'

const effects = () => import('./secret-effects')
const withEffects = (run) => effects().then(run).catch(() => {})

const LABEL = 'background:#f5d90a;color:#111;font-weight:800;padding:2px 6px;border-radius:3px'
const NAME = 'color:#f5d90a;font-weight:700'
const PLAIN = ''
const HEAD = 'font-weight:700'
const DIM = 'color:#888'
const DONE = 'color:#22c55e;font-weight:700'

const ODDS = NUKE_ODDS.toLocaleString('en-US')

const LIST = [
  [
    'type these right here in the console',
    [
      ['enable', 'turn on flashbangs, Minecraft parkour and achievements'],
      ['disable', 'back to the plain site'],
      ['mpoum', 'launch a nuke at this page'],
      ['respect', 'mission passed'],
      ['wasted', 'wasted'],
      ['kill', 'the Minecraft death screen, scored by how long you stayed'],
      ['sus', 'emergency meeting'],
      ['dvd', 'the screensaver, now. wait for the corner'],
      ['sudo', 'you know how this ends'],
      ['coffee', 'HTTP has a status code for it'],
      ['hire', 'the useful one'],
      ['secrets', 'this list'],
    ],
  ],
  [
    "type these on the page, anywhere that isn't a text box",
    [
      ['hesoyam', 'full health, armour and $250k'],
      ['aezakmi', 'the cops forget you'],
      ['do a barrel roll', 'what Peppy keeps telling you to do'],
      ['iddqd', 'god mode, 1993 edition'],
      ['idkfa', 'and the ammo to go with it'],
      ['amogus', 'somebody gets ejected'],
      ['sudo rm -rf /', "don't"],
      ['↑↑↓↓←→←→ba', 'the Konami code, on the home page'],
    ],
  ],
  [
    'after you type enable',
    [
      ['theme toggle', 'going light throws a flashbang, going dark a smoke grenade'],
      ['', `1 in ${ODDS} switches drops a nuke instead`],
      ['', 'eight switches in a few seconds and the site stops responding'],
      ['skills section', 'skim past it on the home page and Minecraft parkour steps in'],
      ['', 'Focus mode gives it half the screen'],
      ['achievements', 'listed below, desktop only'],
    ],
  ],
  [
    'around the site',
    [
      ['home avatar', "it's a ? block. keep clicking"],
      ['doing nothing', 'three minutes idle and the screensaver comes on'],
      ['any 404', "you're wasted on arrival. double-click the 404 for the Game of Life"],
      ['reviews', 'leaving one is a mission passed'],
      ['messages', 'so is your first message in a dashboard thread'],
    ],
  ],
]

const HOW = {
  readItAll: 'spend time on every home page section and project, then rest at the bottom',
  neededParkour: 'reach the bottom of the home page after the parkour had to step in',
  stayedForParkour: 'watch the parkour all the way through in Focus mode',
  konami: '↑↑↓↓←→←→ba on the home page',
  flashbangs: 'switch to light mode five times',
  explorer: 'open home, projects, library, reviews, uses, cv and contact',
  completionist: 'read it all, stay for the parkour, Konami, five flashbangs, every page',
  nuked: `be the 1 in ${ODDS} theme switch`,
  launchCodes: 'type mpoum here',
  cheater: 'type hesoyam or aezakmi on the page',
  barrelRoll: 'type do a barrel roll on the page',
  oneUp: 'click the avatar on the home page ten times',
  rmrf: 'type sudo rm -rf / on the page',
  indecisive: 'switch themes eight times in six seconds',
  dvdCorner: 'type dvd here, or leave the page alone for three minutes, then wait',
}

function print(lines) {
  let format = ''
  const args = []
  for (const line of lines) {
    for (const [text, style = PLAIN] of line) {
      format += '%c%s'
      args.push(style, text)
    }
    format += '\n'
  }
  console.log(format.trimEnd(), ...args)
}

function listSecrets() {
  const width = Math.max(...LIST.flatMap(([, rows]) => rows.map(([name]) => name.length))) + 3
  const lines = [[['blxr secrets', LABEL], ['  everything hidden on this site, and how to set it off']]]
  for (const [heading, rows] of LIST) {
    lines.push([], [[heading, HEAD]])
    for (const [name, what] of rows) lines.push([['  '], [name.padEnd(width), NAME], [what]])
  }

  const unlocked = unlockedAchievements()
  const achievements = Object.entries(ACHIEVEMENTS)
  const titleWidth = Math.max(...achievements.map(([, { title }]) => title.length)) + 2
  const done = achievements.filter(([, { id }]) => unlocked.includes(id)).length
  const status = funEnabled() ? `${done} of ${achievements.length} this session` : 'off, type enable to start'
  lines.push([], [['achievements', HEAD], [`  desktop only · ${status}`, DIM]])
  for (const [key, { id, gamerscore, title }] of achievements) {
    const got = unlocked.includes(id)
    lines.push([
      [got ? '  ✓ ' : '  · ', got ? DONE : DIM],
      [title.padEnd(titleWidth), got ? DONE : PLAIN],
      [`${gamerscore}G`.padStart(4), DIM],
      [`  ${HOW[key] ?? ''}`, DIM],
    ])
  }
  print(lines)
}

const COMMANDS = {
  enable() {
    if (funEnabled()) return 'already on. type disable to turn it off'
    setFun(true)
    console.log('%cenabled%c flashbangs, Minecraft parkour and achievements are live. type disable to turn them off', LABEL, PLAIN)
    return '🎉'
  },
  disable() {
    if (!funEnabled()) return 'already off. type enable to turn it on'
    setFun(false)
    console.log('%cdisabled%c back to the plain site', LABEL, PLAIN)
    return '👋'
  },
  mpoum() {
    if (!nuke(() => forceTheme('light'), { launched: true })) return 'something is already in the air, give it a second'
    console.log('%c☢ launch codes accepted%c impact in 5 seconds', LABEL, PLAIN)
    return '💥'
  },
  respect() {
    missionPassed()
    return '+'
  },
  wasted() {
    wasted()
    return '💀'
  },
  kill() {
    withEffects(({ youDied }) => youDied())
    return '🪦'
  },
  sus() {
    withEffects(({ ejected }) => ejected())
    return '🔪'
  },
  dvd() {
    withEffects(({ dvd }) => dvd())
    return '📀'
  },
  sudo() {
    console.log('%cvisitor is not in the sudoers file. This incident will be reported.', 'color:#ff6b6b')
    return '🚨'
  },
  coffee() {
    console.log("%c418%c I'm a teapot", LABEL, PLAIN)
    return '🫖'
  },
  hire() {
    console.log(`reading the console of a portfolio is the right instinct.\n→ ${location.origin}/contact`)
    return '🤝'
  },
  secrets() {
    listSecrets()
    return '🤫'
  },
}

const CODES = {
  hesoyam: () => cheat('hesoyam'),
  aezakmi: () => cheat('aezakmi'),
  barrelroll: barrelRoll,
  iddqd: () => withEffects(({ doom }) => doom('iddqd')),
  idkfa: () => withEffects(({ doom }) => doom('idkfa')),
  amogus: () => withEffects(({ ejected }) => ejected()),
  sudormrf: () => withEffects(({ rmrf }) => rmrf()),
}
const LONGEST = Math.max(...Object.keys(CODES).map((code) => code.length))

const IDLE_MS = 3 * 60 * 1000
const IDLE_CHECK_MS = 5000
const AWAKE = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart']

function watchIdle() {
  let lastInput = performance.now()
  const awake = () => {
    lastInput = performance.now()
  }
  AWAKE.forEach((type) => window.addEventListener(type, awake, { capture: true, passive: true }))
  document.addEventListener('visibilitychange', awake)
  setInterval(() => {
    if (performance.now() - lastInput < IDLE_MS || document.hidden) return
    if (!onDesktop() || reducedMotion() || /^\/(dashboard|login)/.test(location.pathname)) return
    if ([...document.querySelectorAll('video')].some((video) => !video.paused)) return
    lastInput = performance.now()
    withEffects(({ dvd }) => dvd())
  }, IDLE_CHECK_MS)
}

export function installSecrets() {
  for (const [name, run] of Object.entries(COMMANDS)) {
    Object.defineProperty(window, name, { configurable: true, get: run })
  }

  document.addEventListener('click', (event) => {
    const block = event.target.closest?.('#intro > img')
    if (block) withEffects(({ coin }) => coin(block))
  })

  watchIdle()

  let typed = ''
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return
    if (event.target.isContentEditable || event.target.closest?.('input, textarea, select')) return
    typed = (typed + event.key.toLowerCase()).replace(/[^a-z]/g, '').slice(-LONGEST)
    const code = Object.keys(CODES).find((name) => typed.endsWith(name))
    if (!code) return
    typed = ''
    CODES[code]()
  })
}
