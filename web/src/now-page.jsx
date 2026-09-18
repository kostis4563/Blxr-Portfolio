import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { useI18n, LOCALE_TAGS } from './lib/i18n'
import { link, HOME_PATH, PROJECTS_PATH, REVIEWS_PATH } from './lib/router'
import { CONTACT_EMAIL, GITHUB_URL } from './lib/profile'
import { MailTo, Sensitive, useMounted } from './components/sensitive'
import {
  NOW_UPDATED,
  NOW_LOCATION,
  NOW_INTRO,
  NOW_WORK,
  NOW_LEARNING,
  NOW_NEXT,
  NOW_NOT,
} from './lib/now'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'

const STATUS_DOT = {
  active: 'bg-emerald-500',
  ongoing: 'bg-brand-indigo',
  paused: 'bg-ink-faint',
}

function formatUpdated(iso, lang) {
  const date = new Date(`${iso}T00:00:00Z`)
  try {
    return new Intl.DateTimeFormat(LOCALE_TAGS[lang] || 'en', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date)
  } catch {
    return iso
  }
}

function daysSince(iso) {
  const then = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

function Section({ id, title, children }) {
  return (
    <section aria-labelledby={id} className="w-full mb-14">
      <h2 id={id} className="mb-5 text-[17px] font-semibold tracking-tight text-ink-strong">
        {title}
      </h2>
      {children}
    </section>
  )
}

function WorkRow({ item }) {
  const external = item.href && !item.internal
  const linkProps = !item.href
    ? null
    : external
      ? { href: item.href, target: '_blank', rel: 'noreferrer' }
      : link(item.href)

  return (
    <li className="group flex items-start gap-4 border-b border-dashed border-line py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-strong">{item.name}</h3>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle">{item.status}</span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{item.note}</p>
        {linkProps && (
          <a
            {...linkProps}
            className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-secondary transition-colors duration-200 hover:text-ink-strong"
          >
            <span>{item.hrefLabel || item.href}</span>
            <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">
              {external ? '↗' : '→'}
            </span>
          </a>
        )}
      </div>
      <span
        aria-hidden="true"
        className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[item.status] || STATUS_DOT.paused}`}
      />
    </li>
  )
}

export default function NowPage({ theme, onToggleTheme }) {
  const { t, lang } = useI18n()
  const updated = formatUpdated(NOW_UPDATED, lang)
  const age = daysSince(NOW_UPDATED)
  const mounted = useMounted()

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[880px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
            <span>{t('proj.backHome')}</span>
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

      <main className="w-full max-w-[880px] mx-auto px-5 sm:px-8 pt-24 pb-24 flex flex-col items-start min-h-screen bg-bg animate-rise-in">
        {/* Intro */}
        <div className="w-full max-w-[640px] mb-14 text-left">
          <p className={`${KICKER} mb-4 flex flex-wrap items-center gap-x-2 gap-y-1`}>
            <span>/ {t('now.kicker')}</span>
            <span aria-hidden="true">·</span>
            <span>{NOW_LOCATION}</span>
          </p>
          <h1 className="text-[34px] sm:text-[40px] font-bold text-ink-strong tracking-[-0.035em] leading-tight mb-4">
            {t('now.title')}
          </h1>
          <p className="text-[15px] sm:text-[16px] text-ink-muted font-normal leading-relaxed">{NOW_INTRO}</p>

          <dl className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-ink-subtle">
            <div className="flex items-center gap-2">
              <dt className="font-mono uppercase tracking-wider text-[10.5px]">{t('now.updated')}</dt>
              <dd>
                <time dateTime={NOW_UPDATED}>{updated}</time>
                {age != null && age > 0 && (
                  <span className="ms-1.5 text-ink-faint tabular-nums">· {t('now.daysAgo', { n: age })}</span>
                )}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="font-mono uppercase tracking-wider text-[10.5px]">{t('now.status')}</dt>
              <dd className="inline-flex items-center gap-1.5 text-ink-secondary">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t('now.statusOpen')}
              </dd>
            </div>
          </dl>
        </div>

        {/* Working on */}
        <Section id="now-work" title={t('now.work')}>
          <ul className="w-full">
            {NOW_WORK.map((item) => (
              <WorkRow key={item.name} item={item} />
            ))}
          </ul>
        </Section>

        {/* Learning */}
        <Section id="now-learning" title={t('now.learning')}>
          <ul className="w-full">
            {NOW_LEARNING.map((item) => (
              <li key={item.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-dashed border-line py-3 last:border-b-0">
                <span className="text-[13.5px] font-semibold tracking-tight text-ink-strong">{item.name}</span>
                <span className="text-[13px] leading-relaxed text-ink-muted">{item.note}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Next up + Not doing */}
        <Section id="now-next" title={t('now.next')}>
          <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
            <ul>
              {NOW_NEXT.map((item, index) => (
                <li key={item} className="flex gap-3 border-b border-dashed border-line py-3 text-[13px] leading-relaxed text-ink-secondary last:border-b-0">
                  <span className="mt-[3px] font-mono text-[10.5px] tabular-nums text-ink-faint">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <ul>
              <li className="flex items-center gap-2 border-b border-dashed border-line py-3">
                <span aria-hidden="true" className={`${KICKER} flex-1`}>{t('now.notDoing')}</span>
              </li>
              {NOW_NOT.map((item) => (
                <li key={item} className="flex gap-3 border-b border-dashed border-line py-3 text-[13px] leading-relaxed text-ink-muted last:border-b-0">
                  <span aria-hidden="true" className="mt-[2px] font-mono text-[11px] text-ink-faint">
                    ×
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* Footer */}
        <footer className="w-full max-w-[640px] border-t border-dashed border-line pt-8">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {t('now.footer.about')}{' '}
            <a
              href="https://nownownow.com/about"
              target="_blank"
              rel="noreferrer"
              className="text-ink-secondary underline decoration-line-strong underline-offset-4 transition-colors duration-200 hover:text-ink-strong hover:decoration-ink-strong"
            >
              nownownow.com
            </a>
            . {t('now.footer.reach')}{' '}
            <MailTo
              email={CONTACT_EMAIL}
              className="text-ink-secondary underline decoration-line-strong underline-offset-4 transition-colors duration-200 hover:text-ink-strong hover:decoration-ink-strong"
            >
              <Sensitive interactive={false}>{mounted ? CONTACT_EMAIL : '\u2022'.repeat(20)}</Sensitive>
            </MailTo>
            .
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(PROJECTS_PATH)} className="group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong">
              <span>{t('proj.archiveTitle')}</span>
              <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </a>
            <a {...link(REVIEWS_PATH)} className="group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong">
              <span>{t('rev.title')}</span>
              <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong">
              <span>GitHub</span>
              <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">↗</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}