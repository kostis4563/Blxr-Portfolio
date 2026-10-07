import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { SunIcon } from './components/sun-icon'
import { useAuth } from './lib/supabase'
import { loginUrlFor } from './lib/auth'
import { useAthensTemp } from './lib/weather'
import { link, dashboardPath, HOME_PATH, REVIEWS_PATH, USES_PATH, CV_PATH, PAYMENT_PATH } from './lib/router'
import { CONTACT_EMAIL } from './lib/profile'

const MESSAGES_PATH = dashboardPath('messages')

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const TEXT_LINK = 'rounded-sm text-ink-strong underline decoration-line-strong underline-offset-4 outline-none transition-colors duration-200 hover:decoration-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/50'
const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'
const TIME_ICON = 'mr-1.5 inline-block h-3 w-3 align-[-1.5px]'

const AWAKE_FROM = 9
const AWAKE_TO = 23

const FACTS = [
  { icon: 'clock', value: '1–2 days', label: 'Typical reply' },
  { icon: 'inbox', value: 'All of them', label: 'Emails answered' },
  { icon: 'globe', value: 'EN · GR', label: 'Languages' },
  { icon: 'pin', value: 'Athens', label: 'Based in' },
]

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function wallClock(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return {
    hour: parts.hour,
    minute: parts.minute,
    weekday: parts.weekday,
    at: Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute),
  }
}

function readClocks() {
  try {
    const now = new Date()
    const athens = wallClock(now, 'Europe/Athens')
    const local = wallClock(now, undefined)
    return { athens, local, gap: Math.round((athens.at - local.at) / 60_000) }
  } catch {
    return null
  }
}

function useClocks() {
  const [clocks, setClocks] = useState(null)

  useClientLayoutEffect(() => {
    let timer = 0
    const tick = () => {
      setClocks(readClocks())
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    }
    tick()
    return () => clearTimeout(timer)
  }, [])

  return clocks
}

function describeGap(minutes) {
  if (!minutes) return 'same time'
  const abs = Math.abs(minutes)
  const span = [Math.floor(abs / 60) && `${Math.floor(abs / 60)}h`, abs % 60 && `${abs % 60}m`].filter(Boolean).join(' ')
  return minutes > 0 ? `${span} behind` : `${span} ahead`
}

const pad = (n) => String(n).padStart(2, '0')
const awake = (hour) => hour >= AWAKE_FROM && hour < AWAKE_TO

function overlapHours(gap) {
  const shift = Math.round(gap / 60)
  return Array.from({ length: 24 }, (_, hour) => {
    const mine = awake((((hour + shift) % 24) + 24) % 24)
    const yours = awake(hour)
    return { mine, yours, both: mine && yours }
  })
}

function bestWindow(hours) {
  let best = null
  hours.forEach((hour, start) => {
    if (!hour.both || hours[(start + 23) % 24].both) return
    let length = 0
    while (length < 24 && hours[(start + length) % 24].both) length++
    if (!best || length > best.length) best = { start, length }
  })
  return best
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function Time({ clock, weekday }) {
  if (!clock) {
    return (
      <span className="text-ink-faint">
        <span aria-hidden="true" className={TIME_ICON} />
        --:--
      </span>
    )
  }
  const day = Number(clock.hour) >= 6 && Number(clock.hour) < 20
  return (
    <span className="text-ink-secondary">
      {day ? (
        <SunIcon className={`${TIME_ICON} text-amber-400`} />
      ) : (
        <Icon name="moon" className={`${TIME_ICON} text-ink-muted`} strokeWidth={2} />
      )}
      <span className="sr-only">{day ? 'Daytime, ' : 'Night, '}</span>
      {clock.hour}
      <span aria-hidden="true" className="animate-caret motion-reduce:animate-none">:</span>
      <span className="sr-only">:</span>
      {clock.minute}
      {weekday && <span className="text-ink-subtle"> {clock.weekday}</span>}
    </span>
  )
}

function LocalTime({ clocks }) {
  const tempC = useAthensTemp()
  const asleep = clocks !== null && Number(clocks.athens.hour) < 7
  const otherDay = clocks !== null && clocks.athens.weekday !== clocks.local.weekday

  return (
    <dl className="grid grid-cols-[auto_auto] items-baseline gap-x-4 gap-y-1.5 font-mono text-[11px] tabular-nums text-ink-subtle">
      <dt className="font-watom text-[12px]">Athens</dt>
      <dd>
        <Time clock={clocks?.athens} weekday={otherDay} />
        {tempC !== null && <> · {Math.round(tempC)}°C</>}
        {asleep && <> · probably asleep</>}
      </dd>
      <dt className="font-watom text-[12px]">You</dt>
      <dd>
        <Time clock={clocks?.local} weekday={otherDay} />
        {clocks && <> · {describeGap(clocks.gap)}</>}
      </dd>
    </dl>
  )
}

function cellColor(hour, row) {
  if (!hour[row]) return 'bg-line'
  return hour.both ? 'bg-emerald-400/80' : 'bg-ink-faint/50'
}

function Overlap({ clocks }) {
  const hours = overlapHours(clocks?.gap ?? 0)
  const best = clocks && bestWindow(hours)
  const now = clocks ? ((Number(clocks.local.hour) * 60 + Number(clocks.local.minute)) / 1440) * 100 : null

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={KICKER}>When we're both awake</p>
        <p className="font-mono text-[11.5px] tabular-nums text-ink-secondary">
          {!clocks ? ' ' : best ? `${pad(best.start)}:00–${pad((best.start + best.length) % 24)}:00 your time` : 'Not much overlap, email anyway'}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-[2.25rem_1fr] gap-x-3" aria-hidden="true">
        <div className="flex flex-col gap-1.5 font-mono text-[11px] text-ink-subtle">
          <span className="flex h-7 items-center">Me</span>
          <span className="flex h-7 items-center">You</span>
        </div>
        <div className="relative flex flex-col gap-1.5">
          {['mine', 'yours'].map((row) => (
            <div key={row} className="flex h-7 gap-[2px]">
              {hours.map((hour, i) => (
                <span key={i} className={`flex-1 rounded-[3px] transition-colors duration-500 ${clocks ? cellColor(hour, row) : 'bg-line'}`} />
              ))}
            </div>
          ))}
          {now !== null && (
            <span className="absolute -bottom-1 -top-1 w-0.5 -translate-x-1/2 rounded-full bg-ink-strong" style={{ left: `${now}%` }} />
          )}
        </div>
        <span />
        <div className="mt-2 flex justify-between font-mono text-[10px] tabular-nums text-ink-faint">
          {[0, 6, 12, 18, 24].map((hour) => (
            <span key={hour}>{pad(hour)}</span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-ink-subtle" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-ink-faint/50" />Awake</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-400/80" />Both awake</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 rounded-full bg-ink-strong" />Now</span>
      </div>
    </div>
  )
}

function CopyButton() {
  const [status, setStatus] = useState('idle')
  const timer = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    const ok = await copyText(CONTACT_EMAIL)
    setStatus(ok ? 'copied' : 'failed')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus('idle'), 2000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[12px] font-medium text-ink-muted outline-none transition-colors duration-200 hover:border-line-strong hover:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/50"
    >
      <Icon name={status === 'copied' ? 'check' : 'copy'} className="h-3 w-3" strokeWidth={2.2} />
      <span aria-live="polite">{status === 'copied' ? 'Copied' : status === 'failed' ? "Couldn't copy" : 'Copy'}</span>
    </button>
  )
}

function Facts() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {FACTS.map((fact) => (
        <li key={fact.label} className="rounded-lg border border-line bg-surface-raised p-4">
          <Icon name={fact.icon} className="h-4 w-4 text-ink-subtle" />
          <p className="mt-4 text-[17px] font-medium leading-none text-ink-strong">{fact.value}</p>
          <p className="mt-2 text-[12px] text-ink-subtle">{fact.label}</p>
        </li>
      ))}
    </ul>
  )
}

