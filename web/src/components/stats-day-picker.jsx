import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './dashboard-sidebar'
import { BTN_GHOST } from './settings-ui'
import { monthGrid, monthWords, weekdayNames } from '../lib/boards-when'
import { dayParts, formatDayShort, formatExact, isoDay, shiftDay, today as todayKey } from '../lib/github-stats'

const DAY_NAMES = weekdayNames()
const LEVELS = [0.14, 0.32, 0.55, 0.8, 1]
const CAPS = 'font-mono text-[9.5px] font-semibold uppercase tracking-wider text-ink-faint'

const clamp = (day, min, max) => (day < min ? min : day > max ? max : day)
const faceYm = (face) => `${face.year}-${String(face.month + 1).padStart(2, '0')}`
const monthStep = (face, by) => dayParts(isoDay(new Date(face.year, face.month + by, 1)))

function tintOf(commits, busiest) {
  if (!commits) return null
  const k = Math.sqrt(commits / Math.max(1, busiest))
  const level = LEVELS.findIndex((stop) => k <= stop)
  return `color-mix(in srgb, var(--color-ink-strong) ${10 + 8 * (level < 0 ? 4 : level)}%, var(--color-surface))`
}

const plural = (n) => `${formatExact(n)} commit${n === 1 ? '' : 's'}`

