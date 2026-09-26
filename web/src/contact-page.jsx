import { useState } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { useAuth } from './lib/supabase'
import { loginUrlFor } from './lib/auth'
import { link, dashboardPath, HOME_PATH, REVIEWS_PATH, USES_PATH, CV_PATH } from './lib/router'
import { CONTACT_EMAIL, SOCIALS, SOCIAL_ICON_PATHS } from './lib/profile'

const MESSAGES_PATH = dashboardPath('messages')

const ARROW_LINK = 'group inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-ink-muted transition-colors duration-200 hover:text-ink-strong'

function Arrow() {
  return <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-line py-4 last:border-b-0 sm:grid-cols-[7.5rem_1fr] sm:gap-6">
      <div className="text-[12px] font-watom text-ink-subtle sm:pt-px">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function EmailCard() {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface-raised/60 p-5 sm:p-6">
      <p className="text-[12px] font-watom text-ink-subtle">Email</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          title="Open in your mail app"
          className="min-w-0 break-all font-mono text-[17px] tracking-tight text-ink-strong underline-offset-4 transition-colors duration-200 hover:underline sm:text-[20px]"
        >
          {CONTACT_EMAIL}
        </a>
        <button
          type="button"
          onClick={copy}
          aria-live="polite"
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] border border-line bg-bg px-3 text-[12.5px] font-medium text-ink transition-colors duration-200 hover:border-line-strong hover:text-ink-strong"
        >
          {copied ? (
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-emerald-400/80" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l5 5 10-10.5" />
            </svg>
          ) : (
            <Icon name="copy" className="h-3.5 w-3.5 text-ink-subtle" strokeWidth={1.8} />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function SocialsRow() {
  return (
    <Row label="Elsewhere">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {SOCIALS.map((social) => {
          const Wrapper = social.url ? 'a' : 'span'
          const props = social.url ? { href: social.url, target: '_blank', rel: 'noreferrer' } : {}
          return (
            <Wrapper
              key={social.name}
              {...props}
              className={`inline-flex items-center gap-2 text-[12.5px] text-ink-secondary transition-colors duration-200 ${
                social.url ? 'group cursor-pointer hover:text-ink-strong' : ''
              }`}
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-subtle transition-colors duration-200 group-hover:text-ink-strong" fill="currentColor" viewBox="0 0 24 24">
                <path d={SOCIAL_ICON_PATHS[social.name]} />
              </svg>
              <span className="font-medium">{social.name}</span>
              {social.handle && <span className="font-mono text-[12px] text-ink-subtle">{social.handle}</span>}
            </Wrapper>
          )
        })}
      </div>
    </Row>
  )
}

export default function ContactPage({ theme, onToggleTheme }) {
  const { session } = useAuth()

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
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

      <main className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-24 pb-24 flex flex-col items-start min-h-screen bg-bg animate-rise-in">
        <div className="w-full mb-10 text-left">
          <p className="text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em] mb-4">Get in touch</p>
          <h1 className="text-[34px] sm:text-[40px] font-bold text-ink-strong tracking-[-0.035em] leading-tight mb-4">
            Contact
          </h1>
          <p className="max-w-[640px] text-[15px] sm:text-[16px] text-ink-muted font-normal leading-relaxed">
            Email is the reliable one. It doesn't need to be long, and I reply to all of it, one-liners included.
            If it's about a project, a link to whatever you have so far saves us both a round trip.
          </p>
        </div>

        <div className="w-full text-left">
          <EmailCard />

          <a
            {...link(session ? MESSAGES_PATH : loginUrlFor(MESSAGES_PATH))}
            className="group mt-3 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line px-5 py-3.5 text-[13px] text-ink-muted transition-colors duration-200 hover:border-line-strong hover:text-ink-strong sm:px-6"
          >
            <Icon name="message" className="h-4 w-4 shrink-0 text-ink-subtle transition-colors duration-200 group-hover:text-ink-strong" strokeWidth={1.8} />
            <span className="flex-1">{session ? 'Open your thread' : 'Or start a private thread here. You\'ll need to sign in first.'}</span>
            <Arrow />
          </a>

          <div className="mt-2">
            <SocialsRow />
            <Row label="More">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <a {...link(REVIEWS_PATH)} className={ARROW_LINK}><span>Worked with me? Leave a review</span><Arrow /></a>
                <a {...link(USES_PATH)} className={ARROW_LINK}><span>The desk, the editor, the rest of it</span><Arrow /></a>
                <a {...link(CV_PATH)} className={ARROW_LINK}><span>CV</span><Arrow /></a>
              </div>
            </Row>
          </div>

          <p className="mt-6 text-[11.5px] text-ink-faint">Based in Athens, Greece · EET / EEST</p>
        </div>
      </main>
    </div>
  )
}
