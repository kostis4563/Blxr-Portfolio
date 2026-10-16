import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { Icon } from './components/icon'
import { Bone, Spinner } from './components/skeleton'
import { BookIsland, DoneMark, HostClock, NoteStack, PlaceIcon } from './components/book-touches'
import { CALL_PLACES, CALL_MODES, CALL_LANGS, CALL_TOPICS, CALL_BUDGETS, CALL_TIMELINES, placeById, labelOf } from './lib/call-options'
import { link, HOME_PATH } from './lib/router'
import { CONTACT_EMAIL } from './lib/profile'
import { imageProps, SIZES } from './lib/images'
import { fetchBookingSlots, bookCall } from './lib/api'
import { reducedMotion } from './lib/memes'
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
  emailTypo,
  daysUntil,
  fullShortDay,
  whenWord,
  dayPhrase,
  EVENT_TITLE,
  calendarIcs,
  icsUid,
  icsFileName,
  googleCalendarUrl,
  outlookCalendarUrl,
} from './lib/booking'

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
const SHADOW = 'shadow-[0_1px_2px_var(--shadow-cast-soft),0_16px_48px_-16px_var(--shadow-cast)]'
const CARD = `grid w-full overflow-hidden rounded-2xl border border-line bg-surface ${SHADOW} md:grid-cols-[minmax(0,1fr)_240px] lg:grid-cols-[280px_minmax(0,1fr)_248px]`
const DONE_CARD = `w-full overflow-hidden rounded-2xl border border-line bg-surface ${SHADOW}`
const PANEL = 'min-w-0 p-5 sm:p-6'
const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg text-[14px] font-medium outline-none transition-[background-color,border-color,color,opacity,transform] duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ink-strong/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50'
const INVERT = 'bg-ink-strong text-ink-inverse hover:opacity-90'
const PRIMARY = `${BASE} h-10 px-4 ${INVERT}`
const OUTLINE = `${BASE} h-10 px-4 border border-line-strong bg-surface text-ink-strong hover:bg-surface-hover`
const GHOST = `${BASE} h-10 px-3.5 text-ink-muted hover:bg-surface-hover hover:text-ink-strong`
const NEXT = `${BASE} h-11 ${INVERT}`
const ICON_BUTTON = `flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink-strong disabled:pointer-events-none disabled:opacity-30 ${FOCUS}`
const SLOT =
  'flex h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-line-strong bg-surface text-[14px] font-medium tabular-nums text-ink-strong outline-none transition-[border-color,transform] duration-150 hover:border-ink-strong focus-visible:border-ink-strong focus-visible:ring-1 focus-visible:ring-ink-strong active:scale-[0.98]'
const TEXT_LINK = `rounded-sm font-medium text-ink-strong underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink-strong ${FOCUS}`

const inputClass = (invalid) =>
  `w-full rounded-lg border bg-surface px-3 text-[14px] text-ink-strong placeholder:text-ink-faint outline-none transition-[border-color,box-shadow] duration-150 focus:ring-[3px] ${
    invalid ? 'border-red-500/70 focus:ring-red-500/15' : 'border-line-strong hover:border-ink-faint focus:border-ink-strong focus:ring-ink-strong/10'
  }`

const EMPTY_DRAFT = {
  name: '',
  email: '',
  company: '',
  link: '',
  place: null,
  reach: { link: '', phone: '', handle: '', place: '' },
  mode: 'video',
  lang: 'en',
  topic: null,
  budget: null,
  timeline: null,
  note: '',
  website: '',
}

const FIELD_ORDER = ['name', 'email', 'company', 'link', 'contact', 'note']

const REACH = {
  meet: { help: (mine) => (mine ? 'Leave it empty and you’ll get my link in the invite.' : 'Leave it empty and I’ll send you a link by email.') },
  discord: { label: 'Discord username', placeholder: 'username', help: 'I’ll add you a few minutes before and call you there.' },
  whatsapp: { label: 'WhatsApp number', placeholder: '+44 7700 900123', type: 'tel', help: 'Include the country code. I’ll call you on WhatsApp.' },
  phone: { label: 'Phone number', placeholder: '+44 7700 900123', type: 'tel', help: 'Include the country code. I’ll ring you, voice only.' },
  other: { label: 'Where should we meet?', placeholder: 'Slack huddle, Telegram, a café in Athens…', help: 'I’ll confirm the details by email.' },
}

const reachKind = (place) => (place === 'facetime' ? null : placeById(place)?.contact || null)

const planOf = (draft, hostPlace) => {
  const place = draft.place || hostPlace || 'facetime'
  return { place, mode: place === 'phone' ? 'voice' : draft.mode, lang: draft.lang }
}

const SEND_ERRORS = {
  rate_limited: 'You’ve booked a few calls already today. Email me if you need another one.',
  booking_disabled: 'Booking just went offline. Email me instead and we’ll find a time.',
  booking_paused: 'Booking just closed for now. Email me instead and we’ll find a time.',
  offline: 'You look offline. Check your connection and try again.',
}

