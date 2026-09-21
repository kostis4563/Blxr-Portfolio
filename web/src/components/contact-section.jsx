import { useState } from 'react'
import { Icon } from './icon'
import { useAuth } from '../lib/supabase'
import { loginUrlFor } from '../lib/auth'
import { link, dashboardPath, REVIEWS_PATH, USES_PATH, CV_PATH } from '../lib/router'
import { CONTACT_EMAIL, SOCIALS, SOCIAL_ICON_PATHS } from '../lib/profile'

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

// The address is the primary action: plain text, a mailto, and a copy button. No reveal step.
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

export default function ContactSection() {
  const { session } = useAuth()

  return (
    <section id="contact" className="scroll-mt-8 w-[calc(100%+3rem)] mt-16 border-t border-dashed border-line -mx-6 px-6 pt-12 text-left">
      <h2 className="mb-8 text-[20px] tracking-tight text-ink-strong font-vergilia">Contact</h2>

      <p className="mb-6 max-w-xl text-[13.5px] leading-relaxed text-ink-muted">
        Email is the reliable one. It doesn't need to be long, and I reply to all of it, one-liners included.
        If it's about a project, a link to whatever you have so far saves us both a round trip.
      </p>

      <EmailCard />

      {/* Second route: a private thread in the dashboard. Signed-out visitors go through login first. */}
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
    </section>
  )
}