function MessageCard({ session }) {
  return (
    <a
      {...link(session ? MESSAGES_PATH : loginUrlFor(MESSAGES_PATH))}
      className="group flex items-center gap-4 rounded-lg border border-line p-4 outline-none transition-colors duration-200 hover:border-line-strong hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ink-strong/50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-raised text-ink-muted transition-colors duration-200 group-hover:text-ink-strong">
        <Icon name="message" className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-ink-strong">{session ? 'Your message thread' : 'Message me here'}</span>
        <span className="block text-[12.5px] text-ink-subtle">{session ? 'Pick up where you left off' : 'A private thread, after you sign in'}</span>
      </span>
      <Icon name="arrowRight" className="h-4 w-4 text-ink-faint transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-ink-strong" />
    </a>
  )
}

export default function ContactPage({ theme, onToggleTheme }) {
  const { session } = useAuth()
  const clocks = useClocks()

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
            <ThemeToggle
              theme={theme}
              onToggle={onToggleTheme}
              className="text-ink-muted hover:text-ink-strong transition-colors duration-200"
            />
          </div>
        </div>
      </header>

      <main className="w-full max-w-[960px] mx-auto flex flex-col min-h-screen pt-14 border-x border-dashed border-line bg-bg">
        <section className="px-6 pt-16 pb-16 sm:px-10 sm:pt-24 animate-rise-in">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <p className={KICKER}>/ contact</p>
            <LocalTime clocks={clocks} />
          </div>

          <div className="max-w-[680px]">
            <h1 className="mt-6 font-bagus text-[40px] leading-none tracking-[-0.01em] text-ink-strong sm:text-[52px]">Contact</h1>
            <p className="mt-5 text-[15px] leading-[1.6] text-ink-muted">
              Email is the best way to reach me. Short messages are fine, and I reply to all of them.
            </p>

            <div className="mt-10 border-t border-dashed border-line pt-8">
              <p className={KICKER}>Email</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
                <a href={`mailto:${CONTACT_EMAIL}`} className={`text-[20px] font-medium sm:text-[22px] ${TEXT_LINK}`}>
                  {CONTACT_EMAIL}
                </a>
                <CopyButton />
              </div>
            </div>

            <div className="mt-10 border-t border-dashed border-line pt-8">
              <Overlap clocks={clocks} />
            </div>

            <div className="mt-10 border-t border-dashed border-line pt-8">
              <Facts />
            </div>

            <div className="mt-10 border-t border-dashed border-line pt-8">
              <MessageCard session={session} />
            </div>
          </div>
        </section>

        <footer className="mt-auto px-6 pb-10 pt-16 sm:px-10">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(REVIEWS_PATH)} className={FOOT_LINK}>
              <span>Worked with me? Leave a review</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a {...link(PAYMENT_PATH)} className={FOOT_LINK}>
              <span>Payment</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a {...link(USES_PATH)} className={FOOT_LINK}>
              <span>Uses</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a {...link(CV_PATH)} className={FOOT_LINK}>
              <span>CV</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
