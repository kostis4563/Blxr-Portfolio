import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { Icon } from './components/icon'
import { Bone } from './components/skeleton'
import { CalendarAppIcon, NoteStack, PlaceIcon } from './components/book-touches'
import { CALL_TOPICS, CALL_BUDGETS, CALL_TIMELINES, placeById, labelOf } from './lib/call-options'
import { BlockSheet, ScheduleIsland } from './components/schedule-touches'
import { link, dashboardPath, BOOK_PATH, LOGIN_PATH } from './lib/router'
import { imageProps, SIZES } from './lib/images'
import { reducedMotion } from './lib/memes'
import { WEEKDAYS, dateKey, groupByDay, monthOf, shiftMonth, monthGrid, formatMonth, formatDay, formatTime, formatZone, fullShortDay, prefersTwelveHour, whenWord, daysUntil } from './lib/booking'
import {
  DAY_MINUTES,
  WEEK_ORDER,
  blockWhen,
  clashingRanges,
  dayLabel,
  daysBetween,
  freeMinutes,
  isAllDay,
  isOver,
  minuteLabel,
  minutesIn,
  newBlockId,
  occursOn,
  overlaps,
  rangeLabel,
  repeatLabel,
  shiftDay,
  timeOptions,
  weekdayName,
  weekdayOf,
  weekdayShort,
} from './lib/schedule'
import { fetchSchedule, saveSchedule, SCHEDULE_ERRORS, CALENDAR_ERRORS } from './lib/schedule-api'

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
const SHADOW = 'shadow-[0_1px_2px_var(--shadow-cast-soft),0_16px_48px_-16px_var(--shadow-cast)]'
const SURFACE = `overflow-hidden rounded-2xl border border-line bg-surface ${SHADOW}`
const CARD = `grid w-full grid-cols-1 ${SURFACE} md:grid-cols-[minmax(0,1fr)_288px] lg:grid-cols-[264px_minmax(0,1fr)_304px]`
const PANEL = 'min-w-0 p-5 sm:p-6'
const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium outline-none transition-[background-color,border-color,color,opacity,transform] duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ink-strong/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-40'
const PRIMARY = `${BASE} h-10 px-4 text-[14px] bg-ink-strong text-ink-inverse hover:opacity-90`
const OUTLINE = `${BASE} h-10 px-4 text-[14px] border border-line-strong bg-surface text-ink-strong hover:bg-surface-hover`
const SMALL = `${BASE} h-8 px-3 text-[13px] border border-line-strong bg-surface text-ink-strong hover:bg-surface-hover`
const GHOST = `${BASE} h-10 px-3.5 text-[14px] text-ink-muted hover:bg-surface-hover hover:text-ink-strong`
const ICON_BUTTON = `flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink-strong disabled:pointer-events-none disabled:opacity-30 ${FOCUS}`
const TEXT_LINK = `cursor-pointer rounded-sm font-medium text-ink-strong underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink-strong ${FOCUS}`
const CHIP = `${BASE} h-7 rounded-full px-2.5 text-[12.5px]`

const MOD_KEY = typeof navigator !== 'undefined' && !/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'Ctrl' : '⌘'
const MINUTE = 60_000
const POLL_MS = 90_000
const SAVE_DELAY = 650

const minutesLabel = (minutes) => (minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`)
const cityOf = (zone, at) => formatZone(zone, at).split(' (')[0]
const pick = (view) => ({ hours: view.hours, blocks: view.blocks, paused: view.paused })

function agoLabel(iso, now) {
  const minutes = Math.round((now - Date.parse(iso)) / MINUTE)
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.round(minutes / 60)} h ago`
}

function useNow() {
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
  return now
}

function Switch({ checked, onChange, label, id }) {
  return <button type="button" id={id} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="sched-switch" />
}

function Meta({ icon, children }) {
  return (
    <li className="flex items-start gap-3">
      <Icon name={icon} className="mt-0.5 h-4 w-4 text-ink-subtle" />
      <div className="min-w-0">{children}</div>
    </li>
  )
}