const SERVER_FIELD_ERRORS = {
  name: 'Just your name, no links.',
  email: 'That email doesn’t look right.',
  note: `Keep it under ${BOOKING_LIMITS.note.max} characters.`,
  contact: 'Check this and try again.',
  company: 'Keep it shorter.',
  link: 'That link doesn’t look right.',
}

const MOD_KEY = typeof navigator !== 'undefined' && !/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'Ctrl' : '⌘'
const DEFAULT_APP = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) ? 'google' : 'apple'

const minutesLabel = (minutes) => (minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`)

function MailLink({ children = 'Email me' }) {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={TEXT_LINK}>
      {children}
    </a>
  )
}

function Field({ id, label, optional, counter, help, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-strong">
          {label}
        </label>
        {counter ? (
          <span className={`text-[12px] tabular-nums ${counter.over ? 'text-red-500' : 'text-ink-subtle'}`}>{counter.text}</span>
        ) : (
          optional && <span className="text-[12px] text-ink-subtle">Optional</span>
        )}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12.5px] text-red-500">
          {error}
        </p>
      ) : (
        help && (
          <p id={`${id}-help`} className="text-[12.5px] text-ink-subtle">
            {help}
          </p>
        )
      )}
    </div>
  )
}

function ZonePicker({ zone, onChange }) {
  const zones = useMemo(() => timeZoneList(zone), [zone])
  return (
    <span className="relative inline-flex max-w-full items-center gap-1 rounded-md transition-colors duration-150 focus-within:ring-2 focus-within:ring-ink-strong/30 hover:text-ink-strong">
      <span className="truncate">{formatZone(zone)}</span>
      <Icon name="chevronDown" className="h-3.5 w-3.5 text-ink-subtle" />
      <select aria-label="Time zone" value={zone} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 w-full cursor-pointer opacity-0">
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </span>
  )
}

function Meta({ icon, glyph, children }) {
  return (
    <li className="flex items-start gap-3">
      {glyph || <Icon name={icon} className="mt-0.5 h-4 w-4 text-ink-subtle" />}
      <div className="min-w-0">{children}</div>
    </li>
  )
}

function Host({ load, zone, onZone, slot, twelve, plan }) {
  const ready = load.state === 'ready' && zone
  const differentClock = Boolean(slot && ready && formatTime(slot, zone) !== formatTime(slot, load.timeZone))

  return (
    <aside aria-label="Call details" className={`${PANEL} flex flex-col gap-5 border-b border-line md:col-span-2 lg:col-span-1 lg:border-b-0 lg:border-e`}>
      <img
        {...imageProps('/pfp.webp', SIZES.avatar)}
        alt=""
        width="36"
        height="36"
        draggable="false"
        className="h-9 w-9 select-none rounded-full object-cover"
      />
      <div>
        <p className="text-[14px] font-medium text-ink-muted">Kostis</p>
        <h1 className="mt-1 text-[22px] font-semibold leading-snug tracking-[-0.02em] text-ink-strong">Book a call</h1>
        <p className="mt-3 max-w-[52ch] text-pretty text-[14px] leading-relaxed text-ink-muted">
          A short call to talk through a project, an idea or a question, on whatever app suits you. Times are synced live with my calendar.
        </p>
      </div>

      {ready ? (
        <ul className="flex flex-col gap-3.5 text-[14px] font-medium text-ink-secondary">
          {slot && (
            <Meta icon="calendar">
              <p className="text-ink-strong">{formatDay(dateKey(slot, zone))}</p>
              <p className="mt-0.5 tabular-nums">
                {formatTime(slot, zone, twelve)} – {formatTime(slot + load.minutes * 60_000, zone, twelve)}
              </p>
            </Meta>
          )}
          <Meta icon="clock">{minutesLabel(load.minutes)}</Meta>
          {plan && (
            <Meta glyph={<PlaceIcon place={plan.place} size="sm" />}>
              <p key={plan.place} className="animate-view-in">
                {placeById(plan.place).label}
                {plan.mode === 'voice' && <span className="text-ink-subtle"> · Voice only</span>}
              </p>
            </Meta>
          )}
          {plan?.lang === 'el' && (
            <Meta icon="message">
              <span lang="el">Στα ελληνικά</span>
            </Meta>
          )}
          <Meta icon="globe">{slot ? formatZone(zone, slot) : <ZonePicker zone={zone} onChange={onZone} />}</Meta>
        </ul>
      ) : (
        load.state !== 'error' && (
          <div aria-hidden="true" className="flex flex-col gap-4">
            <Bone className="h-4 w-20" />
            <Bone className="h-4 w-24" />
            <Bone className="h-4 w-36" />
          </div>
        )
      )}

      {ready && !slot && <HostClock zone={load.timeZone} twelve={twelve} />}

      {differentClock && (
        <p className="text-[12.5px] leading-relaxed text-ink-subtle">
          That’s {formatTime(slot, load.timeZone, twelve)} for me in {formatZone(load.timeZone, slot).split(' (')[0]}.
        </p>
      )}
    </aside>
  )
}

function Calendar({ month, onMonth, firstMonth, lastMonth, days, selected, today, onSelect }) {
  const label = formatMonth(month)
  const cut = label.lastIndexOf(' ')

  return (
    <div className={`${PANEL} animate-view-in`}>
      <div className="mb-4 flex h-8 items-center justify-between gap-3">
        <h2 aria-live="polite" className="text-[15px] font-semibold text-ink-strong">
          {label.slice(0, cut)} <span className="font-normal text-ink-subtle">{label.slice(cut + 1)}</span>
        </h2>
        <div className="-me-1.5 flex items-center gap-0.5">
          <button type="button" aria-label="Previous month" disabled={month <= firstMonth} onClick={() => onMonth(shiftMonth(month, -1))} className={ICON_BUTTON}>
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next month" disabled={month >= lastMonth} onClick={() => onMonth(shiftMonth(month, 1))} className={ICON_BUTTON}>
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div role="group" aria-label={label} className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((name) => (
          <span key={name} aria-hidden="true" className="pb-1.5 text-center text-[11px] font-medium uppercase tracking-[0.06em] text-ink-subtle">
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
              className={`relative flex h-11 items-center justify-center rounded-lg text-[14px] font-medium tabular-nums transition-[background-color,color,box-shadow,transform] duration-150 sm:h-12 ${FOCUS} ${
                active
                  ? 'bg-ink-strong text-ink-inverse'
                  : count
                    ? 'cursor-pointer bg-surface-hover-strong/60 text-ink-strong hover:shadow-[inset_0_0_0_1.5px_var(--color-ink-strong)] active:scale-95'
                    : 'cursor-default text-ink-faint'
              }`}
            >
              {Number(key.slice(8))}
              {key === today && <span aria-hidden="true" className={`absolute bottom-1.5 h-1 w-1 rounded-full ${active ? 'bg-ink-inverse' : 'bg-ink-strong'}`} />}
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
          className={`h-6 cursor-pointer rounded-md px-2 text-[12px] font-medium tabular-nums transition-colors duration-150 ${FOCUS} ${
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
  const [chosen, setChosen] = useState(null)
  const nextRef = useRef(null)

  useEffect(() => {
    if (chosen) nextRef.current?.focus({ preventScroll: true })
  }, [chosen])

  return (
    <div className={`${PANEL} flex animate-view-in flex-col border-t border-line md:border-t-0 md:border-s`}>
      <div className="mb-4 flex h-8 items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink-strong">
          <span aria-hidden="true">
            {formatWeekday(day)} <span className="font-normal tabular-nums text-ink-subtle">{Number(day.slice(8))}</span>
          </span>
          <span className="sr-only">{formatDay(day)}</span>
        </h2>
        <HourToggle twelve={twelve} onChange={onTwelve} />
      </div>
      <div className="relative md:min-h-0 md:flex-1">
        <ul className="grid grid-cols-2 gap-2 scrollbar-thin sm:grid-cols-3 md:absolute md:inset-0 md:-mx-1 md:grid-cols-1 md:content-start md:overflow-y-auto md:px-1 md:pb-8 md:pt-px md:mask-[linear-gradient(to_bottom,#000_calc(100%-32px),transparent)]">
          {times.map((ms) => {
            const label = formatTime(ms, zone, twelve)
            return (
              <li key={ms}>
                {chosen === ms ? (
                  <div className="grid h-11 grid-cols-2 gap-1.5 animate-view-in">
                    <span className="flex items-center justify-center rounded-lg bg-surface-hover-strong text-[14px] font-medium tabular-nums text-ink-strong">{label}</span>
                    <button ref={nextRef} type="button" aria-label={`Continue with ${label}`} onClick={() => onPick(ms)} className={NEXT}>
                      Next
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setChosen(ms)} className={SLOT}>
                    {label}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function PickerSkeleton() {
  return (
    <>
      <div aria-busy="true" aria-label="Loading free times" className={PANEL}>
        <div className="mb-4 flex h-8 items-center justify-between">
          <Bone className="h-4 w-28" />
          <Bone className="h-6 w-14" />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <Bone key={`w-${i}`} className="mx-auto mb-1.5 h-3 w-6" />
          ))}
          {Array.from({ length: 35 }, (_, i) => (
            <Bone key={i} className="h-11 rounded-lg sm:h-12" />
          ))}
        </div>
      </div>
      <div aria-hidden="true" className={`${PANEL} flex flex-col gap-2 border-t border-line md:border-t-0 md:border-s`}>
        <div className="mb-2 flex h-8 items-center justify-between">
          <Bone className="h-4 w-14" />
          <Bone className="h-7 w-[76px] rounded-lg" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <Bone key={i} className="h-11 rounded-lg" />
        ))}
      </div>
    </>
  )
}

function Message({ icon, title, children, action }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-14 text-center animate-view-in md:col-span-2">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-hover-strong/60 text-ink-muted">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="mt-5 text-[15px] font-semibold text-ink-strong">{title}</p>
      <p className="mt-1.5 max-w-[40ch] text-pretty text-[14px] leading-relaxed text-ink-muted">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

function Section({ id, title, note, children }) {
  return (
    <section aria-labelledby={id} className="book-section">
      <div className="book-section-head">
        <h3 id={id}>{title}</h3>
        {note && <span>{note}</span>}
      </div>
      {children}
    </section>
  )
}

function PlacePicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-labelledby="book-where" className="book-places">
      {CALL_PLACES.map((p) => (
        <label key={p.id} className="book-place">
          <input type="radio" name="book-place" value={p.id} checked={value === p.id} onChange={() => onChange(p.id)} className="sr-only" />
          <PlaceIcon place={p.id} />
          <span className="book-place-name">{p.short || p.label}</span>
          <span className="book-place-check">
            <Icon name="check" className="" strokeWidth={3.2} />
          </span>
        </label>
      ))}
    </div>
  )
}

function Segmented({ name, labelledBy, options, value, onChange, off = null }) {
  const index = Math.max(0, options.findIndex((o) => o.id === value))
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="book-seg" style={{ '--i': index, '--n': options.length }}>
      <span className="book-seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <label key={o.id}>
          <input type="radio" name={name} value={o.id} checked={value === o.id} disabled={o.id === off} onChange={() => onChange(o.id)} className="sr-only" />
          <span lang={o.own ? o.id : undefined}>{o.own || o.label}</span>
        </label>
      ))}
    </div>
  )
}

