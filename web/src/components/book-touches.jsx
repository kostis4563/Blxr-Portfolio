import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from './icon'
import { ICONS } from '../lib/icons'
import { imageProps, SIZES } from '../lib/images'
import { CONTACT_EMAIL } from '../lib/profile'
import { ALERTS, EVENT_TITLE, dateKey, formatDay, formatTime, formatWeekday, formatZone, shortDay, fullShortDay } from '../lib/booking'
import '../book.css'

const HANDSET = ICONS.phoneCall[0]
const COLLAPSE_MS = 8000
const MINUTE = 60_000
const useMeasureEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const APPS = [
  { id: 'apple', label: 'Apple', go: 'Add to Calendar', done: 'Invite downloaded', hint: 'Downloads an invite that opens in Calendar and most other calendar apps.' },
  { id: 'google', label: 'Google', go: 'Open in Google', done: 'Opened in Google', hint: 'Opens Google Calendar in a new tab, filled in and ready to save.' },
  { id: 'outlook', label: 'Outlook', go: 'Open in Outlook', done: 'Opened in Outlook', hint: 'Opens Outlook on the web in a new tab, filled in and ready to save.' },
]

const alertValue = (minutes) => (minutes === null ? 'none' : String(minutes))

export function Face({ className = 'h-6 w-6', live = false }) {
  return (
    <span className={live ? 'book-island-face is-live' : 'book-island-face'}>
      <img
        {...imageProps('/pfp.webp', SIZES.avatar)}
        alt=""
        width="40"
        height="40"
        draggable="false"
        className={`select-none rounded-full object-cover ${className}`}
      />
    </span>
  )
}

