import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, useId, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { link, navigate, normalizePath, parseRoute, CONTACT_PATH } from '../lib/router'
import { buildCommands, rankCommands, groupCommands, sudoCommand, recentCommands, inScope, SCOPES } from '../lib/commands'
import { usePaletteOpen, closePalette } from '../lib/palette'
import { readRecent } from '../lib/recent'
import { toggleLayoutGrid } from '../lib/figma'
import { reducedMotion } from '../lib/memes'
import { useAuth } from '../lib/supabase'
import { useComments, useCommentsHidden, startCommenting } from '../lib/comments'
import { matchRange, fold } from '../lib/text-match'
import { Handles } from './figma'

const ICONS = {
  home: { d: 'M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z' },
  archive: { d: ['M12 3.5L3.5 8l8.5 4.5L20.5 8 12 3.5z', 'M3.5 12.5L12 17l8.5-4.5', 'M3.5 16.5L12 21l8.5-4.5'] },
  section: { d: ['M6.5 9h13', 'M5.5 15h13', 'M10.5 4L8.5 20', 'M17.5 4l-2 16'] },
  project: { d: ['M4 6.5h16v12H4z', 'M4 10.5h16'] },
  star: { d: 'M12 3.5l2.6 5.4 5.9.7-4.4 4.1 1.2 5.8L12 16.6l-5.3 2.9 1.2-5.8-4.4-4.1 5.9-.7z' },
  sun: { d: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z' },
  moon: { d: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' },
  copy: { d: 'M8.25 8.25V5.5A1.5 1.5 0 019.75 4h9A1.5 1.5 0 0120.25 5.5v9a1.5 1.5 0 01-1.5 1.5H16m-10.25-7.75h9a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5h-9a1.5 1.5 0 01-1.5-1.5v-9a1.5 1.5 0 011.5-1.5z' },
  user: { d: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'] },
  grid: { d: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'] },
  layout: { d: ['M4 4h16v16H4z', 'M9.33 4v16', 'M14.67 4v16'] },
  link: { d: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'] },
  monitor: { d: ['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M8 21h8', 'M12 17v4'] },
  file: { d: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M9 13h6', 'M9 17h4'] },
  logout: { d: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'] },
  terminal: { d: ['M5 7l5 5-5 5', 'M12 18h7'] },
  trash: { d: ['M5 7h14', 'M10 11v6', 'M14 11v6', 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12', 'M9 7V4h6v3'] },
  eye: { d: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'] },
  message: { d: 'M7.5 8.25h9m-9 3.75h5.25M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
  mail: { d: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75' },
  github: { fill: true, d: 'M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z' },
  discord: { fill: true, d: 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z' },
}

const LIST_PAD = 12
const EXIT_MS = 130

function Icon({ name, className = '' }) {
  const icon = ICONS[name]
  if (!icon) return null
  const paths = Array.isArray(icon.d) ? icon.d : [icon.d]
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...(icon.fill
        ? { fill: 'currentColor' }
        : { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' })}
    >
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

function RowIcon({ command, active }) {
  if (command.accent) {
    return (
      <span aria-hidden="true" className="qa-swatch" style={{ '--swatch': command.accent }}>
        {command.label.trim().charAt(0)}
      </span>
    )
  }
  return (
    <Icon
      name={command.icon}
      className={`w-[15px] h-[15px] shrink-0 transition-colors duration-150 ${active ? 'text-ink-strong' : 'text-ink-subtle'}`}
    />
  )
}

function SudoOutput({ line, onContact }) {
  const after = (delay) => ({ animationDelay: delay, animationDuration: '0.12s' })
  return (
    <div role="status" className="px-5 py-4 font-mono text-[12.5px] leading-[1.8]">
      <p className="break-all text-ink-strong">
        <span className="select-none text-ink-faint">$ </span>
        {line}
      </p>
      <p className="text-ink-muted">[sudo] password for visitor:</p>
      <p className="animate-fade-in text-red-400" style={after('0.9s')}>
        visitor is not in the sudoers file. This incident will be reported.
      </p>
      <p className="animate-fade-in mt-3" style={after('1.8s')}>
        <a
          {...link(CONTACT_PATH, onContact)}
          className="text-ink-secondary underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink-strong"
        >
          It was. To me. Say hi →
        </a>
      </p>
    </div>
  )
}

function Key({ children, wide = false }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center h-[18px] ${wide ? 'px-1.5' : 'min-w-[18px] px-1'} rounded-[5px] border border-line bg-surface-raised/70 font-sans text-[10px] leading-none text-ink-subtle`}
    >
      {children}
    </kbd>
  )
}

const displayPath = (command) => {
  if (command?.where) return command.where
  if (!command?.href) return ''
  return command.external ? command.href.replace(/^(mailto:|https?:\/\/)/, '') : command.href
}

export default function CommandPalette({ theme, onToggleTheme }) {
  const open = usePaletteOpen()

  const [present, setPresent] = useState(open)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all')
  const [active, setActive] = useState(0)
  const [flash, setFlash] = useState(null)
  const [shell, setShell] = useState(null)
  const [keyboard, setKeyboard] = useState(false)
  const [recent, setRecent] = useState([])
  const [here, setHere] = useState(null)
  const [listHeight, setListHeight] = useState(null)

  const [edges, setEdges] = useState({ top: false, bottom: false })

  const inputRef = useRef(null)
  const listRef = useRef(null)
  const frameRef = useRef(null)
  const pillRef = useRef(null)
  const rowRefs = useRef([])
  const tabRefs = useRef({})
  const glideRef = useRef(false)
  const pillGlideRef = useRef(false)
  const observerRef = useRef(null)
  const flashTimer = useRef(0)

  const restoreRef = useRef(null)

  const uid = useId()
  const listId = `${uid}-list`
  const rowId = (id) => `${uid}-${id}`

  const { session } = useAuth()
  const signedIn = Boolean(session)
  const onHome = here !== null && parseRoute(here).name === 'home'
  const comments = useComments()
  const commentsHidden = useCommentsHidden()
  const commands = useMemo(
    () =>
      buildCommands({
        theme,
        toggleTheme: onToggleTheme,
        toggleGrid: onHome ? toggleLayoutGrid : null,
        signedIn,
        comments,
        commentsHidden,
        path: here ?? undefined,
      }),
    [theme, onToggleTheme, onHome, signedIn, comments, commentsHidden, here]
  )

  const q = fold(query.trim())
  const sudo = useMemo(() => sudoCommand(query), [query])
  const ranked = useMemo(() => rankCommands(commands, query), [commands, query])

  const counts = useMemo(() => {
    const out = { all: ranked.length }
    for (const command of ranked) out[command.scope] = (out[command.scope] || 0) + 1
    return out
  }, [ranked])

  const results = useMemo(() => {
    if (sudo) return [sudo]
    const scoped = groupCommands(ranked.filter((command) => inScope(command, scope))).flatMap((group) => group.items)
    if (q || scope !== 'all') return scoped
    return [...recentCommands(commands, recent, { exclude: here }), ...scoped]
  }, [sudo, ranked, scope, q, commands, recent, here])

  const close = useCallback(() => {
    closePalette()
  }, [])

  useEffect(() => {
    if (open) {
      setPresent(true)
      return
    }
    const timer = setTimeout(() => setPresent(false), reducedMotion() ? 0 : EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    glideRef.current = false
    pillGlideRef.current = false
  }, [open])

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement
    setQuery('')
    setScope('all')
    setActive(0)
    setFlash(null)
    setShell(null)
    setRecent(readRecent())
    setHere(normalizePath(window.location.pathname))
    setListHeight(null)
    const hasKeyboard = !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    setKeyboard(hasKeyboard)
    if (hasKeyboard)
      inputRef.current?.focus()

    return () => {
      restoreRef.current?.focus?.({ preventScroll: true })
      restoreRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  useEffect(() => () => {
    clearTimeout(flashTimer.current)
    observerRef.current?.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (query) {
        setQuery('')
        inputRef.current?.focus()
        return
      }
      close()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, query, close])

  useEffect(() => {
    setActive(0)
    setShell(null)
  }, [q, scope])

  const contentRef = useCallback((el) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setListHeight(el.offsetHeight))
    observer.observe(el)
    observerRef.current = observer
  }, [])

  const syncEdges = useCallback(() => {
    const el = listRef.current
    if (!el) return
    setEdges({
      top: el.scrollTop > 2,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2,
    })
  }, [])

  useLayoutEffect(() => {
    const list = listRef.current
    const frame = frameRef.current
    const el = rowRefs.current[active]
    if (!list) return
    if (!el || !results[active]) {
      if (frame) frame.style.opacity = '0'
      return
    }

    if (frame) {
      frame.style.transition = glideRef.current ? '' : 'none'
      frame.style.transform = `translateY(${el.offsetTop}px)`
      frame.style.height = `${el.offsetHeight}px`
      frame.style.opacity = '1'
      glideRef.current = true
    }

    const top = el.offsetTop
    const bottom = top + el.offsetHeight
    if (top < list.scrollTop + 28) list.scrollTop = Math.max(0, top - 28)
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 6
    syncEdges()
  }, [active, results, syncEdges, present, shell, keyboard, listHeight])

  useLayoutEffect(() => {
    const pill = pillRef.current
    const tab = tabRefs.current[scope]
    if (!pill || !tab) return
    pill.style.transition = pillGlideRef.current ? '' : 'none'
    pill.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`
    pill.style.width = `${tab.offsetWidth}px`
    pillGlideRef.current = true

    const strip = tab.parentElement
    if (tab.offsetLeft < strip.scrollLeft + 8) strip.scrollLeft = tab.offsetLeft - 8
    else if (tab.offsetLeft + tab.offsetWidth > strip.scrollLeft + strip.clientWidth - 8)
      strip.scrollLeft = tab.offsetLeft + tab.offsetWidth - strip.clientWidth + 8
  }, [scope, counts, q, present])

  const openExternal = (href) => {

    if (href.startsWith('mailto:')) window.location.href = href
    else window.open(href, '_blank', 'noopener,noreferrer')
  }

  const runCommand = useCallback((command) => {
    if (command.external) {
      openExternal(command.href)
      close()
      return
    }
    if (command.shell) {
      setShell(command.label)
      return
    }
    command.run?.()

    if (command.flash) {
      setFlash(command.id)
      clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => {
        setFlash(null)
        close()
      }, 1100)
      return
    }
    close()
  }, [close])

  const move = (delta) => {
    if (!results.length) return
    setActive((i) => (i + delta + results.length) % results.length)
  }

  const cycleScope = (delta) => {
    const i = SCOPES.findIndex((s) => s.id === scope)
    setScope(SCOPES[(i + delta + SCOPES.length) % SCOPES.length].id)
  }

  const onInputKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(Math.max(0, results.length - 1))
    } else if (e.key === 'Enter') {
      if (!results[active]) return
      e.preventDefault()
      runCommand(results[active])
    } else if (e.key === 'Tab') {
      e.preventDefault()
      cycleScope(e.shiftKey ? -1 : 1)
    } else if (e.key === 'Backspace' && !query && scope !== 'all') {
      e.preventDefault()
      setScope('all')
    }
  }

  if (!open && !present) return null

  const state = open ? 'open' : 'closed'
  const activeCommand = results[active]
  const scopeLabel = SCOPES.find((s) => s.id === scope).label
  const maxList = Math.min(window.innerHeight * 0.56, 404)
  const showCounts = Boolean(q) && !sudo

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center px-3 sm:px-4 pt-[10vh] sm:pt-[14vh]"

      onPointerDown={(e) => { if (open && !e.target.closest('[role="dialog"]')) close() }}
    >
      <div aria-hidden="true" data-state={state} className="qa-overlay absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick actions"
        data-state={state}
        className="qa-panel panel-glass relative w-full max-w-[600px] overflow-hidden rounded-[14px] bg-surface/[0.94] backdrop-blur-2xl backdrop-saturate-[1.7] shadow-[0_32px_80px_-20px_var(--shadow-cast),0_6px_18px_-8px_var(--shadow-cast-soft)]"

        onPointerDown={(e) => {
          if (!keyboard || e.target.closest('a, button, input')) return
          requestAnimationFrame(() => {
            if (document.activeElement === document.body) inputRef.current?.focus()
          })
        }}
      >
        {}
        <div className="flex items-center gap-2.5 h-[52px] ps-4 pe-3">
          <svg className="w-4 h-4 shrink-0 text-ink-subtle" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={scope === 'all' ? 'Search pages, projects and actions…' : `Search ${scopeLabel.toLowerCase()}…`}
            aria-label="Quick actions"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeCommand ? rowId(activeCommand.id) : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            className="min-w-0 flex-1 bg-transparent text-base sm:text-[15px] text-ink-strong placeholder:text-ink-faint outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              aria-label="Clear"
              title="Clear"
              className="shrink-0 w-6 h-6 rounded-full text-ink-subtle hover:text-ink-strong hover:bg-surface-hover flex items-center justify-center transition-colors duration-150 cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : (
            keyboard && <Key wide>esc</Key>
          )}
        </div>

        {}
        <div
          role="group"
          aria-label="Filter results"
          className="cmd-scroll relative flex items-center gap-0.5 overflow-x-auto px-2.5 pb-2 border-b border-line"
        >
          <span ref={pillRef} aria-hidden="true" className="qa-tab-pill" />
          {SCOPES.map((s) => {
            const selected = s.id === scope
            const count = counts[s.id] || 0
            return (
              <button
                key={s.id}
                ref={(el) => { tabRefs.current[s.id] = el }}
                type="button"
                tabIndex={-1}
                aria-pressed={selected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setScope(s.id)}
                className={`relative shrink-0 inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-[7px] text-[12px] font-medium cursor-pointer transition-colors duration-150 ${
                  selected ? 'text-ink-strong' : showCounts && !count ? 'text-ink-faint' : 'text-ink-subtle hover:text-ink-secondary'
                }`}
              >
                {s.label}
                {showCounts && (
                  <span className={`tabular-nums text-[10.5px] ${selected ? 'text-ink-muted' : 'text-ink-faint'}`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="relative">
        {shell ? (
          <SudoOutput line={shell} onContact={() => { navigate(CONTACT_PATH); close() }} />
        ) : (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Results"
          onScroll={syncEdges}
          style={listHeight === null ? undefined : { height: Math.min(listHeight + LIST_PAD, maxList) }}
          className="qa-list cmd-scroll relative max-h-[min(56vh,404px)] overflow-y-auto overscroll-contain p-1.5"
        >
          {keyboard && (
            <div ref={frameRef} aria-hidden="true" className="qa-frame">
              <Handles className="fig-handle qa-handle" />
              {activeCommand && flash !== activeCommand.id && (
                <span className="qa-verb">
                  {activeCommand.verb}
                  <span className="qa-verb-key">↵</span>
                </span>
              )}
            </div>
          )}

          <div ref={contentRef}>
          {results.length === 0 && scope === 'comments' && !q && (
            <div className="px-4 py-9 text-center">
              <p className="text-[12.5px] leading-relaxed text-ink-subtle">
                No comments yet. They stay in this browser, only you can see them.
              </p>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { close(); startCommenting() }}
                className="mt-2 text-[12px] font-medium text-ink-secondary underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink-strong cursor-pointer"
              >
                Leave your first comment
              </button>
            </div>
          )}

          {results.length === 0 && (scope !== 'comments' || q) && (
            <div className="px-4 py-9 text-center">
              <p className="text-[12.5px] leading-relaxed text-ink-subtle">
                No results for “{query.trim()}”{scope !== 'all' && ` in ${scopeLabel}`}
              </p>
              {scope !== 'all' && counts.all > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setScope('all')}
                  className="mt-2 text-[12px] font-medium text-ink-secondary underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink-strong cursor-pointer"
                >
                  Search everywhere ({counts.all})
                </button>
              )}
            </div>
          )}

          {results.map((command, i) => {
            const isActive = i === active
            const isFlashing = flash === command.id

            const heading = i === 0 || results[i - 1].group !== command.group
            const range = q ? matchRange(command.label, q) : null

            const rowProps = command.external
              ? {
                  href: command.href,
                  target: '_blank',
                  rel: 'noreferrer noopener',

                  onClick: (e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                    e.preventDefault()
                    runCommand(command)
                  },
                }
              : link(command.href, () => runCommand(command))

            return (
              <Fragment key={command.id}>
                {heading && (
                  <p className={`px-2.5 pb-1 text-[11px] font-medium text-ink-faint select-none ${i === 0 ? 'pt-1.5' : 'pt-3.5'}`}>
                    {command.group}
                  </p>
                )}

                <a
                  {...rowProps}
                  ref={(el) => { rowRefs.current[i] = el }}
                  id={rowId(command.id)}
                  role="option"
                  aria-selected={isActive}
                  tabIndex={-1}

                  onMouseMove={() => setActive(i)}
                  style={{ animationDelay: `${Math.min(i, 9) * 12}ms` }}
                  className={`qa-row relative flex items-center gap-2.5 h-10 sm:h-9 ps-2.5 rounded-[3px] no-underline cursor-pointer select-none transition-colors duration-100 ${
                    keyboard ? 'pe-[72px]' : 'pe-2.5 active:bg-ink-strong/[0.06]'
                  } ${isActive && keyboard ? 'text-ink-strong' : 'text-ink-secondary'}`}
                >
                  <RowIcon command={command} active={isActive && keyboard} />

                  <span className="flex-1 min-w-0 truncate text-[13px]">
                    {range ? (
                      <>
                        {command.label.slice(0, range[0])}
                        <mark className="bg-transparent text-ink-strong font-semibold">
                          {command.label.slice(range[0], range[1])}
                        </mark>
                        {command.label.slice(range[1])}
                      </>
                    ) : (
                      command.label
                    )}
                  </span>

                  {}
                  {isFlashing ? (
                    <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400/90">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l5 5 10-10.5" />
                      </svg>
                      {command.flash}
                    </span>
                  ) : (
                    <>
                      {command.hint && (
                        <span className="shrink-0 max-w-[42%] truncate text-[11.5px] text-ink-faint">
                          {command.hint}
                        </span>
                      )}
                      {command.shortcut && keyboard && (
                        <span className="shrink-0 inline-flex gap-0.5">
                          {command.shortcut.map((k) => <Key key={k}>{k}</Key>)}
                        </span>
                      )}
                      {command.external && (
                        <svg className="w-3 h-3 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16L16 8m0 0H9.5m6.5 0v6.5" />
                        </svg>
                      )}
                    </>
                  )}
                </a>
              </Fragment>
            )
          })}
          </div>
        </div>
        )}

          {}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-surface to-transparent transition-opacity duration-200 ${edges.top ? 'opacity-90' : 'opacity-0'}`}
          />
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-surface to-transparent transition-opacity duration-200 ${edges.bottom ? 'opacity-90' : 'opacity-0'}`}
          />
        </div>

        {}
        {keyboard && (
          <div className="flex items-center gap-3.5 h-9 px-3.5 border-t border-line text-[11px] text-ink-faint select-none">
            <span className="flex items-center gap-1.5">
              <Key>↑</Key>
              <Key>↓</Key>
              Select
            </span>
            <span className="flex items-center gap-1.5">
              <Key>⇥</Key>
              Filter
            </span>
            <span className="ms-auto min-w-0 truncate font-mono text-[10.5px]">{displayPath(activeCommand)}</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
