import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { link, navigate, HOME_PATH } from './lib/router'
import { execute, complete, expandHistory, welcomeLines, USER, HOST, SHELL } from './lib/terminal'
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

function findMatch(history, query, before) {
  if (!query) return -1
  for (let i = Math.min(before, history.length) - 1; i >= 0; i--) {
    if (history[i].includes(query)) return i
  }
  return -1
}

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
      {parts.length ? parts.map((part, i) => <Part key={i} part={part} onRun={onRun} />) : ' '}
    </div>
  )
}

function Typed({ value, start, end, focused }) {
  const from = Math.min(start, value.length)
  const to = Math.min(end, value.length)
  if (from !== to) {
    return (
      <>
        {value.slice(0, from)}
        <span className="bg-selection">{value.slice(from, to)}</span>
        {value.slice(to)}
      </>
    )
  }
  return (
    <>
      {value.slice(0, from)}
      <span key={`${value.length}:${from}`} className="term-cursor" data-state={focused ? 'on' : 'off'}>
        {value[from] ?? ' '}
      </span>
      {value.slice(from + 1)}
    </>
  )
}

export default function TerminalPage({ theme, onToggleTheme }) {
  const [entries, setEntries] = useState([])
  const [showWelcome, setShowWelcome] = useState(true)
  const [lastLogin, setLastLogin] = useState(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [ended, setEnded] = useState(false)
  const [focused, setFocused] = useState(false)
  const [caret, setCaret] = useState({ start: 0, end: 0 })
  const [search, setSearch] = useState(null)

  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const scrollerRef = useRef(null)
  const measureRef = useRef(null)
  const historyRef = useRef([])
  const browseRef = useRef(null)
  const draftRef = useRef('')
  const seqRef = useRef(0)
  const runningRef = useRef(null)
  const startedAtRef = useRef(0)
  const columnsRef = useRef(80)
  const pendingCaretRef = useRef(null)

  const value = search ? search.query : input
  const searching = search !== null

  const syncCaret = () => {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? start
    setCaret((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
  }

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
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return
      const el = document.activeElement
      if (!inputRef.current || el === inputRef.current) return
      if (el && (el.isContentEditable || el.closest('input, textarea, select, [role="dialog"]'))) return
      if (event.key === ' ' && el?.closest('button, a')) return
      inputRef.current.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    const root = rootRef.current
    if (!viewport || !root) return
    const update = () => {
      if (Math.abs(viewport.scale - 1) > 0.01) return
      root.style.setProperty('--term-vh', `${viewport.height}px`)
      root.style.setProperty('--term-vt', `${viewport.offsetTop}px`)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
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
  }, [entries, showWelcome, value, busy])

  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    const pending = pendingCaretRef.current
    if (pending !== null) {
      pendingCaretRef.current = null
      const pos = pending === 'end' ? el.value.length : Math.min(pending, el.value.length)
      el.setSelectionRange(pos, pos)
    }
    syncCaret()
  }, [value, searching])

  const moveCaret = (pos) => {
    const el = inputRef.current
    if (!el) return
    el.setSelectionRange(pos, pos)
    syncCaret()
  }

  const setLine = (next, caretAt = 'end') => {
    if (next === input) {
      moveCaret(caretAt === 'end' ? next.length : caretAt)
      return
    }
    pendingCaretRef.current = caretAt
    setInput(next)
  }

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
    if (runningRef.current || ended) return
    const seq = ++seqRef.current
    browseRef.current = null
    draftRef.current = ''
    setInput('')

    const expanded = expandHistory(raw, historyRef.current)
    if (expanded === null) {
      append({ id: seq, input: raw, lines: [[{ text: `${SHELL}: event not found`, tone: 'err' }]] })
      return
    }
    const command = expanded.trim()
    if (!command) {
      append({ id: seq, input: raw, lines: [] })
      return
    }
    pushHistory(command)

    let cleared = false
    const echo = expanded !== raw ? [[{ text: command, tone: 'dim' }]] : []
    append({ id: seq, input: raw, lines: echo })
    runningRef.current = seq
    setBusy(true)

    let lines
    try {
      lines = await execute(command, context(() => { cleared = true }))
    } catch {
      lines = [[{ text: `${SHELL}: something broke in there`, tone: 'err' }]]
    }
    if (runningRef.current !== seq) return
    runningRef.current = null
    setBusy(false)

    const done = { id: seq, input: raw, lines: [...echo, ...lines] }
    if (cleared) {
      setShowWelcome(false)
      setEntries(lines.length ? [done] : [])
      return
    }
    setEntries((prev) => prev.map((entry) => (entry.id === seq ? done : entry)))
  }

  const matchOf = (state) => (state && state.index >= 0 ? historyRef.current[state.index] ?? '' : '')

  const startSearch = () => {
    draftRef.current = input
    browseRef.current = null
    pendingCaretRef.current = 0
    setSearch({ query: '', index: -1, failed: false })
  }

  const updateSearch = (query) => {
    const index = findMatch(historyRef.current, query, historyRef.current.length)
    setSearch({ query, index, failed: index === -1 && Boolean(query) })
  }

  const searchOlder = () => {
    setSearch((prev) => {
      if (!prev) return prev
      const from = prev.index >= 0 ? prev.index : historyRef.current.length
      const index = findMatch(historyRef.current, prev.query, from)
      return index === -1 ? { ...prev, failed: Boolean(prev.query) } : { ...prev, index, failed: false }
    })
  }

  const acceptSearch = () => {
    const line = search.index >= 0 ? matchOf(search) : draftRef.current
    pendingCaretRef.current = 'end'
    setSearch(null)
    setInput(line)
  }

  const cancelSearch = () => {
    pendingCaretRef.current = 'end'
    setSearch(null)
    setInput(draftRef.current)
  }

  const runSearch = () => {
    const line = search.index >= 0 ? matchOf(search) : draftRef.current
    setSearch(null)
    submit(line)
  }

  const interrupt = () => {
    if (search) {
      cancelSearch()
      return
    }
    const running = runningRef.current
    if (running) {
      runningRef.current = null
      setBusy(false)
      setEntries((prev) =>
        prev.map((entry) => (entry.id === running ? { ...entry, lines: [...entry.lines, [{ text: '^C', tone: 'dim' }]] } : entry)),
      )
      return
    }
    append({ id: ++seqRef.current, input: `${input}^C`, lines: [] })
    setInput('')
    browseRef.current = null
  }

  const logout = () => {
    append({ id: ++seqRef.current, input: '', lines: [[{ text: 'logout', tone: 'dim' }], [{ text: '[Process completed]', tone: 'dim' }]] })
    setEnded(true)
    setTimeout(() => navigate(HOME_PATH), NAV_DELAY_MS)
  }

  const browse = (step) => {
    const list = historyRef.current
    if (!list.length) return
    if (browseRef.current === null) {
      if (step > 0) return
      draftRef.current = input
      browseRef.current = list.length
    }
    const next = Math.min(list.length, Math.max(0, browseRef.current + step))
    if (next === list.length) {
      browseRef.current = null
      setLine(draftRef.current)
    } else {
      browseRef.current = next
      setLine(list[next])
    }
  }

  const completeInput = () => {
    const result = complete(input, context(() => {}))
    if (result.options.length) {
      append({ id: ++seqRef.current, input, lines: [[{ text: result.options.join('  '), tone: 'muted' }]] })
    }
    setLine(result.value)
  }

  const onSearchKey = (event, ctrl, lower) => {
    const key = event.key
    if (key === 'Enter') {
      event.preventDefault()
      runSearch()
    } else if (ctrl && lower === 'r') {
      event.preventDefault()
      searchOlder()
    } else if (key === 'Escape' || (ctrl && (lower === 'g' || lower === 'c'))) {
      event.preventDefault()
      cancelSearch()
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key) || (key === 'Tab' && !event.shiftKey)) {
      event.preventDefault()
      acceptSearch()
    } else {
      requestAnimationFrame(syncCaret)
    }
  }

  const onKeyDown = (event) => {
    const key = event.key
    const ctrl = event.ctrlKey && !event.metaKey && !event.altKey
    const lower = key.toLowerCase()
    if (search) {
      onSearchKey(event, ctrl, lower)
      return
    }
    const el = event.currentTarget
    const at = el.selectionStart ?? input.length
    if (key === 'Tab' && !event.shiftKey) {
      event.preventDefault()
      completeInput()
    } else if (key === 'ArrowUp') {
      event.preventDefault()
      browse(-1)
    } else if (key === 'ArrowDown') {
      event.preventDefault()
      browse(1)
    } else if (ctrl && lower === 'c') {
      const selecting = el.selectionStart !== el.selectionEnd || Boolean(window.getSelection?.()?.toString())
      if (selecting) return
      event.preventDefault()
      interrupt()
    } else if (ctrl && ['l', 'u', 'w', 'a', 'e', 'r', 'd'].includes(lower)) {
      event.preventDefault()
      if (lower === 'l') clearScreen()
      else if (lower === 'u') setLine(input.slice(at), 0)
      else if (lower === 'w') {
        const head = input.slice(0, at).replace(/\S*\s*$/, '')
        setLine(head + input.slice(at), head.length)
      } else if (lower === 'a') moveCaret(0)
      else if (lower === 'e') moveCaret(input.length)
      else if (lower === 'r') startSearch()
      else if (!input) logout()
      else if (at < input.length) setLine(input.slice(0, at) + input.slice(at + 1), at)
    } else {
      requestAnimationFrame(syncCaret)
    }
  }

  const onChange = (event) => {
    if (search) updateSearch(event.target.value)
    else setInput(event.target.value)
    syncCaret()
  }

  const runFromClick = (command) => {
    if (runningRef.current || ended) return
    if (search) setSearch(null)
    submit(command)
    if (finePointer()) inputRef.current?.focus({ preventScroll: true })
  }

  const focusInput = (event) => {
    if (event.target.closest('a, button, input')) return
    if (window.getSelection?.()?.toString()) return
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <div
      ref={rootRef}
      className="fixed inset-x-0 top-0 bg-bg text-ink antialiased selection:bg-selection selection:text-ink-strong"
      style={{ height: 'var(--term-vh, 100dvh)', transform: 'translateY(var(--term-vt, 0px))' }}
    >
      <h1 className="sr-only">Terminal</h1>

      <a
        {...link(HOME_PATH)}
        aria-label="Back to the site"
        className="group absolute right-5 top-2.5 z-10 inline-flex h-7 items-center gap-1.5 rounded-md bg-bg/85 px-2 font-mono text-[12px] text-ink-faint outline-none backdrop-blur-sm transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong focus-visible:ring-1 focus-visible:ring-ink-strong/40 sm:right-7 sm:top-3.5"
      >
        <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5">
          ←
        </span>
        <span>back</span>
      </a>

      <section
        ref={scrollerRef}
        aria-label="Terminal"
        onClick={focusInput}
        className="term-scroll relative h-full overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 font-mono text-[12.5px] leading-[1.6] text-ink-secondary sm:px-6 sm:py-4 sm:text-[13px] xl:text-[13.5px]"
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
              <div className="whitespace-pre-wrap break-words">
                <Prompt />
                <span className="text-ink-strong">{entry.input}</span>
              </div>
              {entry.lines.map((line, i) => (
                <Line key={i} line={line} onRun={runFromClick} />
              ))}
            </div>
          ))}
        </div>

        {!ended && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (search) runSearch()
              else submit(input)
            }}
            className="relative whitespace-pre-wrap break-all"
          >
            <label htmlFor="terminal-input" className="sr-only">
              Command
            </label>
            <span aria-hidden="true">
              {search ? (
                <>
                  <span className={search.failed ? 'text-red-400' : 'text-ink-faint'}>
                    {search.failed ? '(failed reverse-i-search)' : '(reverse-i-search)'}
                  </span>
                  <span className="text-ink-faint">`</span>
                  <span className="text-ink-strong">
                    <Typed value={value} start={caret.start} end={caret.end} focused={focused} />
                  </span>
                  <span className="text-ink-faint">{"': "}</span>
                  <span className="text-ink-strong">{matchOf(search)}</span>
                </>
              ) : (
                <>
                  {!busy && <Prompt />}
                  <span className="text-ink-strong">
                    <Typed value={value} start={caret.start} end={caret.end} focused={focused} />
                  </span>
                </>
              )}
            </span>
            <input
              id="terminal-input"
              ref={inputRef}
              value={value}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onKeyUp={syncCaret}
              onSelect={syncCaret}
              onClick={() => moveCaret(value.length)}
              onFocus={() => {
                setFocused(true)
                syncCaret()
              }}
              onBlur={() => setFocused(false)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              className="absolute inset-0 h-full w-full cursor-text appearance-none border-0 bg-transparent p-0 text-[16px] opacity-0 outline-none"
            />
          </form>
        )}
      </section>
    </div>
  )
}
