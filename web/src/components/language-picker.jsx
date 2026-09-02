import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, useId } from 'react'
import { createPortal } from 'react-dom'
import { LANGUAGES, useI18n } from '../lib/i18n'
import { fold, matchRange } from '../lib/text-match'

const INDEX = LANGUAGES.map((l) => ({
  ...l,
  fName: fold(l.name),
  fEnglish: fold(l.english),

  haystack: fold([l.name, l.english, l.code, l.alt || ''].join(' '))
}))

function Key({ children, wide = false }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center h-[17px] ${wide ? 'px-1.5' : 'w-[17px]'} rounded-[5px] border border-line bg-surface-raised/70 font-sans text-[9.5px] leading-none text-ink-subtle`}
    >
      {children}
    </kbd>
  )
}

export default function LanguagePicker({ className = '' }) {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [edges, setEdges] = useState({ top: false, bottom: false })
  const [keyboard, setKeyboard] = useState(false)

  const [pos, setPos] = useState(null)

  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const optionRefs = useRef([])
  const openedRef = useRef(false)

  const uid = useId()
  const listId = `${uid}-list`
  const optionId = (code) => `${uid}-opt-${code}`

  const activeLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]
  const q = fold(query.trim())

  const results = useMemo(() => {
    if (!q) return INDEX
    const hits = []
    for (const l of INDEX) {
      if (l.fName.startsWith(q) || l.fEnglish.startsWith(q) || l.code.startsWith(q))
        hits.push({ l, rank: 0 })
      else
        if (l.haystack.includes(q)) hits.push({ l, rank: 1 })
    }
    return hits.sort((a, b) => a.rank - b.rank).map((h) => h.l)
  }, [q])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const measure = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const rtl = document.documentElement.dir === 'rtl'
    const vw = document.documentElement.clientWidth
    setPos({
      top: Math.round(r.bottom + 10),
      left: rtl ? Math.max(8, Math.round(r.left)) : undefined,
      right: rtl ? undefined : Math.max(8, Math.round(vw - r.right))
    })
  }, [])

  const openMenu = useCallback(() => {
    setQuery('')
    setActive(Math.max(0, LANGUAGES.findIndex((l) => l.code === lang)))
    setKeyboard(!!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches)
    measure()
    setOpen(true)
  }, [lang, measure])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, measure])

  useEffect(() => { setActive(0) }, [q])

  useEffect(() => {
    if (!open) return

    const onDown = (e) => {
      const inside = wrapRef.current?.contains(e.target) || panelRef.current?.contains(e.target)
      if (!inside) close()
    }
    const onKey = (e) => {
      if (e.key !== 'Escape') return

      if (query) {
        setQuery('')
        inputRef.current?.focus()
        return
      }
      close()
      btnRef.current?.focus()
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, query, close])

  useEffect(() => {
    if (open && keyboard) inputRef.current?.focus()
  }, [open, keyboard])

  const syncEdges = useCallback(() => {
    const el = listRef.current
    if (!el) return
    setEdges({
      top: el.scrollTop > 2,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      openedRef.current = false
      return
    }
    const list = listRef.current
    const el = optionRefs.current[active]
    if (list && el) {
      const top = el.offsetTop
      const bottom = top + el.offsetHeight
      if (!openedRef.current) {
        list.scrollTop = Math.max(0, top - (list.clientHeight - el.offsetHeight) / 2)
        openedRef.current = true
      } else if (top < list.scrollTop) {
        list.scrollTop = top - 6
      } else if (bottom > list.scrollTop + list.clientHeight) {
        list.scrollTop = bottom - list.clientHeight + 6
      }
    }
    syncEdges()
  }, [open, active, results, syncEdges])

  const pick = (code) => {
    setLang(code)
    close()
    btnRef.current?.focus()
  }

  const move = (delta) => {
    if (!results.length) return
    setActive((i) => (i + delta + results.length) % results.length)
  }

  const onPanelKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter') {

      if (e.target === inputRef.current && results[active]) {
        e.preventDefault()
        pick(results[active].code)
      }
    }
  }

  const onTriggerKey = (e) => {
    if (open) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openMenu()
    }
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-full flex items-center"
      onKeyDown={open ? onPanelKey : undefined}

      onBlur={(e) => {
        if (!open || !e.relatedTarget) return
        const inside = wrapRef.current?.contains(e.relatedTarget) || panelRef.current?.contains(e.relatedTarget)
        if (!inside) close()
      }}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKey}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${t('nav.language')} — ${activeLang.name}`}
        title={t('nav.language')}
        className={`${className} group`}
      >
        {}
        <svg
          className={`w-[16px] h-[16px] shrink-0 transition-transform duration-500 ease-out ${open ? 'rotate-[20deg]' : 'group-hover:rotate-[12deg]'}`}
          fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M3 12h18" />
          <path strokeLinecap="round" d="M12 3c2.5 2.5 3.75 5.5 3.75 9S14.5 18.5 12 21c-2.5-2.5-3.75-5.5-3.75-9S9.5 5.5 12 3z" />
        </svg>
        {}
        <span dir="ltr" className="font-mono text-[10.5px] uppercase tracking-[0.1em] leading-none pt-px">
          {lang}
        </span>
        <svg
          className={`w-[9px] h-[9px] shrink-0 opacity-70 transition-transform duration-300 ease-out ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 9l7 7 7-7" />
        </svg>
      </button>

      {}
      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('nav.language')}

          onPointerDown={(e) => {
            if (!keyboard || e.target.closest('button, input')) return
            requestAnimationFrame(() => {
              if (document.activeElement === document.body) inputRef.current?.focus()
            })
          }}
          style={{ top: pos.top, left: pos.left, right: pos.right }}
          className="panel-glass fixed z-[60] w-[292px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[18px] bg-bg/80 backdrop-blur-2xl backdrop-saturate-[1.7] shadow-[0_28px_70px_-18px_var(--shadow-cast),0_4px_14px_-6px_var(--shadow-cast-soft)] ltr:origin-top-right rtl:origin-top-left animate-lang-in"
        >
          {}
          <div className="flex items-center gap-2.5 h-11 px-3.5 border-b border-line">
            <svg className="w-[15px] h-[15px] shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('lang.search')}
              aria-label={t('lang.search')}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={results[active] ? optionId(results[active].code) : undefined}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-strong placeholder:text-ink-faint outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                aria-label={t('lang.clear')}
                title={t('lang.clear')}
                className="shrink-0 w-5 h-5 rounded-full text-ink-faint hover:text-ink-strong hover:bg-surface-hover flex items-center justify-center transition-colors duration-150 cursor-pointer"
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
              aria-label={t('nav.language')}
              onScroll={syncEdges}
              className="relative max-h-[min(56vh,292px)] overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]"
            >
              {results.length === 0 && (
                <p className="px-4 py-7 text-center text-[12px] leading-relaxed text-ink-subtle">
                  {t('lang.noResults', { q: query.trim() })}
                </p>
              )}

              {results.map((l, i) => {
                const selected = l.code === lang
                const isActive = i === active

                const divider = !q && i > 0 && results[i - 1].group !== l.group
                const range = q ? matchRange(l.name, q) : null

                return (
                  <div key={l.code}>
                    {divider && <div aria-hidden="true" className="mx-3 my-1.5 h-px bg-line" />}
                    <button
                      ref={(el) => { optionRefs.current[i] = el }}
                      id={optionId(l.code)}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      tabIndex={-1}
                      onClick={() => pick(l.code)}

                      onMouseMove={() => setActive(i)}
                      style={{ animationDelay: `${Math.min(i, 9) * 16}ms` }}
                      className={`animate-row-in relative w-full flex items-center gap-2.5 h-[34px] ps-3 pe-2 rounded-[10px] text-start transition-colors duration-100 cursor-pointer ${
                        isActive ? 'bg-surface-hover' : ''
                      } ${selected ? 'lang-row-sel' : ''} ${selected || isActive ? 'text-ink-strong' : 'text-ink-muted'}`}
                    >
                      {}
                      {selected && (
                        <span aria-hidden="true" className="lang-accent absolute start-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full" />
                      )}

                      <span
                        aria-hidden="true"
                        className={`w-[18px] shrink-0 text-center text-[13px] leading-none transition-opacity duration-150 ${
                          isActive || selected ? 'opacity-100' : 'opacity-75'
                        }`}
                      >
                        {l.flag}
                      </span>

                      <span className="flex-1 min-w-0 text-[13px] font-medium truncate" dir={l.dir || 'ltr'}>
                        {range ? (
                          <>
                            {l.name.slice(0, range[0])}
                            {}
                            <mark className="rounded-[4px] bg-ink-strong/10 px-[2px] py-[1px] text-ink-strong font-semibold">
                              {l.name.slice(range[0], range[1])}
                            </mark>
                            {l.name.slice(range[1])}
                          </>
                        ) : (
                          l.name
                        )}
                      </span>

                      {}
                      <span className="shrink-0 flex items-center justify-end">
                        {selected ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l5 5 10-10.5" />
                          </svg>
                        ) : (
                          <span
                            className={`px-1 py-0.5 rounded-[5px] font-mono text-[9.5px] uppercase tracking-[0.08em] transition-colors duration-100 ${
                              isActive ? 'bg-surface-hover-strong text-ink-subtle' : 'text-ink-faint'
                            }`}
                          >
                            {l.code}
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>

            {}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 top-0 h-7 bg-gradient-to-b from-bg to-transparent transition-opacity duration-200 ${edges.top ? 'opacity-90' : 'opacity-0'}`}
            />
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-bg to-transparent transition-opacity duration-200 ${edges.bottom ? 'opacity-90' : 'opacity-0'}`}
            />
          </div>

          {}
          {keyboard && (
            <div className="flex items-center gap-2 h-9 px-3 border-t border-line text-[10px] text-ink-faint select-none">
              <Key>↑</Key>
              <Key>↓</Key>
              <span className="flex-1 min-w-0 flex items-center gap-1.5">
                <Key>↵</Key>
                <span className="truncate" dir={results[active]?.dir || 'ltr'}>{results[active]?.name || '—'}</span>
              </span>
              <Key wide>esc</Key>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
