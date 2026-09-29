import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { useAuth } from './lib/supabase'
import { loginUrlFor } from './lib/auth'
import { useAthensTemp } from './lib/weather'
import { link, dashboardPath, HOME_PATH, REVIEWS_PATH, USES_PATH, CV_PATH } from './lib/router'
import { CONTACT_EMAIL, SOCIALS } from './lib/profile'

const MESSAGES_PATH = dashboardPath('messages')

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const GUTTER = 'px-6 sm:px-10'
const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]'

const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'

const EMAIL_CHARS = Array.from(CONTACT_EMAIL)

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

async function copyText(text, restoreFocusTo) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
    }
    area.remove()
    restoreFocusTo?.focus({ preventScroll: true })
    return ok
  }
}

function placePill(button, pill, point) {
  if (!button || !pill || !point) return
  const box = button.getBoundingClientRect()
  pill.style.transform = `translate3d(${point.x - box.left}px, ${point.y - box.top}px, 0)`
}

const TIME_ICON = 'mr-1.5 inline-block h-3 w-3 align-[-1.5px]'

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
      <Icon
        name={day ? 'sun' : 'moon'}
        className={`${TIME_ICON} ${day ? 'text-amber-400' : 'text-ink-muted'}`}
        strokeWidth={2}
      />
      <span className="sr-only">{day ? 'Daytime, ' : 'Night, '}</span>
      {clock.hour}
      <span aria-hidden="true" className="animate-caret motion-reduce:animate-none">:</span>
      <span className="sr-only">:</span>
      {clock.minute}
      {weekday && <span className="text-ink-subtle"> {clock.weekday}</span>}
    </span>
  )
}

