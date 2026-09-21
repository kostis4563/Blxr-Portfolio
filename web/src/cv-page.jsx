import { useEffect } from 'react'
import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { link, HOME_PATH, PROJECTS_PATH, projectPath } from './lib/router'
import { projectsList } from './lib/projects'
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
  CV_LANGUAGES,
} from './lib/cv'
import { SKILL_LEVELS, themedIconFor } from './lib/skills'

const KICKER = 'text-[11px] font-mono text-ink-subtle uppercase tracking-[0.18em]'
const CHIP = 'inline-flex items-center rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-[10.5px] text-ink-subtle'
const ROW = 'grid grid-cols-1 gap-1 border-b border-dashed border-line py-5 last:border-b-0 sm:grid-cols-[7.5rem_1fr] sm:gap-6'
const PERIOD = 'font-mono text-[11.5px] tabular-nums text-ink-subtle sm:pt-[3px]'
const LINK = 'text-ink-secondary underline decoration-line-strong underline-offset-4 transition-colors duration-200 hover:text-ink-strong hover:decoration-ink-strong'

const MAX_LEVEL = 4

function formatUpdated(iso) {
  const date = new Date(`${iso}T00:00:00Z`)
  try {
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date)
  } catch {
    return iso
  }
}

function formatPeriod(period) {
  if (!period) return ''
  const end = period.present ? 'Present' : period.to
  if (!end || end === period.from) return period.from
  return `${period.from} – ${end}`
}

