import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { still, scrollToId, jump, DitherSky, Notch, ThemeButton, HeroTrace, Stop, FrameLabel, useReveal } from './components/focus-kit'
import './focus.css'
import { Icon } from './components/icon'
import { imageProps } from './lib/images'
import { link, HOME_PATH, PROJECTS_PATH, BLOG_PATH, CONTACT_PATH } from './lib/router'
import { GITHUB_URL, DISCORD_URL, CONTACT_EMAIL } from './lib/profile'
import {
  FOCUS_VERSION,
  FOCUS_MIN_MACOS,
  FOCUS_DOWNLOAD,
  FOCUS_SIZE,
  ALLOWED_APPS,
  BLOCKED_SITES,
  APP_ICON,
  DISCORD_ICON,
  DEMO_APPS,
  OPEN_NOW,
  PRESETS,
  MAX_MINUTES,
  MIN_MINUTES,
  DIAL_MAX,
  DIAL_STEP,
  SAVE_GRACE,
  GRACE_CHOICES,
  DEFAULT_SETTINGS,
  appById,
  ruleList,
  wouldClose,
  planBlocks,
  normalizeSettings,
  siteHost,
  clock,
  listSentence,
  dialMinutes,
} from './lib/focus'

const DEMO_KEY = 'focus-lock-demo'
const TRIED_KEY = 'focus-lock-tried'
const SETTINGS_KEY = 'focus-lock-settings'
const DEFAULT_BLOCKS = planBlocks(DEFAULT_SETTINGS)

const timeOf = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const validBlock = (block) =>
  block && typeof block.name === 'string' && (block.kind === 'app' || block.kind === 'site') && Number.isFinite(block.at)

function readDemo() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null')
    if (saved && Number.isFinite(saved.start) && Number.isFinite(saved.end) && saved.end > Date.now()) {
      const blocks = Array.isArray(saved.blocks) && saved.blocks.every(validBlock) ? saved.blocks : DEFAULT_BLOCKS
      return { ...saved, blocks }
    }
  } catch {}
  return null
}

function readSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'))
  } catch {}
  return null
}

function writeSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {}
}

function playChime() {
  try {
    const Context = window.AudioContext || window.webkitAudioContext
    if (!Context) return
    const ctx = new Context()
    const at = ctx.currentTime
    for (const [freq, delay] of [
      [1318.5, 0],
      [1975.5, 0.09],
    ]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, at + delay)
      gain.gain.exponentialRampToValueAtTime(0.16, at + delay + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + delay + 1.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at + delay)
      osc.stop(at + delay + 1.5)
    }
    setTimeout(() => ctx.close(), 1800)
  } catch {}
}

function writeDemo(run) {
  try {
    if (run) localStorage.setItem(DEMO_KEY, JSON.stringify(run))
    else localStorage.removeItem(DEMO_KEY)
  } catch {}
}

function readTried() {
  try {
    const saved = JSON.parse(localStorage.getItem(TRIED_KEY) || '[]')
    if (Array.isArray(saved)) return saved.filter((key) => typeof key === 'string')
  } catch {}
  return []
}

function writeTried(tried) {
  try {
    localStorage.setItem(TRIED_KEY, JSON.stringify([...tried]))
  } catch {}
}

const blocksAt = (run, at) =>
  run.blocks.filter((block) => run.start + block.at * 1000 <= Math.min(at, run.end)).map((block) => ({
    ...block,
    time: run.start + block.at * 1000,
  }))

const SECTIONS = [
  ['try', 'Demo'],
  ['rules', 'Rules'],
  ['settings', 'Settings'],
  ['install', 'Install'],
  ['specs', 'Specs'],
  ['faq', 'FAQ'],
]

const NAV_SECTIONS = SECTIONS.filter(([id]) => id !== 'specs')

function useFocusDemo() {
  const [text, setText] = useState('45')
  const [strict, setStrict] = useState(false)
  const [fullScreen, setFullScreen] = useState(false)
  const [run, setRun] = useState(null)
  const [finished, setFinished] = useState(null)
  const [now, setNow] = useState(null)
  const [overlay, setOverlay] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [tried, setTried] = useState(() => new Set())
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [view, setView] = useState('setup')
  const settingsReady = useRef(false)

  const mark = useCallback((key) => setTried((prev) => (prev.has(key) ? prev : new Set(prev).add(key))), [])

  useEffect(() => {
    const stored = readSettings()
    if (stored) setSettings(stored)
    const before = readTried()
    if (before.length) setTried((prev) => new Set([...before, ...prev]))
    const saved = readDemo()
    if (saved) {
      setRun(saved)
      setStrict(Boolean(saved.strict))
      setText(String(Math.round((saved.end - saved.start) / 60000)))
      mark('reload')
    }
    setNow(Date.now())
  }, [mark])

  useEffect(() => {
    if (tried.size) writeTried(tried)
  }, [tried])

  useEffect(() => {
    if (settingsReady.current) writeSettings(settings)
  }, [settings])

  useEffect(() => {
    settingsReady.current = true
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), run ? 250 : 10000)
    return () => clearInterval(id)
  }, [run])

  useEffect(() => {
    if (!run || now === null || now < run.end) return
    setFinished({ minutes: Math.round((run.end - run.start) / 60000), blocked: blocksAt(run, run.end).length })
    setRun(null)
    setSheet(null)
    writeDemo(null)
    if (settings.chime) playChime()
  }, [now, run, settings.chime])

  const minutes = /^\d{1,3}$/.test(text) && +text >= MIN_MINUTES && +text <= MAX_MINUTES ? +text : null
  const active = Boolean(run) && now !== null && now < run.end
  const total = run ? (run.end - run.start) / 1000 : 0
  const elapsed = active ? Math.max(0, (now - run.start) / 1000) : 0
  const remaining = active ? (run.end - now) / 1000 : 0
  const progress = active && total > 0 ? Math.min(1, elapsed / total) : 0
  const blocks = active ? blocksAt(run, now) : []
  const latest = blocks[blocks.length - 1]
  const recent = latest && elapsed - latest.at < 5 ? latest : null
  const endsAt = now !== null && minutes !== null ? now + minutes * 60000 : null

  const begin = () => {
    if (minutes === null) return
    const start = Date.now()
    const next = { start, end: start + minutes * 60000, strict, blocks: planBlocks(settings) }
    setView('setup')
    setRun(next)
    setNow(start)
    setFinished(null)
    setSheet(null)
    writeDemo(next)
    mark('start')
    if (fullScreen) setOverlay(true)
  }

  const end = useCallback(() => {
    setRun(null)
    setSheet(null)
    setOverlay(false)
    writeDemo(null)
  }, [])

  const chooseStrict = useCallback(
    (value) => {
      setStrict(value)
      if (value) mark('strict')
    },
    [mark],
  )
  const closeSheet = useCallback(() => setSheet(null), [])
  const openOverlay = useCallback(() => setOverlay(true), [])
  const closeOverlay = useCallback(() => setOverlay(false), [])

  const change = useCallback(
    (update) => {
      setSettings((prev) => ({ ...prev, ...update(prev) }))
      mark('settings')
    },
    [mark],
  )
  const listKey = settings.rule === 'allow' ? 'allowed' : 'blocked'

  return {
    text,
    minutes,
    strict,
    fullScreen,
    run,
    finished,
    now,
    overlay,
    sheet,
    tried,
    settings,
    view: active ? 'run' : view,
    openSettings: () => {
      if (!active) setView('settings')
    },
    closeSettings: () => setView('setup'),
    setRule: (rule) => change(() => ({ rule })),
    addApp: (id) => change((prev) => ({ [listKey]: prev[listKey].includes(id) ? prev[listKey] : [...prev[listKey], id] })),
    removeApp: (id) => change((prev) => ({ [listKey]: prev[listKey].filter((item) => item !== id) })),
    addSite: (input) => {
      const host = siteHost(input)
      if (!host) return false
      change((prev) => ({ sites: prev.sites.includes(host) ? prev.sites : [...prev.sites, host] }))
      return true
    },
    removeSite: (host) => change((prev) => ({ sites: prev.sites.filter((site) => site !== host) })),
    setGrace: (grace) => change(() => ({ grace })),
    setChime: (chime) => change(() => ({ chime })),
    setPopUp: (popUp) => change(() => ({ popUp })),
    requestReset: () => setSheet('reset'),
    resetSettings: () => {
      change(() => DEFAULT_SETTINGS)
      setSheet(null)
    },
    active,
    total,
    elapsed,
    remaining,
    progress,
    blocks,
    recent,
    endsAt,
    setDial: (value) => {
      setText(String(value))
      mark('dial')
    },
    type: (value) => {
      setText(value.replace(/\D/g, '').slice(0, 3))
      mark('type')
    },
    preset: (value) => {
      setText(String(value))
      mark('preset')
    },
    setStrict: chooseStrict,
    setFullScreen,
    requestStart: () => {
      if (minutes === null) return
      if (strict) setSheet('strict')
      else begin()
    },
    begin,
    requestGiveUp: () => {
      if (run && !run.strict) setSheet('giveUp')
    },
    giveUp: end,
    reset: end,
    closeSheet,
    openOverlay,
    closeOverlay,
  }
}

function LockGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 7.2V5.1a3 3 0 0 1 6 0v2.1" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <rect x="3" y="7" width="10" height="7.6" rx="2.1" fill="currentColor" />
    </svg>
  )
}

function AppleLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  )
}

function DownloadBadge() {
  return (
    <a href={FOCUS_DOWNLOAD} download className="fl-get">
      <AppleLogo className="fl-get-apple" />
      <span className="fl-get-text">
        <span className="fl-get-kicker">Download for</span>
        <span className="fl-get-title">macOS</span>
      </span>
    </a>
  )
}

function DownloadMeta() {
  return (
    <p className="fl-download-meta">
      Version {FOCUS_VERSION} · {FOCUS_SIZE} · macOS {FOCUS_MIN_MACOS} or later · Apple silicon and Intel
    </p>
  )
}

const FACE_STEPS = [
  ['scan', 0],
  ['match', 1650],
  ['open', 2350],
]

function FaceLock({ locked }) {
  const [phase, setPhase] = useState('locked')
  const [runs, setRuns] = useState(0)
  const [nope, setNope] = useState(false)

  useEffect(() => {
    if (locked) {
      setPhase('locked')
      return undefined
    }
    if (still()) {
      setPhase('open')
      return undefined
    }
    const delay = runs ? 0 : 250
    const timers = FACE_STEPS.map(([next, at]) => window.setTimeout(() => setPhase(next), delay + at))
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [locked, runs])

  useEffect(() => {
    if (!nope) return undefined
    const id = window.setTimeout(() => setNope(false), 520)
    return () => window.clearTimeout(id)
  }, [nope])

  const poke = () => {
    if (locked) setNope(true)
    else if (phase === 'open') setRuns((n) => n + 1)
  }

  const wide = phase === 'scan' || phase === 'match'

  return (
    <span className="fl-faceid" data-phase={phase} data-wide={wide || undefined} data-nope={nope || undefined} onPointerEnter={poke} aria-hidden="true">
      <svg className="fl-facelock" viewBox="0 0 24 24">
        <path className="fl-facelock-shackle" fill="currentColor" d="M6 11V5h1V3h1V2h2V1h4v1h2v1h1v2h1v6h-3V5h-1V4h-4v1H9v6z" />
        <path fill="currentColor" d="M3 11h12V8h3v3h3v1h1v10h-1v1H3v-1H2V12h1z" />
      </svg>
      <svg className="fl-faceid-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path className="fl-faceid-frame" d="M3 8.5V6a3 3 0 0 1 3-3h2.5M15.5 3H18a3 3 0 0 1 3 3v2.5M21 15.5V18a3 3 0 0 1-3 3h-2.5M8.5 21H6a3 3 0 0 1-3-3v-2.5" />
        <path className="fl-faceid-face" d="M8.5 8.5V10M15.5 8.5V10M12 8.5v4.2a.8.8 0 0 1-.8.8h-.5M8.7 16.2a5 5 0 0 0 6.6 0" />
        <path className="fl-faceid-check" pathLength="1" d="M7.6 12.3l3 3 5.8-6" />
      </svg>
    </span>
  )
}

function AppIconImg({ app, size }) {
  return (
    <img
      {...imageProps(app.icon)}
      alt={app.name}
      title={app.name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  )
}

function AppGlyph({ app, size, decorative = false }) {
  if (app.icon) {
    if (!decorative) return <AppIconImg app={app} size={size} />
    return <img {...imageProps(app.icon)} alt="" width={size} height={size} loading="lazy" decoding="async" draggable={false} />
  }
  const label = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': app.name, title: app.name }
  return (
    <span className="fl-glyph" style={{ width: size, height: size, fontSize: size * 0.5 }} {...label}>
      {app.name[0]}
    </span>
  )
}

function rulesLine(settings) {
  const names = ruleList(settings).map((id) => appById(id).short)
  if (settings.rule === 'allow') return names.length ? `Only ${listSentence(names)} can open.` : 'Every app stays closed.'
  return names.length ? `${listSentence(names)} can’t open.` : 'Blocked sites stay closed.'
}

function Band({ tall = false }) {
  return (
    <div className={`fl-band${tall ? ' fl-band-tall' : ''}`}>
      <div className="fl-rule" />
      <div className="fl-rule" />
    </div>
  )
}

function Ring({ size, radius, fraction, children, glowing = true }) {
  const c = 2 * Math.PI * radius
  const mid = size / 2
  return (
    <svg className="fl-ring" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={mid} cy={mid} r={radius} className="fl-ring-track" />
      <circle cx={mid} cy={mid} r={radius + 4} className="fl-ring-edge" />
      <circle cx={mid} cy={mid} r={radius - 4} className="fl-ring-edge" />
      {children}
      <circle
        cx={mid}
        cy={mid}
        r={radius}
        className={`fl-ring-arc${glowing ? '' : ' fl-ring-arc-flat'}`}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - fraction)}
        transform={`rotate(-90 ${mid} ${mid})`}
        opacity={fraction > 0.001 ? 1 : 0}
      />
    </svg>
  )
}

const DIAL_SIZE = 196
const DIAL_R = DIAL_SIZE / 2 - 12

function Dial({ demo, live }) {
  const ref = useRef(null)
  const minutes = demo.minutes ?? 0
  const fraction = Math.min(minutes, DIAL_MAX) / DIAL_MAX
  const mid = DIAL_SIZE / 2

  const dragTo = (event) => {
    const box = ref.current.getBoundingClientRect()
    const x = event.clientX - (box.left + box.width / 2)
    const y = box.top + box.height / 2 - event.clientY
    let degrees = (Math.atan2(x, y) * 180) / Math.PI
    if (degrees < 0) degrees += 360
    const next = dialMinutes(degrees, minutes)
    if (next !== demo.minutes) demo.setDial(next)
  }

  const ends =
    demo.minutes === null ? `${MIN_MINUTES} to ${MAX_MINUTES}` : demo.endsAt ? `ends ${timeOf(demo.endsAt)}` : `${demo.minutes} min from now`

  return (
    <div className="fl-dial" ref={ref}>
      <Ring size={DIAL_SIZE} radius={DIAL_R} fraction={fraction}>
        {Array.from({ length: 12 }, (_, i) => {
          const long = i % 4 === 0
          const len = long ? 7 : 4
          return (
            <line
              key={i}
              x1={mid}
              x2={mid}
              y1={mid - 72 - len / 2}
              y2={mid - 72 + len / 2}
              className={long ? 'fl-tick fl-tick-long' : 'fl-tick'}
              transform={`rotate(${i * 30} ${mid} ${mid})`}
            />
          )
        })}
      </Ring>
      <svg className="fl-dial-knob" viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`} style={{ rotate: `${360 * fraction}deg` }} aria-hidden="true">
        <circle cx={mid} cy={mid - DIAL_R} r="9" className="fl-knob" />
        <circle cx={mid} cy={mid - DIAL_R} r="3" className="fl-knob-dot" />
      </svg>
      {live && (
        <>
          <svg className="fl-dial-hit" viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`} aria-hidden="true">
            <circle
              cx={mid}
              cy={mid}
              r={DIAL_R}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                dragTo(event)
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) dragTo(event)
              }}
            />
          </svg>
          <input
            type="range"
            className="fl-dial-range"
            min={DIAL_STEP}
            max={DIAL_MAX}
            step={DIAL_STEP}
            value={Math.min(Math.max(minutes, DIAL_STEP), DIAL_MAX)}
            onChange={(event) => demo.setDial(Number(event.target.value))}
            aria-label="Minutes on the dial"
          />
        </>
      )}
      <div className="fl-dial-center">
        {live ? (
          <input
            className="fl-dial-input"
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            value={demo.text}
            placeholder="0"
            onChange={(event) => demo.type(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') demo.requestStart()
            }}
            aria-label="Minutes"
          />
        ) : (
          <span className="fl-dial-input">{demo.text || '0'}</span>
        )}
        <span className="fl-watom">minutes</span>
        <span className="fl-dial-ends">{ends}</span>
      </div>
    </div>
  )
}

