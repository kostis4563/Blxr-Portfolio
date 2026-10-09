import { useEffect, useMemo, useRef, useState } from 'react'
import { fold, matchRange } from '../../lib/text-match'
import { SUBJECTS, RATINGS, searchSubjects } from '../../lib/ib'

export const TEXT_BUTTON =
  'text-[13px] text-ink-subtle outline-none transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong focus-visible:underline focus-visible:underline-offset-4 disabled:pointer-events-none disabled:opacity-40'

export const TONE_TEXT = {
  great: 'text-emerald-400',
  good: 'text-green-500',
  pass: 'text-amber-400',
  weak: 'text-red-400',
}

export const fmt = (n) => String(Math.round(n * 10) / 10)
export const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`
const isTyping = (target) => Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'))

export function Rating({ grade }) {
  const rating = RATINGS[grade]
  return <span className={TONE_TEXT[rating.tone]}>{rating.label}</span>
}

export function Choice({ label, options, value, onChange, clearable = false, className = '' }) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex flex-wrap gap-x-6 gap-y-2 ${className}`}>
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={option.name}
            disabled={option.disabled}
            onClick={() => onChange(on && clearable ? '' : option.value)}
            className={`outline-none transition-colors duration-200 focus-visible:underline focus-visible:underline-offset-4 disabled:cursor-not-allowed disabled:opacity-30 ${
              on ? 'text-ink-strong' : 'text-ink-faint hover:text-ink-muted'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function Highlight({ text, query }) {
  const range = query ? matchRange(text, query) : null
  if (!range) return text
  return (
    <>
      {text.slice(0, range[0])}
      <mark className="bg-transparent text-ink-strong">{text.slice(range[0], range[1])}</mark>
      {text.slice(range[1])}
    </>
  )
}

const SEARCH_SIZES = {
  lg: 'mt-2 pb-3 text-[20px] font-medium tracking-tight sm:text-[24px]',
  sm: 'pb-2 text-[15px]',
}

export function SubjectSearch({ id, label, hideLabel = false, subject, onPick, size = 'lg', shortcut = false, emptyText = 'Search subjects' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const results = useMemo(() => searchSubjects(query), [query])
  const needle = fold(query.trim())
  const current = results[active]

  const start = () => {
    setQuery('')
    setActive(Math.max(0, SUBJECTS.findIndex((s) => s.id === subject?.id)))
    setOpen(true)
  }

  const pick = (picked) => {
    onPick(picked.id)
    setOpen(false)
    inputRef.current?.blur()
  }

  useEffect(() => {
    if (!shortcut) return undefined
    const onKey = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcut])

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) return start()
      if (!results.length) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (i + step + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (open && current) pick(current)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-[13px] text-ink-subtle'}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && current ? `${id}-opt-${current.id}` : undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        value={open ? query : (subject?.name ?? '')}
        placeholder={open ? (subject?.name ?? emptyText) : emptyText}
        onFocus={start}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        className={`w-full truncate border-b border-line-strong bg-transparent leading-tight text-ink-strong outline-none transition-colors duration-200 placeholder:text-ink-faint focus:border-ink-strong ${SEARCH_SIZES[size]}`}
      />

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label="Subjects"
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-[min(50vh,340px)] overflow-y-auto overscroll-contain rounded-lg border border-line bg-bg py-1.5 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.5)]"
        >
          {results.length === 0 && (
            <li role="presentation" className="px-4 py-6 text-[13px] text-ink-subtle">
              Nothing matches “{query.trim()}”.
            </li>
          )}
          {results.map((s, index) => (
            <li
              key={s.id}
              id={`${id}-opt-${s.id}`}
              data-index={index}
              role="option"
              aria-selected={s.id === subject?.id}
              onMouseMove={() => index !== active && setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(s)}
              className={`flex cursor-pointer items-baseline justify-between gap-4 px-4 py-2.5 text-[14px] ${index === active ? 'bg-surface-hover' : ''} ${s.id === subject?.id ? 'text-ink-strong' : 'text-ink-muted'}`}
            >
              <span className="min-w-0 truncate">
                <Highlight text={s.name} query={needle} />
              </span>
              <span className="hidden shrink-0 text-[12px] text-ink-faint sm:inline">{s.group}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
