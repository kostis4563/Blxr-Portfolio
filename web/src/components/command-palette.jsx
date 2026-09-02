import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, useId, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../lib/i18n'
import { link } from '../lib/router'
import { buildCommands, rankCommands, groupCommands } from '../lib/commands'
import { usePaletteOpen, closePalette } from '../lib/palette'
import { matchRange, fold } from '../lib/text-match'

const ICONS = {
  home: { d: 'M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z' },
  archive: { d: ['M12 3.5L3.5 8l8.5 4.5L20.5 8 12 3.5z', 'M3.5 12.5L12 17l8.5-4.5', 'M3.5 16.5L12 21l8.5-4.5'] },
  section: { d: ['M6.5 9h13', 'M5.5 15h13', 'M10.5 4L8.5 20', 'M17.5 4l-2 16'] },
  project: { d: ['M4 6.5h16v12H4z', 'M4 10.5h16'] },
  sun: { d: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z' },
  moon: { d: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' },
  copy: { d: 'M8.25 8.25V5.5A1.5 1.5 0 019.75 4h9A1.5 1.5 0 0120.25 5.5v9a1.5 1.5 0 01-1.5 1.5H16m-10.25-7.75h9a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5h-9a1.5 1.5 0 01-1.5-1.5v-9a1.5 1.5 0 011.5-1.5z' },
  mail: { d: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75' },
  github: { fill: true, d: 'M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z' },
  discord: { fill: true, d: 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z' },
}

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

function Key({ children, wide = false }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center h-[17px] ${wide ? 'px-1.5' : 'w-[17px]'} rounded-[5px] border border-line bg-surface-raised/70 font-sans text-[9.5px] leading-none text-ink-subtle`}
    >
      {children}
    </kbd>
  )
}

export default function CommandPalette({ theme, onToggleTheme }) {
  const { t } = useI18n()
  const open = usePaletteOpen()

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [flash, setFlash] = useState(null)
  const [keyboard, setKeyboard] = useState(false)

  const [edges, setEdges] = useState({ top: false, bottom: false })

  const inputRef = useRef(null)
  const listRef = useRef(null)
  const rowRefs = useRef([])
  const flashTimer = useRef(0)

  const restoreRef = useRef(null)

  const uid = useId()
  const listId = `${uid}-list`
  const rowId = (id) => `${uid}-${id}`

  const commands = useMemo(
    () => buildCommands({ t, theme, toggleTheme: onToggleTheme }),
    [t, theme, onToggleTheme]
  )

  const results = useMemo(
    () => groupCommands(rankCommands(commands, query)).flatMap((group) => group.items),
    [commands, query]
  )

  const q = fold(query.trim())

  const close = useCallback(() => {
    closePalette()
  }, [])

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement
    setQuery('')
    setActive(0)
    setFlash(null)
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

  useEffect(() => () => clearTimeout(flashTimer.current), [])

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

  useEffect(() => { setActive(0) }, [q])

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
    const el = rowRefs.current[active]
    if (!list || !el) return
    const top = el.offsetTop
    const bottom = top + el.offsetHeight

    if (top < list.scrollTop + 24) list.scrollTop = Math.max(0, top - 24)
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 6
    syncEdges()
  }, [active, results, syncEdges])

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

  const onInputKeyDown = (e) => {
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
    }
  }

  if (!open) return null

  const activeCommand = results[active]

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[14vh] sm:pt-[16vh]"

      onPointerDown={(e) => { if (!e.target.closest('[role="dialog"]')) close() }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-black/45 backdrop-blur-[3px] animate-overlay-in" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('cmd.open')}
        className="panel-glass relative w-full max-w-[560px] overflow-hidden rounded-2xl bg-surface/[0.92] backdrop-blur-2xl backdrop-saturate-[1.7] shadow-[0_32px_80px_-20px_var(--shadow-cast),0_6px_18px_-8px_var(--shadow-cast-soft)] animate-cmd-in"

        onPointerDown={(e) => {
          if (!keyboard || e.target.closest('a, button, input')) return
          requestAnimationFrame(() => {
            if (document.activeElement === document.body) inputRef.current?.focus()
          })
        }}
      >
        {}
        <div className="flex items-center gap-3 h-[54px] ps-[18px] pe-4 border-b border-line">
          <svg className="w-4 h-4 shrink-0 text-ink-subtle" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={t('cmd.placeholder')}
            aria-label={t('cmd.open')}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeCommand ? rowId(activeCommand.id) : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink-strong placeholder:text-ink-faint outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              aria-label={t('lang.clear')}
              title={t('lang.clear')}
              className="shrink-0 w-6 h-6 rounded-full text-ink-subtle hover:text-ink-strong hover:bg-surface-hover flex items-center justify-center transition-colors duration-150 cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>

        <div className="relative">
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={t('cmd.open')}
          onScroll={syncEdges}
          className="cmd-scroll max-h-[min(56vh,413px)] overflow-y-auto overscroll-contain p-2"
        >
          {results.length === 0 && (
            <p className="px-4 py-8 text-center text-[12.5px] leading-relaxed text-ink-subtle">
              {t('cmd.noResults', { q: query.trim() })}
            </p>
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
                  <p className={`px-3 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint select-none ${i === 0 ? 'pt-1.5' : 'pt-4'}`}>
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
                  style={{ animationDelay: `${Math.min(i, 9) * 16}ms` }}
                  className={`animate-row-in relative flex items-center gap-3 h-[38px] px-3 rounded-[9px] no-underline cursor-pointer transition-colors duration-100 ${
                    isActive ? 'bg-ink-strong/[0.08] text-ink-strong' : 'text-ink-muted'
                  }`}
                >
                  <Icon
                    name={command.icon}
                    className={`w-[15px] h-[15px] shrink-0 transition-colors duration-150 ${isActive ? 'text-ink-strong' : 'text-ink-subtle'}`}
                  />

                  <span className="flex-1 min-w-0 truncate text-[13px] font-medium">
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
                        <span className="shrink-0 max-w-[46%] truncate text-[11px] text-ink-faint">
                          {command.hint}
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
          <div className="flex items-center gap-2 h-10 px-3.5 border-t border-line text-[10.5px] text-ink-faint select-none">
            <Key>↑</Key>
            <Key>↓</Key>
            <span className="flex-1 min-w-0 flex items-center gap-1.5">
              <Key>↵</Key>
              <span className="truncate">{activeCommand?.label || '—'}</span>
            </span>
            <Key wide>esc</Key>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
