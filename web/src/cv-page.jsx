import ThemeToggle from './components/theme-toggle'
import { CommandButton } from './components/command-button'
import { Icon } from './components/icon'
import { link, HOME_PATH } from './lib/router'
import { MailTo, Sensitive, useMounted } from './components/sensitive'
import {
  CV_UPDATED,
  CV_NAME,
  CV_LOCATION,
  CV_ROLE,
  CV_SUMMARY,
  CV_CONTACT,
  CV_EXPERIENCE,
  CV_EDUCATION,
  CV_SKILLS,
  CV_LANGUAGES,
} from './lib/cv'

const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-ink-subtle'
const ROW = 'grid grid-cols-1 gap-1 py-3 sm:grid-cols-[6.5rem_1fr] sm:gap-6'
const PERIOD = 'font-mono text-[11.5px] tabular-nums text-ink-subtle sm:pt-[2px]'
const LINK = 'text-ink-secondary underline decoration-line-strong underline-offset-4 transition-colors duration-200 hover:text-ink-strong hover:decoration-ink-strong'

function formatUpdated(iso) {
  const date = new Date(`${iso}T00:00:00Z`)
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
  } catch {
    return iso
  }
}

function formatPeriod(period) {
  if (!period) return ''
  const end = period.present ? 'Now' : period.to
  if (!end || end === period.from) return period.from
  return `${period.from} – ${end}`
}

function Section({ id, title, children }) {
  return (
    <section aria-labelledby={id} className="w-full border-t border-line pt-6 pb-8">
      <h2 id={id} className={`${LABEL} mb-2`}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Contact({ item, mounted }) {
  if (item.sensitive) {
    return (
      <MailTo email={item.value} className={LINK}>
        <Sensitive interactive={false}>{mounted ? item.value : '•'.repeat(20)}</Sensitive>
      </MailTo>
    )
  }
  return (
    <a href={item.href} target="_blank" rel="noreferrer" className={LINK}>
      {item.value}
    </a>
  )
}

export default function CvPage({ theme, onToggleTheme }) {
  const mounted = useMounted()
  const print = () => window.print()
  const skills = CV_SKILLS.filter((group) => !group.minor).flatMap((group) => group.items.map((item) => item.name))

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-selection selection:text-ink-strong relative overflow-x-hidden antialiased font-sans animate-view-in">
      <header className="w-full max-w-[720px] bg-bg/90 backdrop-blur-md text-ink h-14 fixed left-1/2 -translate-x-1/2 z-40 border-b border-line top-0 flex items-center px-5 sm:px-8 print:hidden">
        <div className="w-full flex items-center justify-between">
          <a
            {...link(HOME_PATH)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200 cursor-pointer"
          >
            <span>←</span>
            <span>Home</span>
          </a>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={print}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink-strong transition-colors duration-200"
            >
              <Icon name="download" className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
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
        className="w-full max-w-[720px] mx-auto px-5 sm:px-8 pt-28 pb-24 flex flex-col items-start bg-bg animate-rise-in print:pt-0 print:pb-0"
      >
        <section aria-labelledby="cv-name" className="w-full pb-10">
          <h1 id="cv-name" className="text-[30px] sm:text-[34px] font-semibold text-ink-strong tracking-[-0.03em] leading-tight">
            {CV_NAME}
          </h1>
          <p className="mt-2 text-[14.5px] text-ink-secondary">{CV_ROLE}</p>
          <p className="mt-5 max-w-[580px] text-[14px] leading-relaxed text-ink-muted">{CV_SUMMARY}</p>
          <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
            <span>{CV_LOCATION}</span>
            {CV_CONTACT.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="text-ink-faint">·</span>
                <Contact item={item} mounted={mounted} />
              </span>
            ))}
          </p>
        </section>

        <Section id="cv-experience" title="Experience">
          <ol className="w-full">
            {CV_EXPERIENCE.map((entry) => (
              <li key={entry.org} className={ROW}>
                <div className={PERIOD}>{formatPeriod(entry.period)}</div>
                <div className="min-w-0">
                  <h3 className="text-[14.5px] font-medium leading-snug text-ink-strong">
                    {entry.role}
                    <span className="text-ink-subtle"> · </span>
                    {entry.url ? (
                      <a href={entry.url} target="_blank" rel="noreferrer" className="font-normal text-ink-muted transition-colors duration-200 hover:text-ink-strong">
                        {entry.org}
                      </a>
                    ) : (
                      <span className="font-normal text-ink-muted">{entry.org}</span>
                    )}
                  </h3>
                  {entry.summary && <p className="mt-1 max-w-[560px] text-[13px] leading-relaxed text-ink-muted">{entry.summary}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="cv-education" title="Education">
          <ol className="w-full">
            {CV_EDUCATION.map((entry) => (
              <li key={entry.degree} className={ROW}>
                <div className={PERIOD}>{formatPeriod(entry.period)}</div>
                <div className="min-w-0">
                  <h3 className="text-[14.5px] font-medium leading-snug text-ink-strong">
                    {entry.degree}
                    <span className="text-ink-subtle"> · </span>
                    <span className="font-normal text-ink-muted">{entry.org}</span>
                  </h3>
                  {entry.note && <p className="mt-1 max-w-[560px] text-[13px] leading-relaxed text-ink-muted">{entry.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="cv-skills" title="Skills">
          <p className="py-3 text-[13.5px] leading-relaxed text-ink-secondary">{skills.join(', ')}</p>
        </Section>

        <Section id="cv-languages" title="Languages">
          <p className="py-3 text-[13.5px] text-ink-secondary">
            {CV_LANGUAGES.map((item, index) => (
              <span key={item.name}>
                {index > 0 && <span aria-hidden="true" className="text-ink-faint"> · </span>}
                {item.name} <span className="text-ink-subtle">({item.level})</span>
              </span>
            ))}
          </p>
        </Section>

        <p className="w-full border-t border-line pt-6 font-mono text-[11px] text-ink-faint">
          Updated <time dateTime={CV_UPDATED}>{formatUpdated(CV_UPDATED)}</time>
        </p>
      </main>
    </div>
  )
}