function Toggle({ on, tone, onChange, label, live }) {
  if (!live) return <span className="fl-toggle" data-on={on || undefined} data-tone={tone} />
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="fl-toggle" data-on={on || undefined} data-tone={tone} onClick={() => onChange(!on)} />
  )
}

function CallButton({ demo, live }) {
  const tone = demo.strict ? 'critical' : 'live'
  const label = demo.strict ? 'Start strict focus' : 'Start focus'
  const inner = (
    <>
      <span className="fl-call-knob">
        <LockGlyph className="fl-call-lock" />
      </span>
      <span className="fl-call-label">{label}</span>
      <span className="fl-call-arrow" aria-hidden="true">
        →
      </span>
    </>
  )
  if (!live) return <span className="fl-call" data-tone={tone}>{inner}</span>
  return (
    <button type="button" className="fl-call" data-tone={tone} disabled={demo.minutes === null} onClick={demo.requestStart}>
      {inner}
    </button>
  )
}

function SetupPane({ demo, live }) {
  const { settings } = demo
  const allow = settings.rule === 'allow'
  const apps = ruleList(settings).map(appById)
  const names = wouldClose(settings)
  const closes = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
  const sites = settings.sites
  const shownSites = sites.slice(0, sites.length > 2 ? 1 : 2)
  return (
    <>
      <div className="fl-app-sec">
        <FrameLabel>Timer</FrameLabel>
        <p className="fl-app-title">Focus</p>
        {demo.finished ? (
          <p className="fl-app-note" data-tone="info">
            Done. {demo.finished.minutes} min of focus{demo.finished.blocked ? `, ${demo.finished.blocked} blocked` : ''}.
          </p>
        ) : (
          <p className="fl-app-note">
            {allow ? 'Pick a time. Only what you need stays open.' : 'Pick a time. What distracts you stays closed.'}
          </p>
        )}
        <Dial demo={demo} live={live} />
        <div className="fl-chips">
          {PRESETS.map((preset) =>
            live ? (
              <button key={preset} type="button" className="fl-chip" aria-pressed={demo.minutes === preset} onClick={() => demo.preset(preset)}>
                {preset}
              </button>
            ) : (
              <span key={preset} className="fl-chip" aria-pressed={demo.minutes === preset}>
                {preset}
              </span>
            ),
          )}
        </div>
      </div>
      <Band />
      <div className="fl-app-sec fl-rules">
        <div className="fl-rules-head">
          <FrameLabel>Rules</FrameLabel>
          {live ? (
            <button type="button" className="fl-text-btn" onClick={demo.openSettings} aria-label="Edit rules in Settings">
              Edit
            </button>
          ) : (
            <span className="fl-text-btn">Edit</span>
          )}
        </div>
        <div className="fl-fact">
          <span className="fl-fact-label">{allow ? 'Stays open' : 'Closes'}</span>
          {apps.length ? (
            <span className="fl-fact-icons">
              {apps.slice(0, 9).map((app) => (
                <AppGlyph key={app.id} app={app} size={20} />
              ))}
              {apps.length > 9 && <span className="fl-fact-more">+{apps.length - 9}</span>}
            </span>
          ) : (
            <span className="fl-fact-more">{allow ? 'Every app closes' : 'No apps'}</span>
          )}
        </div>
        <div className="fl-fact">
          <span className="fl-fact-label">Blocked</span>
          <span className="fl-fact-sites">
            {sites.length === 0 && <span className="fl-fact-more">No sites</span>}
            {shownSites.map((site) => (
              <span key={site}>
                <i className="fl-dot" data-tone="high" />
                {site}
              </span>
            ))}
            {sites.length > shownSites.length && <span className="fl-fact-more">+{sites.length - shownSites.length} more</span>}
          </span>
        </div>
        <div className="fl-fact">
          <span className="fl-fact-label">Full screen</span>
          <Toggle on={demo.fullScreen} tone="live" live={live} label="Full-screen timer" onChange={demo.setFullScreen} />
          <span className="fl-fact-hint">Timer over everything</span>
        </div>
        <div className="fl-fact">
          <span className="fl-fact-label">Strict</span>
          <Toggle on={demo.strict} tone="critical" live={live} label="Strict mode" onChange={demo.setStrict} />
          <span className="fl-fact-hint" data-tone={demo.strict ? 'critical' : undefined}>
            No giving up until it ends
          </span>
        </div>
      </div>
      <div className="fl-rule" />
      <div className="fl-app-start">
        <p className="fl-will-close">
          {names.length ? (
            <>
              <i className="fl-dot" data-tone="critical" />
              <span>Closes {closes}</span>
              {settings.grace > 0 && <span className="fl-faint">· {settings.grace}s to save</span>}
            </>
          ) : (
            <span className="fl-will-none">{allow ? 'Nothing else is open.' : 'Nothing on the block list is open.'}</span>
          )}
        </p>
        <CallButton demo={demo} live={live} />
      </div>
    </>
  )
}

function RemoveButton({ label, onClick }) {
  return (
    <button type="button" className="fl-x" onClick={onClick} aria-label={`Remove ${label}`} title="Remove">
      <Icon name="x" className="h-3 w-3" strokeWidth={2.4} />
    </button>
  )
}

function AddAppMenu({ demo, list }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return undefined
    const away = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    root.current?.querySelector('[role=menu]')?.scrollIntoView({ block: 'nearest', behavior: still() ? 'auto' : 'smooth' })
    root.current?.querySelector('[role=menuitem]')?.focus({ preventScroll: true })
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const openNow = OPEN_NOW.filter((id) => !list.includes(id))
  const others = DEMO_APPS.map((app) => app.id).filter((id) => !list.includes(id) && !OPEN_NOW.includes(id))

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  const onKeyDown = (event) => {
    if (!open) return
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const items = [...root.current.querySelectorAll('[role=menuitem]')]
      const at = items.indexOf(document.activeElement)
      const next = event.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length
      items[next]?.focus()
    }
  }

  const group = (label, ids) =>
    ids.length > 0 && (
      <div role="group" aria-label={label}>
        <p className="fl-menu-head" aria-hidden="true">
          {label}
        </p>
        {ids.map((id) => {
          const app = appById(id)
          return (
            <button
              key={id}
              type="button"
              role="menuitem"
              className="fl-menu-item"
              onClick={() => {
                demo.addApp(id)
                close()
              }}
            >
              <AppGlyph app={app} size={16} decorative />
              {app.name}
            </button>
          )
        })}
      </div>
    )

  return (
    <div className="fl-add" ref={root} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        className="fl-pill"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        + Add app
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Add an app" className="fl-menu">
          {group('Open now', openNow)}
          {group('Applications', others)}
          {!openNow.length && !others.length && <p className="fl-menu-head">Everything’s on the list already.</p>}
        </div>
      )}
    </div>
  )
}