function LocalTime() {
  const clocks = useClocks()
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

function CopyStatus({ status }) {
  if (status === 'copied') {
    return (
      <>
        <Icon name="check" className="h-3 w-3 text-emerald-400" strokeWidth={2.4} />
        <span className="text-ink-secondary">Copied to clipboard</span>
      </>
    )
  }
  if (status === 'failed') {
    return <span className="text-ink-secondary">Couldn't copy, use the mail link below</span>
  }
  return (
    <span>
      <span className="pointer-coarse:hidden">Click</span>
      <span className="hidden pointer-coarse:inline">Tap</span> to copy
    </span>
  )
}

function EmailCopy() {
  const [status, setStatus] = useState('idle')
  const [wave, setWave] = useState(0)
  const buttonRef = useRef(null)
  const pillRef = useRef(null)
  const pointer = useRef(null)
  const timer = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    const onScroll = () => {
      if (buttonRef.current?.matches(':hover')) placePill(buttonRef.current, pillRef.current, pointer.current)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const follow = (event) => {
    if (event.pointerType !== 'mouse') return
    pointer.current = { x: event.clientX, y: event.clientY }
    placePill(buttonRef.current, pillRef.current, pointer.current)
  }

  const copy = async () => {
    const ok = await copyText(CONTACT_EMAIL, buttonRef.current)
    setStatus(ok ? 'copied' : 'failed')
    if (ok) setWave((n) => n + 1)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus('idle'), ok ? 2000 : 4000)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className={KICKER}>Email</p>
        <p aria-live="polite" className="inline-flex min-w-0 items-center gap-1.5 text-right font-mono text-[11px] text-ink-subtle">
          <CopyStatus status={status} />
        </p>
      </div>

      <div className="contact-email-wrap">
        <button
          ref={buttonRef}
          type="button"
          onClick={copy}
          onPointerEnter={follow}
          onPointerMove={follow}
          aria-label={`Copy ${CONTACT_EMAIL}`}
          className="contact-email group relative -mx-2 inline-block max-w-[calc(100%+1rem)] rounded-xl px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50"
        >
          <span
            key={wave}
            data-wave={wave ? '' : undefined}
            aria-hidden="true"
            className="contact-email-text whitespace-nowrap font-semibold text-ink-strong"
          >
            {EMAIL_CHARS.map((char, i) => (
              <span key={i} style={{ '--i': i }}>{char}</span>
            ))}
          </span>
          <span ref={pillRef} aria-hidden="true" className="contact-pill">
            <span className="items-center gap-1.5 whitespace-nowrap rounded-full bg-ink-strong px-3 py-1.5 text-[12px] font-medium text-ink-inverse shadow-[0_10px_24px_-12px_var(--shadow-cast)]">
              <Icon name={status === 'copied' ? 'check' : 'copy'} className="h-3 w-3" strokeWidth={2.2} />
              {status === 'copied' ? 'Copied' : 'Copy'}
            </span>
          </span>
        </button>
      </div>

      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="group inline-flex w-fit items-center gap-1.5 rounded-md text-[13px] text-ink-muted outline-none transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
      >
        <span>or open it in your mail app</span>
        <Icon
          name="arrowUpRight"
          className={`h-3.5 w-3.5 text-ink-faint transition-[color,transform] duration-300 ${EASE} group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-ink-strong`}
        />
      </a>
    </div>
  )
}

function ChannelRow({ index, name, detail, mono, external, props }) {
  return (
    <li className="border-b border-dashed border-line animate-rise-in" style={{ animationDelay: `${340 + index * 60}ms` }}>
      <a
        {...props}
        className={`contact-row group relative grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-strong/40 sm:grid-cols-[3rem_1fr_auto_2rem] sm:py-7 ${GUTTER}`}
      >
        <span aria-hidden="true" className="contact-row-fill absolute inset-0 bg-surface-raised" />
        <span className="relative font-mono text-[11px] tabular-nums text-ink-faint transition-colors duration-300 group-hover:text-ink-muted">
          {String(index).padStart(2, '0')}
        </span>
        <span className="relative min-w-0">
          <span className={`block font-bagus text-[24px] leading-none tracking-[-0.01em] text-ink-strong transition-transform duration-500 ${EASE} group-hover:translate-x-1.5 sm:text-[32px]`}>
            {name}
          </span>
          <span className={`mt-1.5 block truncate text-ink-subtle sm:hidden ${mono ? 'font-mono text-[11px]' : 'text-[12.5px]'}`}>{detail}</span>
        </span>
        <span className={`relative hidden text-right text-ink-subtle transition-colors duration-300 group-hover:text-ink-secondary sm:block ${mono ? 'font-mono text-[12px]' : 'text-[13px]'}`}>
          {detail}
        </span>
        <span aria-hidden="true" className="relative flex justify-end text-ink-faint transition-colors duration-300 group-hover:text-ink-strong">
          <Icon
            name={external ? 'arrowUpRight' : 'arrowRight'}
            className={`h-4 w-4 transition-transform duration-500 ${EASE} ${external ? 'group-hover:-translate-y-0.5 group-hover:translate-x-0.5' : 'group-hover:translate-x-1'}`}
          />
        </span>
      </a>
    </li>
  )
}

function Channels() {
  const { session } = useAuth()

  const rows = [
    {
      name: session ? 'Your thread' : 'Message me here',
      detail: session ? 'Pick up where you left off' : 'A private thread, after you sign in',
      props: link(session ? MESSAGES_PATH : loginUrlFor(MESSAGES_PATH)),
    },
    ...SOCIALS.filter((social) => social.url).map((social) => ({
      name: social.name,
      detail: social.handle,
      mono: true,
      external: true,
      props: { href: social.url, target: '_blank', rel: 'noreferrer' },
    })),
  ]

  return (
    <section aria-labelledby="contact-elsewhere">
      <h2 id="contact-elsewhere" className={`${KICKER} ${GUTTER} pb-4 pt-14 animate-rise-in`} style={{ animationDelay: '300ms' }}>
        Elsewhere
      </h2>
      <ul className="border-t border-dashed border-line">
        {rows.map((row, i) => (
          <ChannelRow key={row.name} index={i + 1} {...row} />
        ))}
      </ul>
    </section>
  )
}

export default function ContactPage({ theme, onToggleTheme }) {
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
        <section className={`${GUTTER} pt-16 pb-14 sm:pt-24 sm:pb-20`}>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 animate-rise-in">
            <p className={KICKER}>/ contact</p>
            <LocalTime />
          </div>
          <h1
            className="contact-title mt-8 font-bagus text-[48px] leading-[0.95] tracking-[-0.02em] text-ink-strong sm:text-[96px] animate-fade-in-up"
            style={{ animationDelay: '60ms' }}
          >
            Let's <span className="hl-word">talk</span>
          </h1>
          <p
            className="mt-6 max-w-[46ch] text-[15px] leading-[1.6] text-ink-muted animate-fade-in-up"
            style={{ animationDelay: '150ms' }}
          >
            Email is the reliable one. It doesn't need to be long, and I reply to all of it, one-liners included.
          </p>
        </section>

        <section
          aria-label="Email"
          className={`border-y border-dashed border-line py-10 sm:py-14 animate-rise-in ${GUTTER}`}
          style={{ animationDelay: '220ms' }}
        >
          <EmailCopy />
        </section>

        <Channels />

        <footer className={`mt-auto pb-10 pt-16 ${GUTTER}`}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(REVIEWS_PATH)} className={FOOT_LINK}>
              <span>Worked with me? Leave a review</span>
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