function Chips({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="book-chips">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(value === o.id ? null : o.id)} className="book-chip">
          {o.label}
        </button>
      ))}
    </div>
  )
}

function PlaceReach({ place, hostPlace, value, onChange, onBlur, error, inputRef }) {
  const info = placeById(place)
  const kind = reachKind(place)
  const mine = place === hostPlace
  let body
  if (!kind) {
    body = (
      <div className="book-reach-text">
        <p>{mine ? 'You’ll get my FaceTime link in the invite.' : 'I’ll email you a FaceTime link before we talk.'}</p>
        <p>It opens in Chrome and Edge too, so no Apple device is needed.</p>
      </div>
    )
  } else {
    const copy = kind === 'link' ? { label: `Your ${info.short || info.label} link`, placeholder: info.example, help: REACH.meet.help(mine), optional: true } : REACH[place]
    body = (
      <div className="min-w-0 flex-1">
        <Field id="book-contact" label={copy.label} optional={copy.optional} help={copy.help} error={error}>
          <input
            id="book-contact"
            ref={inputRef}
            type={copy.type || (kind === 'link' ? 'url' : 'text')}
            inputMode={copy.type === 'tel' ? 'tel' : kind === 'link' ? 'url' : undefined}
            autoComplete={copy.type === 'tel' ? 'tel' : 'off'}
            autoCapitalize="off"
            spellCheck="false"
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={copy.placeholder}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? 'book-contact-error' : 'book-contact-help'}
            className={`${inputClass(error)} h-10`}
          />
        </Field>
      </div>
    )
  }
  return (
    <div key={place} className="book-reach animate-view-in">
      <PlaceIcon place={place} size="lg" />
      {body}
    </div>
  )
}

