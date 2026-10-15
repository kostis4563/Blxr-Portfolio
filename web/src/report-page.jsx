import { Fragment, useEffect, useId, useRef, useState } from 'react'
import {
  parseLink,
  loadReport,
  reportApiBase,
  summarize,
  errorState,
  safeHref,
  formatWhen,
  SEVERITIES,
  SEVERITY_LABEL,
  LOADING_STATE,
  INCOMPLETE_STATE,
  DEFAULT_TITLE,
} from './lib/report'

const THEME_KEY = 'blxr-theme'
const PAD = 'px-4 sm:px-8'
const RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/40'
const CAPS = 'font-mono text-[11px] uppercase tracking-[0.06em]'
const PRE = 'max-h-[28rem] overflow-auto whitespace-pre rounded-lg border px-3.5 py-3 font-mono text-[12px] leading-5 [tab-size:4]'

const tone = (severity) => ({ '--sev': `var(--sev-${severity})` })

function useReport() {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let current = 0
    const load = () => {
      const run = ++current
      const link = parseLink(window.location.hash)
      if (!link) {
        setState({ status: 'incomplete' })
        return
      }
      setState({ status: 'loading' })
      loadReport(link, reportApiBase(window.location.search))
        .then(({ report, expiresAt }) => ({ status: 'ready', id: link.id, summary: summarize(report), expiresAt }))
        .catch((error) => ({ status: 'error', ...errorState(error) }))
        .then((next) => {
          if (run === current) setState(next)
        })
    }
    load()
    window.addEventListener('hashchange', load)
    return () => {
      current += 1
      window.removeEventListener('hashchange', load)
    }
  }, [])

  return state
}

function useThemeToggle() {
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    const root = document.documentElement
    root.dataset.theme = next
    root.style.colorScheme = next
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
    }
    setTheme(next)
  }
  return [theme, toggle]
}

function SunIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

function Chevron({ className = '' }) {
  return (
    <svg className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  )
}

function TopBar() {
  const [theme, toggle] = useThemeToggle()
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <header className={`flex h-14 shrink-0 items-center justify-between gap-4 border-b border-dashed border-line ${PAD}`}>
      <a href="/" className={`inline-flex items-center gap-2 rounded-md text-[13px] font-medium text-ink-muted transition-colors duration-200 hover:text-ink-strong ${RING}`}>
        <span aria-hidden="true">←</span>
        <span>blxr.net</span>
      </a>
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className={`-mr-2 grid h-9 w-9 cursor-pointer place-items-center rounded-md text-ink-muted transition-colors duration-200 hover:text-ink-strong ${RING}`}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  )
}

function State({ title, message }) {
  return (
    <section className="px-4 py-24 text-center sm:py-32">
      <h1 className="font-serif text-[26px] font-normal italic leading-tight text-ink-strong sm:text-[30px]">{title}</h1>
      <p className="mx-auto mt-3 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-subtle [overflow-wrap:anywhere]">{message}</p>
    </section>
  )
}

function Grade({ grade, severity }) {
  return (
    <div
      role="img"
      aria-label={grade ? `Grade ${grade}` : 'No grade'}
      title="Overall grade"
      style={severity ? tone(severity) : undefined}
      className={`grid h-16 w-16 shrink-0 place-items-center rounded-[14px] border font-serif text-[32px] font-normal italic leading-none sm:h-[72px] sm:w-[72px] sm:text-[36px] ${
        severity
          ? 'border-(--sev)/30 bg-(--sev)/8 text-(--sev) shadow-[0_0_36px_-14px_var(--sev)]'
          : 'border-line-strong bg-surface text-ink-faint'
      }`}
    >
      {grade || '—'}
    </div>
  )
}

function Chip({ severity, label, count, active, onClick }) {
  const look = active
    ? severity
      ? 'border-(--sev)/45 bg-(--sev)/12 text-(--sev)'
      : 'border-line-strong bg-surface-hover text-ink-strong'
    : 'border-line text-ink-muted hover:border-line-strong hover:text-ink-strong'
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={severity ? tone(severity) : undefined}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium leading-none transition-colors duration-200 ${look} ${RING}`}
    >
      {severity && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-(--sev)" />}
      <span>{label}</span>
      <span className="tabular-nums opacity-75">{count}</span>
    </button>
  )
}

function CopyButton({ value, label }) {
  const [state, setState] = useState('idle')
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    let next = 'copied'
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      next = 'failed'
    }
    setState(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1600)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-ink-subtle transition-colors duration-200 hover:bg-surface-hover hover:text-ink-strong ${RING}`}
    >
      {state === 'copied' ? (
        <svg className="h-3 w-3 text-(--sev)" style={tone('info')} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L20 7" />
        </svg>
      ) : (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15V6a2 2 0 0 1 2-2h8" />
        </svg>
      )}
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}</span>
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 py-2 sm:grid-cols-[88px_minmax(0,1fr)]">
      <dt className={`${CAPS} pt-[3px] text-ink-faint`}>{label}</dt>
      <dd className="min-w-0 whitespace-pre-line text-[13px] leading-relaxed text-ink-secondary [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