function Grid({ face, value, days, busiest, min, max, cursor, onMonth, onPick, onCursor }) {
  const gridRef = useRef(null)
  const wanted = useRef(null)
  const today = todayKey()
  const cells = useMemo(
    () => monthGrid(face.year, face.month).map((cell) => ({ ...cell, iso: isoDay(new Date(cell.at)) })),
    [face],
  )
  const ym = faceYm(face)
  const inRange = (iso) => iso >= min && iso <= max
  const wish = cursor || value || today
  const roving = cells.some((c) => c.iso === wish && inRange(c.iso)) ? wish : cells.find((c) => c.inside && inRange(c.iso))?.iso

  const focusDay = (day) => gridRef.current?.querySelector(`[data-day="${day}"]`)?.focus({ preventScroll: true })

  useLayoutEffect(() => {
    if (!wanted.current) return
    const day = wanted.current
    wanted.current = null
    focusDay(day)
  })

  useEffect(() => {
    focusDay(value || max)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const walk = (event) => {
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, PageUp: -28, PageDown: 28 }
    const from = cursor || value || today
    let next = steps[event.key] ? shiftDay(from, steps[event.key]) : event.key === 'Home' ? min : event.key === 'End' ? max : null
    if (!next) return
    event.preventDefault()
    next = clamp(next, min, max)
    wanted.current = next
    onCursor(next)
  }

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          disabled={ym <= min.slice(0, 7)}
          onClick={() => onMonth(-1)}
          className="cursor-pointer rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Icon name="chevronLeft" className="h-4 w-4" />
        </button>
        <span className="text-[12.5px] font-medium tracking-tight text-ink-strong">{monthWords(face.year, face.month)}</span>
        <button
          type="button"
          aria-label="Next month"
          disabled={ym >= max.slice(0, 7)}
          onClick={() => onMonth(1)}
          className="cursor-pointer rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>

      <div ref={gridRef} onKeyDown={walk} className="grid grid-cols-7 gap-0.5" role="grid" aria-label="Pick a day">
        {DAY_NAMES.map((name) => (
          <span key={name} className={`${CAPS} pb-1 text-center`}>
            {name.slice(0, 2)}
          </span>
        ))}
        {cells.map((cell) => {
          const commits = days.get(cell.iso)?.c || 0
          const out = !inRange(cell.iso)
          const on = cell.iso === value
          const tint = on || out ? null : tintOf(commits, busiest)
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              data-day={cell.iso}
              disabled={out}
              aria-pressed={on}
              tabIndex={cell.iso === roving ? 0 : -1}
              aria-label={`${formatDayShort(cell.iso)} — ${commits ? plural(commits) : 'no commits'}`}
              title={commits ? plural(commits) : 'No commits'}
              onClick={() => onPick(cell.iso)}
              onFocus={() => onCursor(cell.iso, true)}
              style={tint ? { background: tint } : undefined}
              className={`h-8 cursor-pointer rounded-md font-mono text-[11.5px] tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink-strong/40 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-ink-faint/30 ${
                on
                  ? 'bg-ink-strong font-semibold text-ink-inverse'
                  : `hover:bg-surface-hover hover:ring-1 hover:ring-inset hover:ring-line-strong ${cell.inside ? (commits ? 'font-medium text-ink-strong' : 'text-ink-muted') : 'text-ink-faint/50'} ${
                      cell.iso === today ? 'ring-1 ring-inset ring-line-strong' : ''
                    }`
              }`}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Popover({ anchor, value, days, min, max, latest, note, onClose, onChange }) {
  const frame = useRef(null)
  const [box, setBox] = useState(null)
  const [face, setFace] = useState(() => dayParts(value || max))
  const [cursor, setCursor] = useState(value || null)

  const busiest = useMemo(() => {
    let top = 1
    for (const b of days.values()) if (b.c > top) top = b.c
    return top
  }, [days])

  const place = useCallback(() => {
    const spot = anchor?.current?.getBoundingClientRect()
    const width = Math.min(296, window.innerWidth - 16)
    if (!spot) return setBox({ left: (window.innerWidth - width) / 2, top: 80, width })
    const height = frame.current?.offsetHeight ?? 360
    const left = Math.max(8, Math.min(spot.right - width, window.innerWidth - width - 8))
    const below = spot.bottom + 6
    const top = below + height > window.innerHeight - 8 ? Math.max(8, spot.top - height - 6) : below
    return setBox({ left, top, width })
  }, [anchor])

  useLayoutEffect(place, [place, face])

  useEffect(() => {
    const away = (event) => {
      if (frame.current?.contains(event.target) || anchor?.current?.contains(event.target)) return
      onClose()
    }
    const key = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      event.preventDefault()
      onClose()
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor, onClose, place])

  if (typeof document === 'undefined') return null

  const settle = (day) => {
    onChange(clamp(day, min, max))
    onClose()
  }
  const walk = (day, quiet = false) => {
    setCursor(day)
    if (!quiet) setFace(dayParts(day))
  }

  const shortcuts = [
    { label: 'Today', day: max },
    { label: 'Yesterday', day: clamp(shiftDay(max, -1), min, max) },
    ...(latest && latest !== max ? [{ label: 'Last commit', day: latest }] : []),
  ]

  return createPortal(
    <div
      ref={frame}
      data-nested-open
      role="dialog"
      aria-label="Open a single day"
      style={box ? { left: box.left, top: box.top, width: box.width } : { opacity: 0, top: 0, left: 0 }}
      className="fixed z-110 max-h-[calc(100dvh-16px)] overflow-y-auto rounded-xl border border-line-strong bg-surface shadow-2xl animate-menu-in"
    >
      <Grid
        face={face}
        value={value}
        days={days}
        busiest={busiest}
        min={min}
        max={max}
        cursor={cursor}
        onMonth={(by) => setFace((held) => monthStep(held, by))}
        onPick={settle}
        onCursor={walk}
      />
      {note && <p className="border-t border-line px-3 py-2 text-[11.5px] leading-snug text-ink-subtle">{note}</p>}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-line p-2.5">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => settle(s.day)}
            className="h-7 cursor-pointer rounded-lg border border-line px-2 text-[11.5px] text-ink-subtle transition-colors hover:border-line-strong hover:text-ink-strong"
          >
            {s.label}
          </button>
        ))}
        <span className="flex-1" />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
              onClose()
            }}
            className={`${BTN_GHOST} h-7 px-2 text-[12px]`}
          >
            <Icon name="x" className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

export default function StatsDayPicker({ value, days, min, max, latest, note, onChange }) {
  const anchor = useRef(null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink-strong/30 ${
          value
            ? 'border-line-strong bg-surface text-ink-strong'
            : 'border-line bg-surface-raised/60 text-ink-muted hover:border-line-strong hover:text-ink-strong'
        }`}
      >
        <Icon name="calendar" className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        {value ? formatDayShort(value) : 'Pick a day'}
        <Icon name="chevronDown" className={`h-3 w-3 shrink-0 opacity-50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <Popover
          anchor={anchor}
          value={value}
          days={days}
          min={min}
          max={max}
          latest={latest}
          note={note}
          onClose={() => setOpen(false)}
          onChange={onChange}
        />
      )}
    </>
  )
}