function DetailsForm({ slot, zone, hostPlace, draft, setDraft, onBooked, onTaken, onBack, onSending, headingRef }) {
  const [touched, setTouched] = useState({})
  const [showAll, setShowAll] = useState(false)
  const [serverFields, setServerFields] = useState([])
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const refs = { name: useRef(null), email: useRef(null), company: useRef(null), link: useRef(null), contact: useRef(null), note: useRef(null) }

  const { place, mode } = planOf(draft, hostPlace)
  const kind = reachKind(place)
  const contact = kind ? draft.reach[kind] : ''
  const problems = bookingProblems({ ...draft, place: kind ? place : null, contact })
  const visible = (field) => (showAll || touched[field]) && problems[field]
  const fieldError = (field) => visible(field) || (serverFields.includes(field) ? SERVER_FIELD_ERRORS[field] : null)
  const clearServer = (field) => setServerFields((f) => f.filter((x) => x !== field))
  const put = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }))
    clearServer(field)
  }
  const set = (field) => (e) => put(field, e.target.value)
  const setReach = (e) => {
    const value = e.target.value
    setDraft((d) => ({ ...d, reach: { ...d.reach, [kind]: value } }))
    clearServer('contact')
  }
  const touch = (field) => () => setTouched((t) => ({ ...t, [field]: true }))
  const choosePlace = (id) => {
    put('place', id)
    clearServer('contact')
    setTouched((t) => ({ ...t, contact: false }))
  }
  const noteLength = draft.note.trim().length
  const typo = !fieldError('email') && emailTypo(draft.email)
  const topic = CALL_TOPICS.find((t) => t.id === draft.topic)

  useEffect(() => {
    onSending(sending)
  }, [sending, onSending])
  useEffect(() => () => onSending(false), [onSending])

  const onSubmit = async (event) => {
    event.preventDefault()
    if (sending) return
    const first = FIELD_ORDER.find((f) => problems[f])
    if (first) {
      setShowAll(true)
      refs[first].current?.focus()
      return
    }
    setSending(true)
    setError(null)
    const details = {
      place,
      contact: contact.trim(),
      mode,
      lang: draft.lang,
      topic: draft.topic,
      budget: draft.topic === 'project' ? draft.budget : null,
      timeline: draft.topic === 'project' ? draft.timeline : null,
      company: draft.company.trim(),
      link: draft.link.trim(),
    }
    try {
      const booking = await bookCall({
        start: new Date(slot).toISOString(),
        name: draft.name.trim(),
        email: draft.email.trim(),
        note: draft.note.trim(),
        timeZone: zone,
        website: draft.website,
        ...details,
      })
      onBooked({ ...booking, ...details, name: draft.name.trim(), email: draft.email.trim(), note: draft.note.trim() })
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
    <form
      onSubmit={onSubmit}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return
        e.preventDefault()
        e.currentTarget.requestSubmit()
      }}
      noValidate
      className={`${PANEL} relative flex animate-view-in flex-col md:col-span-2`}
    >
      <div className="book-section-head">
        <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-[15px] font-semibold text-ink-strong outline-none">
          Your details
        </h2>
        <span>Optional bits help me prepare</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
        <Field
          id="book-email"
          label="Email"
          help={
            typo ? (
              <>
                Did you mean{' '}
                <button type="button" onClick={() => setDraft((d) => ({ ...d, email: typo }))} className={`cursor-pointer ${TEXT_LINK}`}>
                  {typo}
                </button>
                ?
              </>
            ) : (
              'The calendar invite goes here.'
            )
          }
          error={fieldError('email')}
        >
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
            aria-describedby={fieldError('email') ? 'book-email-error' : 'book-email-help'}
            className={`${inputClass(fieldError('email'))} h-10`}
          />
        </Field>
        <Field id="book-company" label="Company or project" optional error={fieldError('company')}>
          <input
            id="book-company"
            ref={refs.company}
            type="text"
            autoComplete="organization"
            value={draft.company}
            onChange={set('company')}
            onBlur={touch('company')}
            aria-invalid={Boolean(fieldError('company')) || undefined}
            aria-describedby={fieldError('company') ? 'book-company-error' : undefined}
            className={`${inputClass(fieldError('company'))} h-10`}
          />
        </Field>
        <Field id="book-link" label="Website or link" optional help="A site, portfolio, GitHub or Figma file to look at first." error={fieldError('link')}>
          <input
            id="book-link"
            ref={refs.link}
            type="url"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="off"
            spellCheck="false"
            value={draft.link}
            onChange={set('link')}
            onBlur={touch('link')}
            placeholder="yoursite.com"
            aria-invalid={Boolean(fieldError('link')) || undefined}
            aria-describedby={fieldError('link') ? 'book-link-error' : 'book-link-help'}
            className={`${inputClass(fieldError('link'))} h-10`}
          />
        </Field>
      </div>

      <Section id="book-where" title="Where should we talk?" note="Pick what’s easiest for you">
        <PlacePicker value={place} onChange={choosePlace} />
        <PlaceReach
          place={place}
          hostPlace={hostPlace}
          value={contact}
          onChange={setReach}
          onBlur={touch('contact')}
          error={fieldError('contact')}
          inputRef={refs.contact}
        />
      </Section>

      <Section id="book-how" title="How should we talk?">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span id="book-mode" className="text-[13px] font-medium text-ink-strong">
              Camera
            </span>
            <Segmented name="book-mode" labelledBy="book-mode" options={CALL_MODES} value={mode} onChange={(id) => put('mode', id)} off={place === 'phone' ? 'video' : null} />
            <p className="text-[12.5px] text-ink-subtle">{place === 'phone' ? 'Phone calls are voice only.' : mode === 'voice' ? 'No camera needed, just your voice.' : 'Cameras on, the usual way.'}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span id="book-lang" className="text-[13px] font-medium text-ink-strong">
              Language
            </span>
            <Segmented name="book-lang" labelledBy="book-lang" options={CALL_LANGS} value={draft.lang} onChange={(id) => put('lang', id)} />
            <p className="text-[12.5px] text-ink-subtle">I speak both, so pick what feels natural.</p>
          </div>
        </div>
      </Section>

      <Section id="book-about" title="What’s it about?" note="Optional">
        <Chips label="Topic" options={CALL_TOPICS} value={draft.topic} onChange={(id) => put('topic', id)} />
        {draft.topic === 'project' && (
          <div className="book-sub animate-view-in">
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-ink-strong">Rough budget</span>
              <Chips label="Rough budget" options={CALL_BUDGETS} value={draft.budget} onChange={(id) => put('budget', id)} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-ink-strong">When would you like to start?</span>
              <Chips label="When would you like to start?" options={CALL_TIMELINES} value={draft.timeline} onChange={(id) => put('timeline', id)} />
            </div>
          </div>
        )}
        <Field
          id="book-note"
          label="Notes"
          optional
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
            placeholder={topic?.hint || 'Share anything that will help me prepare.'}
            aria-invalid={Boolean(fieldError('note')) || undefined}
            aria-describedby={fieldError('note') ? 'book-note-error' : undefined}
            className={`${inputClass(fieldError('note'))} min-h-28 resize-y py-2.5 leading-relaxed`}
          />
        </Field>
      </Section>

      <div aria-hidden="true" className="absolute -start-[9999px] top-0 h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={draft.website} onChange={set('website')} />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/6 px-3.5 py-3 text-[13px] text-red-500">
          <Icon name="alert" className="mt-px h-4 w-4" />
          {error}
        </p>
      )}

      <div className="mt-auto flex items-center justify-end gap-2 pt-8">
        <button type="button" onClick={onBack} disabled={sending} className={GHOST}>
          Back
        </button>
        <button type="submit" disabled={sending} className={PRIMARY}>
          {sending && <Spinner className="h-4 w-4" />}
          {sending ? 'Booking…' : 'Confirm booking'}
          {!sending && (
            <kbd aria-hidden="true" className="book-kbd">
              {MOD_KEY}↵
            </kbd>
          )}
        </button>
      </div>
    </form>
  )
}

