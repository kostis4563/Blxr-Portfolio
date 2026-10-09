import { useEffect, useRef, useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { useAuth } from './lib/supabase'
import { loginUrlFor } from './lib/auth'
import { link, dashboardPath, HOME_PATH, REVIEWS_PATH, USES_PATH, CV_PATH, PAYMENT_PATH } from './lib/router'
import { CONTACT_EMAIL, SOCIALS } from './lib/profile'

const MESSAGES_PATH = dashboardPath('messages')

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/50'
const ROW = `group flex items-baseline justify-between gap-6 border-b border-dashed border-line py-4 transition-colors duration-200 ${FOCUS}`
const ROW_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'
const FOOT_LINK = 'group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong'
const FOOT_ARROW = 'inline-block transition-transform duration-200 group-hover:translate-x-0.5'

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
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
      className={`rounded-sm text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors duration-200 hover:text-ink-strong hover:decoration-ink-strong ${FOCUS}`}
    >
      <span aria-live="polite">{status === 'copied' ? 'Copied' : status === 'failed' ? "Couldn't copy" : 'Copy email'}</span>
    </button>
  )
}

function Row({ name, detail, arrow, ...props }) {
  return (
    <li>
      <a {...props} className={ROW}>
        <span className="text-[15px] font-medium text-ink-strong">{name}</span>
        <span className="flex items-baseline gap-2 text-[13px] text-ink-subtle transition-colors duration-200 group-hover:text-ink-strong">
          <span className="font-mono">{detail}</span>
          <span aria-hidden="true" className={ROW_ARROW}>{arrow}</span>
        </span>
      </a>
    </li>
  )
}

export default function ContactPage({ theme, onToggleTheme }) {
  const { session } = useAuth()

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
          <p className={KICKER}>/ contact</p>
          <h1 className="mt-6 font-watom text-[44px] leading-[1.05] tracking-[-0.02em] text-ink-strong sm:text-[64px]">Say hello.</h1>
          <p className="mt-6 max-w-120 text-[15px] leading-[1.6] text-ink-muted">
            Projects, questions, or just a quick note. Email is the best way to reach me, and I read everything.
          </p>

          <div className="mt-16 border-t border-dashed border-line pt-10">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className={`group inline-flex flex-wrap items-baseline gap-x-4 rounded-sm text-[clamp(26px,5.6vw,52px)] font-medium leading-tight tracking-[-0.02em] text-ink-strong ${FOCUS}`}
            >
              <span className="break-all underline decoration-transparent decoration-2 underline-offset-10 transition-colors duration-300 group-hover:decoration-ink-strong">
                {CONTACT_EMAIL}
              </span>
              <span aria-hidden="true" className="text-ink-faint transition-[color,transform] duration-300 group-hover:translate-x-1 group-hover:text-ink-strong">→</span>
            </a>
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-subtle">
              <CopyButton />
              <span aria-hidden="true">·</span>
              <span>Replies within 1–2 days</span>
              <span aria-hidden="true">·</span>
              <span>Athens, Greece</span>
            </div>
          </div>

          <div className="mt-20 grid gap-y-4 sm:grid-cols-[180px_1fr]">
            <p className={`${KICKER} sm:pt-5`}>Elsewhere</p>
            <ul className="border-t border-dashed border-line">
              <Row
                {...link(session ? MESSAGES_PATH : loginUrlFor(MESSAGES_PATH))}
                name="Message on the site"
                detail={session ? 'your thread' : 'sign in'}
                arrow="→"
              />
              {SOCIALS.map((social) => (
                <Row
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  name={social.name}
                  detail={`@${social.handle}`}
                  arrow="↗"
                />
              ))}
            </ul>
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