function SettingsPane({ demo }) {
  const { settings } = demo
  const allow = settings.rule === 'allow'
  const list = ruleList(settings)
  const [site, setSite] = useState('')
  const [invalid, setInvalid] = useState(false)
  const hint = useId()

  const submitSite = (event) => {
    event.preventDefault()
    if (!site.trim()) return
    if (demo.addSite(site)) setSite('')
    else setInvalid(true)
  }

  return (
    <>
      <div className="fl-app-sec">
        <FrameLabel>Settings</FrameLabel>
        <p className="fl-app-title">Settings</p>
        <p className="fl-app-note">Pick what gets blocked. None of it can change while a session runs.</p>
      </div>
      <Band />
      <div className="fl-app-sec">
        <FrameLabel>Apps</FrameLabel>
        <div className="fl-seg" role="group" aria-label="How the app list works">
          {[
            ['allow', 'Allow list'],
            ['block', 'Block list'],
          ].map(([rule, label]) => (
            <button key={rule} type="button" className="fl-chip" aria-pressed={settings.rule === rule} onClick={() => demo.setRule(rule)}>
              {label}
            </button>
          ))}
        </div>
        <p className="fl-set-hint">{allow ? 'Only these stay open. Every other app closes.' : 'Only these close. Every other app stays open.'}</p>
        <div className="fl-blocks">
          {list.length === 0 ? (
            <div className="fl-block-row">
              <i className="fl-dot" data-tone={allow ? 'critical' : 'info'} />
              <span className="fl-muted">{allow ? 'Nothing stays open but Finder.' : 'No apps yet. Add what distracts you.'}</span>
            </div>
          ) : (
            list.map((id) => {
              const app = appById(id)
              return (
                <div key={id} className="fl-block-row">
                  <AppGlyph app={app} size={20} decorative />
                  <span className="fl-block-name">{app.name}</span>
                  <RemoveButton label={app.name} onClick={() => demo.removeApp(id)} />
                </div>
              )
            })
          )}
        </div>
        <AddAppMenu demo={demo} list={list} />
      </div>
      <div className="fl-rule" />
      <div className="fl-app-sec">
        <FrameLabel>Sites</FrameLabel>
        <div className="fl-blocks fl-blocks-top">
          {settings.sites.length === 0 ? (
            <div className="fl-block-row">
              <i className="fl-dot" data-tone="info" />
              <span className="fl-muted">No sites blocked.</span>
            </div>
          ) : (
            settings.sites.map((host) => (
              <div key={host} className="fl-block-row">
                <i className="fl-dot" data-tone="high" />
                <span className="fl-block-name">{host}</span>
                <RemoveButton label={host} onClick={() => demo.removeSite(host)} />
              </div>
            ))
          )}
        </div>
        <form className="fl-site-form" onSubmit={submitSite}>
          <input
            className="fl-site-input"
            value={site}
            placeholder="youtube.com"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-label="Site to block"
            aria-invalid={invalid || undefined}
            aria-describedby={hint}
            onChange={(event) => {
              setSite(event.target.value)
              setInvalid(false)
            }}
          />
          <button type="submit" className="fl-pill">
            Add
          </button>
        </form>
        <p id={hint} className="fl-set-hint" data-tone={invalid ? 'critical' : undefined}>
          {invalid ? 'That doesn’t look like a site. Try something like youtube.com.' : 'Blocked in Google Chrome, subdomains included.'}
        </p>
      </div>
      <Band />
      <div className="fl-app-sec fl-rules">
        <FrameLabel>Session</FrameLabel>
        <div className="fl-fact">
          <span className="fl-fact-label">Save time</span>
          <span className="fl-chips fl-chips-row" role="group" aria-label="Save time">
            {GRACE_CHOICES.map((seconds) => (
              <button key={seconds} type="button" className="fl-chip" aria-pressed={settings.grace === seconds} onClick={() => demo.setGrace(seconds)}>
                {seconds === 60 ? '1m' : `${seconds}s`}
              </button>
            ))}
          </span>
        </div>
        <div className="fl-fact">
          <span className="fl-fact-label">Chime</span>
          <Toggle on={settings.chime} tone="live" live label="Chime" onChange={demo.setChime} />
          <span className="fl-fact-hint">Play a sound when time’s up</span>
        </div>
        <div className="fl-fact">
          <span className="fl-fact-label">Pop up</span>
          <Toggle on={settings.popUp} tone="live" live label="Pop up on each block" onChange={demo.setPopUp} />
          <span className="fl-fact-hint">Show the window on each block</span>
        </div>
      </div>
      <div className="fl-rule" />
      <div className="fl-app-foot">
        <button type="button" className="fl-text-btn" onClick={demo.requestReset}>
          Reset to defaults
        </button>
        <span className="fl-set-saved">Saved as you go</span>
      </div>
    </>
  )
}

function BlockList({ blocks }) {
  const shown = 3
  if (!blocks.length) {
    return (
      <div className="fl-blocks">
        <div className="fl-block-row">
          <i className="fl-dot" data-tone="info" />
          <span className="fl-muted">Nothing blocked yet. Keep it that way.</span>
        </div>
      </div>
    )
  }
  const recent = blocks.slice(-shown).reverse()
  return (
    <div className="fl-blocks">
      {recent.map((block) => (
        <div key={`${block.at}-${block.name}`} className="fl-block-row fl-block-in">
          <i className="fl-dot" data-tone={block.kind === 'app' ? 'critical' : 'high'} />
          <span className="fl-block-name">{block.name}</span>
          <span className="fl-block-kind">{block.kind === 'app' ? 'App' : 'Site'}</span>
          <span className="fl-block-time">{timeOf(block.time)}</span>
        </div>
      ))}
      {blocks.length > shown && (
        <div className="fl-block-row">
          <span className="fl-block-more">+ {blocks.length - shown} earlier</span>
        </div>
      )}
    </div>
  )
}

function RunningPane({ demo, live }) {
  const { run } = demo
  const time = clock(demo.remaining)
  return (
    <>
      <div className="fl-app-sec">
        <FrameLabel>Session</FrameLabel>
        <div className="fl-session-head">
          <div>
            <p className="fl-app-title fl-app-title-sm">Locked in</p>
            {demo.recent ? (
              <p className="fl-app-sub fl-block-in" key={`${demo.recent.at}`}>
                <i className="fl-dot" data-tone={demo.recent.kind === 'app' ? 'critical' : 'high'} />
                <span className="fl-strong">{demo.recent.name} is blocked</span>
              </p>
            ) : (
              <p className="fl-app-sub">
                {Math.round(demo.total / 60)} min · until {timeOf(run.end)}
              </p>
            )}
          </div>
          <div className="fl-count-box">
            <span data-hot={demo.blocks.length > 0 || undefined}>{demo.blocks.length}</span>
            Blocked
          </div>
        </div>
        <div className="fl-countdown">
          <Ring size={172} radius={81} fraction={1 - demo.progress} />
          <div className="fl-countdown-center">
            <span className="fl-countdown-time" data-long={time.length > 5 || undefined}>
              {time}
            </span>
            <span className="fl-watom">remaining</span>
          </div>
        </div>
      </div>
      <Band />
      <div className="fl-app-sec fl-report">
        <FrameLabel>Report</FrameLabel>
        <SessionBar progress={demo.progress} />
        <div className="fl-report-facts">
          {[
            ['Started', timeOf(run.start)],
            ['Ends', timeOf(run.end)],
            ['Focused', `${Math.floor(demo.elapsed / 60)} min`],
            ['Left', `${Math.ceil(demo.remaining / 60)} min`],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              {value}
            </div>
          ))}
        </div>
        <p className="fl-report-label">Blocked</p>
        <BlockList blocks={demo.blocks} />
      </div>
      <div className="fl-rule" />
      <div className="fl-app-foot">
        {run.strict ? (
          <p className="fl-strict-line">
            <LockGlyph className="fl-strict-lock" />
            <span className="fl-muted fl-medium">Strict mode.</span>
            <span className="fl-subtle">No giving up until {timeOf(run.end)}.</span>
          </p>
        ) : live ? (
          <button type="button" className="fl-text-btn" onClick={demo.requestGiveUp}>
            Give up
          </button>
        ) : (
          <span className="fl-text-btn">Give up</span>
        )}
        {live ? (
          <button type="button" className="fl-icon-btn" onClick={demo.openOverlay} aria-label="Full-screen timer" title="Full-screen timer">
            <Icon name="maximize" className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        ) : (
          <span className="fl-icon-btn">
            <Icon name="maximize" className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
        )}
      </div>
    </>
  )
}

function SessionBar({ progress }) {
  return (
    <div className="fl-bar">
      <span style={{ width: `max(6px, calc((100% - 3px) * ${progress.toFixed(4)}))` }} />
      <span />
    </div>
  )
}

