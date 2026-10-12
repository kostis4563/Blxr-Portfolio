import { useEffect, useMemo, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { Bone, Spinner } from './components/skeleton'
import { link, HOME_PATH, CONTACT_PATH, REVIEWS_PATH, PAYMENT_PATH } from './lib/router'
import { CONTACT_EMAIL } from './lib/profile'
import { imageProps, SIZES } from './lib/images'
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
  formatWeekday,
  formatTime,
  formatZone,
  bookingProblems,
} from './lib/booking'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50'
const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'
const CARD =
  'grid overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_var(--shadow-cast-soft),0_24px_48px_-28px_var(--shadow-cast)] md:grid-cols-[minmax(0,1fr)_216px] lg:grid-cols-[256px_minmax(0,1fr)_216px]'
const PANEL = 'min-w-0 p-5 sm:p-6'
const PRIMARY =
  'group inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-ink-strong px-4 text-[13.5px] font-semibold text-ink-inverse outline-none transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100'
const SECONDARY =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-[13.5px] font-medium text-ink-secondary outline-none transition-[color,border-color,background-color,transform] duration-150 hover:border-line-strong hover:bg-surface-raised hover:text-ink-strong active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ink-strong/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100'
const NAV_BUTTON = `flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-line text-ink-muted transition-[color,border-color,background-color] duration-150 hover:border-line-strong hover:bg-surface-raised hover:text-ink-strong disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:bg-transparent disabled:hover:text-ink-muted ${FOCUS}`
const TIME_BUTTON =
  'flex h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-[13.5px] font-medium tabular-nums text-ink-strong outline-none transition-[border-color,background-color,transform] duration-150 hover:border-ink-subtle hover:bg-surface-raised active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-strong/50'

