import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../dashboard-sidebar'
import { BTN_BARE, BTN_QUIET, BTN_SOLID, CAPS, INPUT } from './ui'
import {
  TIME_CHOICES,
  WHEN_EXAMPLES,
  clock,
  dayWords,
  gapWords,
  monthGrid,
  monthWords,
  parseWhen,
  relativeChoices,
  sameDay,
  startOfDay,
  timeWords,
  weekdayNames,
  withTime,
} from '../../lib/boards-when'
import { stepWords, remindOf } from '../../lib/boards'

const DAYS = weekdayNames()

const faceOf = (at) => {
  const when = new Date(at)
  return { year: when.getFullYear(), month: when.getMonth() }
}

function toneOf(at, now, done) {
  if (done) return 'text-ink-faint'
  if (at < now) return 'text-red-500'
  if (at - now < 48 * 3600000) return 'text-amber-500'
  return 'text-ink-secondary'
}

function Grid({ month, picked, now, onPick, onChoose, onMonth }) {
  const cells = monthGrid(month.year, month.month)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => onMonth(-1)}
          className="cursor-pointer rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-strong"
        >
          <Icon name="chevronLeft" className="h-4 w-4" />
        </button>
        <span className="text-[12px] font-medium tracking-tight text-ink-strong">{monthWords(month.year, month.month)}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => onMonth(1)}
          className="cursor-pointer rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-strong"
        >
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5" role="grid">
        {DAYS.map((day) => (
          <span key={day} className="pb-1 text-center font-mono text-[9.5px] font-semibold uppercase tracking-wider text-ink-faint">
            {day.slice(0, 2)}
          </span>
        ))}
        {cells.map((cell) => {
          const chosen = sameDay(cell.at, picked)
          const today = sameDay(cell.at, now)
          const past = cell.at < startOfDay(now)
          return (
            <button
              key={cell.at}
              type="button"
              aria-pressed={chosen}
              aria-label={new Date(cell.at).toDateString()}
              onClick={() => onPick(cell.at)}
              onDoubleClick={() => onChoose(cell.at)}
              className={`h-8 cursor-pointer rounded-md font-mono text-[11.5px] tabular-nums transition-colors ${
                chosen
                  ? 'bg-ink-strong font-semibold text-ink-inverse'
                  : `hover:bg-surface-hover ${cell.inside ? (past ? 'text-ink-faint' : 'text-ink-secondary') : 'text-ink-faint/40'} ${
                      today ? 'font-semibold text-ink-strong ring-1 ring-inset ring-line-strong' : ''
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

const Strip = ({ children }) => <p className={`mb-1.5 ${CAPS}`}>{children}</p>

function TimeBox({ at, onSet }) {
  const face = new Date(at)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {TIME_CHOICES.map((choice) => {
        const on = face.getHours() === choice.hour && face.getMinutes() === choice.minute
        return (
          <button
            key={choice.label}
            type="button"
            aria-pressed={on}
            onClick={() => onSet(choice.hour, choice.minute)}
            className={`h-7 cursor-pointer rounded-lg border px-2 font-mono text-[11.5px] tabular-nums transition-colors ${
              on ? 'border-line-strong bg-surface-raised text-ink-strong' : 'border-line text-ink-subtle hover:border-line-strong hover:text-ink'
            }`}
          >
            {choice.label}
          </button>
        )
      })}
      <input
        type="time"
        aria-label="Exact time"
        value={`${String(face.getHours()).padStart(2, '0')}:${String(face.getMinutes()).padStart(2, '0')}`}
        onChange={(event) => {
          const [hour, minute] = event.target.value.split(':').map(Number)
          if (Number.isFinite(hour) && Number.isFinite(minute)) onSet(hour, minute)
        }}
        className={`${INPUT} h-7 w-[104px] px-2 tabular-nums`}
      />
    </div>
  )
}

export function WhenPicker({ anchor, value, now = Date.now(), board, onClose, onChange }) {
  const frame = useRef(null)
  const [box, setBox] = useState(null)
  const [typed, setTyped] = useState('')

  const start = Date.parse(value ?? '')
  const [draft, setDraft] = useState(() => (Number.isFinite(start) ? start : withTime(now + 86400000, 18, 0)))
  const [month, setMonth] = useState(() => faceOf(Number.isFinite(start) ? start : now))

  const kept = new Date(draft)
  const read = typed.trim() ? parseWhen(typed, now, { hour: kept.getHours(), minute: kept.getMinutes() }) : null
  const shown = read ? read.at : draft
  const face = new Date(shown)

  const readAt = read ? read.at : null
  useEffect(() => {
    if (readAt === null) return
    const next = faceOf(readAt)
    setMonth((was) => (was.year === next.year && was.month === next.month ? was : next))
  }, [readAt])

  const place = useCallback(() => {
    const spot = anchor?.current?.getBoundingClientRect()
    const width = Math.min(330, window.innerWidth - 16)
    if (!spot) {
      setBox({ left: (window.innerWidth - width) / 2, top: 80, width })
      return
    }
    const height = frame.current?.offsetHeight ?? 460
    const left = Math.max(8, Math.min(spot.left, window.innerWidth - width - 8))
    const below = spot.bottom + 6
    const top = below + height > window.innerHeight - 8 ? Math.max(8, spot.top - height - 6) : below
    setBox({ left, top, width })
  }, [anchor])

  useLayoutEffect(place, [place, typed, month, shown])

  useEffect(() => {
    const away = (event) => {
      if (frame.current?.contains(event.target)) return
      if (anchor?.current?.contains(event.target)) return
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

  const settle = (at) => {
    onChange(new Date(at).toISOString())
    onClose()
  }
  const move = (at) => {
    setTyped('')
    setDraft(withTime(at, face.getHours(), face.getMinutes()))
  }
  const retime = (hour, minute) => {
    setTyped('')
    setDraft(withTime(shown, hour, minute))
  }

  const remind = remindOf(board)
  const ladder = remind.on
    ? [...remind.lead.map((step) => `${stepWords(step)} before`), ...remind.late.map((step) => `${stepWords(step)} after`)]
    : []

  return createPortal(
    <div
      ref={frame}
      data-nested-open
      role="dialog"
      aria-label="Pick a due date"
      style={box ? { left: box.left, top: box.top, width: box.width } : { opacity: 0, top: 0, left: 0 }}
      className="fixed z-[110] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-xl border border-line-strong bg-surface shadow-2xl animate-menu-in"
    >
      <div className="border-b border-line p-3">
        <Strip>Say it in words</Strip>
        <input
          autoFocus
          value={typed}
          maxLength={60}
          spellCheck={false}
          aria-label="Say when, in your own words"
          placeholder="tomorrow 6pm · in 2 days · fri 09:00"
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            if (read) settle(read.at)
          }}
          className={INPUT}
        />
        {typed.trim() && (
          <p className={`mt-1.5 text-[12px] ${read ? 'text-ink-muted' : 'text-amber-500'}`}>
            {read ? (
              <>
                <span className="text-ink-strong">{clock(read.at)}</span> · {gapWords(read.at, now)} — press Enter
              </>
            ) : (
              <>Not a date I can read. Try {WHEN_EXAMPLES.slice(0, 3).join(', ')}.</>
            )}
          </p>
        )}
      </div>

      <div className="border-b border-line p-3">
        <Strip>Shortcuts</Strip>
        <div className="flex flex-wrap gap-1.5">
          {relativeChoices(now).map((choice) => (
            <button
              key={choice.label}
              type="button"
              onClick={() => settle(choice.at)}
              className="h-7 cursor-pointer rounded-lg border border-line px-2 text-[11.5px] text-ink-subtle transition-colors hover:border-line-strong hover:text-ink-strong"
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        <Grid month={month} picked={shown} now={now} onPick={move} onChoose={settle} onMonth={(step) => setMonth((held) => faceOf(new Date(held.year, held.month + step, 1)))} />
      </div>

      <div className="border-t border-line p-3">
        <Strip>Time</Strip>
        <TimeBox at={shown} onSet={retime} />
      </div>

      <div className="border-t border-line bg-surface-raised/50 p-3">
        <p className={`text-[12.5px] ${toneOf(shown, now, false)}`}>
          <span className="font-medium">{dayWords(shown, now)}</span> at {timeWords(shown)} · {gapWords(shown, now)}
        </p>
        {ladder.length > 0 && <p className="mt-1 text-[11.5px] text-ink-faint">Reminders: {ladder.join(', ')}.</p>}
        <div className="mt-2.5 flex items-center gap-2">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null)
                onClose()
              }}
              className={BTN_BARE}
            >
              <Icon name="x" className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            Cancel
          </button>
          <button type="button" onClick={() => settle(shown)} className={BTN_SOLID}>
            Set due
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function WhenField({ value, now = Date.now(), disabled, done, board, onChange }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  const at = Date.parse(value ?? '')
  const set = Number.isFinite(at)

  return (
    <>
      <button
        ref={anchor}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-left text-[12.5px] transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60 ${
          set ? toneOf(at, now, done) : 'text-ink-faint'
        }`}
      >
        <Icon name="calendar" className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        <span className="min-w-0 flex-1 truncate">{set ? clock(at) : 'No due date'}</span>
        {set && <span className="shrink-0 text-[11px] text-ink-faint">{gapWords(at, now)}</span>}
      </button>
      {open && <WhenPicker anchor={anchor} value={value} now={now} board={board} onClose={() => setOpen(false)} onChange={onChange} />}
    </>
  )
}
