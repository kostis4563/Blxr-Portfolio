import { useEffect, useMemo, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { Bone } from './components/skeleton'
import { link, HOME_PATH, CONTACT_PATH, REVIEWS_PATH, PAYMENT_PATH } from './lib/router'
import { CONTACT_EMAIL } from './lib/profile'
import { fetchBookingSlots, bookCall } from './lib/api'
import {
  BOOKING_LIMITS,
  WEEKDAYS,
  visitorTimeZone,
  timeZoneList,
  prefersTwelveHour,
  dateKey,
  groupByDay,
  monthOf,
  shiftMonth,
  monthGrid,
  formatMonth,
  formatDay,
  formatTime,
  formatZone,
  bookingProblems,
} from './lib/booking'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const LABEL = 'text-[11px] font-mono font-semibold text-ink-subtle uppercase tracking-wider'
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50'
const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'
const CTA =
  'group inline-flex h-10 items-center gap-2 rounded-full bg-ink-strong ps-5 pe-4 text-[13px] font-semibold text-ink-inverse outline-none transition-[transform,opacity] duration-200 hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ink-strong/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer'
const GHOST =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-surface-raised px-4 py-2 text-[12.5px] font-semibold text-ink-secondary transition-colors hover:text-ink-strong'
const NAV_BUTTON = `flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ${FOCUS}`

const inputClass = (invalid) =>
  `w-full rounded-xl border bg-surface-raised/60 px-3.5 py-2.5 text-[13.5px] text-ink-strong placeholder:text-ink-faint transition-colors focus:outline-none focus:bg-surface ${
    invalid ? 'border-red-500/60 focus:border-red-500/80' : 'border-line hover:border-line-strong focus:border-line-strong'
  }`

const EMPTY_DRAFT = { name: '', email: '', note: '', website: '' }

const SEND_ERRORS = {
  rate_limited: 'You’ve booked a few calls already today. Email me if you need another one.',
  booking_disabled: 'Booking just went offline. Email me instead and we’ll find a time.',
  offline: 'You look offline. Check your connection and try again.',
}

const SERVER_FIELD_ERRORS = {
  name: 'Just your name, no links.',
  email: 'That email doesn’t look right.',
  note: `Keep it under ${BOOKING_LIMITS.note.max} characters.`,
}

const minutesLabel = (minutes) => (minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`)

function EmailLink() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={`rounded-sm text-ink-strong underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink-strong ${FOCUS}`}>
      {CONTACT_EMAIL}
    </a>
  )
}

function Field({ id, label, hint, counter, error, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={LABEL}>
          {label}
          {hint && <span className="ms-1.5 font-normal normal-case tracking-normal text-ink-faint">· {hint}</span>}
        </label>
        {counter && <span className={`font-mono text-[10.5px] tabular-nums ${counter.over ? 'text-red-500' : 'text-ink-faint'}`}>{counter.text}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}

function ZonePicker({ zone, onChange }) {
  const zones = useMemo(() => timeZoneList(zone), [zone])
  return (
    <span className="relative inline-flex items-center gap-1.5 rounded-md text-ink-muted transition-colors focus-within:ring-2 focus-within:ring-ink-strong/50 hover:text-ink-strong">
      <Icon name="globe" className="h-[14px] w-[14px]" />
      <span className="underline decoration-dashed decoration-line-strong underline-offset-4">{formatZone(zone)}</span>
      <Icon name="chevronDown" className="h-[12px] w-[12px]" />
      <select
        aria-label="Time zone"
        value={zone}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </span>
  )
}

function Calendar({ month, onMonth, firstMonth, lastMonth, days, selected, today, onSelect }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-medium text-ink-strong" aria-live="polite">
          {formatMonth(month)}
        </h2>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" disabled={month <= firstMonth} onClick={() => onMonth(shiftMonth(month, -1))} className={NAV_BUTTON}>
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next month" disabled={month >= lastMonth} onClick={() => onMonth(shiftMonth(month, 1))} className={NAV_BUTTON}>
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={formatMonth(month)}>
        {WEEKDAYS.map((name) => (
          <span key={name} role="columnheader" className="pb-2 font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
            {name}
          </span>
        ))}
        {monthGrid(month).map((key, i) => {
          if (!key) return <span key={`pad-${i}`} aria-hidden="true" />
          const count = days.get(key)?.length || 0
          const active = key === selected
          const label = `${formatDay(key)}${count ? `, ${count} ${count === 1 ? 'time' : 'times'} free` : ', nothing free'}`
          return (
            <button
              key={key}
              type="button"
              disabled={!count}
              aria-pressed={active}
              aria-label={label}
              onClick={() => onSelect(key)}
              className={`relative flex h-11 items-center justify-center rounded-lg text-[13.5px] tabular-nums transition-colors duration-150 sm:h-12 ${FOCUS} ${
                active
                  ? 'bg-ink-strong font-semibold text-ink-inverse'
                  : count
                    ? 'cursor-pointer bg-surface-hover/70 font-semibold text-ink-strong hover:bg-surface-hover-strong'
                    : 'cursor-default text-ink-faint'
              }`}
            >
              {Number(key.slice(8))}
              {key === today && <span aria-hidden="true" className={`absolute bottom-1.5 h-1 w-1 rounded-full ${active ? 'bg-ink-inverse' : 'bg-ink-muted'}`} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Times({ day, times, zone, twelve, minutes, onPick }) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-4">
        <h2 className="text-[15px] font-medium text-ink-strong">{formatDay(day)}</h2>
        <p className="mt-0.5 text-[12px] text-ink-subtle">
          {times.length} {times.length === 1 ? 'time' : 'times'} · {minutesLabel(minutes)} each
        </p>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:max-h-[372px] md:grid-cols-1 md:overflow-y-auto md:pe-1">
        {times.map((ms) => (
          <li key={ms}>
            <button
              type="button"
              onClick={() => onPick(ms)}
              className={`group flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line text-[13.5px] font-medium tabular-nums text-ink-strong transition-colors duration-150 hover:border-ink-strong ${FOCUS}`}
            >
              {formatTime(ms, zone, twelve)}
              <span aria-hidden="true" className="hidden text-ink-faint transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-ink-strong md:inline">
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PickerSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading free times" className="grid gap-10 md:grid-cols-[minmax(0,1fr)_200px] md:gap-12">
      <div>
        <Bone className="mb-5 h-5 w-36" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, i) => (
            <Bone key={i} className="h-11 rounded-lg sm:h-12" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Bone className="mb-3 h-5 w-40" />
        {Array.from({ length: 6 }, (_, i) => (
          <Bone key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

function Message({ title, children, action }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-5 py-8 sm:px-8">
      <p className="text-[15px] font-medium text-ink-strong">{title}</p>
      <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-ink-muted">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

function Summary({ slot, minutes, video, zone, ownerZone, twelve, onChange }) {
  const sameClock = formatTime(slot, zone) === formatTime(slot, ownerZone)
  return (
    <div className="flex flex-col gap-4 md:sticky md:top-24 md:self-start">
      <p className={KICKER}>Your call</p>
      <div>
        <p className="text-[17px] font-medium leading-snug text-ink-strong">{formatDay(dateKey(slot, zone))}</p>
        <p className="mt-1 text-[14px] tabular-nums text-ink-secondary">
          {formatTime(slot, zone, twelve)} – {formatTime(slot + minutes * 60_000, zone, twelve)}
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-[12.5px] text-ink-muted">
        <li className="flex items-center gap-2">
          <Icon name="clock" className="h-[14px] w-[14px]" />
          {minutesLabel(minutes)}
        </li>
        <li className="flex items-center gap-2">
          <Icon name="monitor" className="h-[14px] w-[14px]" />
          {video}
        </li>
        <li className="flex items-center gap-2">
          <Icon name="globe" className="h-[14px] w-[14px]" />
          {formatZone(zone, slot)}
        </li>
      </ul>
      {!sameClock && (
        <p className="text-[12px] text-ink-subtle">
          That’s {formatTime(slot, ownerZone, twelve)} for me in {formatZone(ownerZone, slot).split(' (')[0]}.
        </p>
      )}
      <button type="button" onClick={onChange} className={`self-start rounded-sm text-[12.5px] font-medium text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink-strong ${FOCUS}`}>
        Change time
      </button>
    </div>
  )
}

function DetailsForm({ slot, zone, onBooked, onTaken, headingRef }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [touched, setTouched] = useState({})
  const [showAll, setShowAll] = useState(false)
  const [serverFields, setServerFields] = useState([])
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const refs = { name: useRef(null), email: useRef(null), note: useRef(null) }

  const problems = bookingProblems(draft)
  const visible = (field) => (showAll || touched[field]) && problems[field]
  const fieldError = (field) => visible(field) || (serverFields.includes(field) ? SERVER_FIELD_ERRORS[field] : null)
  const set = (field) => (e) => {
    const value = e.target.value
    setDraft((d) => ({ ...d, [field]: value }))
    setServerFields((f) => f.filter((x) => x !== field))
  }
  const touch = (field) => () => setTouched((t) => ({ ...t, [field]: true }))
  const noteLength = draft.note.trim().length

  const onSubmit = async (event) => {
    event.preventDefault()
    if (sending) return
    const first = ['name', 'email', 'note'].find((f) => problems[f])
    if (first) {
      setShowAll(true)
      refs[first].current?.focus()
      return
    }
    setSending(true)
    setError(null)
    try {
      const booking = await bookCall({
        start: new Date(slot).toISOString(),
        name: draft.name.trim(),
        email: draft.email.trim(),
        note: draft.note.trim(),
        timeZone: zone,
        website: draft.website,
      })
      onBooked({ ...booking, email: draft.email.trim() })
    } catch (err) {
      setSending(false)
      if (err?.code === 'slot_taken' || err?.fields?.includes('start')) return onTaken()
      if (err?.code === 'invalid' && err.fields?.length) {
        setServerFields(err.fields)
        refs[err.fields.find((f) => refs[f])]?.current?.focus()
        return
      }
      setError(SEND_ERRORS[err?.code] || 'Couldn’t reach my calendar. Try again in a moment.')
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex min-w-0 flex-col gap-6">
      <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-[20px] font-medium tracking-[-0.01em] text-ink-strong outline-none">
        Your details
      </h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="book-name" label="Name" error={fieldError('name')}>
          <input
            id="book-name"
            ref={refs.name}
            type="text"
            autoComplete="name"
            maxLength={BOOKING_LIMITS.name.max}
            value={draft.name}
            onChange={set('name')}
            onBlur={touch('name')}
            aria-invalid={Boolean(fieldError('name')) || undefined}
            aria-describedby={fieldError('name') ? 'book-name-error' : undefined}
            className={inputClass(fieldError('name'))}
          />
        </Field>
        <Field id="book-email" label="Email" error={fieldError('email')}>
          <input
            id="book-email"
            ref={refs.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={BOOKING_LIMITS.email.max}
            value={draft.email}
            onChange={set('email')}
            onBlur={touch('email')}
            aria-invalid={Boolean(fieldError('email')) || undefined}
            aria-describedby={fieldError('email') ? 'book-email-error' : undefined}
            className={inputClass(fieldError('email'))}
          />
        </Field>
      </div>

      <Field
        id="book-note"
        label="What’s it about?"
        hint="optional"
        counter={noteLength > BOOKING_LIMITS.note.max * 0.8 ? { text: `${noteLength}/${BOOKING_LIMITS.note.max}`, over: noteLength > BOOKING_LIMITS.note.max } : null}
        error={fieldError('note')}
      >
        <textarea
          id="book-note"
          ref={refs.note}
          rows={4}
          value={draft.note}
          onChange={set('note')}
          onBlur={touch('note')}
          placeholder="A project, a question, a link to look at first…"
          aria-invalid={Boolean(fieldError('note')) || undefined}
          aria-describedby={fieldError('note') ? 'book-note-error' : undefined}
          className={`${inputClass(fieldError('note'))} min-h-[110px] resize-y leading-relaxed`}
        />
      </Field>

      <div aria-hidden="true" className="absolute -start-[9999px] top-0 h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={draft.website} onChange={set('website')} />
        </label>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button type="submit" disabled={sending} className={CTA}>
          <span>{sending ? 'Booking…' : 'Book the call'}</span>
          {!sending && (
            <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          )}
        </button>
        <p className="max-w-[44ch] text-[11.5px] leading-relaxed text-ink-faint">
          You’ll get a calendar invite by email. Your email is only used for that.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[12.5px] text-red-500">
          {error}
        </p>
      )}
    </form>
  )
}

function saveIcs(ics) {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'call-with-blxr.ics'
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function Booked({ booking, video, zone, twelve, headingRef }) {
  const start = Date.parse(booking.start)
  const end = Date.parse(booking.end)
  return (
    <div className="flex flex-col items-start gap-6 animate-rise-in">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
        <Icon name="check" className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-24 font-watom text-[32px] leading-[1.1] tracking-[-0.02em] text-ink-strong outline-none sm:text-[40px]">
          You’re booked.
        </h2>
        <p className="mt-4 text-[15px] text-ink-strong">
          {formatDay(dateKey(start, zone))} · <span className="tabular-nums">{formatTime(start, zone, twelve)} – {formatTime(end, zone, twelve)}</span>
        </p>
        <p className="mt-1 text-[12.5px] text-ink-subtle">{formatZone(zone, start)}</p>
      </div>
      <p className="max-w-[56ch] text-[13.5px] leading-relaxed text-ink-muted">
        {booking.emailed ? (
          <>
            A calendar invite is on its way to <span className="text-ink-strong">{booking.email}</span>. Open it to add the call to your calendar.
          </>
        ) : (
          'Add it to your calendar below so it doesn’t slip.'
        )}{' '}
        {booking.video ? 'The link to join is in the invite too.' : 'I’ll email you the link to join before we talk.'} If something comes up, just email me.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {booking.video && (
          <a href={booking.video} target="_blank" rel="noopener noreferrer" className={CTA}>
            <span>Join on {video}</span>
            <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
              ↗
            </span>
          </a>
        )}
        {booking.ics && (
          <button type="button" onClick={() => saveIcs(booking.ics)} className={booking.video ? GHOST : CTA}>
            <Icon name="calendar" className="h-[14px] w-[14px]" />
            Add to calendar
          </button>
        )}
        <a {...link(HOME_PATH)} className={GHOST}>
          Back to home
        </a>
      </div>
    </div>
  )
}

export default function BookPage({ theme, onToggleTheme }) {
  const [load, setLoad] = useState({ state: 'loading' })
  const [reload, setReload] = useState(0)
  const [zone, setZone] = useState(null)
  const [twelve, setTwelve] = useState(false)
  const [day, setDay] = useState(null)
  const [month, setMonth] = useState(null)
  const [slot, setSlot] = useState(null)
  const [step, setStep] = useState('pick')
  const [notice, setNotice] = useState(null)
  const [booking, setBooking] = useState(null)
  const headingRef = useRef(null)

  useEffect(() => {
    const ctrl = new AbortController()
    let retry = 0
    fetchBookingSlots({ signal: ctrl.signal })
      .then((data) => {
        setLoad({ state: 'ready', ...data })
        setZone((z) => z || visitorTimeZone())
        setTwelve(prefersTwelveHour())
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        if (err?.code === 'warming' && reload < 6) {
          retry = setTimeout(() => setReload((n) => n + 1), Math.min(10, err.retryAfter || 5) * 1000)
          return
        }
        setLoad({ state: 'error', code: err?.code || 'failed' })
      })
    return () => {
      ctrl.abort()
      clearTimeout(retry)
    }
  }, [reload])

  useEffect(() => {
    if (step !== 'pick') headingRef.current?.focus()
  }, [step])

  const days = useMemo(() => (load.state === 'ready' && zone ? groupByDay(load.slots, zone) : new Map()), [load, zone])
  const keys = useMemo(() => [...days.keys()].sort(), [days])
  const activeDay = days.has(day) ? day : keys[0] || null
  const firstMonth = keys.length ? monthOf(keys[0]) : null
  const lastMonth = keys.length ? monthOf(keys[keys.length - 1]) : null
  const activeMonth = month && month >= firstMonth && month <= lastMonth ? month : activeDay ? monthOf(activeDay) : null
  const today = zone ? dateKey(Date.now(), zone) : null
  const ready = load.state === 'ready' && zone

  const changeMonth = (next) => {
    setMonth(next)
    const first = keys.find((k) => monthOf(k) === next)
    if (first) setDay(first)
  }

  const pick = (ms) => {
    setSlot(ms)
    setNotice(null)
    setStep('details')
  }

  const taken = () => {
    setSlot(null)
    setStep('pick')
    setNotice('Someone just took that time. Pick another one.')
    setReload((n) => n + 1)
  }

  const booked = (made) => {
    setBooking(made)
    setStep('done')
  }

  let body
  if (step === 'done' && booking) {
    body = <Booked booking={booking} video={load.video} zone={zone} twelve={twelve} headingRef={headingRef} />
  } else if (load.state === 'error') {
    body =
      load.code === 'booking_disabled' ? (
        <Message title="Booking isn’t open right now.">
          Email me at <EmailLink /> and we’ll find a time that works.
        </Message>
      ) : (
        <Message
          title="Couldn’t load my calendar."
          action={
            <button
              type="button"
              className={GHOST}
              onClick={() => {
                setLoad({ state: 'loading' })
                setReload((n) => n + 1)
              }}
            >
              <Icon name="refresh" className="h-[14px] w-[14px]" />
              Try again
            </button>
          }
        >
          Something went wrong on the way to my calendar. Try again, or email me at <EmailLink />.
        </Message>
      )
  } else if (!ready) {
    body = <PickerSkeleton />
  } else if (!keys.length) {
    body = (
      <Message title={`Nothing free in the next ${load.days || 'few'} days.`}>
        My calendar’s full for now. Email me at <EmailLink /> and we’ll find a time.
      </Message>
    )
  } else if (step === 'details' && slot) {
    body = (
      <div className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)] md:gap-14">
        <Summary slot={slot} minutes={load.minutes} video={load.video} zone={zone} ownerZone={load.timeZone} twelve={twelve} onChange={() => setStep('pick')} />
        <DetailsForm slot={slot} zone={zone} onBooked={booked} onTaken={taken} headingRef={headingRef} />
      </div>
    )
  } else {
    body = (
      <div className="flex flex-col gap-8">
        {notice && (
          <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-[12.5px] text-amber-500">
            {notice}
          </p>
        )}
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_200px] md:gap-12">
          <Calendar
            month={activeMonth}
            onMonth={changeMonth}
            firstMonth={firstMonth}
            lastMonth={lastMonth}
            days={days}
            selected={activeDay}
            today={today}
            onSelect={setDay}
          />
          <Times day={activeDay} times={days.get(activeDay) || []} zone={zone} twelve={twelve} minutes={load.minutes} onPick={pick} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-x border-dashed border-line top-0 flex items-center px-6 sm:px-10">
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
            <ThemeToggle theme={theme} onToggle={onToggleTheme} className="text-ink-muted hover:text-ink-strong transition-colors duration-200" />
          </div>
        </div>
      </header>

      <main className="w-full max-w-[960px] mx-auto flex flex-col min-h-screen pt-14 border-x border-dashed border-line bg-bg">
        <section className="px-6 pt-16 pb-12 sm:px-10 sm:pt-24 animate-rise-in">
          <p className={KICKER}>/ book</p>
          <h1 className="mt-6 font-watom text-[44px] leading-[1.05] tracking-[-0.02em] text-ink-strong sm:text-[64px]">Book a call.</h1>
          <p className="mt-6 max-w-120 text-[15px] leading-[1.6] text-ink-muted">
            A project, a question, or just to say hi. The times below come straight from my calendar, so anything you can pick is actually free.
          </p>
          <div className="mt-8 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-ink-subtle">
            {ready && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="clock" className="h-[14px] w-[14px]" />
                  {minutesLabel(load.minutes)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="monitor" className="h-[14px] w-[14px]" />
                  {load.video}
                </span>
                <span aria-hidden="true">·</span>
                <ZonePicker zone={zone} onChange={setZone} />
              </>
            )}
          </div>
        </section>

        <section aria-label="Pick a time" className="border-t border-dashed border-line px-6 py-12 sm:px-10 sm:py-14">
          {body}
        </section>

        <footer className="mt-auto px-6 pb-10 pt-16 sm:px-10">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(CONTACT_PATH)} className={FOOT_LINK}>
              <span>Rather email? Contact</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a {...link(REVIEWS_PATH)} className={FOOT_LINK}>
              <span>Reviews</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a {...link(PAYMENT_PATH)} className={FOOT_LINK}>
              <span>Payment</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