function Captured({ content }) {
  const [open, setOpen] = useState(false)
  const lines = content.split('\n').length
  return (
    <details className="group/captured mt-4" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary
        className={`${CAPS} mb-1.5 inline-flex cursor-pointer list-none select-none items-center gap-1.5 rounded text-ink-faint transition-colors duration-200 hover:text-ink-muted ${RING} [&::-webkit-details-marker]:hidden`}
      >
        <Chevron className="h-3 w-3 -rotate-90 transition-transform duration-200 group-open/captured:rotate-0" />
        <span>Captured file contents</span>
        <span className="normal-case tracking-normal">· {lines === 1 ? '1 line' : `${lines} lines`}</span>
      </summary>
      {open && <pre className={`${PRE} border-line bg-surface text-ink-secondary`}>{content}</pre>}
    </details>
  )
}

export function FindingDetails({ id, finding }) {
  const href = finding.reference ? safeHref(finding.reference) : null
  const hasFields = finding.detail || finding.exploit || finding.remediation || finding.reference
  return (
    <div id={id} className="min-w-0 pb-6 pl-9 pr-4 sm:pl-[52px] sm:pr-8">
      {hasFields && (
        <dl className="divide-y divide-dashed divide-line">
          {finding.detail && <Field label="Detail">{finding.detail}</Field>}
          {finding.exploit && <Field label={finding.category === 'Performance' ? 'Impact' : 'Exploit'}>{finding.exploit}</Field>}
          {finding.remediation && <Field label="Fix">{finding.remediation}</Field>}
          {finding.reference && (
            <Field label="Ref">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded text-ink-strong underline decoration-line-strong underline-offset-2 transition-colors duration-200 hover:decoration-ink-strong ${RING}`}
                >
                  {finding.reference}
                </a>
              ) : (
                finding.reference
              )}
            </Field>
          )}
        </dl>
      )}
      {finding.evidence && (
        <div className="mt-4">
          <p className={`${CAPS} mb-1.5 text-ink-faint`}>Evidence</p>
          <pre className={`${PRE} border-line bg-surface text-ink-secondary`}>{finding.evidence}</pre>
        </div>
      )}
      {finding.reproduction && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className={`${CAPS} text-brand-purple`}>Proof of concept</p>
            <CopyButton value={finding.reproduction} label="proof of concept" />
          </div>
          <pre className={`${PRE} border-brand-purple/25 bg-brand-purple/5 text-ink`}>{finding.reproduction}</pre>
        </div>
      )}
      {finding.capturedContent && <Captured content={finding.capturedContent} />}
    </div>
  )
}

function FindingRow({ finding, open, onToggle }) {
  const bodyId = `${useId()}-body`
  return (
    <li style={tone(finding.severity)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        className={`flex w-full cursor-pointer items-center gap-3 py-4 text-left outline-none transition-colors duration-200 hover:bg-surface-hover/50 focus-visible:bg-surface-hover/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-strong/30 sm:gap-4 ${PAD}`}
      >
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-(--sev) shadow-[0_0_10px_var(--sev)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-snug text-ink-strong [overflow-wrap:anywhere]">{finding.title || 'Untitled finding'}</span>
          <span className="mt-1 flex min-w-0 items-center gap-2 font-mono text-[11.5px] leading-5 text-ink-subtle">
            <span className="shrink-0 rounded bg-(--sev)/14 px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.06em] text-(--sev)">
              {SEVERITY_LABEL[finding.severity]}
            </span>
            {finding.category && <span className="max-w-[40%] shrink-0 truncate text-ink-faint">{finding.category}</span>}
            {finding.location && (
              <span className="min-w-0 truncate" title={finding.location}>
                {finding.location}
              </span>
            )}
          </span>
        </span>
        <Chevron className={`h-4 w-4 text-ink-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <FindingDetails id={bodyId} finding={finding} />}
    </li>
  )
}

function Subline({ total, worst, finishedAt }) {
  const scanned = formatWhen(finishedAt)
  const parts = [
    <span key="count">{total === 0 ? 'No findings' : total === 1 ? '1 finding' : `${total} findings`}</span>,
    worst && (
      <span key="worst">
        worst severity{' '}
        <span style={tone(worst)} className="font-medium text-(--sev)">
          {SEVERITY_LABEL[worst]}
        </span>
      </span>
    ),
    scanned && (
      <span key="scanned">
        scanned <time dateTime={finishedAt}>{scanned}</time>
      </span>
    ),
  ].filter(Boolean)
  return (
    <p className="mt-2 text-[13px] leading-relaxed text-ink-subtle">
      {parts.map((part, index) => (
        <Fragment key={part.key}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          {part}
        </Fragment>
      ))}
    </p>
  )
}

function ReportFooter({ generator, expires }) {
  return (
    <footer className={`pt-6 pb-12 text-[12px] leading-relaxed text-ink-subtle ${PAD}`}>
      <p>
        <span
          style={tone('info')}
          className="mr-2 inline-block rounded-md border border-(--sev)/35 px-1.5 py-[3px] align-[1px] font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.15em] text-(--sev)"
        >
          E2E encrypted
        </span>
        Decrypted in your browser — the key is in this link and never reaches blxr.net.{' '}
        {expires && <strong className="font-semibold text-ink-secondary">Link expires {expires}. </strong>}
        Generated by {generator}. For authorized security testing only — verify findings before acting.
      </p>
    </footer>
  )
}

export function ReportView({ summary, expiresAt }) {
  const { findings, counts, worst } = summary
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(() => new Set())
  const total = findings.length
  const shown = filter === 'all' ? findings : findings.filter((finding) => finding.severity === filter)

  const toggle = (key) =>
    setOpen((previous) => {
      const next = new Set(previous)
      if (!next.delete(key)) next.add(key)
      return next
    })

  return (
    <>
      <section aria-labelledby="report-title" className={`border-b border-dashed border-line py-7 sm:py-9 ${PAD}`}>
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.2em] text-ink-subtle">{summary.eyebrow}</p>
            <h1 id="report-title" className="mt-2.5 font-mono text-[17px] font-normal leading-snug text-ink-strong [overflow-wrap:anywhere] sm:text-[19px]">
              {summary.url || 'Untitled scan'}
            </h1>
            <Subline total={total} worst={worst} finishedAt={summary.finishedAt} />
          </div>
          <Grade grade={summary.grade} severity={summary.gradeSeverity} />
        </div>
        {total > 0 && (
          <div role="group" aria-label="Filter findings by severity" className="mt-6 flex flex-wrap gap-1.5">
            <Chip label="All" count={total} active={filter === 'all'} onClick={() => setFilter('all')} />
            {SEVERITIES.filter((severity) => counts[severity] > 0).map((severity) => (
              <Chip
                key={severity}
                severity={severity}
                label={SEVERITY_LABEL[severity]}
                count={counts[severity]}
                active={filter === severity}
                onClick={() => setFilter((current) => (current === severity ? 'all' : severity))}
              />
            ))}
          </div>
        )}
      </section>

      {total > 0 ? (
        <ul aria-label="Findings" className="divide-y divide-dashed divide-line border-b border-dashed border-line">
          {shown.map((finding) => (
            <FindingRow key={finding.key} finding={finding} open={open.has(finding.key)} onToggle={() => toggle(finding.key)} />
          ))}
        </ul>
      ) : (
        <section className="border-b border-dashed border-line px-4 py-20 text-center sm:py-24">
          <p className="font-serif text-[28px] font-normal italic leading-tight text-ink-strong sm:text-[32px]">All clear.</p>
          <p className="mx-auto mt-3 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-subtle [overflow-wrap:anywhere]">
            The scan finished without flagging anything
            {summary.host && (
              <>
                {' on '}
                <span className="font-mono text-ink-secondary">{summary.host}</span>
              </>
            )}
            .
          </p>
        </section>
      )}

      <ReportFooter generator={summary.generator} expires={formatWhen(expiresAt)} />
    </>
  )
}

export default function ReportPage() {
  const state = useReport()

  useEffect(() => {
    document.title = state.status === 'ready' ? state.summary.title : DEFAULT_TITLE
  }, [state])

  let content
  if (state.status === 'ready') content = <ReportView key={state.id} summary={state.summary} expiresAt={state.expiresAt} />
  else if (state.status === 'incomplete') content = <State {...INCOMPLETE_STATE} />
  else if (state.status === 'error') content = <State title={state.title} message={state.message} />
  else content = <State {...LOADING_STATE} />

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[960px] flex-col border-x border-dashed border-line bg-bg text-ink">
      <TopBar />
      <main aria-busy={state.status === 'loading'} className="flex min-w-0 flex-1 flex-col">
        {content}
      </main>
    </div>
  )
}
