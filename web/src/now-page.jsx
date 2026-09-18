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
  NOW_LEARNING,
  NOW_BUILDING,
  NOW_STUDYING,
  NOW_ALSO,
  NOW_NEXT,
  NOW_NOT,
} from './lib/now'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const CARD = 'rounded-[18px] border border-line bg-surface-raised/50 transition-colors duration-200 hover:border-line-strong'
const CHIP = 'inline-flex items-center rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-[10.5px] text-ink-subtle'

const MAX_LEVEL = 4
const LEVEL_LABEL = ['', 'Just started', 'Getting comfortable', 'Daily use', 'Going deep']

const STATUS_STYLE = {
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

function SectionHeading({ kicker, title, aside, id }) {
  return (
    <div className="mb-5 flex w-full items-end justify-between gap-4">
      <div>
        <p className={`${KICKER} mb-2`}>{kicker}</p>
        <h2 id={id} className="text-[22px] font-semibold tracking-tight text-ink-strong sm:text-[24px]">
          {title}
        </h2>
      </div>
      {aside && <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">{aside}</span>}
    </div>
  )
}

function LevelMeter({ level, name }) {
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`${name}: ${LEVEL_LABEL[level]}`}
      title={LEVEL_LABEL[level]}
    >
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-1.5 w-4 rounded-full transition-colors duration-300 ${
            i < level ? 'bg-ink-strong' : 'bg-line-strong'
          }`}
        />
      ))}
    </div>
  )
}

function LearningCard({ item, index }) {
  return (
    <li
      className={`${CARD} flex flex-col gap-3 p-4 sm:p-5 animate-rise-in`}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-ink-strong">{item.name}</h3>
        <LevelMeter level={item.level} name={item.name} />
      </div>
      <p className="text-[13px] leading-relaxed text-ink-muted">{item.note}</p>
      {item.tags?.length > 0 && (
        <ul className="mt-auto flex flex-wrap gap-1.5 pt-1" aria-label="Topics">
          {item.tags.map((tag) => (
            <li key={tag} className={CHIP}>
              {tag}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function BuildingRow({ item }) {
  const external = item.href && !item.internal
  const linkProps = !item.href
    ? null
    : external
      ? { href: item.href, target: '_blank', rel: 'noreferrer' }
      : link(item.href)

  return (
    <li className="group flex gap-4 border-b border-dashed border-line py-5 last:border-b-0">
      <span className="relative mt-[7px] flex h-2 w-2 shrink-0">
        {item.status === 'active' && (
          <span
            aria-hidden="true"
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden ${STATUS_STYLE.active}`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${STATUS_STYLE[item.status] || STATUS_STYLE.paused}`} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-strong">{item.name}</h3>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle">{item.status}</span>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{item.note}</p>
        {linkProps && (
          <a
            {...linkProps}
            className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-secondary transition-colors duration-200 hover:text-ink-strong"
          >
            <span>{item.hrefLabel || item.href}</span>
            <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">
              {external ? '↗' : '→'}
            </span>
          </a>
        )}
      </div>
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
            <span>{t('now.kicker')}</span>
            <span aria-hidden="true">/</span>
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
                <time dateTime={NOW_UPDATED} className="text-ink-secondary">
                  {updated}
                </time>
                {age != null && age > 0 && (
                  <span className="ms-1.5 text-ink-faint tabular-nums">· {t('now.daysAgo', { n: age })}</span>
                )}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="font-mono uppercase tracking-wider text-[10.5px]">{t('now.status')}</dt>
              <dd className="inline-flex items-center gap-1.5 text-ink-secondary">
                <span className="relative flex h-1.5 w-1.5">
                  <span aria-hidden="true" className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                {t('now.statusValue')}
              </dd>
            </div>
          </dl>
        </div>

        {/* Learning */}
        <section aria-labelledby="now-learning" className="w-full mb-16">
          <SectionHeading
            id="now-learning"
            kicker="01"
            title={t('now.learning')}
            aside={`${NOW_LEARNING.length} ${t('now.topics')}`}
          />
          <ul className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            {NOW_LEARNING.map((item, index) => (
              <LearningCard key={item.name} item={item} index={index} />
            ))}
          </ul>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] text-ink-faint">
            {LEVEL_LABEL.slice(1).map((label, i) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className="inline-flex gap-0.5" aria-hidden="true">
                  {Array.from({ length: MAX_LEVEL }, (_, j) => (
                    <span key={j} className={`h-1 w-2 rounded-full ${j <= i ? 'bg-ink-subtle' : 'bg-line-strong'}`} />
                  ))}
                </span>
                {label}
              </span>
            ))}
          </p>
        </section>

        {/* Building */}
        <section aria-labelledby="now-building" className="w-full mb-16">
          <SectionHeading id="now-building" kicker="02" title={t('now.building')} />
          <ul className="w-full">
            {NOW_BUILDING.map((item) => (
              <BuildingRow key={item.name} item={item} />
            ))}
          </ul>
        </section>

        {/* Studying */}
        <section aria-labelledby="now-studying" className="w-full mb-16">
          <SectionHeading id="now-studying" kicker="03" title={t('now.studying')} />
          <div className={`${CARD} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-[17px] font-semibold tracking-tight text-ink-strong">{NOW_STUDYING.programme}</h3>
              <span className="font-mono text-[11px] text-ink-subtle">{NOW_STUDYING.where}</span>
            </div>
            <p className="mt-2 max-w-[560px] text-[13.5px] leading-relaxed text-ink-muted">{NOW_STUDYING.note}</p>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto]">
              <div>
                <p className={`${KICKER} mb-3`}>{t('now.subjects')}</p>
                <ul className="flex flex-wrap gap-2">
                  {NOW_STUDYING.subjects.map((subject) => (
                    <li
                      key={subject.name}
                      className={`rounded-[10px] border px-3 py-1.5 text-[12.5px] transition-colors duration-200 ${
                        subject.focus
                          ? 'border-ink-strong bg-surface-inverted font-semibold text-ink-on-inverted'
                          : 'border-line bg-surface text-ink-secondary'
                      }`}
                    >
                      {subject.name}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="sm:border-s sm:border-dashed sm:border-line sm:ps-6">
                <p className={`${KICKER} mb-3`}>{t('now.core')}</p>
                <ul className="flex flex-col gap-1.5 text-[12.5px] text-ink-secondary">
                  {NOW_STUDYING.core.map((part) => (
                    <li key={part} className="flex items-center gap-2">
                      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-ink-subtle" />
                      {part}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 border-t border-dashed border-line pt-4">
              <p className={`${KICKER} mb-3`}>{t('now.csTopics')}</p>
              <ul className="flex flex-wrap gap-1.5">
                {NOW_STUDYING.topics.map((topic) => (
                  <li key={topic} className={CHIP}>
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Next up + Not doing */}
        <section aria-labelledby="now-next" className="w-full mb-16">
          <SectionHeading id="now-next" kicker="04" title={t('now.next')} />
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
            <div className={`${CARD} p-5`}>
              <p className={`${KICKER} mb-4`}>{t('now.queued')}</p>
              <ol className="flex flex-col gap-3">
                {NOW_NEXT.map((item, index) => (
                  <li key={item} className="flex gap-3 text-[13px] leading-relaxed text-ink-secondary">
                    <span className="mt-[3px] font-mono text-[10.5px] tabular-nums text-ink-faint">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className={`${CARD} border-dashed p-5`}>
              <p className={`${KICKER} mb-4`}>{t('now.notDoing')}</p>
              <ul className="flex flex-col gap-3">
                {NOW_NOT.map((item) => (
                  <li key={item} className="flex gap-3 text-[13px] leading-relaxed text-ink-muted">
                    <span aria-hidden="true" className="mt-[2px] font-mono text-[11px] text-ink-faint">
                      ×
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Also */}
        <section aria-labelledby="now-also" className="w-full mb-16">
          <SectionHeading id="now-also" kicker="05" title={t('now.also')} />
          <dl className="grid w-full grid-cols-1 gap-x-8 sm:grid-cols-2">
            {NOW_ALSO.map((row) => (
              <div key={row.label} className="flex items-baseline gap-4 border-b border-dashed border-line py-3">
                <dt className="w-[84px] shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle">{row.label}</dt>
                <dd className="text-[13px] text-ink-secondary">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

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
