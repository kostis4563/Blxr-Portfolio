import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { link, navigate, HOME_PATH } from './lib/router'
import { execute, complete, expandHistory, welcomeLines, SUGGESTIONS, USER, HOST, SHELL } from './lib/terminal'
import { fetchSpotifyNow, sampleNow } from './lib/listening'
import { athensTemp } from './lib/weather'
import { openPalette } from './lib/palette'
import { forceTheme } from './lib/use-theme'
import {
  ACHIEVEMENTS,
  barrelRoll,
  cheat,
  funEnabled,
  missionPassed,
  nuke,
  setFun,
  unlockedAchievements,
  wasted,
} from './lib/memes'

const HISTORY_KEY = 'blxr:terminal-history'
const LOGIN_KEY = 'blxr:terminal-login'
const HISTORY_MAX = 100
const NAV_DELAY_MS = 450

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50'

const TONES = {
  dim: 'text-ink-faint',
  muted: 'text-ink-muted',
  strong: 'text-ink-strong font-semibold',
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  err: 'text-red-400',
  dir: 'term-dir font-semibold',
  logo: 'text-ink-strong',
  invert: 'bg-ink-strong text-bg',
  link: 'text-ink-strong',
  'swatch-red': 'text-red-400',
  'swatch-amber': 'text-amber-400',
  'swatch-emerald': 'text-emerald-400',
  'swatch-sky': 'term-dir',
  'swatch-violet': 'term-violet',
  'swatch-rose': 'text-rose-400',
  'swatch-ink': 'text-ink-strong',
}

const LINK_CLASS =
  'cursor-pointer rounded-sm underline decoration-dotted decoration-line-strong underline-offset-[3px] transition-colors duration-150 hover:decoration-ink-strong hover:text-ink-strong focus-visible:decoration-ink-strong outline-none focus-visible:ring-1 focus-visible:ring-ink-strong/50'

const effect = (name, ...args) =>
  import('./lib/secret-effects').then((mod) => mod[name](...args)).catch(() => {})

const FX = {
  rmrf: () => effect('rmrf'),
  sus: () => effect('ejected'),
  dvd: () => effect('dvd'),
  kill: () => effect('youDied'),
  iddqd: () => effect('doom', 'iddqd'),
  idkfa: () => effect('doom', 'idkfa'),
  hesoyam: () => cheat('hesoyam'),
  aezakmi: () => cheat('aezakmi'),
  wasted: () => wasted(),
  respect: () => missionPassed(),
  barrelroll: () => barrelRoll(),
  nuke: () => nuke(() => forceTheme('light'), { launched: true }),
}

function readStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return value ?? fallback
  } catch {
    return fallback
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
  }
}

const loginStamp = (date) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

const finePointer = () => Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches)

function Prompt() {
  return (
    <span aria-hidden="true" className="select-none">
      <span className="font-semibold text-emerald-400">{`${USER}@${HOST}`}</span>
      <span className="text-ink-faint">:</span>
      <span className="term-dir font-semibold">~</span>
      <span className="text-ink-faint">$ </span>
    </span>
  )
}

function Part({ part, onRun }) {
  if (typeof part === 'string') return part
  const { text, tone, cmd, to, href } = part
  const toneClass = TONES[tone] ?? ''
  if (!cmd && !to && !href) return <span className={toneClass}>{text}</span>

  const label = text.replace(/\s+$/, '')
  const trail = text.slice(label.length)
  const className = `${toneClass} ${LINK_CLASS}`
  let node
  if (cmd) {
    node = (
      <button type="button" onClick={() => onRun(cmd)} title={`run ${cmd}`} className={className}>
        {label}
      </button>
    )
  } else if (to) {
    node = (
      <a {...link(to)} className={className}>
        {label}
      </a>
    )
  } else {
    const mail = href.startsWith('mailto:')
    node = (
      <a href={href} {...(mail ? {} : { target: '_blank', rel: 'noopener noreferrer' })} className={className}>
        {label}
      </a>
    )
  }
  return (
    <>
      {node}
      {trail}
    </>
  )
}

