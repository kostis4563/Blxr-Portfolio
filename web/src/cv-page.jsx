import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { useI18n, LOCALE_TAGS } from './lib/i18n'
import { link, HOME_PATH, PROJECTS_PATH, NOW_PATH, projectPath } from './lib/router'
import { projectsList, SHORT_KEY } from './lib/projects'
import { MailTo, Sensitive, useMounted } from './components/sensitive'
import {
  CV_UPDATED,
  CV_NAME,
  CV_HANDLE,
  CV_LOCATION,
  CV_TIMEZONE,
  CV_ROLE,
  CV_STATUS,
  CV_SUMMARY,
  CV_CONTACT,
  CV_EXPERIENCE,
  CV_PROJECT_IDS,
  CV_EDUCATION,
  CV_SKILLS,
  CV_TOOLS,
  CV_CERTIFICATIONS,
  CV_LANGUAGES,
} from './lib/cv'
import { SKILL_LEVELS, themedIconFor } from './lib/skills'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const CHIP = 'inline-flex items-center rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-[10.5px] text-ink-subtle'
const ROW = 'grid grid-cols-1 gap-1 border-b border-dashed border-line py-5 last:border-b-0 sm:grid-cols-[7.5rem_1fr] sm:gap-6'
const PERIOD = 'font-mono text-[11.5px] tabular-nums text-ink-subtle sm:pt-[3px]'
const LINK = 'text-ink-secondary underline decoration-line-strong underline-offset-4 transition-colors duration-200 hover:text-ink-strong hover:decoration-ink-strong'

const MAX_LEVEL = 4

// A piece of CV copy is either a plain string or `{ key, fallback }`.
const useCopy = (t) => (value) => (value && typeof value === 'object' ? t(value.key, null, value.fallback) : value)

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

function formatPeriod(period, t) {
  if (!period) return ''
  const end = period.present ? t('common.present') : period.to
  if (!end || end === period.from) return period.from
  return `${period.from} – ${end}`
}

function SectionHeading({ kicker, title, id }) {
  return (
    <div className="mb-2 flex w-full items-end justify-between gap-4">
      <div>
        <p className={`${KICKER} mb-2`}>{kicker}</p>
        <h2 id={id} className="text-[22px] font-semibold tracking-tight text-ink-strong sm:text-[24px]">
          {title}
        </h2>
      </div>
    </div>
  )
}

function LevelMeter({ level, label }) {
  const rank = SKILL_LEVELS[level]?.rank || 0
  return (
    <span className="inline-flex items-center gap-2" title={label}>
      <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
        {Array.from({ length: MAX_LEVEL }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`h-1 w-2.5 rounded-full ${i < rank ? 'bg-ink-strong' : 'bg-line-strong'}`}
          />
        ))}
      </span>
      <span className="hidden font-mono text-[10.5px] text-ink-faint print:inline sm:inline">{label}</span>
    </span>
  )
}

function ExternalLink({ href, children, className = LINK }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  )
}

function ContactRow({ item, mounted }) {
  const external = /^https?:/.test(item.href || '')
  const cls = `${LINK} inline-flex items-center gap-1`
  let node
  if (item.sensitive) {
    node = (
      <MailTo email={item.value} className={cls}>
        <Sensitive interactive={false}>{mounted ? item.value : '•'.repeat(20)}</Sensitive>
      </MailTo>
    )
  } else if (external) {
    node = (
      <ExternalLink href={item.href} className={cls}>
        <span>{item.value}</span>
        <span aria-hidden="true" className="print:hidden">↗</span>
      </ExternalLink>
    )
  } else {
    node = <span className="text-ink-secondary">{item.value}</span>
  }
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-[64px] shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle">{item.label}</dt>
      <dd className="min-w-0 truncate text-[13px]">{node}</dd>
    </div>
  )
}

