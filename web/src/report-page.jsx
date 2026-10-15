import { useEffect, useId, useRef, useState } from 'react'
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
const WRAP = 'mx-auto w-full max-w-[760px] px-6'
const RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/40'
const LABEL = 'text-[12px] font-medium text-ink-subtle'
const CODE = 'max-h-[28rem] overflow-auto whitespace-pre rounded-lg border border-line bg-surface px-3.5 py-3 font-mono text-[12px] leading-[1.7] text-ink-secondary [tab-size:4]'

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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path fill="currentColor" d="M12 6c3.31 0 6 2.69 6 6c0 3.31 -2.69 6 -6 6c-3.31 0 -6 -2.69 -6 -6c0 -3.31 2.69 -6 6 -6Z" />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        d="M12 21v1M21 12h1M12 3v-1M3 12h-1M18.5 18.5l0.5 0.5M18.5 5.5l0.5 -0.5M5.5 5.5l-0.5 -0.5M5.5 18.5l-0.5 0.5"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="7" rx="1.75" />
      <path strokeLinecap="round" d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  )
}

function Chevron({ className = '' }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 6.5 3.5 3.5 3.5-3.5" />
    </svg>
  )
}

function TopBar() {
  const [theme, toggle] = useThemeToggle()
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className={`${WRAP} flex h-14 items-center justify-between gap-4`}>
        <div className="flex min-w-0 items-center gap-2.5 text-[13.5px]">
          <a href="/" className={`rounded font-semibold tracking-tight text-ink-strong ${RING}`}>
            blxr
          </a>
          <span aria-hidden="true" className="text-ink-faint">
            /
          </span>
          <span className="truncate text-ink-muted">Security report</span>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={label}
          title={label}
          className={`-mr-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-subtle transition-colors duration-200 hover:text-ink-strong focus-visible:text-ink-strong ${RING}`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  )
}

function Footer({ children }) {
  return (
    <footer className={`${WRAP} mt-auto`}>
      <div className="flex gap-2.5 border-t border-line py-8 text-[12px] leading-relaxed text-ink-subtle">
        <span className="mt-[3px] text-ink-muted">
          <LockIcon />
        </span>
        <p className="max-w-[68ch]">
          <span className="font-medium text-ink-muted">E2E encrypted.</span> Decrypted in your browser. The key lives in this link and never reaches blxr.net.
          {children}
        </p>
      </div>
    </footer>
  )
}