function saveIcs(ics, name) {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function Detail({ label, children }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4">
      <dt className="font-medium text-ink-strong">{label}</dt>
      <dd className="min-w-0 wrap-break-word text-ink-secondary">{children}</dd>
    </div>
  )
}

function reachLine(booking) {
  const { place, contact, video } = booking
  if (place === 'phone') return `I’ll ring you at ${contact}.`
  if (place === 'whatsapp') return `I’ll call you on WhatsApp at ${contact}.`
  if (place === 'discord') return `I’ll add ${contact} on Discord and call you there.`
  if (place === 'other') return `${contact}. I’ll confirm the details by email.`
  if (video) return contact ? 'On your own link. Join with the button below.' : 'Join with the button below when it’s time.'
  return 'I’ll email you the link before we talk.'
}

function Booked({ booking, zone, twelve, onAdd, headingRef }) {
  const start = Date.parse(booking.start)
  const end = Date.parse(booking.end)
  const minutes = Math.round((end - start) / 60_000)
  const place = placeById(booking.place)
  const about = [labelOf(CALL_TOPICS, booking.topic), labelOf(CALL_BUDGETS, booking.budget), labelOf(CALL_TIMELINES, booking.timeline)].filter(Boolean)

  return (
    <div className="flex flex-col items-center px-6 py-10 text-center animate-rise-in sm:px-10 sm:py-12">
      <DoneMark ms={start} zone={zone} />
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 scroll-mt-24 text-[22px] font-semibold tracking-[-0.02em] text-ink-strong outline-none">
        This call is scheduled
      </h1>
      <p className="mt-2 max-w-[44ch] text-pretty text-[14px] leading-relaxed text-ink-muted">
        {booking.emailed ? (
          <>
            A calendar invite is on its way to <span className="font-medium text-ink-strong">{booking.email}</span>.
          </>
        ) : (
          'Add it to your calendar so it doesn’t slip.'
        )}
      </p>

      <dl className="mt-8 grid w-full gap-5 border-y border-line py-6 text-start text-[14px]">
        <Detail label="What">{minutesLabel(minutes)} call with Kostis</Detail>
        <Detail label="When">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {formatDay(dateKey(start, zone))}
            <span className="rounded-full bg-surface-hover-strong/70 px-2 py-0.5 text-[12px] font-medium leading-none text-ink-muted">{whenWord(start, zone)}</span>
          </p>
          <p className="mt-0.5 tabular-nums text-ink-muted">
            {formatTime(start, zone, twelve)} – {formatTime(end, zone, twelve)} · {formatZone(zone, start)}
          </p>
        </Detail>
        {place && (
          <Detail label="Where">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <PlaceIcon place={place.id} size="sm" />
              {place.label}
              {booking.mode === 'voice' && <span className="text-ink-subtle">· Voice only</span>}
              {booking.lang === 'el' && (
                <span lang="el" className="text-ink-subtle">
                  · Ελληνικά
                </span>
              )}
            </p>
            <p className="mt-0.5 text-ink-muted">{reachLine(booking)}</p>
          </Detail>
        )}
        <Detail label="Who">
          <p>
            Kostis <span className="text-ink-subtle">· Host</span>
          </p>
          <p className="mt-0.5">
            {booking.name}
            {booking.company && <span className="text-ink-subtle"> · {booking.company}</span>}
          </p>
          <p className="mt-0.5 text-ink-muted">{booking.email}</p>
        </Detail>
        {(about.length > 0 || booking.note) && (
          <Detail label="About">
            {about.length > 0 && <p>{about.join(' · ')}</p>}
            {booking.note && <p className={`line-clamp-3 whitespace-pre-line text-ink-muted ${about.length ? 'mt-0.5' : ''}`}>{booking.note}</p>}
          </Detail>
        )}
      </dl>

      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        {booking.video && (
          <a href={booking.video} target="_blank" rel="noopener noreferrer" className={PRIMARY}>
            Join the call
            <Icon name="arrowUpRight" className="h-4 w-4" />
          </a>
        )}
        <button type="button" onClick={(e) => onAdd(e.currentTarget)} aria-haspopup="dialog" className={booking.video ? OUTLINE : PRIMARY}>
          <Icon name="calendar" className="h-4 w-4" />
          Add to calendar
        </button>
      </div>

      <p className="mt-6 text-[13px] text-ink-subtle">
        Need to make a change? <MailLink />
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
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [sending, setSending] = useState(false)
  const [flash, setFlash] = useState(false)
  const headingRef = useRef(null)
  const flashTimer = useRef(0)
  const [notes, setNotes] = useState([])
  const noteTimers = useRef([])
  const [sheet, setSheet] = useState(false)
  const [added, setAdded] = useState(null)
  const [event, setEvent] = useState(null)
  const addedTimer = useRef(0)
  const opener = useRef(null)

  useEffect(
    () => () => {
      clearTimeout(flashTimer.current)
      clearTimeout(addedTimer.current)
    },
    [],
  )

  useEffect(() => {
    const timers = noteTimers.current
    return () => timers.forEach(clearTimeout)
  }, [])

  const notify = useCallback((note) => setNotes((list) => [...list.filter((n) => n.id !== note.id), note]), [])
  const dismiss = useCallback((id) => setNotes((list) => list.filter((n) => n.id !== id)), [])

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
  const done = step === 'done' && booking
  const closed = load.code === 'booking_disabled' || load.code === 'booking_paused'

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
    setFlash(true)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(false), 3200)
  }

  const soonest = keys.length ? days.get(keys[0])[0] : null
  const takeSoonest = () => {
    setDay(keys[0])
    setMonth(null)
    pick(soonest)
  }

  let island = 'pick'
  if (done) island = sheet ? 'add' : added ? 'added' : 'done'
  else if (load.state === 'error') island = closed ? 'paused' : 'offline'
  else if (!ready) island = 'loading'
  else if (flash) island = 'taken'
  else if (!keys.length) island = 'full'
  else if (choosing) island = sending ? 'sending' : 'details'

  const restoreFocus = () =>
    requestAnimationFrame(() => {
      const was = opener.current
      const el = was?.isConnected ? was : (was?.id && document.getElementById(was.id)) || headingRef.current
      el?.focus({ preventScroll: true })
    })

  const openSheet = (from = null) => {
    opener.current = from
    setNotes((list) => list.map((n) => (n.id === 'event' ? { ...n, gone: true } : n)))
    clearTimeout(addedTimer.current)
    setAdded(null)
    setSheet(true)
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  const closeSheet = () => {
    setSheet(false)
    restoreFocus()
  }

  const addToCalendar = (prefs) => {
    const start = Date.parse(booking.start)
    const end = Date.parse(booking.end)
    const title = prefs.title.trim() || EVENT_TITLE
    const info = {
      start,
      end,
      title,
      notes: [prefs.notes.trim(), booking.plan || (booking.video ? `Join: ${booking.video}` : 'The video link follows by email.')].filter(Boolean).join('\n\n'),
      location: booking.video || booking.where || '',
    }
    if (prefs.app === 'apple') {
      const file = icsFileName(title)
      saveIcs(calendarIcs({ ...info, uid: icsUid(booking.ics) || `${start}@blxr.net`, alert: prefs.alert }), file)
      notify({ id: 'saved', icon: 'calendar', ms: start, zone, title: 'Invite downloaded', body: `Open ${file} to add it to your calendar.`, ttl: 6000 })
    } else {
      window.open(prefs.app === 'google' ? googleCalendarUrl(info) : outlookCalendarUrl(info), '_blank', 'noopener,noreferrer')
    }
    setEvent(prefs)
    setSheet(false)
    setAdded(prefs.app)
    clearTimeout(addedTimer.current)
    addedTimer.current = setTimeout(() => setAdded(null), 2600)
    restoreFocus()
  }

  const booked = (made) => {
    setBooking(made)
    setStep('done')
    setEvent({ title: EVENT_TITLE, notes: made.note || '', alert: 10, app: DEFAULT_APP })
    const start = Date.parse(made.start)
    const end = Date.parse(made.end)
    const first = made.name.split(/\s+/)[0]
    const at = (ms) => formatTime(ms, zone, twelve).replace(' ', ' ')
    const later = (ms, note) => noteTimers.current.push(setTimeout(() => notify(note), ms))
    later(700, {
      id: 'message',
      icon: 'message',
      title: 'Kostis',
      body: `Thanks ${first}, talk ${dayPhrase(start, zone)} at ${at(start)}.`,
      action: { label: 'Reply', href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Our call ${dayPhrase(start, zone)}`)}` },
      ttl: 9000,
    })
    const day = daysUntil(start, zone)
    later(1600, {
      id: 'event',
      icon: 'calendar',
      ms: start,
      zone,
      title: EVENT_TITLE,
      body: `${day <= 1 ? whenWord(start, zone) : fullShortDay(start, zone)}, ${at(start)} – ${at(end)}`,
      action: { label: 'Add', onClick: () => openSheet() },
      ttl: 11000,
    })
  }

  let panels
  if (load.state === 'error') {
    panels =
      closed ? (
        <Message icon="calendar" title="Booking isn’t open right now">
          <MailLink /> and we’ll find a time that works.
        </Message>
      ) : (
        <Message
          icon="alert"
          title="Couldn’t load my calendar"
          action={
            <button
              type="button"
              className={OUTLINE}
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
          Something went wrong on the way to my calendar. Try again, or <MailLink>email me</MailLink>.
        </Message>
      )
  } else if (!ready) {
    panels = <PickerSkeleton />
  } else if (!keys.length) {
    panels = (
      <Message icon="calendar" title={`Nothing free in the next ${load.days || 'few'} days`}>
        My calendar is full for now. <MailLink /> and we’ll find a time.
      </Message>
    )
  } else if (choosing) {
    panels = (
      <DetailsForm
        slot={slot}
        zone={zone}
        hostPlace={load.place}
        draft={draft}
        setDraft={setDraft}
        onBooked={booked}
        onTaken={taken}
        onBack={() => setStep('pick')}
        onSending={setSending}
        headingRef={headingRef}
      />
    )
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
        <Times key={activeDay} day={activeDay} times={days.get(activeDay) || []} zone={zone} twelve={twelve} onTwelve={setTwelve} onPick={pick} />
      </>
    )
  }

  return (
    <div className="book-ui flex min-h-dvh flex-col bg-bg text-ink antialiased selection:bg-selection selection:text-ink-strong animate-view-in">
      <header className="relative mx-auto flex h-16 w-full max-w-[1048px] items-center justify-between px-4 sm:px-6">
        <a
          {...link(HOME_PATH)}
          className={`group -ms-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13.5px] font-medium text-ink-muted transition-colors duration-150 hover:text-ink-strong ${FOCUS}`}
        >
          <Icon name="arrowLeft" className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
          Back
        </a>
        <BookIsland
          mode={island}
          slot={done ? Date.parse(booking.start) : slot}
          end={done ? Date.parse(booking.end) : null}
          soonest={soonest}
          zone={zone}
          twelve={twelve}
          onSoonest={takeSoonest}
          video={done ? booking.video : null}
          onAdd={done ? openSheet : null}
          event={event}
          added={added}
          modKey={MOD_KEY}
          onClose={closeSheet}
          onConfirm={addToCalendar}
        />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} className={`-me-2 ${ICON_BUTTON}`} />
      </header>

      <NoteStack notes={notes} onDismiss={dismiss} />

      <main className="flex flex-1 justify-center px-4 pb-12 pt-2 sm:items-center sm:px-6 sm:pb-16">
        <div className={`w-full animate-rise-in ${done ? 'max-w-[520px]' : 'max-w-[1000px]'}`}>
          {notice && (
            <p role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/6 px-3.5 py-3 text-[13px] text-amber-500">
              <Icon name="info" className="h-4 w-4" />
              {notice}
            </p>
          )}

          {done ? (
            <div className={DONE_CARD}>
              <Booked booking={booking} zone={zone} twelve={twelve} onAdd={openSheet} headingRef={headingRef} />
            </div>
          ) : (
            <div className={CARD}>
              <Host load={load} zone={zone} onZone={setZone} slot={choosing ? slot : null} twelve={twelve} plan={choosing ? planOf(draft, load.place) : null} />
              {panels}
            </div>
          )}

          {!done && load.state !== 'error' && (
            <p className="mt-5 text-center text-[13px] text-ink-subtle">
              Can’t find a time that works? <MailLink />
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