function Line({ line, onRun }) {
  const pre = !Array.isArray(line) && line?.pre
  const parts = Array.isArray(line) ? line : line?.parts ?? []
  return (
    <div className={pre ? 'whitespace-pre' : 'whitespace-pre-wrap break-words'}>
      {parts.length ? parts.map((part, i) => <Part key={i} part={part} onRun={onRun} />) : ' '}
    </div>
  )
}

export default function TerminalPage({ theme, onToggleTheme }) {
  const [entries, setEntries] = useState([])
  const [showWelcome, setShowWelcome] = useState(true)
  const [lastLogin, setLastLogin] = useState(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const inputRef = useRef(null)
  const scrollerRef = useRef(null)
  const measureRef = useRef(null)
  const historyRef = useRef([])
  const cursorRef = useRef(null)
  const draftRef = useRef('')
  const seqRef = useRef(0)
  const runningRef = useRef(null)
  const startedAtRef = useRef(0)
  const columnsRef = useRef(80)
  const caretToEndRef = useRef(false)

  useEffect(() => {
    startedAtRef.current = Date.now()
    const stored = readStored(HISTORY_KEY, [])
    historyRef.current = Array.isArray(stored) ? stored.filter((item) => typeof item === 'string').slice(-HISTORY_MAX) : []
    const previous = readStored(LOGIN_KEY, null)
    const previousDate = typeof previous === 'string' ? new Date(previous) : null
    if (previousDate && !Number.isNaN(previousDate.getTime())) setLastLogin(loginStamp(previousDate))
    writeStored(LOGIN_KEY, new Date().toISOString())
    if (finePointer()) inputRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const scroller = scrollerRef.current
    const measure = measureRef.current
    if (!scroller || !measure || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const charWidth = measure.getBoundingClientRect().width / 10
      if (!charWidth) return
      const style = getComputedStyle(scroller)
      const inner = scroller.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      columnsRef.current = Math.max(20, Math.floor(inner / charWidth))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [entries, showWelcome])

  useLayoutEffect(() => {
    if (!caretToEndRef.current) return
    caretToEndRef.current = false
    const el = inputRef.current
    if (el) el.setSelectionRange(el.value.length, el.value.length)
  }, [input])

  const pushHistory = (command) => {
    const list = historyRef.current
    if (list[list.length - 1] === command) return
    historyRef.current = [...list, command].slice(-HISTORY_MAX)
    writeStored(HISTORY_KEY, historyRef.current)
  }

  const clearHistory = () => {
    historyRef.current = []
    writeStored(HISTORY_KEY, [])
  }

  const clearScreen = () => {
    setEntries([])
    setShowWelcome(false)
  }

  const append = (entry) => setEntries((prev) => [...prev, entry])

  const context = (onClear) => ({
    theme,
    toggleTheme: onToggleTheme,
    history: historyRef.current,
    clearHistory,
    clear: onClear,
    startedAt: startedAtRef.current,
    columns: columnsRef.current,
    screen: `${window.innerWidth}×${window.innerHeight}`,
    url: window.location.href,
    now: () => new Date(),
    navigate: (to) => setTimeout(() => navigate(to), NAV_DELAY_MS),
    openUrl: (href) => {
      if (href.startsWith('mailto:')) window.location.href = href
      else window.open(href, '_blank', 'noopener,noreferrer')
    },
    copy: (text) =>
      navigator.clipboard?.writeText
        ? navigator.clipboard.writeText(text).then(
            () => true,
            () => false,
          )
        : Promise.resolve(false),
    spotifyNow: () => fetchSpotifyNow().then((data) => sampleNow(data)),
    athensTemp,
    ping: async () => {
      const started = performance.now()
      const res = await fetch(`/favicon.ico?ping=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
      if (!res.ok) throw new Error(`http_${res.status}`)
      return performance.now() - started
    },
    fx: (name) => FX[name]?.(),
    fun: funEnabled,
    setFun,
    achievements: () => {
      const got = unlockedAchievements()
      return Object.values(ACHIEVEMENTS).map((item) => ({ ...item, got: got.includes(item.id) }))
    },
    openPalette,
  })

  const submit = async (raw) => {
    if (runningRef.current) return
    const id = ++seqRef.current
    cursorRef.current = null
    draftRef.current = ''
    setInput('')

    const expanded = expandHistory(raw, historyRef.current)
    if (expanded === null) {
      append({ id, input: raw, lines: [[{ text: `${SHELL}: event not found`, tone: 'err' }]] })
      return
    }
    const command = expanded.trim()
    if (!command) {
      append({ id, input: raw, lines: [] })
      return
    }
    pushHistory(command)

    let cleared = false
    const echo = expanded !== raw ? [[{ text: command, tone: 'dim' }]] : []
    append({ id, input: raw, lines: echo, pending: true })
    runningRef.current = id
    setBusy(true)

    let lines
    try {
      lines = await execute(command, context(() => { cleared = true }))
    } catch {
      lines = [[{ text: `${SHELL}: something broke in there`, tone: 'err' }]]
    }
    if (runningRef.current !== id) return
    runningRef.current = null
    setBusy(false)

    const done = { id, input: raw, lines: [...echo, ...lines], pending: false }
    if (cleared) {
      setShowWelcome(false)
      setEntries(lines.length ? [done] : [])
      return
    }
    setEntries((prev) => prev.map((entry) => (entry.id === id ? done : entry)))
  }

  const interrupt = () => {
    const running = runningRef.current
    if (running) {
      runningRef.current = null
      setBusy(false)
      setEntries((prev) =>
        prev.map((entry) => (entry.id === running ? { ...entry, pending: false, lines: [...entry.lines, [{ text: '^C', tone: 'dim' }]] } : entry)),
      )
      return
    }
    append({ id: ++seqRef.current, input: `${input}^C`, lines: [] })
    setInput('')
    cursorRef.current = null
  }

  const browse = (step) => {
    const list = historyRef.current
    if (!list.length) return
    if (cursorRef.current === null) {
      if (step > 0) return
      draftRef.current = input
      cursorRef.current = list.length
    }
    const next = Math.min(list.length, Math.max(0, cursorRef.current + step))
    caretToEndRef.current = true
    if (next === list.length) {
      cursorRef.current = null
      setInput(draftRef.current)
    } else {
      cursorRef.current = next
      setInput(list[next])
    }
  }

  const onKeyDown = (event) => {
    const key = event.key
    if (key === 'Tab') {
      event.preventDefault()
      const result = complete(input, context(() => {}))
      if (result.options.length) {
        append({ id: ++seqRef.current, input, lines: [[{ text: result.options.join('  '), tone: 'muted' }]] })
      }
      caretToEndRef.current = true
      setInput(result.value)
    } else if (key === 'ArrowUp') {
      event.preventDefault()
      browse(-1)
    } else if (key === 'ArrowDown') {
      event.preventDefault()
      browse(1)
    } else if (event.ctrlKey && !event.metaKey && !event.altKey) {
      const lower = key.toLowerCase()
      if (lower === 'l') {
        event.preventDefault()
        clearScreen()
      } else if (lower === 'c') {
        const el = event.currentTarget
        const selecting = el.selectionStart !== el.selectionEnd || Boolean(window.getSelection?.()?.toString())
        if (selecting) return
        event.preventDefault()
        interrupt()
      } else if (lower === 'u') {
        event.preventDefault()
        setInput('')
      }
    }
  }

  const runFromClick = (command) => {
    if (runningRef.current) return
    submit(command)
    if (finePointer()) inputRef.current?.focus({ preventScroll: true })
  }

  const focusInput = (event) => {
    if (event.target.closest('a, button, input')) return
    if (window.getSelection?.()?.toString()) return
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 frame-bleed-b border-b border-x border-dashed border-line top-0 flex items-center px-6 sm:px-10">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="group inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
            <span>Back to Home</span>
          </a>
          <div className="flex items-center gap-4">
            <CommandButton className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-strong transition-colors duration-200" />
            <ThemeToggle
              theme={theme}
              onToggle={onToggleTheme}
              className="text-ink-muted hover:text-ink-strong transition-colors duration-200"
            />
          </div>
        </div>
      </header>

      <main className="w-full max-w-[960px] mx-auto flex flex-col items-center min-h-screen pt-14 border-x border-dashed border-line bg-bg px-4 sm:px-6">
        <div className="w-full max-w-[760px] pt-14 pb-16 sm:pt-20">
          <h1 className="font-bagus text-[28px] leading-none text-ink-strong">Terminal</h1>
          <p className="mt-3 max-w-[54ch] text-[14px] leading-relaxed text-ink-subtle">
            The site as a shell. It is optional: everything in here is one click away on the normal pages, so type{' '}
            <span className="font-mono text-ink-muted">help</span> only if you feel like it.
          </p>

          <section aria-label="Terminal" className="mt-8 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-32px_rgb(0_0_0/0.55)]">
            <div className="flex h-9 items-center border-b border-line bg-surface-raised px-3.5">
              <span aria-hidden="true" className="flex w-12 gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
              </span>
              <span className="flex-1 truncate text-center font-mono text-[11px] text-ink-subtle">{`${USER}@${HOST}: ~ — ${SHELL}`}</span>
              <span aria-hidden="true" className="w-12 text-right font-mono text-[10.5px] text-ink-faint">{busy ? 'busy' : ''}</span>
            </div>

            <div
              ref={scrollerRef}
              onClick={focusInput}
              className="relative h-[min(68vh,620px)] min-h-[360px] overflow-auto overscroll-contain px-4 py-3.5 font-mono text-[12.5px] leading-[1.65] text-ink-secondary sm:px-5 sm:text-[13px]"
            >
              <span ref={measureRef} aria-hidden="true" className="invisible absolute left-0 top-0 whitespace-pre">
                0000000000
              </span>

              <div role="log" aria-live="polite" aria-label="Terminal output">
                {showWelcome && (
                  <div className="mb-3">
                    {welcomeLines(lastLogin).map((line, i) => (
                      <Line key={i} line={line} onRun={runFromClick} />
                    ))}
                  </div>
                )}
                {entries.map((entry) => (
                  <div key={entry.id} className="mb-2">
                    {entry.input !== null && (
                      <div className="whitespace-pre-wrap break-words">
                        <Prompt />
                        <span className="text-ink-strong">{entry.input}</span>
                      </div>
                    )}
                    {entry.lines.map((line, i) => (
                      <Line key={i} line={line} onRun={runFromClick} />
                    ))}
                    {entry.pending && <div className="text-ink-faint motion-safe:animate-pulse">…</div>}
                  </div>
                ))}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  submit(input)
                }}
                className="flex items-baseline"
              >
                <label htmlFor="terminal-input" className="sr-only">
                  Command
                </label>
                <Prompt />
                <input
                  id="terminal-input"
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onKeyDown}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  className="min-w-0 flex-1 bg-transparent p-0 font-mono text-[16px] text-ink-strong caret-emerald-400 outline-none sm:text-[13px]"
                />
              </form>
            </div>
          </section>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" aria-label="Try a command">
              {SUGGESTIONS.map((command) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => runFromClick(command)}
                  className={`h-7 cursor-pointer rounded-md border border-line bg-surface px-2.5 font-mono text-[11.5px] text-ink-muted transition-colors duration-200 hover:border-line-strong hover:text-ink-strong ${FOCUS}`}
                >
                  {command}
                </button>
              ))}
            </div>
            <p className="hidden font-mono text-[11px] text-ink-faint sm:block">Tab completes · ↑ ↓ history · Ctrl+L clears</p>
          </div>
        </div>
      </main>
    </div>
  )
}