function Overview({ data, paused, zone, now, upcoming, onPause, onCopy }) {
  const week = upcoming.filter((c) => daysUntil(Date.parse(c.start), zone, now) < 7).length
  return (
    <aside aria-label="Overview" className={`${PANEL} flex flex-col gap-5 border-b border-line md:col-span-2 lg:col-span-1 lg:border-b-0 lg:border-e`}>
      <img {...imageProps('/pfp.webp', SIZES.avatar)} alt="" width="36" height="36" draggable="false" className="h-9 w-9 select-none rounded-full object-cover" />
      <div>
        <p className="text-[14px] font-medium text-ink-muted">Blxr</p>
        <h1 className="mt-1 text-[22px] font-semibold leading-snug tracking-[-0.02em] text-ink-strong">Calls</h1>
        <p className="mt-3 max-w-[52ch] text-pretty text-[14px] leading-relaxed text-ink-muted">Who’s booked, when /book is open, and the time you keep for yourself.</p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface-raised p-3.5">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-ink-strong">{paused ? 'Booking paused' : 'Taking calls'}</p>
          <p className="mt-0.5 text-pretty text-[12.5px] leading-relaxed text-ink-subtle">{paused ? '/book shows a closed sign until you switch it back on.' : 'Visitors can book any open time below.'}</p>
        </div>
        <Switch checked={!paused} onChange={(on) => onPause(!on)} label="Taking calls" />
      </div>

      <ul className="flex flex-col gap-3.5 text-[14px] font-medium text-ink-secondary">
        <Meta icon="phoneCall">
          {upcoming.length ? `${upcoming.length} booked · ${week} this week` : 'Nothing booked yet'}
        </Meta>
        <Meta icon="clock">
          {minutesLabel(data.minutes)} calls · {data.notice} h notice
        </Meta>
        <Meta icon="calendar">
          {data.days} days ahead{data.maxPerDay ? ` · ${data.maxPerDay} a day max` : ''}
        </Meta>
        <Meta icon="globe">{formatZone(zone, now)}</Meta>
      </ul>

      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-subtle">
        {data.calendarError ? (
          <p className="flex items-start gap-2 text-amber-500">
            <Icon name="alert" className="mt-0.5 h-3.5 w-3.5" />
            {CALENDAR_ERRORS[data.calendarError] || CALENDAR_ERRORS.calendar_failed}
          </p>
        ) : (
          <p className="flex items-start gap-2">
            <span aria-hidden="true" className="sched-live mt-1.5" />
            <span>
              Synced with iCloud{data.calendar ? ` · ${data.calendar}` : ''} · {agoLabel(data.syncedAt, now)}
            </span>
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a {...link(BOOK_PATH)} className={TEXT_LINK}>
            Open /book
          </a>
          <button type="button" onClick={onCopy} className={TEXT_LINK}>
            Copy link
          </button>
        </p>
      </div>
    </aside>
  )
}

function MonthView({ month, onMonth, today, selected, onSelect, infoFor }) {
  const label = formatMonth(month)
  const cut = label.lastIndexOf(' ')
  const home = monthOf(today)

  return (
    <div className={`${PANEL} flex flex-col`}>
      <div className="mb-4 flex h-8 items-center justify-between gap-3">
        <h2 aria-live="polite" className="text-[15px] font-semibold text-ink-strong">
          {label.slice(0, cut)} <span className="font-normal text-ink-subtle">{label.slice(cut + 1)}</span>
        </h2>
        <div className="-me-1.5 flex items-center gap-0.5">
          {(month !== home || selected !== today) && (
            <button
              type="button"
              onClick={() => {
                onMonth(home)
                onSelect(today)
              }}
              className={`me-1 h-7 cursor-pointer rounded-md px-2 text-[12.5px] font-medium text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink-strong ${FOCUS}`}
            >
              Today
            </button>
          )}
          <button type="button" aria-label="Previous month" disabled={month <= shiftMonth(home, -6)} onClick={() => onMonth(shiftMonth(month, -1))} className={ICON_BUTTON}>
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next month" disabled={month >= shiftMonth(home, 18)} onClick={() => onMonth(shiftMonth(month, 1))} className={ICON_BUTTON}>
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
          const info = infoFor(key)
          const active = key === selected
          const isToday = key === today
          const said = [
            formatDay(key),
            isToday && 'today',
            info.calls.length && `${info.calls.length} ${info.calls.length === 1 ? 'call' : 'calls'}`,
            info.blocked ? 'blocked' : info.blocks.length ? 'partly blocked' : null,
            info.closed && !info.past && 'closed',
            info.slots.length && `${info.slots.length} open on /book`,
          ]
            .filter(Boolean)
            .join(', ')
          let tone = 'text-ink-strong hover:bg-surface-hover'
          if (active) tone = isToday ? 'bg-[#ff3b30] text-white' : 'bg-ink-strong text-ink-inverse'
          else if (info.past) tone = 'text-ink-faint hover:bg-surface-hover'
          else if (info.slots.length) tone = 'bg-surface-hover-strong/60 text-ink-strong hover:shadow-[inset_0_0_0_1.5px_var(--color-ink-strong)]'
          else if (info.closed) tone = 'text-ink-subtle hover:bg-surface-hover'
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              aria-label={said}
              onClick={() => onSelect(key)}
              className={`relative flex h-11 cursor-pointer items-center justify-center rounded-lg text-[14px] font-medium tabular-nums transition-[background-color,color,box-shadow,transform] duration-150 active:scale-95 sm:h-12 lg:h-14 ${FOCUS} ${tone}`}
            >
              {info.blocked && <span aria-hidden="true" className="sched-hatch absolute inset-0 rounded-lg" />}
              <span className={`relative ${isToday && !active ? 'font-semibold text-[#ff3b30]' : ''}`}>{Number(key.slice(8))}</span>
              {(info.calls.length > 0 || (info.blocks.length > 0 && !info.blocked)) && (
                <span aria-hidden="true" className="absolute bottom-1.5 flex items-center gap-0.75">
                  {info.calls.slice(0, 3).map((c) => (
                    <i key={c.uid} className="sched-dot" />
                  ))}
                  {info.blocks.length > 0 && !info.blocked && <i className="sched-dash" />}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <ul aria-label="Key" className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 text-[12px] text-ink-subtle">
        <li className="flex items-center gap-1.5">
          <i aria-hidden="true" className="sched-dot" />
          Call
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-sm bg-surface-hover-strong/60" />
          Open on /book
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="sched-hatch h-3 w-3 rounded-sm" />
          Blocked
        </li>
        <li className="flex items-center gap-1.5">
          <i aria-hidden="true" className="sched-dash" />
          Partly blocked
        </li>
      </ul>
    </div>
  )
}

const linkHost = (href) => {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return href
  }
}

function callReach(call) {
  const digits = (call.contact || '').replace(/\D/g, '')
  if (call.place === 'whatsapp' && digits) return { href: `https://wa.me/${digits}`, label: 'WhatsApp', external: true }
  if (call.place === 'phone' && digits) return { href: `tel:${call.contact.replace(/[^\d+]/g, '')}`, label: 'Call' }
  return null
}

function CallItem({ item, zone, twelve, now, flash }) {
  const { call, start, end } = item
  const past = end <= now
  const going = start <= now && now < end
  const theirs = call.timeZone && call.timeZone !== zone && formatTime(start, call.timeZone, twelve) !== formatTime(start, zone, twelve)
  const place = placeById(call.place)
  const about = [labelOf(CALL_TOPICS, call.topic), labelOf(CALL_BUDGETS, call.budget), labelOf(CALL_TIMELINES, call.timeline)].filter(Boolean)
  const reach = callReach(call)
  const showContact = call.contact && call.place !== 'facetime' && !/^https:/.test(call.contact)
  return (
    <div className="sched-item" data-tone="call" data-past={past || undefined} data-flash={flash || undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-medium tabular-nums text-ink-muted">
          {formatTime(start, zone, twelve)} – {formatTime(end, zone, twelve)}
        </p>
        {past ? <span className="text-[11.5px] font-medium text-ink-subtle">Done</span> : going && <span className="sched-now">Now</span>}
      </div>
      <p className="mt-0.5 truncate text-[14px] font-semibold text-ink-strong">
        {call.name}
        {call.company && <span className="font-normal text-ink-subtle"> · {call.company}</span>}
      </p>
      {call.email && <p className="truncate text-[12.5px] text-ink-muted">{call.email}</p>}
      {theirs && (
        <p className="text-[12px] text-ink-subtle">
          {formatTime(start, call.timeZone, twelve)} for them in {cityOf(call.timeZone, start)}
        </p>
      )}
      {place && (
        <p className="mt-1.5 flex items-start gap-2 text-[12.5px] text-ink-secondary">
          <PlaceIcon place={place.id} size="sm" />
          <span className="min-w-0 wrap-break-word">
            {place.label}
            {showContact && <span className="text-ink-strong"> · {call.contact}</span>}
            {call.mode === 'voice' && call.place !== 'phone' && <span className="text-ink-subtle"> · Voice only</span>}
            {call.lang === 'el' && <span className="text-ink-subtle"> · Greek</span>}
          </span>
        </p>
      )}
      {about.length > 0 && <p className="mt-1 text-[12.5px] font-medium text-ink-secondary">{about.join(' · ')}</p>}
      {call.note && <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-pretty text-[13px] leading-relaxed text-ink-secondary">{call.note}</p>}
      {call.link && (
        <a href={call.link} target="_blank" rel="noopener noreferrer" className={`mt-1.5 inline-flex max-w-full items-center gap-1 text-[12.5px] ${TEXT_LINK}`}>
          <span className="truncate">{linkHost(call.link)}</span>
          <Icon name="arrowUpRight" className="h-3 w-3" strokeWidth={2} />
        </a>
      )}
      {!past && (call.video || reach || call.email) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {call.video && (
            <a href={call.video} target="_blank" rel="noopener noreferrer" className={`${CHIP} bg-[#30d158] text-black hover:brightness-105`}>
              Join
              <Icon name="arrowUpRight" className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          )}
          {reach && (
            <a href={reach.href} {...(reach.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={`${CHIP} bg-[#30d158] text-black hover:brightness-105`}>
              <Icon name="phoneCall" className="h-3.5 w-3.5" strokeWidth={2} />
              {reach.label}
            </a>
          )}
          {call.email && (
            <a href={`mailto:${call.email}?subject=${encodeURIComponent(`Our call on ${fullShortDay(start, zone)}`)}`} className={`${CHIP} border border-line-strong text-ink-strong hover:bg-surface-hover`}>
              <Icon name="mail" className="h-3.5 w-3.5" />
              Email
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function BlockItem({ item, twelve, onOpen }) {
  const { block } = item
  return (
    <button type="button" id={`agenda-${block.id}`} onClick={(e) => onOpen(block, e.currentTarget)} className={`sched-item w-full cursor-pointer text-start ${FOCUS}`} data-tone="block">
      <p className="text-[12.5px] font-medium tabular-nums text-ink-muted">{rangeLabel(block.start, block.end, twelve)}</p>
      <p className="mt-0.5 truncate text-[14px] font-semibold text-ink-strong">{block.label || 'Blocked'}</p>
      {block.repeat !== 'none' && (
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-subtle">
          <Icon name="repeat" className="h-3 w-3" strokeWidth={2} />
          {repeatLabel(block.repeat, block.date)}
        </p>
      )}
    </button>
  )
}

function BusyItem({ item, twelve }) {
  return (
    <div className="sched-item" data-tone="busy">
      <p className="text-[12.5px] font-medium tabular-nums text-ink-muted">{item.start === 0 && item.end === DAY_MINUTES ? 'All day' : rangeLabel(item.start, item.end, twelve)}</p>
      <p className="mt-0.5 text-[13.5px] font-medium text-ink-secondary">Busy in iCloud</p>
    </div>
  )
}

function OnBook({ info, data, paused, zone, twelve, today }) {
  let line = null
  if (info.past) line = null
  else if (paused) line = 'Booking is paused, so /book shows nothing.'
  else if (info.key > shiftDay(today, data.days - 1)) line = `This day opens for booking on ${dayLabel(shiftDay(info.key, 1 - data.days))}.`
  else if (info.closed) line = `Closed. There are no weekly hours on ${weekdayName(info.weekday)}s.`
  else if (info.blocked) line = 'Blocked, so /book skips this day.'
  else if (!info.slots.length) line = data.maxPerDay && info.calls.length >= data.maxPerDay ? `Full: that’s the limit of ${data.maxPerDay} calls a day.` : 'Nothing left to book on this day.'

  if (info.past) return null
  return (
    <section aria-label="Open on /book" className="mt-5 border-t border-line pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink-strong">On /book</h3>
        {!line && <span className="text-[12px] tabular-nums text-ink-subtle">{info.slots.length} open</span>}
      </div>
      {line ? (
        <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-ink-subtle">{line}</p>
      ) : (
        <ul className="mt-2.5 grid grid-cols-3 gap-1.5">
          {info.slots.map((ms) => (
            <li key={ms} className="flex h-8 items-center justify-center rounded-md border border-line text-[12.5px] font-medium tabular-nums text-ink-secondary">
              {formatTime(ms, zone, twelve)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DayPanel({ info, data, paused, zone, twelve, now, today, flash, panelRef, onEditBlock, onNewBlock, onUnblock, onHours }) {
  const items = useMemo(() => {
    const list = [
      ...info.calls.map((c) => ({ kind: 'call', id: c.uid, call: c, start: c.startMs, end: c.endMs, at: c.from })),
      ...info.blocks.map((b) => ({ kind: 'block', id: b.id, block: b, at: b.start ?? -1 })),
      ...info.busy.map((r, i) => ({ kind: 'busy', id: `busy-${i}`, start: r.from, end: r.to, at: r.from === 0 && r.to === DAY_MINUTES ? -1 : r.from })),
    ]
    return list.sort((a, b) => a.at - b.at)
  }, [info])
  const dayBlock = info.blocks.find(isAllDay)
  const days = daysBetween(today, info.key)

  return (
    <div ref={panelRef} className={`${PANEL} flex scroll-mt-20 flex-col border-t border-line md:border-t-0 md:border-s`}>
      <div className="mb-1 flex h-8 items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink-strong">
          <span aria-hidden="true">
            {weekdayShort(info.weekday)} <span className="font-normal tabular-nums text-ink-subtle">{Number(info.key.slice(8))}</span>
          </span>
          <span className="sr-only">{formatDay(info.key)}</span>
        </h2>
        {days >= -1 && days <= 1 && <span className="rounded-full bg-surface-hover-strong/70 px-2 py-0.5 text-[12px] font-medium leading-none text-ink-muted">{days === -1 ? 'Yesterday' : days === 0 ? 'Today' : 'Tomorrow'}</span>}
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
        <span className="tabular-nums">{info.windows.length ? info.windows.map((w) => rangeLabel(w.start, w.end, twelve)).join(', ') : `Closed on ${weekdayName(info.weekday)}s`}</span>
        <button type="button" onClick={() => onHours(info.weekday)} className={`text-[13px] ${TEXT_LINK}`}>
          Edit
        </button>
      </p>

      <div className="relative mt-4 md:min-h-0 md:flex-1">
        <div className="md:absolute md:inset-0 md:-mx-1 md:overflow-y-auto md:px-1 md:pb-6 md:mask-[linear-gradient(to_bottom,#000_calc(100%-24px),transparent)]">
          {items.length ? (
            <ol aria-label="This day" className="flex flex-col gap-2">
              {items.map((item) => (
                <li key={item.id}>
                  {item.kind === 'call' ? (
                    <CallItem item={item} zone={zone} twelve={twelve} now={now} flash={flash === item.id} />
                  ) : item.kind === 'block' ? (
                    <BlockItem item={item} twelve={twelve} onOpen={(block, el) => onEditBlock(block, info.key, el)} />
                  ) : (
                    <BusyItem item={item} twelve={twelve} />
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-ink-subtle">{info.past ? 'Nothing happened on this day.' : 'Nothing on this day yet.'}</p>
          )}
          <OnBook info={info} data={data} paused={paused} zone={zone} twelve={twelve} today={today} />
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <button type="button" id="day-block-time" disabled={info.past} onClick={(e) => onNewBlock(info.key, false, e.currentTarget)} className={`${OUTLINE} flex-1`}>
          <Icon name="ban" className="h-4 w-4" />
          Block time
        </button>
        {dayBlock ? (
          <button type="button" onClick={() => onUnblock(dayBlock, info.key)} className={GHOST}>
            Unblock day
          </button>
        ) : (
          <button type="button" id="day-block-day" disabled={info.past} onClick={(e) => onNewBlock(info.key, true, e.currentTarget)} className={GHOST}>
            Block day
          </button>
        )}
      </div>
    </div>
  )
}

function TimeField({ value, options, onChange, label, twelve, warn }) {
  return (
    <span className="relative inline-flex min-w-0 flex-1 sm:flex-none">
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className={`h-9 w-full cursor-pointer appearance-none rounded-lg border bg-surface ps-3 pe-7 text-[14px] max-sm:ps-2.5 max-sm:pe-6 tabular-nums text-ink-strong outline-none transition-[border-color,box-shadow] duration-150 hover:border-ink-faint focus-visible:border-ink-strong focus-visible:ring-[3px] focus-visible:ring-ink-strong/10 max-sm:text-[16px] ${twelve ? 'sm:w-27' : 'sm:w-21.5'} ${warn ? 'border-amber-500/60' : 'border-line-strong'}`}
      >
        {options.map((m) => (
          <option key={m} value={m}>
            {minuteLabel(m, twelve)}
          </option>
        ))}
      </select>
      <Icon name="chevronsUpDown" className="pointer-events-none absolute inset-e-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
    </span>
  )
}

function WeeklyHours({ hours, twelve, zone, now, flashDay, onChange }) {
  const byDay = (day) => hours.filter((w) => w.day === day).sort((a, b) => a.start - b.start)
  const setDay = (day, list, note) => onChange([...hours.filter((w) => w.day !== day), ...list.map(({ start, end }) => ({ day, start, end }))], note)

  const toggle = (day, on) => {
    if (!on) return setDay(day, [], `${weekdayName(day)}s closed`)
    const model = WEEK_ORDER.map(byDay).find((list) => list.length) || [{ start: 600, end: 1080 }]
    setDay(day, model, `${weekdayName(day)}s open`)
  }

  const setRange = (day, index, field, value) => {
    const list = byDay(day).map((w, i) => {
      if (i !== index) return w
      if (field === 'start') return { ...w, start: value, end: w.end <= value ? Math.min(value + 60, DAY_MINUTES) : w.end }
      return { ...w, end: value }
    })
    setDay(day, list)
  }

  const addRange = (day) => {
    const list = byDay(day)
    const last = list[list.length - 1]
    const start = Math.min(last.end + 60, DAY_MINUTES - 60)
    setDay(day, [...list, { start, end: Math.min(start + 120, DAY_MINUTES) }])
  }

  const removeRange = (day, index) => {
    const list = byDay(day).filter((_, i) => i !== index)
    setDay(day, list, list.length ? null : `${weekdayName(day)}s closed`)
  }

  return (
    <section aria-labelledby="hours-title" className={`${SURFACE} ${PANEL}`}>
      <h2 id="hours-title" className="text-[15px] font-semibold text-ink-strong">
        Weekly hours
      </h2>
      <p className="mt-1 text-pretty text-[13px] leading-relaxed text-ink-muted">When /book offers times, in {cityOf(zone, now)}. Changes save as you go.</p>
      <ul className="mt-4">
        {WEEK_ORDER.map((day) => {
          const list = byDay(day)
          const open = list.length > 0
          const clash = clashingRanges(list)
          const last = list[list.length - 1]
          return (
            <li
              key={day}
              id={`hours-${day}`}
              data-flash={flashDay === day || undefined}
              className="sched-hours-row grid scroll-mt-24 items-start gap-2 border-t border-line py-3 first:border-t-0 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-3"
            >
              <div className="flex h-9 items-center gap-2.5">
                <Switch id={`hours-switch-${day}`} checked={open} onChange={(on) => toggle(day, on)} label={`Open on ${weekdayName(day)}s`} />
                <span className={`text-[14px] font-medium ${open ? 'text-ink-strong' : 'text-ink-subtle'}`}>
                  <span className="sm:hidden">{weekdayName(day)}</span>
                  <span className="max-sm:hidden">{weekdayShort(day)}</span>
                </span>
                {!open && <span className="ms-auto text-[14px] text-ink-subtle sm:hidden">Closed</span>}
              </div>
              {open ? (
                <div className="flex min-w-0 flex-col gap-2">
                  {list.map((w, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <TimeField value={w.start} options={timeOptions(0, DAY_MINUTES - 15)} onChange={(v) => setRange(day, i, 'start', v)} label={`${weekdayName(day)} from`} twelve={twelve} warn={clash.has(i)} />
                      <span aria-hidden="true" className="text-ink-subtle">
                        –
                      </span>
                      <TimeField value={w.end} options={timeOptions(w.start + 15, DAY_MINUTES)} onChange={(v) => setRange(day, i, 'end', v)} label={`${weekdayName(day)} until`} twelve={twelve} warn={clash.has(i)} />
                      <button type="button" aria-label={`Remove ${rangeLabel(w.start, w.end, twelve)} on ${weekdayName(day)}s`} onClick={() => removeRange(day, i)} className={ICON_BUTTON}>
                        <Icon name="x" className="h-4 w-4" />
                      </button>
                      {i === 0 ? (
                        <button type="button" aria-label={`Add more hours on ${weekdayName(day)}s`} disabled={last.end >= DAY_MINUTES - 60} onClick={() => addRange(day)} className={ICON_BUTTON}>
                          <Icon name="plus" className="h-4 w-4" />
                        </button>
                      ) : (
                        <span aria-hidden="true" className="w-8 shrink-0 max-sm:block sm:hidden" />
                      )}
                    </div>
                  ))}
                  {clash.size > 0 && <p className="text-[12px] text-amber-500">These overlap. That’s fine, /book treats them as one stretch.</p>}
                </div>
              ) : (
                <p className="hidden h-9 items-center text-[14px] text-ink-subtle sm:flex">Closed</p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function BlockRow({ block, twelve, onOpen }) {
  return (
    <li>
      <button
        type="button"
        id={`block-${block.id}`}
        onClick={(e) => onOpen(block, e.currentTarget)}
        className={`group -mx-2 flex w-[calc(100%+16px)] cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-start transition-colors duration-150 hover:bg-surface-hover ${FOCUS}`}
      >
        <span aria-hidden="true" className="sched-tile">
          <Icon name={block.repeat === 'none' ? 'ban' : 'repeat'} className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink-strong">{block.label || 'Blocked'}</span>
          <span className="block truncate text-[12.5px] tabular-nums text-ink-muted">{blockWhen(block, twelve)}</span>
        </span>
        {block.except?.length > 0 && <span className="shrink-0 text-[12px] text-ink-subtle max-sm:hidden">{block.except.length} skipped</span>}
        <Icon name="chevronRight" className="h-4 w-4 text-ink-faint transition-colors group-hover:text-ink-muted" />
      </button>
    </li>
  )
}

function BlockList({ blocks, today, twelve, onOpen, onNew }) {
  const live = blocks.filter((b) => !isOver(b, today))
  const order = (a, b) => a.date.localeCompare(b.date) || (a.start ?? -1) - (b.start ?? -1)
  const repeating = live.filter((b) => b.repeat !== 'none').sort(order)
  const once = live.filter((b) => b.repeat === 'none').sort(order)

  return (
    <section aria-labelledby="blocks-title" className={`${SURFACE} ${PANEL} flex flex-col`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="blocks-title" className="text-[15px] font-semibold text-ink-strong">
            Blocked time
          </h2>
          <p className="mt-1 text-pretty text-[13px] leading-relaxed text-ink-muted">Days off, trips, and the hours you keep for yourself.</p>
        </div>
        <button type="button" id="block-new" onClick={(e) => onNew(e.currentTarget)} className={SMALL}>
          <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2.2} />
          New
        </button>
      </div>

      {live.length ? (
        <div className="mt-3 flex flex-col gap-3">
          {[
            ['Repeating', repeating],
            ['One-off', once],
          ]
            .filter(([, list]) => list.length)
            .map(([title, list]) => (
              <div key={title}>
                <h3 className="pb-1 pt-2 text-[12.5px] font-medium text-ink-subtle">{title}</h3>
                <ul className="flex flex-col">
                  {list.map((b) => (
                    <BlockRow key={b.id} block={b} twelve={twelve} onOpen={onOpen} />
                  ))}
                </ul>
              </div>
            ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <span className="sched-tile is-big" aria-hidden="true">
            <Icon name="ban" className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <p className="mt-4 text-[14px] font-semibold text-ink-strong">Nothing blocked</p>
          <p className="mt-1 max-w-[34ch] text-pretty text-[13px] leading-relaxed text-ink-muted">Block a day off, a weekly gym hour or a whole trip, and /book hides those times.</p>
        </div>
      )}
    </section>
  )
}

function UpcomingCalls({ calls, zone, twelve, now, onShow, onCopy }) {
  const groups = []
  for (const call of calls) {
    const start = Date.parse(call.start)
    const key = dateKey(start, zone)
    if (groups[groups.length - 1]?.key !== key) groups.push({ key, start, list: [] })
    groups[groups.length - 1].list.push(call)
  }

  return (
    <section aria-labelledby="upcoming-title" className={`${SURFACE} ${PANEL}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="upcoming-title" className="text-[15px] font-semibold text-ink-strong">
          Upcoming calls
        </h2>
        {calls.length > 0 && <span className="text-[12.5px] tabular-nums text-ink-subtle">{calls.length} booked</span>}
      </div>
      <p className="mt-1 text-pretty text-[13px] leading-relaxed text-ink-muted">Everyone who booked through /book, soonest first.</p>

      {groups.length ? (
        <div className="mt-2 flex flex-col">
          {groups.map((group) => {
            const days = daysUntil(group.start, zone, now)
            return (
              <div key={group.key} className="mt-3">
                <h3 className="flex items-baseline gap-2 pb-1 text-[12.5px] font-medium text-ink-subtle">
                  {days <= 1 && <span className={days <= 0 ? 'text-[#ff3b30]' : 'text-ink-secondary'}>{whenWord(group.start, zone, now)}</span>}
                  <span>{dayLabel(group.key)}</span>
                </h3>
                <ul className="-mx-2 flex flex-col">
                  {group.list.map((call) => {
                    const start = Date.parse(call.start)
                    const going = start <= now
                    return (
                      <li key={call.uid}>
                        <button
                          type="button"
                          onClick={() => onShow(call)}
                          className={`group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-start transition-colors duration-150 hover:bg-surface-hover ${FOCUS}`}
                        >
                          <span className={`shrink-0 text-[13px] font-medium tabular-nums text-ink-strong ${twelve ? 'w-16' : 'w-11'}`}>{formatTime(start, zone, twelve)}</span>
                          <span aria-hidden="true" className="sched-bar" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[14px] font-medium text-ink-strong">{call.name}</span>
                              {going && <span className="sched-now">Now</span>}
                            </span>
                            <span className="block truncate text-[12.5px] text-ink-muted">{call.note || labelOf(CALL_TOPICS, call.topic) || call.email}</span>
                          </span>
                          {call.place && <PlaceIcon place={call.place} size="sm" />}
                          <Icon name="chevronRight" className="h-4 w-4 text-ink-faint transition-colors group-hover:text-ink-muted" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center px-4 py-9 text-center">
          <CalendarAppIcon ms={now} zone={zone} big />
          <p className="mt-4 text-[14px] font-semibold text-ink-strong">No calls booked</p>
          <p className="mt-1 max-w-[34ch] text-pretty text-[13px] leading-relaxed text-ink-muted">Share /book and new calls land here, and in your iCloud calendar.</p>
          <button type="button" onClick={onCopy} className={`${SMALL} mt-4`}>
            <Icon name="copy" className="h-3.5 w-3.5" />
            Copy link
          </button>
        </div>
      )}
    </section>
  )
}

function PageSkeleton() {
  return (
    <>
      <div className={CARD} aria-busy="true" aria-label="Loading your schedule">
        <div className={`${PANEL} flex flex-col gap-5 border-b border-line md:col-span-2 lg:col-span-1 lg:border-b-0 lg:border-e`}>
          <Bone className="h-9 w-9 rounded-full" />
          <div className="flex flex-col gap-2.5">
            <Bone className="h-4 w-12" />
            <Bone className="h-6 w-24" />
            <Bone className="h-4 w-48" />
          </div>
          <Bone className="h-18.5 rounded-xl" />
          <div className="flex flex-col gap-3.5">
            <Bone className="h-4 w-32" />
            <Bone className="h-4 w-40" />
            <Bone className="h-4 w-36" />
          </div>
        </div>
        <div className={PANEL}>
          <div className="mb-4 flex h-8 items-center justify-between">
            <Bone className="h-4 w-28" />
            <Bone className="h-6 w-14" />
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }, (_, i) => (
              <Bone key={i} className="h-11 rounded-lg sm:h-12" />
            ))}
          </div>
        </div>
        <div className={`${PANEL} flex flex-col gap-2 border-t border-line md:border-t-0 md:border-s`}>
          <Bone className="mb-2 h-4 w-16" />
          {Array.from({ length: 3 }, (_, i) => (
            <Bone key={i} className="h-18.5 rounded-[10px]" />
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Bone className="h-105 rounded-2xl" />
        <Bone className="h-105 rounded-2xl" />
      </div>
    </>
  )
}

function LoadError({ code, onRetry }) {
  const signIn = code === 'unauthorized' || code === 'needs_mfa'
  return (
    <div className={`${SURFACE} flex min-h-90 flex-col items-center justify-center px-6 py-14 text-center animate-view-in`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-hover-strong/60 text-ink-muted">
        <Icon name={signIn ? 'lock' : 'alert'} className="h-5 w-5" />
      </span>
      <p className="mt-5 text-[15px] font-semibold text-ink-strong">{signIn ? 'Sign in again to see your calls' : 'Couldn’t load your schedule'}</p>
      <p className="mt-1.5 max-w-[44ch] text-pretty text-[14px] leading-relaxed text-ink-muted">{SCHEDULE_ERRORS[code] || SCHEDULE_ERRORS.failed}</p>
      <div className="mt-6">
        {signIn ? (
          <a {...link(LOGIN_PATH)} className={PRIMARY}>
            Sign in
          </a>
        ) : (
          <button type="button" onClick={onRetry} className={OUTLINE}>
            <Icon name="refresh" className="h-4 w-4" />
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

export default function DashboardCalls({ theme, onToggleTheme }) {
  const [load, setLoad] = useState({ state: 'loading' })
  const [reload, setReload] = useState(0)
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState({ mode: 'idle', note: null })
  const [selected, setSelected] = useState(null)
  const [month, setMonth] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [flash, setFlash] = useState(null)
  const [flashDay, setFlashDay] = useState(null)
  const [notes, setNotes] = useState([])
  const [twelve] = useState(prefersTwelveHour)
  const now = useNow()

  const draftRef = useRef(null)
  const revRef = useRef(0)
  const queued = useRef(null)
  const queuedNote = useRef(null)
  const inflight = useRef(false)
  const debounce = useRef(0)
  const statusTimer = useRef(0)
  const flashTimer = useRef(0)
  const seen = useRef(null)
  const opener = useRef(null)
  const panelRef = useRef(null)

  const zone = data?.timeZone || null
  const today = zone ? dateKey(now, zone) : null

  useEffect(
    () => () => {
      clearTimeout(debounce.current)
      clearTimeout(statusTimer.current)
      clearTimeout(flashTimer.current)
    },
    [],
  )

  const notify = useCallback((note) => setNotes((list) => [...list.filter((n) => n.id !== note.id), note]), [])
  const dismiss = useCallback((id) => setNotes((list) => list.filter((n) => n.id !== id)), [])

  const flashStatus = useCallback((mode, note = null, ms = 1800) => {
    setStatus({ mode, note })
    clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setStatus((s) => (s.mode === mode ? { mode: 'idle', note: null } : s)), ms)
  }, [])

  const adopt = useCallback((view) => {
    revRef.current = view.rev
    const fresh = pick(view)
    draftRef.current = fresh
    setDraft(fresh)
  }, [])

  const showCall = useCallback(
    (call) => {
      const key = dateKey(Date.parse(call.start), zone)
      setSelected(key)
      setMonth(monthOf(key))
      setFlash(call.uid)
      clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setFlash(null), 1800)
      const panel = panelRef.current
      if (panel) {
        const box = panel.getBoundingClientRect()
        if (box.top < 64 || box.top > window.innerHeight - 160) panel.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
      }
    },
    [zone],
  )

  const refresh = useCallback(
    async (signal) => {
      let view
      try {
        view = await fetchSchedule({ signal })
      } catch {
        return
      }
      const fresh = view.calls.filter((c) => seen.current && !seen.current.has(c.uid) && Date.parse(c.end) > Date.now())
      seen.current = new Set([...(seen.current || []), ...view.calls.map((c) => c.uid)])
      if (inflight.current || queued.current) {
        setData((d) => (d ? { ...d, calls: view.calls, busy: view.busy, calendar: view.calendar, syncedAt: view.syncedAt, calendarError: view.calendarError } : view))
      } else {
        setData(view)
        if (view.rev !== revRef.current) adopt(view)
      }
      for (const call of fresh.slice(-2)) {
        const start = Date.parse(call.start)
        notify({
          id: `call-${call.uid}`,
          icon: 'calendar',
          ms: start,
          zone: view.timeZone,
          title: 'New call booked',
          body: `${call.name} · ${fullShortDay(start, view.timeZone)} at ${formatTime(start, view.timeZone, twelve)}`,
          action: { label: 'Show', onClick: () => showCall(call) },
          ttl: 12000,
        })
      }
    },
    [adopt, notify, showCall, twelve],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    fetchSchedule({ signal: ctrl.signal })
      .then((view) => {
        seen.current = new Set(view.calls.map((c) => c.uid))
        setData(view)
        adopt(view)
        setLoad({ state: 'ready' })
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setLoad({ state: 'error', code: err?.code || 'failed' })
      })
    return () => ctrl.abort()
  }, [reload, adopt])

  const ready = load.state === 'ready' && data && draft
  const warming = data?.calendarError === 'warming'

  useEffect(() => {
    if (!ready) return
    const ctrl = new AbortController()
    const tick = () => {
      if (document.visibilityState === 'visible') refresh(ctrl.signal)
    }
    const timer = setInterval(tick, warming ? 5000 : POLL_MS)
    window.addEventListener('focus', tick)
    return () => {
      ctrl.abort()
      clearInterval(timer)
      window.removeEventListener('focus', tick)
    }
  }, [ready, warming, refresh])

  useEffect(() => {
    const warn = (e) => {
      if (!queued.current && !inflight.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const flush = useCallback(async () => {
    clearTimeout(debounce.current)
    if (inflight.current || !queued.current) return
    const body = queued.current
    const note = queuedNote.current
    queued.current = null
    queuedNote.current = null
    inflight.current = true
    setStatus({ mode: 'saving', note: null })
    clearTimeout(statusTimer.current)
    let again = false
    try {
      const view = await saveSchedule({ ...body, rev: revRef.current })
      revRef.current = view.rev
      setData(view)
      if (queued.current) again = true
      else {
        adopt(view)
        flashStatus('saved', note)
      }
    } catch (err) {
      if (err?.code === 'conflict' && err.schedule) {
        setData(err.schedule)
        adopt(err.schedule)
        queued.current = null
        flashStatus('conflict', null, 3600)
      } else {
        if (!queued.current) {
          queued.current = body
          queuedNote.current = note
        }
        setStatus({ mode: 'error', note: SCHEDULE_ERRORS[err?.code] || SCHEDULE_ERRORS.failed })
      }
    } finally {
      inflight.current = false
    }
    if (again) flush()
  }, [adopt, flashStatus])

  const change = (fn, { note = null, immediate = false } = {}) => {
    const next = fn(draftRef.current)
    draftRef.current = next
    setDraft(next)
    queued.current = next
    if (note || !queuedNote.current) queuedNote.current = note
    clearTimeout(debounce.current)
    if (immediate) flush()
    else debounce.current = setTimeout(flush, SAVE_DELAY)
  }

  const callsByDay = useMemo(() => {
    const map = new Map()
    if (!data || !zone) return map
    for (const call of data.calls) {
      const startMs = Date.parse(call.start)
      const endMs = Date.parse(call.end)
      const key = dateKey(startMs, zone)
      const entry = { ...call, startMs, endMs, from: minutesIn(startMs, zone) }
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(entry)
    }
    for (const list of map.values()) list.sort((a, b) => a.startMs - b.startMs)
    return map
  }, [data, zone])

  const busyByDay = useMemo(() => {
    const map = new Map()
    if (!data || !zone) return map
    for (const [a, b] of data.busy) {
      const start = Date.parse(a)
      const end = Date.parse(b)
      const first = dateKey(start, zone)
      const last = dateKey(end - 1, zone)
      for (let key = first; key <= last; key = shiftDay(key, 1)) {
        const from = key === first ? minutesIn(start, zone) : 0
        const to = key === last ? minutesIn(end, zone) || DAY_MINUTES : DAY_MINUTES
        if (!map.has(key)) map.set(key, [])
        map.get(key).push({ from, to: to <= from ? DAY_MINUTES : to })
      }
    }
    return map
  }, [data, zone])

  const slotsByDay = useMemo(() => (data && zone ? groupByDay(data.slots, zone) : new Map()), [data, zone])

  const infoFor = useMemo(() => {
    const cache = new Map()
    return (key) => {
      if (cache.has(key)) return cache.get(key)
      const weekday = weekdayOf(key)
      const windows = draft ? draft.hours.filter((w) => w.day === weekday).sort((a, b) => a.start - b.start) : []
      const blocks = draft ? draft.blocks.filter((b) => occursOn(b, key)) : []
      const info = {
        key,
        weekday,
        windows,
        blocks,
        calls: callsByDay.get(key) || [],
        busy: busyByDay.get(key) || [],
        slots: slotsByDay.get(key) || [],
        closed: !windows.length,
        blocked: blocks.some(isAllDay) || (windows.length > 0 && freeMinutes(windows, blocks) === 0),
        past: Boolean(today) && key < today,
      }
      cache.set(key, info)
      return info
    }
  }, [draft, callsByDay, busyByDay, slotsByDay, today])

  const upcoming = useMemo(() => (data ? data.calls.filter((c) => Date.parse(c.end) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)) : []), [data, now])

  const activeDay = selected || today
  const activeMonth = month || (activeDay ? monthOf(activeDay) : null)

  const clashesFor = (block) => {
    if (!zone) return []
    return upcoming
      .map((c) => {
        const start = Date.parse(c.start)
        const key = dateKey(start, zone)
        const from = minutesIn(start, zone)
        return { name: c.name, key, minute: from, end: from + Math.round((Date.parse(c.end) - start) / MINUTE) }
      })
      .filter((c) => occursOn(block, c.key) && overlaps(block, c.minute, c.end))
  }

  const restoreFocus = () =>
    requestAnimationFrame(() => {
      const was = opener.current
      const el = was?.isConnected ? was : was?.id && document.getElementById(was.id)
      el?.focus({ preventScroll: true })
    })

  const openSheet = (next, el) => {
    opener.current = el || null
    setSheet({ ...next, at: Date.now() })
  }

  const closeSheet = () => {
    setSheet(null)
    restoreFocus()
  }

  const freshBlock = (key, allDay) => {
    const windows = infoFor(key).windows
    const start = windows.length ? windows[0].start : 12 * 60
    return { id: newBlockId(), date: key, start: allDay ? null : start, end: allDay ? null : Math.min(start + 60, DAY_MINUTES), repeat: 'none', until: null, except: [], label: '' }
  }

  const newBlock = (key, allDay, el) => openSheet({ block: freshBlock(key < today ? today : key, allDay), from: null, editing: false }, el)
  const editBlock = (block, from, el) => openSheet({ block, from, editing: true }, el)

  const saveBlock = (block) => {
    const editing = sheet?.editing
    change((d) => ({ ...d, blocks: editing ? d.blocks.map((b) => (b.id === block.id ? block : b)) : [...d.blocks, block] }), {
      note: editing ? 'Block saved' : block.start === null && block.repeat === 'none' ? `${dayLabel(block.date)} blocked` : 'Time blocked',
      immediate: true,
    })
    setSelected(block.date)
    setMonth(monthOf(block.date))
    closeSheet()
  }

  const focusLater = (id) => requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }))

  const deleteBlock = (block, { note = 'Block removed', focus = 'day-block-time' } = {}) => {
    change((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== block.id) }), { note, immediate: true })
    setSheet(null)
    opener.current = null
    focusLater(focus)
  }

  const skipDay = (block, key, { focus = 'day-block-time' } = {}) => {
    change((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === block.id ? { ...b, except: [...new Set([...(b.except || []), key])].sort() } : b)) }), { note: `${dayLabel(key)} unblocked`, immediate: true })
    setSheet(null)
    opener.current = null
    focusLater(focus)
  }

  const unblockDay = (block, key) =>
    block.repeat === 'none' ? deleteBlock(block, { note: `${dayLabel(key)} unblocked`, focus: 'day-block-day' }) : skipDay(block, key, { focus: 'day-block-day' })

  const setPaused = (paused) => change((d) => ({ ...d, paused }), { note: paused ? 'Booking paused' : 'Booking open', immediate: true })

  const setHours = (hours, note) => change((d) => ({ ...d, hours }), { note: note || 'Hours saved' })

  const goToHours = (weekday) => {
    const row = document.getElementById(`hours-${weekday}`)
    if (!row) return
    row.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    setFlashDay(weekday)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashDay(null), 1800)
    document.getElementById(`hours-switch-${weekday}`)?.focus({ preventScroll: true })
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${BOOK_PATH}`)
      flashStatus('copied', 'Link to /book copied')
    } catch {
      flashStatus('error', 'Couldn’t copy the link', 2400)
    }
  }

  let mode = 'loading'
  if (sheet) mode = 'sheet'
  else if (status.mode !== 'idle') mode = status.mode
  else if (ready && draft.paused) mode = 'paused'
  else if (ready) mode = upcoming.length ? 'next' : 'none'

  const sheetNode =
    sheet && ready ? (
      <BlockSheet
        key={sheet.at}
        block={sheet.block}
        from={sheet.from}
        editing={sheet.editing}
        today={today}
        twelve={twelve}
        modKey={MOD_KEY}
        clashesFor={clashesFor}
        onCancel={closeSheet}
        onSave={saveBlock}
        onDelete={() => deleteBlock(sheet.block)}
        onSkip={(key) => skipDay(sheet.block, key)}
      />
    ) : null

  return (
    <div className="book-ui flex min-h-dvh flex-col bg-bg text-ink antialiased selection:bg-selection selection:text-ink-strong animate-view-in">
      <header className="sched-header sticky top-0 z-40">
        <div className="relative mx-auto flex h-16 w-full max-w-282 items-center justify-between px-4 sm:px-6">
          <a
            {...link(dashboardPath())}
            className={`group -ms-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13.5px] font-medium text-ink-muted transition-colors duration-150 hover:text-ink-strong ${FOCUS}`}
          >
            <Icon name="arrowLeft" className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
            <span className="max-[400px]:sr-only">Dashboard</span>
          </a>
          <ScheduleIsland
            mode={mode}
            call={upcoming[0] || null}
            now={now}
            zone={zone}
            twelve={twelve}
            note={status.note}
            onShow={showCall}
            onRetry={flush}
            onClose={closeSheet}
            sheet={sheetNode}
          />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} className={`-me-2 ${ICON_BUTTON}`} />
        </div>
      </header>

      <NoteStack notes={notes} onDismiss={dismiss} />

      <main className="flex flex-1 justify-center px-4 pb-16 pt-2 sm:px-6">
        <div className="w-full max-w-270 animate-rise-in">
          {load.state === 'error' ? (
            <LoadError
              code={load.code}
              onRetry={() => {
                setLoad({ state: 'loading' })
                setReload((n) => n + 1)
              }}
            />
          ) : !ready || !today ? (
            <PageSkeleton />
          ) : (
            <>
              {status.mode === 'error' && status.note && (
                <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/6 px-3.5 py-3 text-[13px] text-red-500">
                  <Icon name="alert" className="mt-px h-4 w-4" />
                  <span>
                    {status.note}{' '}
                    <button type="button" onClick={flush} className="cursor-pointer font-medium underline underline-offset-4">
                      Try again
                    </button>
                  </span>
                </p>
              )}

              <div className={CARD}>
                <Overview data={data} paused={draft.paused} zone={zone} now={now} upcoming={upcoming} onPause={setPaused} onCopy={copyLink} />
                <MonthView
                  month={activeMonth}
                  onMonth={setMonth}
                  today={today}
                  selected={activeDay}
                  onSelect={(key) => {
                    setSelected(key)
                    setMonth(monthOf(key))
                  }}
                  infoFor={infoFor}
                />
                <DayPanel
                  info={infoFor(activeDay)}
                  data={data}
                  paused={draft.paused}
                  zone={zone}
                  twelve={twelve}
                  now={now}
                  today={today}
                  flash={flash}
                  panelRef={panelRef}
                  onEditBlock={editBlock}
                  onNewBlock={newBlock}
                  onUnblock={unblockDay}
                  onHours={goToHours}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-4">
                  <UpcomingCalls calls={upcoming} zone={zone} twelve={twelve} now={now} onShow={showCall} onCopy={copyLink} />
                  <BlockList blocks={draft.blocks} today={today} twelve={twelve} onOpen={(block, el) => editBlock(block, null, el)} onNew={(el) => newBlock(activeDay, false, el)} />
                </div>
                <WeeklyHours hours={draft.hours} twelve={twelve} zone={zone} now={now} flashDay={flashDay} onChange={setHours} />
              </div>

              <p className="mt-6 text-center text-[13px] text-ink-subtle">
                All times are in {cityOf(zone, now)}.{data.custom ? '' : ' Weekly hours start from the server’s BOOKING_HOURS until you change them here.'}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