function ExperienceRow({ entry, copy, t }) {
  const org = copy(entry.org)
  return (
    <li className={ROW}>
      <div className={PERIOD}>
        <div>{formatPeriod(entry.period, t)}</div>
        {entry.location && <div className="mt-1 text-[10.5px] text-ink-faint">{entry.location}</div>}
      </div>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-ink-strong">
          {copy(entry.role)}
          <span className="font-normal text-ink-subtle"> · </span>
          {entry.url ? (
            <ExternalLink href={entry.url} className="font-normal text-ink-muted transition-colors duration-200 hover:text-ink-strong">
              {org}
            </ExternalLink>
          ) : (
            <span className="font-normal text-ink-muted">{org}</span>
          )}
        </h3>
        {entry.summary && <p className="mt-1.5 max-w-[600px] text-[13px] leading-relaxed text-ink-muted">{copy(entry.summary)}</p>}
        {entry.bullets?.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {entry.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-secondary">
                <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-subtle" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
        {entry.stack?.length > 0 && (
          <ul className="mt-3.5 flex flex-wrap gap-1.5" aria-label={t('cv.stack')}>
            {entry.stack.map((tag) => (
              <li key={tag} className={CHIP}>
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

function ProjectRow({ project, t }) {
  const source = project.github
  const site = project.url && !/youtube\.com|youtu\.be/.test(project.url) ? project.url : null
  return (
    <li className={ROW}>
      <div className={PERIOD}>{project.date}</div>
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px] font-semibold leading-snug tracking-tight text-ink-strong">
          <a {...link(projectPath(project.id))} className="transition-colors duration-200 hover:text-ink-muted">
            {project.title}
          </a>
          <span className="font-mono text-[10.5px] font-normal uppercase tracking-wider text-ink-subtle">
            {t(`cat.${project.category}`, null, project.category)}
          </span>
        </h3>
        <p className="mt-1.5 max-w-[600px] text-[13px] leading-relaxed text-ink-muted">
          {t(SHORT_KEY[project.id], null, project.shortDescription)}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          {site && (
            <ExternalLink href={site} className={`${LINK} inline-flex items-center gap-1`}>
              <span>{site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
              <span aria-hidden="true" className="print:hidden">↗</span>
            </ExternalLink>
          )}
          {source && (
            <ExternalLink href={source} className={`${LINK} inline-flex items-center gap-1`}>
              <span>{source.replace(/^https?:\/\/(www\.)?/, '')}</span>
              <span aria-hidden="true" className="print:hidden">↗</span>
            </ExternalLink>
          )}
        </div>
        {project.tags?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('cv.stack')}>
            {project.tags.map((tag) => (
              <li key={tag} className={CHIP}>
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

export default function CvPage({ theme, onToggleTheme }) {
  const { t, lang } = useI18n()
  const copy = useCopy(t)
  const mounted = useMounted()
  const themedIcon = themedIconFor(theme)
  const updated = formatUpdated(CV_UPDATED, lang)

  const projects = CV_PROJECT_IDS.map((id) => projectsList.find((project) => project.id === id)).filter(Boolean)

  const print = () => window.print()

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[880px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8 print:hidden">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
            <span>{t('proj.backHome')}</span>
          </a>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={print}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200"
            >
              <Icon name="download" className="h-4 w-4" />
              <span className="hidden sm:inline">{t('cv.print')}</span>
            </button>
            <CommandButton className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-strong transition-colors duration-200" />
            <ThemeToggle
              theme={theme}
              onToggle={onToggleTheme}
              className="text-ink-muted hover:text-ink-strong transition-colors duration-200"
            />
          </div>
        </div>
      </header>

      <main
        id="cv"
        className="w-full max-w-[880px] mx-auto px-5 sm:px-8 pt-24 pb-24 flex flex-col items-start min-h-screen bg-bg animate-rise-in print:pt-0 print:pb-0"
      >
        {/* Identity */}
        <section aria-labelledby="cv-name" className="w-full mb-14 text-left">
          <p className={`${KICKER} mb-4 flex flex-wrap items-center gap-x-2 gap-y-1`}>
            <span>{t('cv.kicker')}</span>
            <span aria-hidden="true">/</span>
            <span>{CV_LOCATION}</span>
          </p>
          <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-[1fr_auto] md:gap-12">
            <div className="max-w-[600px]">
              <h1 id="cv-name" className="text-[34px] sm:text-[40px] font-bold text-ink-strong tracking-[-0.035em] leading-tight">
                {CV_NAME}
                <span className="ms-3 align-middle font-mono text-[13px] font-normal tracking-normal text-ink-subtle">@{CV_HANDLE}</span>
              </h1>
              <p className="mt-3 text-[16px] font-medium leading-snug text-ink-secondary">{copy(CV_ROLE)}</p>
              <p className="mt-1 text-[13.5px] text-ink-muted">{copy(CV_STATUS)}</p>
              <p className="mt-5 text-[14px] leading-relaxed text-ink-muted">{CV_SUMMARY}</p>
            </div>

            <dl className="flex flex-col gap-2.5 md:min-w-[240px] md:border-s md:border-dashed md:border-line md:ps-8">
              {CV_CONTACT.map((item) => (
                <ContactRow key={item.label} item={item} mounted={mounted} />
              ))}
              <div className="flex items-baseline gap-3">
                <dt className="w-[64px] shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle">{t('cv.timezone')}</dt>
                <dd className="text-[13px] text-ink-secondary">{CV_TIMEZONE}</dd>
              </div>
            </dl>
          </div>

          <dl className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-ink-subtle">
            <div className="flex items-center gap-2">
              <dt className="font-mono uppercase tracking-wider text-[10.5px]">{t('cv.updated')}</dt>
              <dd>
                <time dateTime={CV_UPDATED} className="text-ink-secondary">
                  {updated}
                </time>
              </dd>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <dt className="sr-only">{t('cv.print')}</dt>
              <dd>
                <button type="button" onClick={print} className={`${LINK} inline-flex items-center gap-1.5`}>
                  <Icon name="download" className="h-3.5 w-3.5" />
                  <span>{t('cv.printHint')}</span>
                </button>
              </dd>
            </div>
          </dl>
        </section>

        {/* Experience */}
        <section aria-labelledby="cv-experience" className="w-full mb-14">
          <SectionHeading id="cv-experience" kicker="01" title={t('home.experience')} />
          <ol className="w-full">
            {CV_EXPERIENCE.map((entry, index) => (
              <ExperienceRow key={index} entry={entry} copy={copy} t={t} />
            ))}
          </ol>
        </section>

        {/* Projects */}
        <section aria-labelledby="cv-projects" className="w-full mb-14">
          <SectionHeading id="cv-projects" kicker="02" title={t('cv.projects')} />
          <ol className="w-full">
            {projects.map((project) => (
              <ProjectRow key={project.id} project={project} t={t} />
            ))}
          </ol>
          <a {...link(PROJECTS_PATH)} className="group mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted transition-colors duration-200 hover:text-ink-strong print:hidden">
            <span>{t('home.browseAll')}</span>
            <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </a>
        </section>

        {/* Education */}
        <section aria-labelledby="cv-education" className="w-full mb-14">
          <SectionHeading id="cv-education" kicker="03" title={t('cv.education')} />
          <ol className="w-full">
            {CV_EDUCATION.map((entry, index) => (
              <li key={index} className={ROW}>
                <div className={PERIOD}>{formatPeriod(entry.period, t)}</div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-ink-strong">
                    {copy(entry.degree)}
                    <span className="font-normal text-ink-subtle"> · </span>
                    <span className="font-normal text-ink-muted">{copy(entry.org)}</span>
                  </h3>
                  {entry.note && <p className="mt-1.5 max-w-[600px] text-[13px] leading-relaxed text-ink-muted">{entry.note}</p>}
                  {entry.highlights?.length > 0 && (
                    <ul className="mt-3.5 flex flex-wrap gap-1.5">
                      {entry.highlights.map((subject) => (
                        <li key={subject.key || subject} className="rounded-md border border-line bg-surface-raised/60 px-2.5 py-1 text-[11.5px] text-ink-muted">
                          {copy(subject)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Skills */}
        <section aria-labelledby="cv-skills" className="w-full mb-14">
          <SectionHeading id="cv-skills" kicker="04" title={t('home.skills')} />
          <div className="w-full">
            {CV_SKILLS.map((group) => (
              <div key={group.nameKey} className={ROW}>
                <div className={`${PERIOD} uppercase tracking-wider`}>{t(group.nameKey)}</div>
                <ul className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <li key={item.name} className="flex items-center justify-between gap-4 text-[13px] text-ink-secondary">
                      <span className="inline-flex items-center gap-2">
                        <img src={themedIcon(item.icon)} alt="" width="14" height="14" loading="lazy" className="h-3.5 w-3.5 shrink-0 print:hidden" />
                        {item.name}
                      </span>
                      {item.level && <LevelMeter level={item.level} label={t(SKILL_LEVELS[item.level].key)} />}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {CV_TOOLS.map((group) => (
              <div key={group.nameKey} className={ROW}>
                <div className={`${PERIOD} uppercase tracking-wider`}>{t(group.nameKey)}</div>
                <ul className="flex flex-wrap gap-x-5 gap-y-2">
                  {group.items.map((item) => (
                    <li key={item.name} className="inline-flex items-center gap-2 text-[13px] text-ink-secondary">
                      <img src={themedIcon(item.icon)} alt="" width="14" height="14" loading="lazy" className="h-3.5 w-3.5 shrink-0 print:hidden" />
                      {item.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Certifications + Languages */}
        <section aria-labelledby="cv-certs" className="w-full mb-14">
          <SectionHeading id="cv-certs" kicker="05" title={t('cv.certsAndLanguages')} />
          <div className="grid w-full grid-cols-1 gap-x-12 md:grid-cols-2">
            <div>
              <p className={`${KICKER} mb-1 mt-4`}>{t('cv.certifications')}</p>
              <ul>
                {CV_CERTIFICATIONS.map((cert, index) => (
                  <li key={index} className="flex items-baseline justify-between gap-4 border-b border-dashed border-line py-3 last:border-b-0 text-[13px]">
                    <span className="text-ink-secondary">
                      {cert.name}
                      <span className="text-ink-subtle"> · </span>
                      <span className="text-ink-muted">{t(cert.tierKey)}</span>
                    </span>
                    <span className="font-mono text-[10.5px] text-ink-subtle">{cert.issuer}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10.5px] text-ink-faint">{t('cert.note')}</p>
            </div>
            <div>
              <p className={`${KICKER} mb-1 mt-4`}>{t('cv.languages')}</p>
              <ul>
                {CV_LANGUAGES.map((item) => (
                  <li key={item.name} className="flex items-baseline justify-between gap-4 border-b border-dashed border-line py-3 last:border-b-0 text-[13px]">
                    <span className="text-ink-secondary">{item.name}</span>
                    <span className="font-mono text-[10.5px] text-ink-subtle">{item.level}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full max-w-[640px] border-t border-dashed border-line pt-8 print:hidden">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {t('cv.footer')}{' '}
            <a {...link(NOW_PATH)} className={LINK}>
              /now
            </a>
            .
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(PROJECTS_PATH)} className="group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong">
              <span>{t('proj.archiveTitle')}</span>
              <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </a>
            <button type="button" onClick={print} className="group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong">
              <span>{t('cv.print')}</span>
              <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}