function SectionHeading({ kicker, title, id }) {
  return (
    <div className="mb-2 flex w-full items-end justify-between gap-4">
      <div>
        <p className={`${KICKER} mb-2`}>{kicker}</p>
        <h2 id={id} className="scroll-mt-20 text-[22px] font-semibold tracking-tight text-ink-strong sm:text-[24px]">
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

function ExperienceRow({ entry }) {
  const org = entry.org
  return (
    <li className={ROW}>
      <div className={PERIOD}>
        <div>{formatPeriod(entry.period)}</div>
        {entry.location && <div className="mt-1 text-[10.5px] text-ink-faint">{entry.location}</div>}
      </div>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-ink-strong">
          {entry.role}
          <span className="font-normal text-ink-subtle"> · </span>
          {entry.url ? (
            <ExternalLink href={entry.url} className="font-normal text-ink-muted transition-colors duration-200 hover:text-ink-strong">
              {org}
            </ExternalLink>
          ) : (
            <span className="font-normal text-ink-muted">{org}</span>
          )}
        </h3>
        {entry.summary && <p className="mt-1.5 max-w-[600px] text-[13px] leading-relaxed text-ink-muted">{entry.summary}</p>}
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
          <ul className="mt-3.5 flex flex-wrap gap-1.5" aria-label="Stack">
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

function ProjectRow({ project }) {
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
            {project.category}
          </span>
        </h3>
        <p className="mt-1.5 max-w-[600px] text-[13px] leading-relaxed text-ink-muted">
          {project.shortDescription}
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
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Stack">
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
  const mounted = useMounted()
  const themedIcon = themedIconFor(theme)
  const updated = formatUpdated(CV_UPDATED)

  const projects = CV_PROJECT_IDS.map((id) => projectsList.find((project) => project.id === id)).filter(Boolean)

  const print = () => window.print()

  // Deep links such as /cv#cv-skills land on their section.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[960px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8 print:hidden">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
            <span>Back to Home</span>
          </a>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={print}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200"
            >
              <Icon name="download" className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
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
        className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-24 pb-24 flex flex-col items-start min-h-screen bg-bg animate-rise-in print:pt-0 print:pb-0"
      >
        {/* Identity */}
        <section aria-labelledby="cv-name" className="w-full mb-14 text-left">
          <p className={`${KICKER} mb-4 flex flex-wrap items-center gap-x-2 gap-y-1`}>
            <span>Curriculum vitae</span>
            <span aria-hidden="true">/</span>
            <span>{CV_LOCATION}</span>
          </p>
          <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-[1fr_auto] md:gap-12">
            <div className="max-w-[600px]">
              <h1 id="cv-name" className="text-[34px] sm:text-[40px] font-bold text-ink-strong tracking-[-0.035em] leading-tight">
                {CV_NAME}
                <span className="ms-3 align-middle font-mono text-[13px] font-normal tracking-normal text-ink-subtle">@{CV_HANDLE}</span>
              </h1>
              <p className="mt-3 text-[16px] font-medium leading-snug text-ink-secondary">{CV_ROLE}</p>
              <p className="mt-1 text-[13.5px] text-ink-muted">{CV_STATUS}</p>
              <p className="mt-5 text-[14px] leading-relaxed text-ink-muted">{CV_SUMMARY}</p>
            </div>

            <dl className="flex flex-col gap-2.5 md:min-w-[240px] md:border-s md:border-dashed md:border-line md:ps-8">
              {CV_CONTACT.map((item) => (
                <ContactRow key={item.label} item={item} mounted={mounted} />
              ))}
              <div className="flex items-baseline gap-3">
                <dt className="w-[64px] shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle">Time</dt>
                <dd className="text-[13px] text-ink-secondary">{CV_TIMEZONE}</dd>
              </div>
            </dl>
          </div>

          <dl className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-ink-subtle">
            <div className="flex items-center gap-2">
              <dt className="font-mono uppercase tracking-wider text-[10.5px]">Updated</dt>
              <dd>
                <time dateTime={CV_UPDATED} className="text-ink-secondary">
                  {updated}
                </time>
              </dd>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <dt className="sr-only">Print</dt>
              <dd>
                <button type="button" onClick={print} className={`${LINK} inline-flex items-center gap-1.5`}>
                  <Icon name="download" className="h-3.5 w-3.5" />
                  <span>Print or save as PDF</span>
                </button>
              </dd>
            </div>
          </dl>
        </section>

        {/* Experience */}
        <section aria-labelledby="cv-experience" className="w-full mb-14">
          <SectionHeading id="cv-experience" kicker="01" title="Experience" />
          <ol className="w-full">
            {CV_EXPERIENCE.map((entry, index) => (
              <ExperienceRow key={index} entry={entry} />
            ))}
          </ol>
        </section>

        {/* Projects */}
        <section aria-labelledby="cv-projects" className="w-full mb-14">
          <SectionHeading id="cv-projects" kicker="02" title="Selected projects" />
          <ol className="w-full">
            {projects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </ol>
          <a {...link(PROJECTS_PATH)} className="group mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted transition-colors duration-200 hover:text-ink-strong print:hidden">
            <span>All {projectsList.length} projects</span>
            <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </a>
        </section>

        {/* Education */}
        <section aria-labelledby="cv-education" className="w-full mb-14">
          <SectionHeading id="cv-education" kicker="03" title="Education" />
          <ol className="w-full">
            {CV_EDUCATION.map((entry, index) => (
              <li key={index} className={ROW}>
                <div className={PERIOD}>{formatPeriod(entry.period)}</div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-ink-strong">
                    {entry.degree}
                    <span className="font-normal text-ink-subtle"> · </span>
                    <span className="font-normal text-ink-muted">{entry.org}</span>
                  </h3>
                  {entry.note && <p className="mt-1.5 max-w-[600px] text-[13px] leading-relaxed text-ink-muted">{entry.note}</p>}
                  {entry.highlights?.length > 0 && (
                    <ul className="mt-3.5 flex flex-wrap gap-1.5">
                      {entry.highlights.map((subject) => (
                        <li key={subject.key || subject} className="rounded-md border border-line bg-surface-raised/60 px-2.5 py-1 text-[11.5px] text-ink-muted">
                          {subject}
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
          <SectionHeading id="cv-skills" kicker="04" title="Skills" />
          <div className="w-full">
            {CV_SKILLS.map((group) => (
              <div key={group.name} className={ROW}>
                <div className={`${PERIOD} uppercase tracking-wider`}>{group.name}</div>
                <ul className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <li key={item.name} className="flex items-center justify-between gap-4 text-[13px] text-ink-secondary">
                      <span className="inline-flex items-center gap-2">
                        <img src={themedIcon(item.icon)} alt="" width="14" height="14" loading="lazy" className="h-3.5 w-3.5 shrink-0 print:hidden" />
                        {item.name}
                      </span>
                      {item.level && <LevelMeter level={item.level} label={SKILL_LEVELS[item.level].label} />}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {CV_TOOLS.map((group) => (
              <div key={group.name} className={ROW}>
                <div className={`${PERIOD} uppercase tracking-wider`}>{group.name}</div>
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

        {/* Languages */}
        <section aria-labelledby="cv-languages" className="w-full mb-14">
          <SectionHeading id="cv-languages" kicker="05" title="Languages" />
          <ul className="w-full max-w-[640px]">
            {CV_LANGUAGES.map((item) => (
              <li key={item.name} className="flex items-baseline justify-between gap-4 border-b border-dashed border-line py-3 last:border-b-0 text-[13px]">
                <span className="text-ink-secondary">{item.name}</span>
                <span className="font-mono text-[10.5px] text-ink-subtle">{item.level}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Footer */}
        <footer className="w-full max-w-[640px] border-t border-dashed border-line pt-8 print:hidden">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            This is the formal version. For what I am working on at the moment, see{' '}
            <a {...link(PROJECTS_PATH)} className={LINK}>
              /projects
            </a>
            .
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium text-ink-muted">
            <a {...link(PROJECTS_PATH)} className="group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong">
              <span>Projects Archive</span>
              <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </a>
            <button type="button" onClick={print} className="group inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-strong">
              <span>Print</span>
              <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}