function State({ title, message, busy = false }) {
  return (
    <>
      <section className={`${WRAP} pt-20 pb-24`}>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-strong">
          {title}
          {busy && (
            <span aria-hidden="true" className="dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          )}
        </h1>
        <p className="mt-2 max-w-[54ch] text-[14px] leading-relaxed text-ink-muted [overflow-wrap:anywhere]">{message}</p>
      </section>
      <Footer />
    </>
  )
}

function Dot({ className = '' }) {
  return <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full bg-(--sev) ${className}`} />
}

function Grade({ grade, severity }) {
  return (
    <div role="img" aria-label={grade ? `Grade ${grade}` : 'No grade'} title="Overall grade" className="flex shrink-0 flex-col items-center gap-1.5">
      <span
        aria-hidden="true"
        style={severity ? tone(severity) : undefined}
        className={`grid h-12 w-12 place-items-center rounded-xl border border-line bg-surface text-[21px] font-semibold tracking-tight ${
          severity ? 'text-(--sev)' : 'text-ink-faint'
        }`}
      >
        {grade || '—'}
      </span>
      <span aria-hidden="true" className="text-[11px] text-ink-subtle">
        Grade
      </span>
    </div>
  )
}

function Tab({ label, count, severity, active, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${label}: ${count}`}
      onClick={onClick}
      style={severity ? tone(severity) : undefined}
      className={`relative flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-sm text-[13px] outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-strong/40 ${
        active ? 'text-ink-strong after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink-strong' : 'text-ink-muted hover:text-ink-strong'
      }`}
    >
      {severity && <Dot className="h-1.5 w-1.5" />}
      <span>{label}</span>
      <span className="tabular-nums text-ink-faint">{count}</span>
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
      className={`-mr-1.5 inline-flex h-6 shrink-0 cursor-pointer items-center rounded-md px-1.5 text-[12px] text-ink-subtle transition-colors duration-200 hover:text-ink-strong ${RING}`}
    >
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}</span>
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-[13.5px] leading-[1.65] text-ink-secondary [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

function Captured({ content }) {
  const [open, setOpen] = useState(false)
  const lines = content.split('\n').length
  return (
    <details className="group/captured" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary
        className={`inline-flex cursor-pointer list-none select-none items-center gap-1 rounded text-[12.5px] text-ink-muted transition-colors duration-200 hover:text-ink-strong ${RING} [&::-webkit-details-marker]:hidden`}
      >
        Captured file contents
        <span className="text-ink-faint">· {lines === 1 ? '1 line' : `${lines} lines`}</span>
        <Chevron className="h-3.5 w-3.5 transition-transform duration-200 group-open/captured:rotate-180" />
      </summary>
      {open && <pre className={`mt-2 ${CODE}`}>{content}</pre>}
    </details>
  )
}

export function FindingDetails({ id, finding }) {
  const href = finding.reference ? safeHref(finding.reference) : null
  const hasFields = finding.detail || finding.exploit || finding.remediation || finding.reference
  return (
    <div id={id} className="reveal flex min-w-0 flex-col gap-5 pb-6 pl-6">
      {hasFields && (
        <dl className="flex flex-col gap-4">
          {finding.detail && <Field label="Detail">{finding.detail}</Field>}
          {finding.exploit && <Field label={finding.category === 'Performance' ? 'Impact' : 'Exploit'}>{finding.exploit}</Field>}
          {finding.remediation && <Field label="Fix">{finding.remediation}</Field>}
          {finding.reference && (
            <Field label="Reference">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded text-ink-strong underline decoration-line-strong underline-offset-4 transition-colors duration-200 hover:decoration-ink-muted ${RING}`}
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
        <div>
          <p className={`mb-1.5 ${LABEL}`}>Evidence</p>
          <pre className={CODE}>{finding.evidence}</pre>
        </div>
      )}
      {finding.reproduction && (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className={LABEL}>Proof of concept</p>
            <CopyButton value={finding.reproduction} label="proof of concept" />
          </div>
          <pre className={`${CODE} text-ink-strong`}>{finding.reproduction}</pre>
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
        className="group flex w-full cursor-pointer items-start gap-4 rounded-sm py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ink-strong/30"
      >
        <Dot className="mt-[7px]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium leading-snug text-ink-strong transition-colors duration-200 [overflow-wrap:anywhere] group-hover:text-ink">
            {finding.title || 'Untitled finding'}
          </span>
          <span className="mt-1 flex min-w-0 items-baseline gap-1.5 text-[12.5px] leading-5 text-ink-subtle">
            <span className="shrink-0 text-ink-muted">{SEVERITY_LABEL[finding.severity]}</span>
            {finding.category && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span className="hidden max-w-[40%] shrink-0 truncate sm:inline">{finding.category}</span>
              </>
            )}
            {finding.location && (
              <>
                <span aria-hidden="true">·</span>
                <span className="min-w-0 truncate font-mono text-[11.5px]" title={finding.location}>
                  {finding.location}
                </span>
              </>
            )}
          </span>
        </span>
        <Chevron className="mt-0.5 h-4 w-4 text-ink-faint transition-[transform,color] duration-200 group-hover:text-ink-muted group-aria-expanded:rotate-180" />
      </button>
      {open && <FindingDetails id={bodyId} finding={finding} />}
    </li>
  )
}

export function ReportView({ summary, expiresAt }) {
  const { findings, counts } = summary
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(() => new Set())
  const total = findings.length
  const shown = filter === 'all' ? findings : findings.filter((finding) => finding.severity === filter)
  const scanned = formatWhen(summary.finishedAt)
  const expires = formatWhen(expiresAt)

  const toggle = (key) =>
    setOpen((previous) => {
      const next = new Set(previous)
      if (!next.delete(key)) next.add(key)
      return next
    })

  return (
    <>
      <section aria-labelledby="report-title" className={`${WRAP} rise pt-16 pb-10`}>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 id="report-title" className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink-strong [overflow-wrap:anywhere] sm:text-[30px]">
              {summary.host || 'Untitled scan'}
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-subtle">
              {summary.scan.replaceAll(' · ', ' · ')}
              {scanned && (
                <>
                  <span aria-hidden="true">{' · '}</span>
                  <time dateTime={summary.finishedAt}>{scanned}</time>
                </>
              )}
            </p>
          </div>
          <Grade grade={summary.grade} severity={summary.gradeSeverity} />
        </div>
      </section>

      <div style={{ '--d': '60ms' }} className={`${WRAP} rise`}>
        {total > 0 ? (
          <>
            <div
              role="group"
              aria-label="Filter findings by severity"
              className="flex gap-6 overflow-x-auto border-b border-line pr-6 [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,#000_80%,transparent)] [&::-webkit-scrollbar]:hidden"
            >
              <Tab label="All" count={total} active={filter === 'all'} onClick={() => setFilter('all')} />
              {SEVERITIES.filter((severity) => counts[severity] > 0).map((severity) => (
                <Tab
                  key={severity}
                  label={SEVERITY_LABEL[severity]}
                  count={counts[severity]}
                  severity={severity}
                  active={filter === severity}
                  onClick={() => setFilter((current) => (current === severity ? 'all' : severity))}
                />
              ))}
            </div>
            <ul aria-label="Findings" className="divide-y divide-line">
              {shown.map((finding) => (
                <FindingRow key={finding.key} finding={finding} open={open.has(finding.key)} onToggle={() => toggle(finding.key)} />
              ))}
            </ul>
          </>
        ) : (
          <div className="border-t border-line py-14">
            <p className="text-[15px] font-medium text-ink-strong">All clear.</p>
            <p className="mt-1.5 max-w-[50ch] text-[13.5px] leading-relaxed text-ink-muted [overflow-wrap:anywhere]">
              The scan finished without flagging anything
              {summary.host && (
                <>
                  {' on '}
                  <span className="font-mono text-[12.5px] text-ink-secondary">{summary.host}</span>
                </>
              )}
              .
            </p>
          </div>
        )}
      </div>

      <div className="h-16 shrink-0" />

      <Footer>
        {expires && ` Link expires ${expires}.`} Generated by {summary.generator}. For authorized security testing only.
      </Footer>
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
  else content = <State {...LOADING_STATE} busy />

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <TopBar />
      <main aria-busy={state.status === 'loading'} className="flex min-w-0 flex-1 flex-col">
        {content}
      </main>
    </div>
  )
}