const inputClass = (invalid) =>
  `w-full rounded-lg border bg-surface-raised px-3 text-[14px] text-ink-strong placeholder:text-ink-faint outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:bg-surface focus:ring-4 ${
    invalid ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/10' : 'border-line hover:border-line-strong focus:border-ink-subtle focus:ring-ink-strong/[0.07]'
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
    <a href={`mailto:${CONTACT_EMAIL}`} className={`rounded-sm font-medium text-ink-strong underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink-strong ${FOCUS}`}>
      {CONTACT_EMAIL}
    </a>
  )
}

function Field({ id, label, hint, counter, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-secondary">
          {label}
        </label>
        {counter ? (
          <span className={`font-mono text-[11px] tabular-nums ${counter.over ? 'text-red-500' : 'text-ink-faint'}`}>{counter.text}</span>
        ) : (
          hint && <span className="text-[12px] text-ink-faint">{hint}</span>
        )}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-[12.5px] text-red-500">
          <Icon name="alert" className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  )
}

function ZonePicker({ zone, onChange }) {
  const zones = useMemo(() => timeZoneList(zone), [zone])
  return (
    <span className="relative flex h-9 w-full items-center gap-2 md:max-w-xs lg:max-w-none rounded-lg border border-line bg-surface-raised px-3 text-[13px] text-ink-secondary transition-colors duration-150 focus-within:border-line-strong focus-within:ring-2 focus-within:ring-ink-strong/20 hover:border-line-strong hover:text-ink-strong">
      <Icon name="globe" className="h-4 w-4 text-ink-subtle" />
      <span className="min-w-0 flex-1 truncate">{formatZone(zone)}</span>
      <Icon name="chevronsUpDown" className="h-3.5 w-3.5 text-ink-subtle" />
      <select
        aria-label="Time zone"
        value={zone}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full cursor-pointer opacity-0"
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

function Meta({ icon, children }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon name={icon} className="mt-px h-4 w-4 text-ink-subtle" />
      <div className="min-w-0">{children}</div>
    </li>
  )
}

function Host({ load, zone, onZone, slot, twelve }) {
  const ready = load.state === 'ready' && zone
  const differentClock = Boolean(slot && ready && formatTime(slot, zone) !== formatTime(slot, load.timeZone))

  return (
    <aside aria-label="About this call" className={`${PANEL} flex flex-col gap-6 border-b border-line md:col-span-2 lg:col-span-1 lg:border-b-0 lg:border-e`}>
      <div className="flex items-center gap-3">
        <img
          {...imageProps('/pfp.webp', SIZES.avatar)}
          alt=""
          width="40"
          height="40"
          draggable="false"
          className="h-10 w-10 shrink-0 select-none rounded-[11px] object-cover"
        />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold leading-tight text-ink-strong">Blxr</p>
          <p className="mt-0.5 text-[12px] leading-tight text-ink-subtle">Athens, Greece</p>
        </div>
      </div>

      <div>
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink-strong">Book a call</h1>
        <p className="mt-2.5 max-w-[60ch] text-pretty text-[13.5px] leading-[1.6] text-ink-muted">
          A project, a question, or just to say hi. The times come straight from my calendar, so anything you can pick is actually free.
        </p>
      </div>

      {ready ? (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3 text-[13px] text-ink-secondary">
            {slot && (
              <Meta icon="calendar">
                <p className="font-medium text-ink-strong">{formatDay(dateKey(slot, zone))}</p>
                <p className="mt-0.5 tabular-nums">
                  {formatTime(slot, zone, twelve)} – {formatTime(slot + load.minutes * 60_000, zone, twelve)}
                </p>
              </Meta>
            )}
            <Meta icon="clock">{minutesLabel(load.minutes)}</Meta>
            <Meta icon="monitor">{load.video}</Meta>
            {slot && <Meta icon="globe">{formatZone(zone, slot)}</Meta>}
          </ul>
          {!slot && <ZonePicker zone={zone} onChange={onZone} />}
          {differentClock && (
            <p className="text-[12px] leading-relaxed text-ink-subtle">
              That’s {formatTime(slot, load.timeZone, twelve)} for me in {formatZone(load.timeZone, slot).split(' (')[0]}.
            </p>
          )}
        </div>
      ) : (
        load.state !== 'error' && (
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Bone className="h-4 w-20" />
            <Bone className="h-4 w-28" />
            <Bone className="mt-1 h-9 w-full rounded-lg" />
          </div>
        )
      )}
    </aside>
  )
}

function Calendar({ month, onMonth, firstMonth, lastMonth, days, selected, today, onSelect }) {
  const label = formatMonth(month)
  const cut = label.lastIndexOf(' ')

  return (
    <div className={`${PANEL} animate-view-in`}>
      <div className="mb-5 flex h-8 items-center justify-between gap-3">
        <h2 aria-live="polite" className="text-[14px] font-semibold text-ink-strong">
          {label.slice(0, cut)} <span className="font-normal text-ink-subtle">{label.slice(cut + 1)}</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Previous month" disabled={month <= firstMonth} onClick={() => onMonth(shiftMonth(month, -1))} className={NAV_BUTTON}>
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next month" disabled={month >= lastMonth} onClick={() => onMonth(shiftMonth(month, 1))} className={NAV_BUTTON}>
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div role="group" aria-label={label} className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((name) => (
          <span key={name} aria-hidden="true" className="pb-2 text-[11.5px] font-medium text-ink-subtle">
            {name}
          </span>
        ))}
        {monthGrid(month).map((key, i) => {
          if (!key) return <span key={`pad-${i}`} aria-hidden="true" />
          const count = days.get(key)?.length || 0
          const active = key === selected
          return (
            <button
              key={key}
              type="button"
              disabled={!count}
              aria-pressed={active}
              aria-label={`${formatDay(key)}${count ? `, ${count} ${count === 1 ? 'time' : 'times'} free` : ', nothing free'}`}
              onClick={() => onSelect(key)}
              className={`relative flex h-10 items-center justify-center rounded-lg text-[13.5px] tabular-nums transition-[background-color,color,transform] duration-150 sm:h-12 ${FOCUS} ${
                active
                  ? 'bg-ink-strong font-semibold text-ink-inverse'
                  : count
                    ? 'cursor-pointer bg-surface-hover/80 font-semibold text-ink-strong hover:bg-surface-hover-strong active:scale-95'
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

function HourToggle({ twelve, onChange }) {
  return (
    <div role="group" aria-label="Time format" className="inline-flex shrink-0 rounded-lg border border-line bg-surface-raised p-0.5">
      {[
        ['12h', true],
        ['24h', false],
      ].map(([label, value]) => (
        <button
          key={label}
          type="button"
          aria-pressed={twelve === value}
          onClick={() => onChange(value)}
          className={`h-6 cursor-pointer rounded-md px-2 text-[11.5px] font-medium tabular-nums transition-colors duration-150 ${FOCUS} ${
            twelve === value ? 'bg-surface-hover-strong text-ink-strong' : 'text-ink-subtle hover:text-ink-strong'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Times({ day, times, zone, twelve, onTwelve, onPick }) {
  return (
    <div className={`${PANEL} flex animate-view-in flex-col border-t border-line md:border-t-0 md:border-s`}>
      <div className="mb-5 flex h-8 items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-ink-strong">
          <span aria-hidden="true">
            {formatWeekday(day)} <span className="font-normal tabular-nums text-ink-subtle">{Number(day.slice(8))}</span>
          </span>
          <span className="sr-only">{formatDay(day)}</span>
        </h2>
        <HourToggle twelve={twelve} onChange={onTwelve} />
      </div>
      <div className="relative md:min-h-0 md:flex-1">
        <ul
          key={day}
          className="grid grid-cols-3 gap-2 animate-rise-in scrollbar-thin sm:grid-cols-4 md:absolute md:inset-0 md:grid-cols-1 md:content-start md:overflow-y-auto md:pb-8 md:mask-[linear-gradient(to_bottom,#000_calc(100%-32px),transparent)]"
        >
          {times.map((ms) => (
            <li key={ms}>
              <button type="button" onClick={() => onPick(ms)} className={TIME_BUTTON}>
                {formatTime(ms, zone, twelve)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function PickerSkeleton() {
  return (
    <>
      <div aria-busy="true" aria-label="Loading free times" className={PANEL}>
        <div className="mb-5 flex h-8 items-center justify-between">
          <Bone className="h-4 w-28" />
          <Bone className="h-8 w-[70px] rounded-lg" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <Bone key={`w-${i}`} className="mx-auto mb-2 h-3 w-6" />
          ))}
          {Array.from({ length: 35 }, (_, i) => (
            <Bone key={i} className="h-10 rounded-lg sm:h-12" />
          ))}
        </div>
      </div>
      <div aria-hidden="true" className={`${PANEL} flex flex-col gap-2 border-t border-line md:border-t-0 md:border-s`}>
        <div className="mb-3 flex h-8 items-center justify-between">
          <Bone className="h-4 w-14" />
          <Bone className="h-7 w-[78px] rounded-lg" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <Bone key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </>
  )
}

function Message({ icon, title, children, action }) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center px-6 py-14 text-center animate-view-in md:col-span-2">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-raised text-ink-muted">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="mt-5 text-[15px] font-semibold text-ink-strong">{title}</p>
      <p className="mt-1.5 max-w-[42ch] text-pretty text-[13.5px] leading-relaxed text-ink-muted">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

function DetailsForm({ slot, zone, onBooked, onTaken, onBack, headingRef }) {
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
    <form onSubmit={onSubmit} noValidate className={`${PANEL} relative flex animate-view-in flex-col md:col-span-2`}>
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-[17px] font-semibold tracking-[-0.01em] text-ink-strong outline-none">
          Your details
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted">The calendar invite goes to your email. It’s only used for that.</p>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
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
            className={`${inputClass(fieldError('name'))} h-10`}
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
            placeholder="you@company.com"
            aria-invalid={Boolean(fieldError('email')) || undefined}
            aria-describedby={fieldError('email') ? 'book-email-error' : undefined}
            className={`${inputClass(fieldError('email'))} h-10`}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field
          id="book-note"
          label="What’s it about?"
          hint="Optional"
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
            className={`${inputClass(fieldError('note'))} min-h-[112px] resize-y py-2.5 leading-relaxed`}
          />
        </Field>
      </div>

      <div aria-hidden="true" className="absolute -start-[9999px] top-0 h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={draft.website} onChange={set('website')} />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3.5 py-3 text-[13px] text-red-500">
          <Icon name="alert" className="mt-px h-4 w-4" />
          {error}
        </p>
      )}

      <div className="mt-auto pt-8">
        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onBack} disabled={sending} className={SECONDARY}>
            <Icon name="arrowLeft" className="h-4 w-4" />
            Back
          </button>
          <button type="submit" disabled={sending} className={PRIMARY}>
            {sending ? (
              <>
                <Spinner className="h-4 w-4" />
                Booking…
              </>
            ) : (
              <>
                Confirm booking
                <Icon name="arrowRight" className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </div>
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

function Detail({ label, children }) {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-4 px-4 py-3.5 sm:grid-cols-[88px_minmax(0,1fr)] sm:px-5">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-ink-strong">{children}</dd>
    </div>
  )
}

function Booked({ booking, video, zone, twelve, headingRef }) {
  const start = Date.parse(booking.start)
  const end = Date.parse(booking.end)
  const minutes = Math.round((end - start) / 60_000)

  return (
    <div className="col-span-full flex flex-col items-center px-5 py-12 text-center animate-rise-in sm:px-10 sm:py-16">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/25">
        <Icon name="check" className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <h1 ref={headingRef} tabIndex={-1} className="mt-5 scroll-mt-24 text-[26px] font-semibold tracking-[-0.02em] text-ink-strong outline-none">
        You’re booked
      </h1>
      <p className="mt-2 max-w-[48ch] text-pretty text-[14px] leading-relaxed text-ink-muted">
        {booking.emailed ? (
          <>
            A calendar invite is on its way to <span className="font-medium text-ink-strong">{booking.email}</span>.
          </>
        ) : (
          'Add it to your calendar below so it doesn’t slip.'
        )}
      </p>

      <dl className="mt-8 w-full max-w-[480px] divide-y divide-line rounded-xl border border-line bg-surface-raised/50 text-start text-[13.5px]">
        <Detail label="What">{minutesLabel(minutes)} call with Blxr</Detail>
        <Detail label="When">
          <p>{formatDay(dateKey(start, zone))}</p>
          <p className="mt-0.5 tabular-nums text-ink-muted">
            {formatTime(start, zone, twelve)} – {formatTime(end, zone, twelve)} · {formatZone(zone, start)}
          </p>
        </Detail>
        <Detail label="Where">
          {booking.video ? (
            <a
              href={booking.video}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 rounded-sm underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink-strong ${FOCUS}`}
            >
              {video}
              <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
            </a>
          ) : (
            <>
              <p>{video}</p>
              <p className="mt-0.5 text-ink-muted">I’ll email you the link before we talk.</p>
            </>
          )}
        </Detail>
        <Detail label="Who">
          <p>
            Blxr <span className="text-ink-subtle">· host</span>
          </p>
          <p className="mt-0.5 text-ink-muted">{booking.email}</p>
        </Detail>
      </dl>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {booking.video && (
          <a href={booking.video} target="_blank" rel="noopener noreferrer" className={PRIMARY}>
            Join on {video}
            <Icon name="arrowUpRight" className="h-4 w-4 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px" />
          </a>
        )}
        {booking.ics && (
          <button type="button" onClick={() => saveIcs(booking.ics)} className={booking.video ? SECONDARY : PRIMARY}>
            <Icon name="calendar" className="h-4 w-4" />
            Add to calendar
          </button>
        )}
        <a {...link(HOME_PATH)} className={SECONDARY}>
          Back to home
        </a>
      </div>

      <p className="mt-6 text-[12.5px] text-ink-subtle">
        Something came up? Email me at <EmailLink />.
      </p>
    </div>
  )
}

export default function BookPage({ theme, onToggleTheme }) {
  const [load, setLoad] = useState({ state: 'loading' })
  const [reload, setReload] = useState(0)
  const [zone, setZone] = useState(null)
  const [twelve, setTwelve] = useState(null)
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
        setTwelve((t) => t ?? prefersTwelveHour())
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
  const choosing = step === 'details' && slot

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

  let panels
  if (load.state === 'error') {
    panels =
      load.code === 'booking_disabled' ? (
        <Message icon="calendar" title="Booking isn’t open right now">
          Email me at <EmailLink /> and we’ll find a time that works.
        </Message>
      ) : (
        <Message
          icon="alert"
          title="Couldn’t load my calendar"
          action={
            <button
              type="button"
              className={SECONDARY}
              onClick={() => {
                setLoad({ state: 'loading' })
                setReload((n) => n + 1)
              }}
            >
              <Icon name="refresh" className="h-4 w-4" />
              Try again
            </button>
          }
        >
          Something went wrong on the way to my calendar. Try again, or email me at <EmailLink />.
        </Message>
      )
  } else if (!ready) {
    panels = <PickerSkeleton />
  } else if (!keys.length) {
    panels = (
      <Message icon="calendar" title={`Nothing free in the next ${load.days || 'few'} days`}>
        My calendar’s full for now. Email me at <EmailLink /> and we’ll find a time.
      </Message>
    )
  } else if (choosing) {
    panels = <DetailsForm slot={slot} zone={zone} onBooked={booked} onTaken={taken} onBack={() => setStep('pick')} headingRef={headingRef} />
  } else {
    panels = (
      <>
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
        <Times day={activeDay} times={days.get(activeDay) || []} zone={zone} twelve={twelve} onTwelve={setTwelve} onPick={pick} />
      </>
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
        <section aria-label="Book a call" className="px-4 pt-10 pb-4 sm:px-10 sm:pt-16 animate-rise-in">
          <p className={`${KICKER} mb-6`}>/ book</p>

          {notice && (
            <p role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3.5 py-3 text-[13px] text-amber-500">
              <Icon name="info" className="h-4 w-4" />
              {notice}
            </p>
          )}

          <div className={CARD}>
            {step === 'done' && booking ? (
              <Booked booking={booking} video={load.video} zone={zone} twelve={twelve} headingRef={headingRef} />
            ) : (
              <>
                <Host load={load} zone={zone} onZone={setZone} slot={choosing ? slot : null} twelve={twelve} />
                {panels}
              </>
            )}
          </div>

          {step === 'pick' && ready && keys.length > 0 && (
            <p className="mt-5 text-center text-[12.5px] text-ink-subtle">
              No time that works? Email me at <EmailLink /> and we’ll find one.
            </p>
          )}
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