export function Handset({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4.25 w-4.25 ${className}`} fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" aria-hidden="true">
      <path d={HANDSET} />
    </svg>
  )
}

export function Dot({ tone }) {
  return <span className="book-island-dot" data-tone={tone} />
}

const LENS = 'm16.5 10.3 3.9-2.5c.5-.3 1.1.1 1.1.6v7.2c0 .6-.6.9-1.1.6l-3.9-2.5z'

function PlaceGlyph({ place }) {
  switch (place) {
    case 'facetime':
    case 'zoom':
      return (
        <>
          <rect x="2.5" y="6.5" width="13" height="11" rx="3" />
          <path d={LENS} />
        </>
      )
    case 'meet':
      return (
        <>
          <rect x="2.5" y="6.5" width="13" height="11" rx="2" fill="#00ac47" />
          <path d="M7 6.5h6.5a2 2 0 0 1 2 2V10H7z" fill="#ffba00" />
          <path d="M2.5 10H7v7.5H4.5a2 2 0 0 1-2-2z" fill="#0066da" />
          <path d="M4.5 6.5H7V10H2.5V8.5a2 2 0 0 1 2-2z" fill="#ea4335" />
          <path d={LENS} fill="#00832d" />
        </>
      )
    case 'teams':
      return (
        <>
          <circle cx="17.6" cy="6.6" r="2.4" />
          <path d="M15.2 10.2h5c.7 0 1.3.6 1.3 1.3v3.9a3.3 3.3 0 0 1-6.3 1.4z" opacity=".75" />
          <rect x="2.5" y="7" width="11.5" height="11.5" rx="2" />
          <path d="M5.4 9.7h5.7v1.8H9.2v4.8H7.3v-4.8H5.4z" fill="#4b53bc" />
        </>
      )
    case 'discord':
      return (
        <>
          <path d="M18.6 6.4a15.6 15.6 0 0 0-3.8-1.2l-.5 1a14.4 14.4 0 0 0-4.6 0l-.5-1a15.6 15.6 0 0 0-3.8 1.2c-2.4 3.6-3.1 7.1-2.7 10.6a15.8 15.8 0 0 0 4.7 2.4l1-1.6c-.6-.2-1.1-.5-1.6-.8l.4-.3a11.2 11.2 0 0 0 9.6 0l.4.3c-.5.3-1 .6-1.6.8l1 1.6a15.8 15.8 0 0 0 4.7-2.4c.4-4-.7-7.5-2.7-10.6z" />
          <ellipse cx="9.1" cy="12.9" rx="1.5" ry="1.7" fill="#5865f2" />
          <ellipse cx="14.9" cy="12.9" rx="1.5" ry="1.7" fill="#5865f2" />
        </>
      )
    case 'whatsapp':
      return (
        <>
          <path d="M12 3.6a8.4 8.4 0 0 0-7.3 12.6L3.6 20.4l4.3-1.1A8.4 8.4 0 1 0 12 3.6z" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M9.3 7.9c-.3 0-.6.1-.8.4-.3.3-1 1-1 2.3s1 2.6 1.1 2.8c.1.2 1.9 3 4.7 4.1 2.3.9 2.8.7 3.3.7s1.6-.7 1.8-1.3c.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.5-.3l-1.8-.9c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.6.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.6-1.5-1.8-.1-.3 0-.4.1-.5l.4-.5.3-.4c.1-.2 0-.4 0-.5l-.8-2c-.2-.5-.4-.4-.6-.4z" />
        </>
      )
    case 'phone':
      return <path d={HANDSET} transform="translate(2.4 2.4) scale(0.8)" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    default:
      return (
        <>
          <circle cx="6.5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="17.5" cy="12" r="1.8" />
        </>
      )
  }
}

export function PlaceIcon({ place, size }) {
  return (
    <span className="book-app" data-place={place} data-size={size} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <PlaceGlyph place={place} />
      </svg>
    </span>
  )
}

export function CalendarAppIcon({ ms, zone, big = false }) {
  const key = dateKey(ms, zone)
  return (
    <span className={big ? 'book-cal is-big' : 'book-cal'} aria-hidden="true">
      <span className="book-cal-day">{formatWeekday(key)}</span>
      <span className="book-cal-date">{Number(key.slice(8))}</span>
    </span>
  )
}

export function IslandSheet({ label, onCancel, onSubmit, children }) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])

  const keys = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      e.currentTarget.requestSubmit()
    } else if (e.key === 'Tab') {
      const list = [...e.currentTarget.querySelectorAll('input:not([type=radio]), input:checked, select, textarea, button')].filter((el) => !el.disabled)
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const submit = (e) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} onSubmit={submit} onKeyDown={keys} className="book-sheet">
      {children}
    </form>
  )
}

export function IslandFrame({ view, sheet = false, live = false, hit = null, onClose, onHold, children }) {
  const rowRef = useRef(null)
  const [size, setSize] = useState(null)

  useMeasureEffect(() => {
    const el = rowRef.current
    if (!el) return
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [view])

  return (
    <>
      <div className="book-island-scrim" data-open={sheet || undefined} onClick={onClose} aria-hidden="true" />
      <div
        data-view={view}
        data-sheet={sheet || undefined}
        className="book-island"
        style={size ? { '--w': `${size.w}px`, '--h': `${size.h}px` } : undefined}
        onPointerEnter={() => onHold?.(true)}
        onPointerLeave={() => onHold?.(false)}
        onFocus={() => onHold?.(true)}
        onBlur={() => onHold?.(false)}
      >
        {hit && <button type="button" aria-label={hit.label} onClick={hit.onClick} className="book-island-hit" />}
        <span ref={rowRef} key={view} aria-hidden={live || sheet ? undefined : 'true'} className="book-island-row">
          {children}
        </span>
      </div>
    </>
  )
}

function CalendarSheet({ event, zone, twelve, modKey, onCancel, onConfirm }) {
  const [title, setTitle] = useState(event.title)
  const [notes, setNotes] = useState(event.notes)
  const [alert, setAlert] = useState(event.alert)
  const [app, setApp] = useState(event.app)
  const index = Math.max(0, APPS.findIndex((a) => a.id === app))
  const choice = APPS[index]
  const at = (ms) => formatTime(ms, zone, twelve)

  return (
    <IslandSheet label="Add to calendar" onCancel={onCancel} onSubmit={() => onConfirm({ title: title.trim() || EVENT_TITLE, notes, alert, app })}>
      <div className="book-sheet-head">
        <CalendarAppIcon ms={event.start} zone={zone} />
        <span className="book-sheet-heading">
          <span className="book-sheet-name">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={EVENT_TITLE} aria-label="Event name" autoComplete="off" spellCheck="false" />
            <Icon name="pencil" className="h-3.5 w-3.5" />
          </span>
          <span className="book-sheet-when">
            {fullShortDay(event.start, zone)} · {at(event.start)} – {at(event.end)}
          </span>
        </span>
        <button type="button" onClick={onCancel} aria-label="Close" className="book-sheet-x">
          <Icon name="x" className="h-3 w-3" strokeWidth={2.6} />
        </button>
      </div>

      <fieldset className="book-sheet-seg" style={{ '--i': index }}>
        <legend className="sr-only">Calendar</legend>
        <span className="book-sheet-thumb" aria-hidden="true" />
        {APPS.map((a) => (
          <label key={a.id}>
            <input type="radio" name="calendar-app" value={a.id} checked={app === a.id} onChange={() => setApp(a.id)} className="sr-only" />
            <span>{a.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="book-sheet-group">
        {app === 'apple' ? (
          <label className="book-sheet-row">
            <span className="book-sheet-label">
              <Icon name="bell" className="h-4 w-4" />
              Alert
            </span>
            <span className="book-sheet-select">
              <select value={alertValue(alert)} onChange={(e) => setAlert(e.target.value === 'none' ? null : Number(e.target.value))}>
                {ALERTS.map((a) => (
                  <option key={a.label} value={alertValue(a.minutes)}>
                    {a.label}
                  </option>
                ))}
              </select>
              <Icon name="chevronsUpDown" className="h-3.5 w-3.5" />
            </span>
          </label>
        ) : (
          <div className="book-sheet-row">
            <span className="book-sheet-label">
              <Icon name="bell" className="h-4 w-4" />
              Alert
            </span>
            <span className="book-sheet-dim">Your {choice.label} default</span>
          </div>
        )}
        <label className="book-sheet-row is-notes">
          <span className="sr-only">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Add notes" />
        </label>
      </div>

      <p className="book-sheet-hint">{choice.hint}</p>

      <div className="book-sheet-actions">
        <button type="button" onClick={onCancel} className="book-sheet-btn">
          Cancel
        </button>
        <button type="submit" className="book-sheet-btn" data-tone="go">
          <Icon name={app === 'apple' ? 'calendar' : 'arrowUpRight'} className="h-4 w-4" strokeWidth={2.2} />
          {choice.go}
          <kbd aria-hidden="true" className="book-kbd">
            {modKey}↵
          </kbd>
        </button>
      </div>
    </IslandSheet>
  )
}

export function BookIsland({ mode, slot, end, soonest, zone, twelve, onSoonest, video, onAdd, event, added, modKey, onClose, onConfirm }) {
  const [open, setOpen] = useState(true)
  const [held, setHeld] = useState(false)
  const view = mode === 'done' && !open ? 'booked' : mode

  useEffect(() => {
    if (mode !== 'done' || !open || held) return
    const timer = setTimeout(() => setOpen(false), COLLAPSE_MS)
    return () => clearTimeout(timer)
  }, [mode, open, held])

  const at = (ms) => formatTime(ms, zone, twelve)
  let row = null
  let hit = null

  if (view === 'loading') {
    row = (
      <>
        <Face />
        <span className="book-island-spin" />
      </>
    )
  } else if (view === 'pick' && soonest) {
    hit = { label: `Book the soonest time, ${formatDay(dateKey(soonest, zone))} at ${at(soonest)}`, onClick: onSoonest }
    row = (
      <>
        <Face live />
        <span className="book-island-dim max-[380px]:hidden">Soonest</span>
        <span>{shortDay(soonest, zone)}</span>
        <span className="book-island-go">{at(soonest)}</span>
      </>
    )
  } else if (view === 'details' && slot) {
    row = (
      <>
        <Face />
        <span>{fullShortDay(slot, zone)}</span>
        <span className="book-island-go">{at(slot)}</span>
      </>
    )
  } else if (view === 'sending') {
    row = (
      <>
        <Face />
        <span>Booking</span>
        <span className="book-island-typing">
          <i />
          <i />
          <i />
        </span>
      </>
    )
  } else if (view === 'taken') {
    row = (
      <>
        <Icon name="alert" className="book-island-warn h-4 w-4" strokeWidth={2.2} />
        <span>That time just went</span>
      </>
    )
  } else if (view === 'offline' || view === 'paused' || view === 'full') {
    row = (
      <>
        <Dot tone={view === 'offline' ? 'red' : 'grey'} />
        <span>{view === 'offline' ? 'Calendar offline' : view === 'paused' ? 'Booking paused' : 'Fully booked'}</span>
      </>
    )
  } else if (view === 'booked' && slot) {
    hit = { label: 'Show call details', onClick: () => setOpen(true) }
    row = (
      <>
        <Face />
        <span>Booked</span>
        <span className="book-island-check">
          <Icon name="check" className="h-3 w-3" strokeWidth={3} />
        </span>
      </>
    )
  } else if (view === 'done' && slot) {
    const subject = encodeURIComponent(`Moving our call on ${fullShortDay(slot, zone)}, ${at(slot)}`)
    row = (
      <>
        <Face className="h-10 w-10" />
        <span aria-hidden="true" className="flex flex-col gap-1 text-start">
          <span className="text-[14px]">Call booked</span>
          <span className="book-island-dim tabular-nums">
            {fullShortDay(slot, zone)} · {at(slot)}
          </span>
        </span>
        <span className="ms-auto flex items-center gap-2 ps-2 sm:gap-2.5 sm:ps-5">
          <a href={`mailto:${CONTACT_EMAIL}?subject=${subject}`} aria-label="Can’t make it? Email me" title="Can’t make it?" className="book-island-btn" data-tone="end">
            <Handset className="rotate-135" />
          </a>
          {video ? (
            <a href={video} target="_blank" rel="noopener noreferrer" aria-label="Join the call" title="Join the call" className="book-island-btn" data-tone="go">
              <Handset />
            </a>
          ) : (
            onAdd && (
              <button
                type="button"
                id="book-island-add"
                onClick={(e) => onAdd(e.currentTarget)}
                aria-label="Add to calendar"
                aria-haspopup="dialog"
                title="Add to calendar"
                className="book-island-btn"
                data-tone="go"
              >
                <Icon name="calendar" className="h-4.25 w-4.25" strokeWidth={2.2} />
              </button>
            )
          )}
        </span>
      </>
    )
  } else if (view === 'add' && slot && event) {
    row = (
      <CalendarSheet
        event={{ ...event, start: slot, end }}
        zone={zone}
        twelve={twelve}
        modKey={modKey}
        onCancel={onClose}
        onConfirm={(prefs) => {
          setOpen(false)
          onConfirm(prefs)
        }}
      />
    )
  } else if (view === 'added') {
    row = (
      <>
        <span className="book-island-check">
          <Icon name="check" className="h-3 w-3" strokeWidth={3} />
        </span>
        <span>{(APPS.find((a) => a.id === added) || APPS[0]).done}</span>
      </>
    )
  }

  if (!row) return null

  return (
    <IslandFrame view={view} sheet={view === 'add'} live={view === 'done'} hit={hit} onClose={onClose} onHold={setHeld}>
      {row}
    </IslandFrame>
  )
}

export function DoneMark({ ms, zone }) {
  return (
    <span className="book-done-mark" aria-hidden="true">
      <CalendarAppIcon ms={ms} zone={zone} big />
      <span className="book-done-check">
        <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    </span>
  )
}

function NoteIcon({ note }) {
  if (note.icon !== 'message') return <CalendarAppIcon ms={note.ms} zone={note.zone} />
  return (
    <span className="mac-note-avatar">
      <img {...imageProps('/pfp.webp', SIZES.avatar)} alt="" width="38" height="38" draggable="false" className="h-full w-full select-none rounded-full object-cover" />
      <span className="mac-note-badge">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#fff"
            d="M12 5.2c-4.3 0-7.8 2.8-7.8 6.3 0 2 1.2 3.8 3 5-.2 1-.7 2-1.6 2.7 1.6.1 3-.4 4.1-1.3.7.2 1.5.3 2.3.3 4.3 0 7.8-2.8 7.8-6.3s-3.5-6.7-7.8-6.7z"
          />
        </svg>
      </span>
    </span>
  )
}

function MacNote({ note, paused, onDismiss }) {
  const ref = useRef(null)
  const from = useRef(null)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const leave = useCallback(() => {
    ref.current?.style.setProperty('--note-h', `${ref.current.offsetHeight}px`)
    setLeaving(true)
  }, [])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => onDismiss(note.id), 320)
    return () => clearTimeout(timer)
  }, [leaving, note.id, onDismiss])

  useEffect(() => {
    if (note.gone) leave()
  }, [note.gone, leave])

  useEffect(() => {
    if (paused || leaving || !note.ttl) return
    const timer = setTimeout(leave, note.ttl)
    return () => clearTimeout(timer)
  }, [paused, leaving, note.ttl, leave])

  const down = (e) => {
    if (e.button !== 0 || e.target.closest('a, button')) return
    from.current = e.clientX
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const move = (e) => {
    if (from.current === null) return
    const dx = e.clientX - from.current
    setDrag(dx > 0 ? dx : dx / 6)
  }

  const up = () => {
    if (from.current === null) return
    from.current = null
    setDragging(false)
    if (drag > 80) leave()
    else setDrag(0)
  }

  const run = () => {
    note.action.onClick?.()
    leave()
  }

  return (
    <div
      ref={ref}
      role="group"
      aria-label={note.title}
      data-leaving={leaving || undefined}
      data-dragging={dragging || undefined}
      className="mac-note"
      style={drag ? { transform: `translateX(${drag}px)` } : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <button type="button" aria-label="Dismiss notification" onClick={leave} className="mac-note-close">
        <Icon name="x" className="h-2.5 w-2.5" strokeWidth={2.8} />
      </button>
      <NoteIcon note={note} />
      <span className="mac-note-text">
        <span className="mac-note-title">{note.title}</span>
        <span className="mac-note-body">{note.body}</span>
      </span>
      <span className="mac-note-side">
        <span className="mac-note-time">now</span>
        {note.action &&
          (note.action.href ? (
            <a href={note.action.href} onClick={leave} className="mac-note-action">
              {note.action.label}
            </a>
          ) : (
            <button type="button" onClick={run} className="mac-note-action">
              {note.action.label}
            </button>
          ))}
      </span>
    </div>
  )
}

export function NoteStack({ notes, onDismiss }) {
  const [paused, setPaused] = useState(false)
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="mac-notes"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {notes.map((note) => (
        <MacNote key={note.id} note={note} paused={paused} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

export function HostClock({ zone, twelve }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer = 0
    const tick = () => {
      setNow(Date.now())
      timer = setTimeout(tick, MINUTE - (Date.now() % MINUTE))
    }
    timer = setTimeout(tick, MINUTE - (Date.now() % MINUTE))
    return () => clearTimeout(timer)
  }, [])

  const hour = Number(formatTime(now, zone).slice(0, 2))
  const awake = hour >= 7 && hour < 19
  return (
    <p className="flex items-center gap-2 text-[12.5px] leading-relaxed text-ink-subtle">
      <Icon name={awake ? 'sun' : 'moon'} className="h-3.5 w-3.5" />
      <span>
        It’s <span className="font-medium tabular-nums text-ink-muted">{formatTime(now, zone, twelve)}</span> for me in {formatZone(zone, now).split(' (')[0]}.
      </span>
    </p>
  )
}
