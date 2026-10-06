import { useEffect, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { MailTo, useMounted } from './components/sensitive'
import { link, HOME_PATH, CONTACT_PATH } from './lib/router'
import { CONTACT_EMAIL } from './lib/profile'
import {
  SECURITY_UPDATED,
  SECURITY_EXPIRES,
  SECURITY_TXT_PATH,
  SECURITY_INTRO,
  SECURITY_SUBJECT,
  SECURITY_LANGUAGES,
  SECURITY_KEYS,
  SECURITY_STEPS,
  SECURITY_SCOPE,
  SECURITY_SAFE_HARBOUR,
  SECURITY_BOUNTY,
} from './lib/security'

const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-ink-subtle'
const BODY = 'text-[13.5px] leading-relaxed text-ink-muted'
const RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'
const MASK = '•'.repeat(20)

function formatDate(iso) {
  const date = new Date(`${iso}T00:00:00Z`)
  try {
    return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
  } catch {
    return iso
  }
}

function groupFingerprint(value) {
  const hex = value.replace(/\s+/g, '')
  if (!/^[0-9a-f]+$/i.test(hex)) return value
  return hex.toUpperCase().match(/.{1,4}/g).join(' ')
}

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle transition-colors duration-200 hover:bg-surface-hover hover:text-ink-strong ${RING}`}
    >
      <Icon name={copied ? 'check' : 'copy'} className={`h-3 w-3 ${copied ? 'text-emerald-400' : ''}`} strokeWidth={2} />
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

function Section({ id, title, children }) {
  return (
    <section aria-labelledby={id} className="grid w-full grid-cols-1 gap-3 border-t border-line py-8 sm:grid-cols-[8.5rem_1fr] sm:gap-6">
      <h2 id={id} className={`${LABEL} sm:pt-[3px]`}>
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function Report({ mounted }) {
  const email = mounted ? CONTACT_EMAIL : MASK
  return (
    <div className="w-full overflow-hidden rounded-xl border border-line bg-surface-raised">
      <dl className="divide-y divide-line text-[13px]">
        <div className="flex items-center gap-4 px-4 py-2.5">
          <dt className={`${LABEL} w-16 shrink-0`}>To</dt>
          <dd className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <span className="truncate font-medium text-ink-strong">{email}</span>
            {mounted && <CopyButton value={CONTACT_EMAIL} label="email address" />}
          </dd>
        </div>
        <div className="flex items-center gap-4 px-4 py-2.5">
          <dt className={`${LABEL} w-16 shrink-0`}>Subject</dt>
          <dd className="min-w-0 truncate text-ink-secondary">
            {SECURITY_SUBJECT}
            <span className="text-ink-faint">short title</span>
          </dd>
        </div>
      </dl>
      <div className="flex flex-col gap-4 border-t border-line px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-[400px] text-[13px] leading-relaxed text-ink-muted">
          What you found, the steps to reproduce it, what it affects, and a proof of concept if you have one.
        </p>
        <MailTo
          email={CONTACT_EMAIL}
          subject={SECURITY_SUBJECT}
          className={`group inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-ink-strong px-3.5 py-2 text-[12.5px] font-semibold text-ink-inverse transition-opacity duration-200 hover:opacity-85 sm:self-auto ${RING}`}
        >
          <span>Write a report</span>
          <span aria-hidden="true" className={FOOT_ARROW}>→</span>
        </MailTo>
      </div>
    </div>
  )
}

function Manifest({ mounted }) {
  const pgp = SECURITY_KEYS.find((key) => key.id === 'pgp')
  const lines = [
    ['Contact', `mailto:${mounted ? CONTACT_EMAIL : MASK}`],
    ['Expires', SECURITY_EXPIRES],
    ...(pgp?.href ? [['Encryption', pgp.href]] : []),
    ['Preferred-Languages', SECURITY_LANGUAGES.join(', ')],
    ['Policy', '/security'],
  ]
  return (
    <figure className="w-full">
      <figcaption className="mb-2 flex items-center justify-between gap-4">
        <span className={LABEL}>security.txt</span>
        <a href={SECURITY_TXT_PATH} target="_blank" rel="noreferrer" className={`group inline-flex items-center gap-1 rounded font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle transition-colors duration-200 hover:text-ink-strong ${RING}`}>
          <span>Raw</span>
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">↗</span>
        </a>
      </figcaption>
      <dl className="flex flex-col gap-1 rounded-xl border border-dashed border-line-strong px-4 py-3.5 font-mono text-[11.5px] leading-relaxed">
        {lines.map(([key, value]) => (
          <div key={key} className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] sm:gap-3">
            <dt className="text-ink-subtle">{key}:</dt>
            <dd className="min-w-0 break-all text-ink-secondary">{value}</dd>
          </div>
        ))}
      </dl>
    </figure>
  )
}

function Keys() {
  return (
    <ul className="flex flex-col divide-y divide-dashed divide-line">
      {SECURITY_KEYS.map((key) => (
        <li key={key.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-mono text-[12.5px] font-semibold tracking-tight text-ink-strong">{key.label}</h3>
            {key.fingerprint ? (
              <div className="flex items-center gap-1">
                {key.href && (
                  <a href={key.href} target="_blank" rel="noreferrer" className={`rounded-md px-1.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle transition-colors duration-200 hover:bg-surface-hover hover:text-ink-strong ${RING}`}>
                    Key ↗
                  </a>
                )}
                <CopyButton value={key.fingerprint} label={`${key.label} fingerprint`} />
              </div>
            ) : (
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">On request</span>
            )}
          </div>
          {key.fingerprint ? (
            <code className="block break-all font-mono text-[12px] leading-relaxed tracking-wide text-ink-secondary">{groupFingerprint(key.fingerprint)}</code>
          ) : (
            <p className="text-[13px] leading-relaxed text-ink-muted">Not published yet. Ask by email and I will send it over a channel you can verify.</p>
          )}
          <p className="text-[12.5px] text-ink-subtle">{key.note}</p>
        </li>
      ))}
    </ul>
  )
}

function Steps() {
  return (
    <ol className="flex flex-col">
      {SECURITY_STEPS.map((step, index) => (
        <li key={step.title} className="relative grid grid-cols-[2rem_1fr] gap-x-3 pb-6 last:pb-0">
          {index < SECURITY_STEPS.length - 1 && <span aria-hidden="true" className="absolute left-[0.6rem] top-6 bottom-1 w-px bg-line" />}
          <span className="font-mono text-[11px] tabular-nums leading-[22px] text-ink-faint">{String(index + 1).padStart(2, '0')}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <h3 className="text-[14px] font-medium leading-[22px] text-ink-strong">{step.title}</h3>
              <span className="font-mono text-[11px] tabular-nums text-ink-subtle">{step.when}</span>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function ScopeList({ title, items, mark }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2.5 text-[13px] font-medium text-ink-strong">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="grid grid-cols-[1rem_1fr] text-[13px] leading-relaxed text-ink-muted">
            <span aria-hidden="true" className="font-mono text-ink-faint">{mark}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function SecurityPage({ theme, onToggleTheme }) {
  const mounted = useMounted()

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[720px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
            <span>Home</span>
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

      <main className="w-full max-w-[720px] mx-auto px-5 sm:px-8 pt-28 pb-24 flex flex-col items-start bg-bg">
        <section aria-labelledby="security-title" className="w-full pb-10">
          <p className={`${LABEL} mb-3 animate-rise-in`}>/ security</p>
          <h1
            id="security-title"
            className="text-[30px] sm:text-[34px] font-semibold text-ink-strong tracking-[-0.03em] leading-tight animate-rise-in"
            style={{ animationDelay: '60ms' }}
          >
            Security
          </h1>
          <p className="mt-3 max-w-[560px] text-[14.5px] leading-relaxed text-ink-muted animate-rise-in" style={{ animationDelay: '120ms' }}>
            {SECURITY_INTRO}
          </p>
          <div className="mt-8 flex w-full flex-col gap-6 animate-rise-in" style={{ animationDelay: '180ms' }}>
            <Report mounted={mounted} />
            <Manifest mounted={mounted} />
          </div>
        </section>

        <Section id="security-keys" title="Keys">
          <Keys />
        </Section>

        <Section id="security-disclosure" title="Disclosure">
          <Steps />
        </Section>

        <Section id="security-scope" title="Scope">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <ScopeList title="In scope" items={SECURITY_SCOPE.in} mark="+" />
            <ScopeList title="Out of scope" items={SECURITY_SCOPE.out} mark="−" />
          </div>
        </Section>

        <Section id="security-safe-harbour" title="Safe harbour">
          <p className={BODY}>{SECURITY_SAFE_HARBOUR}</p>
        </Section>

        <Section id="security-bounty" title="Bug bounty">
          <p className={BODY}>{SECURITY_BOUNTY}</p>
        </Section>

        <footer className="flex w-full flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] text-ink-faint">
            Updated <time dateTime={SECURITY_UPDATED}>{formatDate(SECURITY_UPDATED)}</time>
            <span aria-hidden="true"> · </span>
            Expires <time dateTime={SECURITY_EXPIRES}>{formatDate(SECURITY_EXPIRES)}</time>
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(CONTACT_PATH)} className={FOOT_LINK}>
              <span>Other questions</span>
              <span aria-hidden="true" className={FOOT_ARROW}>→</span>
            </a>
            <a href={SECURITY_TXT_PATH} target="_blank" rel="noreferrer" className={FOOT_LINK}>
              <span>security.txt</span>
              <span aria-hidden="true" className={FOOT_ARROW}>↗</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