function Sheet({ demo }) {
  const title = useId()
  const body = useId()
  const primary = useRef(null)
  const until = demo.minutes !== null && demo.endsAt ? timeOf(demo.endsAt) : 'it ends'
  const content = {
    strict: {
      heading: 'Start a strict session?',
      text: `There’s no giving up until ${until}. If you restart your Mac, Focus Lock opens again by itself.`,
      action: 'Lock me in',
      tone: 'live',
      run: demo.begin,
      cancel: 'Cancel',
    },
    giveUp: {
      heading: 'End this session early?',
      text: `${clock(demo.remaining)} left.`,
      action: 'Give up',
      tone: 'critical',
      run: demo.giveUp,
      cancel: 'Keep going',
    },
    reset: {
      heading: 'Reset all settings?',
      text: 'The app list, blocked sites and session options go back to how they started.',
      action: 'Reset',
      tone: 'critical',
      run: demo.resetSettings,
      cancel: 'Cancel',
    },
  }[demo.sheet]

  useEffect(() => {
    primary.current?.focus()
  }, [demo.sheet])

  return (
    <div className="fl-sheet-scrim" onPointerDown={(event) => event.target === event.currentTarget && demo.closeSheet()}>
      <div
        className="fl-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={title}
        aria-describedby={body}
        onKeyDown={(event) => {
          if (event.key === 'Escape') demo.closeSheet()
        }}
      >
        <img {...imageProps(APP_ICON)} alt="" width="52" height="52" className="fl-sheet-icon" />
        <p id={title} className="fl-sheet-title">
          {content.heading}
        </p>
        <p id={body} className="fl-sheet-text">
          {content.text}
        </p>
        <div className="fl-sheet-actions">
          <button ref={primary} type="button" className="fl-sheet-btn" data-tone={content.tone} onClick={content.run}>
            {content.action}
          </button>
          <button type="button" className="fl-sheet-btn" onClick={demo.closeSheet}>
            {content.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}

function WindowAction({ demo, live, settingsOpen }) {
  const gear = useRef(null)
  const done = useRef(null)
  const was = useRef(settingsOpen)

  useEffect(() => {
    if (!live || was.current === settingsOpen) return
    was.current = settingsOpen
    ;(settingsOpen ? done : gear).current?.focus({ preventScroll: true })
  }, [live, settingsOpen])

  if (demo.active) {
    return (
      <span className="fl-status" data-strict={demo.run.strict || undefined}>
        <i />
        {demo.run.strict ? 'Strict' : 'Focusing'}
      </span>
    )
  }
  if (!live) {
    return (
      <span className="fl-icon-btn fl-bar-end">
        <Icon name="settings" className="h-4 w-4" />
      </span>
    )
  }
  if (settingsOpen) {
    return (
      <button ref={done} type="button" className="fl-pill fl-bar-end" onClick={demo.closeSettings}>
        Done
      </button>
    )
  }
  return (
    <button ref={gear} type="button" className="fl-icon-btn fl-bar-end" onClick={demo.openSettings} aria-label="Settings" title="Settings">
      <Icon name="settings" className="h-4 w-4" />
    </button>
  )
}

function AppWindow({ demo, variant }) {
  const live = variant === 'live'
  const running = demo.active
  const settingsOpen = live && demo.view === 'settings'
  const pop = live && running && demo.settings.popUp && demo.recent?.kind === 'app' ? demo.recent : null
  const shell = live ? { role: 'group', 'aria-label': 'Focus Lock window, working demo' } : { 'aria-hidden': true, inert: true }
  return (
    <div className="fl-app" data-variant={variant} data-pane={settingsOpen ? 'settings' : undefined} {...shell}>
      <div className="fl-app-bar">
        <span className="fl-lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <img {...imageProps('/wordmark-nav.png')} alt="blxr" width="53" height="24" className="fl-app-logo" draggable={false} />
        <span className="fl-faint">/</span>
        <span className="fl-muted">Focus lock</span>
        <WindowAction demo={demo} live={live} settingsOpen={settingsOpen} />
      </div>
      <div className="fl-rule" />
      {settingsOpen ? (
        <div
          className="fl-app-scroll"
          key="settings"
          onKeyDown={(event) => {
            if (event.key === 'Escape') demo.closeSettings()
          }}
        >
          <div className="fl-app-body">
            <SettingsPane demo={demo} />
          </div>
        </div>
      ) : (
        <div className="fl-app-body" key={running ? 'run' : 'setup'}>
          {running ? <RunningPane demo={demo} live={live} /> : <SetupPane demo={demo} live={live} />}
        </div>
      )}
      {pop && <span key={`pop-${pop.at}`} className="fl-pop" aria-hidden="true" />}
      {live && demo.sheet && <Sheet demo={demo} />}
    </div>
  )
}

function FullScreenTimer({ demo }) {
  const close = useRef(null)
  const { closeOverlay } = demo

  useEffect(() => {
    const previous = document.activeElement
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = 'hidden'
    close.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') closeOverlay()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      root.style.overflow = overflow
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true })
    }
  }, [closeOverlay])

  const run = demo.run
  return (
    <div className="fl-fs" role="dialog" aria-modal="true" aria-label="Full-screen timer">
      <div className="fl-fs-col">
        <div className="fl-fs-bar">
          <img {...imageProps('/wordmark-nav.png')} alt="blxr" width="62" height="28" className="fl-app-logo" draggable={false} />
          <span className="fl-faint">/</span>
          <span className="fl-muted">Focus lock</span>
          <button ref={close} type="button" className="fl-fs-close" onClick={closeOverlay}>
            {demo.active ? 'Back to work' : 'Close'}
            <kbd>esc</kbd>
          </button>
        </div>
        <div className="fl-rule" />
        <div className="fl-fs-main">
          {demo.active ? (
            <>
              <FrameLabel>{run.strict ? 'Strict focus' : 'Focus'}</FrameLabel>
              <p className="fl-fs-clock">{clock(demo.remaining)}</p>
              <SessionBar progress={demo.progress} />
              <p className="fl-fs-line">
                {demo.recent ? (
                  <>
                    <i className="fl-dot" data-tone={demo.recent.kind === 'app' ? 'critical' : 'high'} />
                    <span className="fl-strong">{demo.recent.name} is blocked</span>
                  </>
                ) : (
                  <>
                    <span className="fl-muted">until {timeOf(run.end)}</span>
                    {run.strict && (
                      <>
                        <span className="fl-faint">·</span>
                        <span data-tone="critical">no giving up</span>
                      </>
                    )}
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <FrameLabel>Done</FrameLabel>
              <p className="fl-fs-done">Session complete</p>
              {demo.finished && (
                <p className="fl-fs-line fl-muted">
                  {demo.finished.minutes} minutes of focus, {demo.finished.blocked} blocked. Nice work.
                </p>
              )}
            </>
          )}
        </div>
        <Band tall />
        <p className="fl-fs-foot">
          <LockGlyph className="fl-fs-lock" />
          {rulesLine(demo.settings)}
        </p>
      </div>
    </div>
  )
}

function Hero({ demo, theme, onToggleTheme }) {
  const host = useRef(null)
  return (
    <section className="fl-hero" id="top" aria-labelledby="fl-title">
      <div className="fl-hero-card" ref={host}>
        <div className="fl-sky" aria-hidden="true">
          <DitherSky hostRef={host} theme={theme} />
          <div className="fl-sky-grid" />
          <div className="fl-sky-shade" />
        </div>

        <div className="fl-hero-stage" aria-hidden="true">
          <div className="fl-hero-window">
            <AppWindow demo={demo} variant="hero" />
          </div>
        </div>

        <div className="fl-hero-copy">
          <h1 id="fl-title" className="fl-h1">
            <span>
              Pick a Time
              <Stop />
            </span>{' '}
            <span>
              The Rest Closes
              <Stop />
            </span>
          </h1>
          <p className="fl-lede">
            Focus Lock is a Mac app for studying. Press Start and every app that isn’t on your allow list is closed until the timer runs
            out. Open Discord mid-session and it’s gone again within a second.
          </p>
          <div className="fl-actions">
            <DownloadBadge />
          </div>
          <DownloadMeta />
          <p className="fl-download-note">
            It isn’t notarized by Apple yet, so the first time it’s blocked: open System Settings, then Privacy &amp; Security, and click
            Open Anyway.
          </p>
        </div>

        <HeroTrace hostRef={host} theme={theme} />

        <Notch className="fl-notch-logo">
          <a {...jump('top')} className="fl-notch-home" aria-label="Focus Lock, back to top">
            <FaceLock locked={demo.active} />
          </a>
        </Notch>

        <Notch className="fl-notch-nav">
          {NAV_SECTIONS.map(([id, label]) => (
            <a key={id} {...jump(id)} className="fl-nav-link fl-nav-section">
              {label}
            </a>
          ))}
          <a {...link(HOME_PATH)} className="fl-nav-link">
            <span className="fl-nav-wide">kostis.wtf</span>
            <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
          </a>
          <ThemeButton theme={theme} onToggle={onToggleTheme} />
        </Notch>

        <Notch side="bottom" className="fl-notch-apps">
          {ALLOWED_APPS.map((app) => (
            <AppIconImg key={app.id} app={app} size={26} />
          ))}
        </Notch>
      </div>
    </section>
  )
}

function CountSection({ demo }) {
  const minutes = demo.minutes ?? 45
  const ghost = clock(minutes * 60)
  const span = minutes === 1 ? '1 minute' : `${minutes} minutes`
  return (
    <section className="fl-section fl-wrap" aria-labelledby="fl-count-title">
      <div className="fl-count" data-reveal>
        <p className="fl-count-ghost" aria-hidden="true">
          {ghost}
        </p>
        <h2 id="fl-count-title" className="fl-count-title">
          Press Start, and for the next {span}{' '}
          <span>
            only the apps on your list can open<Stop /> Everything else is gone within a second<Stop />
          </span>
        </h2>
      </div>
      <SessionFlow demo={demo} />
    </section>
  )
}

function SessionFlow({ demo }) {
  const { grace, chime } = demo.settings
  const minutes = demo.minutes ?? 45
  const wait = grace === 60 ? 'a minute' : `${grace} seconds`
  const steps = [
    {
      time: clock(0),
      tone: 'live',
      title: 'Start',
      text: grace
        ? `Anything open that your rules don’t allow gets ${wait} to save.`
        : 'Anything open that your rules don’t allow closes straight away.',
    },
    {
      time: clock(grace),
      tone: 'critical',
      title: 'Locked',
      text: 'Those apps are forced closed, and blocked Chrome tabs go to the blocked page.',
    },
    {
      time: 'Any time',
      tone: 'high',
      title: 'Holding',
      text: 'Open something that isn’t allowed and it’s closed within a second. Each block is logged.',
    },
    {
      time: clock(minutes * 60),
      tone: 'info',
      title: 'Time’s up',
      text: `${chime ? 'A chime plays and the lock lifts.' : 'The lock lifts.'} Your apps and sites are yours again.`,
    },
  ]
  return (
    <div className="fl-flow" data-reveal>
      <FrameLabel>How a session runs</FrameLabel>
      <ol>
        {steps.map((step) => (
          <li key={step.title}>
            <i className="fl-dot" data-tone={step.tone} />
            <span className="fl-flow-time">{step.time}</span>
            <h3 className="fl-flow-title">{step.title}</h3>
            <p className="fl-flow-text">{step.text}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function SectionHead({ id, label, title, rest, lede }) {
  return (
    <div className="fl-head" data-reveal>
      <FrameLabel>{label}</FrameLabel>
      <h2 id={id} className="fl-h2">
        <span>
          {title}
          <Stop />
        </span>{' '}
        <span>
          {rest}
          <Stop />
        </span>
      </h2>
      {lede && <p className="fl-head-lede">{lede}</p>}
    </div>
  )
}

const TRIES = [
  ['dial', 'Drag the dial'],
  ['preset', 'Tap a preset'],
  ['type', 'Click the number and type one'],
  ['settings', 'Change something in Settings'],
  ['strict', 'Turn on Strict'],
  ['start', 'Press Start'],
  ['reload', 'Reload the page mid-session'],
]

function TrySection({ demo }) {
  const done = TRIES.filter(([key]) => demo.tried.has(key)).length
  const all = done === TRIES.length
  return (
    <section id="try" className="fl-section fl-wrap" aria-labelledby="fl-try-title">
      <div className="fl-try">
        <div>
          <SectionHead
            id="fl-try-title"
            label="Demo"
            title="Try it here"
            rest="It’s the real window"
            lede="This is the Focus Lock window, rebuilt for the browser. It won’t close anything on your Mac and the blocks are pretend, but the timer is real and survives a reload, the way the app survives a restart."
          />
          <div className="fl-tries" data-reveal>
            <p className="fl-tries-head">
              <span>Things to try</span>
              <span className="fl-tries-count" data-done={all || undefined}>
                {all ? 'All done, nice' : `${done} of ${TRIES.length}`}
              </span>
            </p>
            <span className="fl-tries-meter" style={{ '--p': done / TRIES.length }} aria-hidden="true" />
            <ul>
              {TRIES.map(([key, label]) => {
                const hit = demo.tried.has(key)
                return (
                  <li key={key} data-done={hit || undefined}>
                    <span className="fl-tries-box" aria-hidden="true">
                      <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {label}
                    {hit && <span className="sr-only">, done</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
        <div className="fl-try-stage" data-reveal>
          <AppWindow demo={demo} variant="live" />
        </div>
      </div>
    </section>
  )
}

function Cell({ as: Tag = 'article', label, title, visual, children }) {
  return (
    <Tag className="fl-cell">
      <div className="fl-cell-visual fl-mini">{visual}</div>
      <FrameLabel>{label}</FrameLabel>
      <h3 className="fl-h3">{title}</h3>
      <p className="fl-cell-text">{children}</p>
    </Tag>
  )
}

function RulesSection() {
  return (
    <section id="rules" className="fl-section fl-wrap" aria-labelledby="fl-rules-title">
      <SectionHead
        id="fl-rules-title"
        label="Rules"
        title="Your list stays open"
        rest="Everything else waits"
        lede="Pick a time and these rules hold until it runs out. You set them in Settings beforehand, and nothing can loosen them once the timer starts."
      />
      <div className="fl-grid fl-cells" data-reveal>
        <Cell
          label="Allow list"
          title="Only what you study with"
          visual={
            <div className="fl-dock" aria-hidden="true">
              {ALLOWED_APPS.map((app) => (
                <AppIconImg key={app.id} app={app} size={30} />
              ))}
            </div>
          }
        >
          Out of the box that’s {ALLOWED_APPS.map((app) => app.short).join(', ')}, iTerm and Notion Calendar. Finder always stays, and
          menu bar apps and background helpers are left alone.
        </Cell>
        <Cell
          label="Apps"
          title="Closed within a second"
          visual={
            <div className="fl-gone" aria-hidden="true">
              <span className="fl-gone-icon">
                <img {...imageProps(DISCORD_ICON)} alt="" width="48" height="48" draggable={false} />
                <i>
                  <Icon name="x" className="h-3 w-3" strokeWidth={3} />
                </i>
              </span>
              <span className="fl-app-sub">
                <i className="fl-dot" data-tone="critical" />
                <span className="fl-strong">Discord is blocked</span>
              </span>
            </div>
          }
        >
          Open something your rules don’t allow and it’s closed again straight away, and the window comes forward to say so. It
          keeps a log of everything it stopped.
        </Cell>
        <Cell
          label="Sites"
          title="Any site, off in Chrome"
          visual={
            <div className="fl-browser" aria-hidden="true">
              <div className="fl-browser-bar">
                <span className="fl-browser-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="fl-browser-url">{BLOCKED_SITES[0]}</span>
              </div>
              <div className="fl-browser-body">
                <span className="fl-browser-title">
                  <i className="fl-dot" data-tone="critical" />
                  This site is blocked
                </span>
                <SessionBar progress={0.38} />
                <span className="fl-browser-meta">It opens again when the timer runs out.</span>
              </div>
            </div>
          }
        >
          Instagram and Discord to start, plus anything you add in Settings, subdomains included. Their tabs are sent to a
          blocked page with the time left.
        </Cell>
        <Cell
          label="Grace"
          title="Time to save first"
          visual={
            <div className="fl-grace" aria-hidden="true">
              <p className="fl-will-close">
                <i className="fl-dot" data-tone="critical" />
                <span>Closes Discord, Mail +2</span>
                <span className="fl-faint">· {SAVE_GRACE}s to save</span>
              </p>
              <span className="fl-grace-ticks" style={{ '--n': SAVE_GRACE }} />
            </div>
          }
        >
          Apps that were already open when you press Start get {SAVE_GRACE} seconds to save your work, then they’re forced
          closed. Make it 0, 5, 30 seconds or a minute in Settings.
        </Cell>
        <Cell
          label="Quit"
          title="Quitting doesn’t reset it"
          visual={
            <div className="fl-keys" aria-hidden="true">
              <span className="fl-keys-row">
                <kbd>⌘</kbd>
                <kbd>Q</kbd>
              </span>
              <span className="fl-keys-note">
                <i className="fl-dot" data-tone="critical" />
                Ignored during a session
              </span>
            </div>
          }
        >
          ⌘Q does nothing while the timer runs. Quit or restart anyway and the lock picks up again the next time Focus Lock
          opens.
        </Cell>
        <Cell
          label="Strict"
          title="No giving up"
          visual={
            <div className="fl-strict" aria-hidden="true">
              <div className="fl-fact">
                <span className="fl-fact-label">Strict</span>
                <Toggle on tone="critical" live={false} />
                <span className="fl-fact-hint" data-tone="critical">
                  No giving up
                </span>
              </div>
              <span className="fl-strict-giveup">Give up</span>
            </div>
          }
        >
          Strict mode removes Give up. Focus Lock reopens by itself at login until the timer ends, so restarting your Mac
          doesn’t get you out.
        </Cell>
      </div>
    </section>
  )
}

function SettingsSection({ demo }) {
  const openDemo = () => {
    demo.openSettings()
    scrollToId('try')
  }
  return (
    <section id="settings" className="fl-section fl-wrap" aria-labelledby="fl-settings-title">
      <SectionHead
        id="fl-settings-title"
        label="Settings"
        title="Your rules"
        rest="Set before you start"
        lede="Open Settings from the gear in the window, or press ⌘, between sessions. It saves as you go and locks while a session runs, so a running lock can’t be loosened."
      />
      <div className="fl-grid fl-cells fl-four" data-reveal>
        <Cell
          label="Apps"
          title="Allow list or block list"
          visual={
            <div className="fl-set-apps" aria-hidden="true">
              <div className="fl-seg">
                <span className="fl-chip" data-side="a">
                  Allow list
                </span>
                <span className="fl-chip" data-side="b">
                  Block list
                </span>
              </div>
              <div className="fl-set-swap">
                <div className="fl-blocks" data-side="a">
                  {[appById('chrome'), appById('notion')].map((app) => (
                    <div key={app.id} className="fl-block-row">
                      <AppGlyph app={app} size={18} decorative />
                      <span className="fl-block-name">{app.name}</span>
                    </div>
                  ))}
                </div>
                <div className="fl-blocks" data-side="b">
                  {[appById('discord'), appById('messages')].map((app) => (
                    <div key={app.id} className="fl-block-row">
                      <AppGlyph app={app} size={18} decorative />
                      <span className="fl-block-name">{app.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          }
        >
          Keep only the apps you list open, or flip it and close only the ones you list. Add what’s open right now or anything in
          Applications.
        </Cell>
        <Cell
          label="Sites"
          title="Block any site"
          visual={
            <div className="fl-set-sites" aria-hidden="true">
              <div className="fl-site-form">
                <span className="fl-site-input">
                  <span className="fl-typing">youtube.com</span>
                  <i className="fl-caret" />
                </span>
                <span className="fl-pill">Add</span>
              </div>
              <div className="fl-blocks">
                <div className="fl-block-row">
                  <i className="fl-dot" data-tone="high" />
                  <span className="fl-block-name">{BLOCKED_SITES[0]}</span>
                </div>
                <div className="fl-block-row fl-set-new">
                  <i className="fl-dot" data-tone="high" />
                  <span className="fl-block-name">youtube.com</span>
                </div>
              </div>
            </div>
          }
        >
          Type a site or paste a link. It’s blocked in Chrome along with its subdomains, so youtube.com covers m.youtube.com too.
        </Cell>
        <Cell
          label="Save time"
          title="Your grace period"
          visual={
            <div className="fl-set-grace" aria-hidden="true">
              <span className="fl-chips fl-chips-row">
                {GRACE_CHOICES.map((seconds) => (
                  <span key={seconds} className="fl-chip" aria-pressed={seconds === SAVE_GRACE}>
                    {seconds === 60 ? '1m' : `${seconds}s`}
                  </span>
                ))}
              </span>
              <p className="fl-will-close">
                <i className="fl-dot" data-tone="critical" />
                <span>Closes Mail, Xcode</span>
                <span className="fl-faint">· {SAVE_GRACE}s to save</span>
              </p>
            </div>
          }
        >
          Apps that were already open get 0, 5, 15 or 30 seconds, or a full minute, to save before they’re forced closed.
        </Cell>
        <Cell
          label="Session"
          title="Chime and pop up"
          visual={
            <div className="fl-blocks fl-set-toggles" aria-hidden="true">
              {[
                ['Chime', 'Play a sound when time’s up'],
                ['Pop up', 'Show the window on each block'],
              ].map(([name, hint]) => (
                <div key={name} className="fl-block-row">
                  <Toggle on tone="live" live={false} />
                  <span>
                    <span className="fl-block-name">{name}</span>
                    <small>{hint}</small>
                  </span>
                </div>
              ))}
            </div>
          }
        >
          A sound when time’s up, and the window comes forward whenever an app gets blocked. Both start on, and either turns off.
        </Cell>
      </div>
      <div className="fl-head-actions" data-reveal>
        <button type="button" className="fl-ghost-btn" onClick={openDemo} disabled={demo.active}>
          <Icon name="settings" className="h-4 w-4" />
          Open Settings in the demo
        </button>
        <span className="fl-head-note">
          {demo.active ? 'Settings are locked while the demo session runs.' : 'What you change there shapes the demo session.'}
        </span>
      </div>
    </section>
  )
}

function MacFolder() {
  return (
    <svg className="fl-folder" viewBox="0 0 48 40" aria-hidden="true">
      <path d="M3 6a4 4 0 0 1 4-4h10.5l4 4H41a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill="#2f7fd8" />
      <path d="M3 13a4 4 0 0 1 4-4h34a4 4 0 0 1 4 4v21a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill="#5aaaf5" />
    </svg>
  )
}

function InstallSection() {
  const file = FOCUS_DOWNLOAD.split('/').pop()
  return (
    <section id="install" className="fl-section fl-wrap" aria-labelledby="fl-install-title">
      <SectionHead
        id="fl-install-title"
        label="Install"
        title="Set up once"
        rest="Then it’s just Start"
        lede="Four steps, and the last two only happen the first time."
      />
      <ol className="fl-grid fl-cells fl-four" data-reveal>
        <Cell
          as="li"
          label="Step 1"
          title="Download the .dmg"
          visual={
            <a href={FOCUS_DOWNLOAD} download className="fl-file">
              <span className="fl-file-icon" aria-hidden="true">
                <Icon name="download" className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <span>
                <span className="fl-file-name">{file}</span>
                <span className="fl-file-meta">{FOCUS_SIZE} · Apple silicon and Intel</span>
              </span>
            </a>
          }
        >
          One file for every Mac on macOS {FOCUS_MIN_MACOS} or later.
        </Cell>
        <Cell
          as="li"
          label="Step 2"
          title="Drag it into Applications"
          visual={
            <div className="fl-drag" aria-hidden="true">
              <span className="fl-drag-item">
                <img {...imageProps(APP_ICON)} alt="" width="44" height="44" draggable={false} />
                <small>Focus Lock</small>
              </span>
              <span className="fl-drag-arrow">→</span>
              <span className="fl-drag-item">
                <MacFolder />
                <small>Applications</small>
              </span>
              <img {...imageProps(APP_ICON)} alt="" width="44" height="44" className="fl-drag-ghost" draggable={false} />
            </div>
          }
        >
          Open the .dmg and drop Focus Lock on the Applications folder next to it.
        </Cell>
        <Cell
          as="li"
          label="Step 3"
          title="Open Anyway, once"
          visual={
            <div className="fl-settings" aria-hidden="true">
              <p className="fl-settings-head">Privacy &amp; Security</p>
              <div className="fl-settings-row">
                <span>“Focus Lock” was blocked to protect your Mac.</span>
                <span className="fl-mac-btn fl-mac-ping">Open Anyway</span>
              </div>
            </div>
          }
        >
          It isn’t notarized yet, so macOS blocks the first launch. Open System Settings, then Privacy &amp; Security, and click
          Open Anyway.
        </Cell>
        <Cell
          as="li"
          label="Step 4"
          title="Allow Chrome, once"
          visual={
            <div className="fl-alert" aria-hidden="true">
              <img {...imageProps(APP_ICON)} alt="" width="30" height="30" draggable={false} />
              <p>“Focus Lock” wants access to control “Google Chrome”.</p>
              <span className="fl-alert-actions">
                <span className="fl-mac-btn">Don’t Allow</span>
                <span className="fl-mac-btn" data-tone="live">
                  Allow
                </span>
              </span>
            </div>
          }
        >
          Your first session asks to control Chrome, so it can send Instagram and Discord tabs away. Click Allow.
        </Cell>
      </ol>
    </section>
  )
}

const graceLabel = (seconds) => (seconds === 60 ? '1m' : `${seconds}s`)

const SPECS = [
  ['Version', FOCUS_VERSION, `${FOCUS_SIZE} download`],
  ['Requires', `macOS ${FOCUS_MIN_MACOS} or later`, 'Apple silicon and Intel'],
  ['Sessions', `${MIN_MINUTES} min to ${MAX_MINUTES / 60} hours`, `The dial goes to ${DIAL_MAX / 60} hours, type for more`],
  ['Presets', PRESETS.join(' · '), 'Minutes, one tap each'],
  ['Apps', 'Allow or block list', 'Finder always stays open'],
  ['Sites', 'Google Chrome', 'Subdomains included'],
  [
    'Save time',
    `${graceLabel(GRACE_CHOICES[0])} to ${graceLabel(GRACE_CHOICES[GRACE_CHOICES.length - 1])}`,
    `${graceLabel(SAVE_GRACE)} out of the box`,
  ],
  ['Strict', 'Optional', 'Reopens at login until it ends'],
  ['Permissions', 'Just one', 'Control of Google Chrome'],
  ['Account', 'None', 'No sign-in, nothing to sync'],
  ['Data', 'Stays on your Mac', 'Nothing is sent anywhere'],
  ['Made in', 'Athens, Greece', 'By blxr'],
]

function SpecsSection() {
  return (
    <section id="specs" className="fl-section fl-wrap" aria-labelledby="fl-specs-title">
      <SectionHead
        id="fl-specs-title"
        label="Specs"
        title="The fine print"
        rest="Nothing hidden"
        lede="What it needs, what it touches and what it leaves alone."
      />
      <dl className="fl-grid fl-specs" data-reveal>
        {SPECS.map(([term, value, note]) => (
          <div key={term} className="fl-cell fl-spec">
            <dt>{term}</dt>
            <dd>
              {value}
              <span>{note}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const FAQ = [
  [
    'Can I pick which apps stay open?',
    'Yes. Open Settings from the gear, or press ⌘, between sessions. Keep an allow list, where only those apps stay open, or switch to a block list, where only those close. Add what’s open right now or anything in Applications.',
  ],
  [
    'Can I change the rules mid-session?',
    'No. Settings only opens between sessions, so a running lock can’t be loosened. Change what you need before you press Start.',
  ],
  [
    'How long can a session be?',
    `Anywhere from ${MIN_MINUTES} minute to ${MAX_MINUTES / 60} hours. The dial goes up to ${DIAL_MAX / 60} hours, and you can type a number for anything longer. The presets are ${listSentence(PRESETS.map(String))} minutes.`,
  ],
  [
    'What happens to apps I already have open?',
    `When you press Start they get ${SAVE_GRACE} seconds to save, then they’re forced closed. Settings can make that 0, 5 or 30 seconds, or a minute. Menu bar apps like Raycast and background helpers are left alone.`,
  ],
  [
    'Does it block sites in Safari or Arc?',
    'Site blocking is Chrome only, for any site you add. On the default allow list other browsers aren’t included, so they’re closed for the whole session. On a block list, add them to it.',
  ],
  [
    'Can I get out of a session early?',
    'Without Strict, Give up ends it after a confirmation. With Strict there’s no button, and it reopens at login until the timer ends. It’s a commitment device rather than a cage: while Terminal is allowed you can still stop it from there, you just have to really mean it.',
  ],
  [
    'What happens when the timer ends?',
    'A chime plays, unless you’ve turned it off, and the lock lifts. Blocked sites load again and every app opens like normal. Settings unlocks for the next session.',
  ],
  [
    'Why does macOS say it can’t be opened?',
    'Focus Lock isn’t notarized by Apple yet. The first time, open System Settings, then Privacy & Security, and click Open Anyway. After that it opens like any other app.',
  ],
  [
    'What permissions does it need?',
    'Just one: control of Google Chrome, so it can send blocked tabs to the blocked page. No Accessibility and no Screen Recording.',
  ],
  [
    'Does it need an account?',
    'No. There’s no account and no sign-in, and it doesn’t send anything anywhere. Your sessions and settings stay on your Mac.',
  ],
  [
    'Does it work offline?',
    'Yes. It doesn’t talk to a server for anything, so it works the same with Wi-Fi off.',
  ],
  [
    'Which Macs does it run on?',
    `Any Mac on macOS ${FOCUS_MIN_MACOS} or later, Apple silicon or Intel. It’s one download for both.`,
  ],
]

function FaqSection() {
  return (
    <section id="faq" className="fl-section fl-wrap" aria-labelledby="fl-faq-title">
      <div className="fl-faq">
        <div className="fl-faq-side">
          <SectionHead id="fl-faq-title" label="FAQ" title="Questions" rest="Short answers" />
          <p className="fl-faq-mail" data-reveal>
            Something else? <a href={`mailto:${CONTACT_EMAIL}`}>Email me</a>
          </p>
        </div>
        <div className="fl-faq-list" data-reveal>
          {FAQ.map(([question, answer]) => (
            <details key={question} className="fl-faq-item">
              <summary>
                {question}
                <span className="fl-faq-icon" aria-hidden="true">
                  <Icon name="plus" className="h-4 w-4" strokeWidth={2} />
                </span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

const PROMISES = ['No account', 'Nothing leaves your Mac', 'One permission']

function FinalCta({ theme }) {
  const host = useRef(null)
  return (
    <section className="fl-cta" aria-labelledby="fl-cta-title">
      <div className="fl-cta-card" ref={host} data-reveal>
        <div className="fl-sky" aria-hidden="true">
          <DitherSky hostRef={host} theme={theme} />
          <div className="fl-sky-grid" />
          <div className="fl-cta-shade" />
        </div>
        <div className="fl-cta-copy">
          <h2 id="fl-cta-title" className="fl-h2">
            <span>
              Start the next session
              <Stop />
            </span>{' '}
            <span>
              The rest can wait
              <Stop />
            </span>
          </h2>
          <p className="fl-cta-lede">Pick a time, press Start and get the work done.</p>
          <div className="fl-actions">
            <DownloadBadge />
          </div>
          <DownloadMeta />
          <ul className="fl-promises">
            {PROMISES.map((item) => (
              <li key={item}>
                <Icon name="check" className="h-3 w-3" strokeWidth={2.6} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <HeroTrace hostRef={host} theme={theme} />
        <Notch className="fl-notch-icon">
          <img {...imageProps(APP_ICON)} alt="" width="32" height="32" draggable={false} />
        </Notch>
      </div>
    </section>
  )
}

const FOOT_COLUMNS = [
  {
    title: 'Focus Lock',
    links: [...SECTIONS.map(([id, label]) => ({ label, jump: id })), { label: 'Download', href: FOCUS_DOWNLOAD, download: true }],
  },
  {
    title: 'kostis.wtf',
    links: [
      { label: 'Home', to: HOME_PATH },
      { label: 'Projects', to: PROJECTS_PATH },
      { label: 'Blog', to: BLOG_PATH },
      { label: 'Contact', to: CONTACT_PATH },
    ],
  },
  {
    title: 'Elsewhere',
    links: [
      { label: 'GitHub', href: GITHUB_URL, external: true },
      { label: 'Discord', href: DISCORD_URL, external: true },
      { label: 'Email', href: `mailto:${CONTACT_EMAIL}` },
    ],
  },
]

function footLink(item) {
  if (item.jump) return jump(item.jump)
  if (item.to) return link(item.to)
  return {
    href: item.href,
    ...(item.download && { download: true }),
    ...(item.external && { target: '_blank', rel: 'noopener noreferrer' }),
  }
}

function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="fl-foot">
      <div className="fl-wrap">
        <div className="fl-rule" />
        <div className="fl-foot-top">
          <div className="fl-foot-brand">
            <a {...jump('top')} className="fl-foot-app">
              <img {...imageProps(APP_ICON)} alt="" width="44" height="44" draggable={false} />
              <span>
                <span className="fl-foot-name">Focus Lock</span>
                <span className="fl-foot-ver">Version {FOCUS_VERSION} for macOS</span>
              </span>
            </a>
            <p>A Mac study timer that closes everything else. Made in Athens by blxr.</p>
          </div>
          <div className="fl-foot-cols">
            {FOOT_COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p>{column.title}</p>
                <ul>
                  {column.links.map((item) => (
                    <li key={item.label}>
                      <a {...footLink(item)}>{item.label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="fl-foot-bar">
          <p>© {year} Kostis · Athens, Greece</p>
          <p>Apple, the Apple logo and macOS are trademarks of Apple Inc.</p>
        </div>
      </div>
      <p className="fl-foot-mark" aria-hidden="true">
        Focus Lock
      </p>
    </footer>
  )
}

export default function FocusPage({ theme = 'dark', onToggleTheme }) {
  const root = useRef(null)
  const demo = useFocusDemo()
  useReveal(root)

  return (
    <div className="fl" ref={root}>
      <main>
        <Hero demo={demo} theme={theme} onToggleTheme={onToggleTheme} />
        <CountSection demo={demo} />
        <TrySection demo={demo} />
        <RulesSection />
        <SettingsSection demo={demo} />
        <InstallSection />
        <SpecsSection />
        <FaqSection />
        <FinalCta theme={theme} />
      </main>
      <Footer />
      {demo.overlay && <FullScreenTimer demo={demo} />}
    </div>
  )
}
