import { useEffect, useState } from 'react'
import { Icon } from './icon'
import { Sensitive, useMounted } from './sensitive'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/supabase'
import { loginUrlFor } from '../lib/auth'
import { link, dashboardPath, REVIEWS_PATH, NOW_PATH, USES_PATH, CV_PATH } from '../lib/router'
import { CONTACT_EMAIL, SOCIALS, SOCIAL_ICON_PATHS } from '../lib/profile'

const MESSAGES_PATH = dashboardPath('messages')
const PERKS = ['private', 'files', 'notify']

const ICON_BTN =
  'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-ink-subtle transition-colors duration-200 hover:bg-surface-hover hover:text-ink-strong disabled:cursor-default'
const ARROW_LINK = 'group inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-ink-muted transition-colors duration-200 hover:text-ink-strong'

function useOwnerOnline(enabled) {
  const [online, setOnline] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let room = null
    let alive = true
    import('../lib/messages-api').then((api) => {
      if (alive) room = api.lobby(false, { onOwnerHere: setOnline })
    })
    return () => {
      alive = false
      room?.leave()
      setOnline(false)
    }
  }, [enabled])
  return online
}

function Arrow() {
  return <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
}

function Row({ label, hint, children }) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-line py-4 last:border-b-0 sm:grid-cols-[7.5rem_1fr] sm:gap-6">
      <div className="sm:pt-px">
        <div className="text-[12px] font-watom text-ink-subtle">{label}</div>
        {hint && <div className="mt-0.5 text-[10.5px] text-ink-faint">{hint}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function MessageCard({ t, session, online }) {
  const signedIn = Boolean(session)
  return (
    <div className="rounded-[16px] border border-line bg-surface-raised/60 p-5 transition-colors duration-200 hover:border-line-strong sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-bg text-ink-secondary">
            <Icon name="message" className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div>
            <h3 className="text-[15px] font-medium tracking-tight text-ink-strong">{t('contact.dm.title')}</h3>
            <p className="text-[11.5px] text-ink-subtle">{t('contact.dm.kicker')}</p>
          </div>
        </div>
        {online && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-emerald-500/90">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {t('contact.dm.online')}
          </span>
        )}
      </div>

      <p className="mt-4 max-w-lg text-[13px] font-light leading-relaxed text-ink-muted">{t('contact.dm.body')}</p>

      <p className="mt-3 text-[11.5px] text-ink-subtle">
        {PERKS.map((key, i) => (
          <span key={key}>
            {i > 0 && <span aria-hidden="true" className="mx-2 text-ink-faint">·</span>}
            {t(`contact.dm.${key}`)}
          </span>
        ))}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          {...link(signedIn ? MESSAGES_PATH : loginUrlFor(MESSAGES_PATH))}
          className="group inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-ink-strong px-3.5 py-2 text-[12.5px] font-medium text-ink-inverse transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
        >
          <span>{signedIn ? t('contact.dm.open') : t('contact.dm.start')}</span>
          <Arrow />
        </a>
        {!signedIn && <span className="text-[11.5px] text-ink-faint">{t('contact.dm.note')}</span>}
      </div>
    </div>
  )
}

function EmailRow({ t, mounted }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
    }
  }
  const open = () => { window.location.href = `mailto:${CONTACT_EMAIL}` }

  return (
    <Row label={t('contact.email.kicker')} hint={t('contact.email.hint')}>
      <div className="flex items-center gap-1">
        {mounted ? (
          <Sensitive className="min-w-0 truncate font-mono text-[13px] text-ink-secondary" label={t('contact.email.reveal')}>
            {CONTACT_EMAIL}
          </Sensitive>
        ) : (
          <span aria-hidden="true" className="font-mono text-[13px] tracking-[0.1em] text-ink-faint">{'•'.repeat(20)}</span>
        )}

        <button type="button" onClick={copy} disabled={!mounted} aria-label={copied ? t('contact.copied') : t('contact.copy')} title={t('contact.copy')} className={`${ICON_BTN} ml-1`}>
          {copied ? (
            <svg aria-hidden="true" className="h-3.5 w-3.5 text-emerald-400/80" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l5 5 10-10.5" />
            </svg>
          ) : (
            <Icon name="copy" className="h-3.5 w-3.5" strokeWidth={1.8} />
          )}
        </button>
        <button type="button" onClick={open} disabled={!mounted} aria-label={t('contact.email.open')} title={t('contact.email.open')} className={ICON_BTN}>
          <Icon name="mail" className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </div>
    </Row>
  )
}

function SocialsRow({ t }) {
  return (
    <Row label={t('contact.elsewhere')}>
      <div className="flex flex-wrap gap-2">
        {SOCIALS.map((social) => {
          const Wrapper = social.url ? 'a' : 'span'
          const props = social.url ? { href: social.url, target: '_blank', rel: 'noreferrer' } : {}
          return (
            <Wrapper
              key={social.name}
              {...props}
              className={`inline-flex items-center gap-2 rounded-lg border border-line bg-surface-raised/60 px-2.5 py-1 text-[12px] text-ink-secondary transition-colors duration-200 ${
                social.url ? 'group cursor-pointer hover:border-line-strong hover:text-ink-strong' : ''
              }`}
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-subtle transition-colors duration-200 group-hover:text-ink-strong" fill="currentColor" viewBox="0 0 24 24">
                <path d={SOCIAL_ICON_PATHS[social.name]} />
              </svg>
              <span className="font-medium">{social.name}</span>
              {social.handle && <span className="text-ink-subtle">{social.handle}</span>}
            </Wrapper>
          )
        })}
      </div>
    </Row>
  )
}

export default function ContactSection() {
  const { t } = useI18n()
  const { session } = useAuth()
  const mounted = useMounted()
  const online = useOwnerOnline(Boolean(session))

  return (
    <section id="contact" className="scroll-mt-28 w-[calc(100%+3rem)] mt-16 border-t border-dashed border-line -mx-6 px-6 pt-12 text-left">
      <h2 className="mb-8 text-[20px] tracking-tight text-ink-strong font-vergilia">{t('home.contact')}</h2>

      <p className="mb-6 max-w-xl text-[13.5px] font-light leading-relaxed text-ink-muted">{t('contact.intro')}</p>

      <MessageCard t={t} session={session} online={online} />

      <div className="mt-2">
        <EmailRow t={t} mounted={mounted} />
        <SocialsRow t={t} />
        <Row label={t('contact.more')}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a {...link(REVIEWS_PATH)} className={ARROW_LINK}><span>{t('rev.cta')}</span><Arrow /></a>
            <a {...link(NOW_PATH)} className={ARROW_LINK}><span>{t('now.cta')}</span><Arrow /></a>
            <a {...link(USES_PATH)} className={ARROW_LINK}><span>{t('uses.cta')}</span><Arrow /></a>
            <a {...link(CV_PATH)} className={ARROW_LINK}><span>{t('cv.cta')}</span><Arrow /></a>
          </div>
        </Row>
      </div>

      <p className="mt-6 text-[11.5px] text-ink-faint">{t('contact.based')}</p>
    </section>
  )
}
